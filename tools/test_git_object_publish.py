"""Offline safety tests; no GitHub calls or credentials."""
import unittest
from unittest.mock import Mock

from tools.git_object_publish import assert_sha, commit_payload, fast_forward, require_apply


class GitObjectPublishTests(unittest.TestCase):
    def test_commit_metadata_preserves_offset_message_and_parent(self):
        raw = (b'tree ' + b'a'*40 + b'\nparent ' + b'b'*40 +
               b'\nauthor Builder <dev@example.com> 0 +0800\n'
               b'committer Builder <dev@example.com> 0 +0800\n\nmessage\n')
        payload = commit_payload(raw)
        self.assertEqual(payload['author']['date'], '1970-01-01T08:00:00+08:00')
        self.assertEqual(payload['parents'], ['b'*40])
        self.assertEqual(payload['message'], 'message\n')

    def test_unsupported_headers_are_rejected_not_silently_rewritten(self):
        with self.assertRaises(ValueError):
            commit_payload(b'tree a\ngpgsig signed\n\nmessage\n')

    def test_sha_mismatch_stops_publication(self):
        with self.assertRaises(ValueError):
            assert_sha('a'*40, 'b'*40, 'commit')

    def test_default_is_no_write(self):
        with self.assertRaises(ValueError):
            require_apply(False)

    def test_remote_race_skips_reference_update(self):
        api = Mock(return_value={'object': {'sha': 'other'}})
        with self.assertRaises(ValueError):
            fast_forward(api, 'base', 'head')
        api.assert_called_once_with('GET', 'git/ref/heads/main')

    def test_reference_update_is_non_force_and_verified(self):
        api = Mock(side_effect=[{'object': {'sha': 'base'}}, {'object': {'sha': 'head'}}])
        fast_forward(api, 'base', 'head')
        self.assertEqual(api.call_args_list[1].args,
                         ('PATCH', 'git/refs/heads/main', {'sha': 'head', 'force': False}))


if __name__ == '__main__':
    unittest.main()
