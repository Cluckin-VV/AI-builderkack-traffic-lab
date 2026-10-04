"""Exact-object GitHub API fallback. Dry-run unless --apply; never force.

Uses the existing gh login, not a token in source or process arguments.
Official API: https://docs.github.com/en/rest/git/commits
https://docs.github.com/en/rest/git/trees
https://docs.github.com/en/rest/git/blobs
https://docs.github.com/en/rest/git/refs#update-a-reference
"""
import argparse
import base64
from datetime import datetime, timedelta, timezone
import json
from pathlib import Path
import re
import subprocess

ROOT = Path(__file__).resolve().parent.parent
REPO = 'Cluckin-VV/AI-builderkack-traffic-lab'


def git(*args):
    return subprocess.check_output(['git', *args], cwd=ROOT, timeout=30)


def api(method, endpoint, payload=None):
    command = ['gh', 'api', f'repos/{REPO}/{endpoint}', '--method', method,
               '-H', 'Accept: application/vnd.github+json',
               '-H', 'X-GitHub-Api-Version: 2022-11-28']
    body = None
    if payload is not None:
        command += ['--input', '-']
        body = json.dumps(payload, ensure_ascii=False).encode('utf-8')
    result = subprocess.run(command, input=body, capture_output=True, cwd=ROOT, timeout=60)
    if result.returncode:
        # Never print authentication headers, the request body or raw diagnostics.
        status = re.search(rb'HTTP \d{3}', result.stderr)
        raise RuntimeError(f'GitHub API {method} {endpoint.split("?")[0]} failed '
                           f'({status.group().decode() if status else "transport error"})')
    return json.loads(result.stdout)


def identity(value):
    match = re.fullmatch(r'(.*) <([^<>]+)> (\d+) ([+-]\d{4})', value)
    if not match:
        raise ValueError('Unsupported Git identity')
    name, email, stamp, offset = match.groups()
    minutes = (int(offset[1:3])*60+int(offset[3:])) * (1 if offset[0]=='+' else -1)
    return {'name': name, 'email': email,
            'date': datetime.fromtimestamp(int(stamp), timezone(timedelta(minutes=minutes))).isoformat()}


def commit_payload(raw):
    headers, message = raw.decode('utf-8').split('\n\n', 1)
    result = {'parents': [], 'message': message}
    for line in headers.splitlines():
        key, value = line.split(' ', 1)
        if key == 'parent':
            result['parents'].append(value)
        elif key in ('author', 'committer'):
            result[key] = identity(value)
        elif key == 'tree':
            result['tree'] = value
        else:
            raise ValueError('Signed/extended commits require a different upload path')
    if not all(key in result for key in ('author', 'committer', 'tree')):
        raise ValueError('Incomplete commit metadata')
    return result


def assert_sha(expected, actual, kind):
    if expected != actual:
        raise ValueError(f'{kind} SHA mismatch; reference NOT updated')


def require_apply(enabled):
    if not enabled:
        raise ValueError('Remote writes require explicit --apply')


def fast_forward(api_call, base, head):
    if api_call('GET', 'git/ref/heads/main')['object']['sha'] != base:
        raise ValueError('Remote main changed; reference NOT updated')
    result = api_call('PATCH', 'git/refs/heads/main', {'sha': head, 'force': False})
    assert_sha(head, result['object']['sha'], 'reference')


def entries(commit):
    result = {}
    for row in git('ls-tree', '-r', '-z', commit).split(b'\0'):
        if not row:
            continue
        meta, path = row.split(b'\t', 1)
        mode, kind, sha = meta.decode().split()
        if kind != 'blob':
            raise ValueError('Submodule/non-blob upload is not supported')
        result[path.decode('utf-8')] = {'mode': mode, 'type': kind, 'sha': sha}
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--apply', action='store_true')
    args = parser.parse_args()
    if git('status', '--porcelain').strip():
        raise ValueError('Commit/review the worktree before publication')
    head = git('rev-parse', 'main').decode().strip()
    base = api('GET', 'git/ref/heads/main')['object']['sha']
    if base == head:
        print(json.dumps({'already_synced': True, 'head': head})); return
    subprocess.run(['git', 'merge-base', '--is-ancestor', base, head], cwd=ROOT, check=True)
    commits = git('rev-list', '--reverse', f'{base}..{head}').decode().splitlines()
    previous = base
    for commit in commits:
        if commit_payload(git('cat-file', 'commit', commit))['parents'] != [previous]:
            raise ValueError('This bounded uploader supports only a linear fast-forward chain')
        previous = commit
    print(json.dumps({'dry_run': not args.apply, 'base': base, 'head': head,
                      'commits': commits}), flush=True)
    if not args.apply:
        return
    require_apply(args.apply)
    # Prove serialization preserves an EXISTING commit before uploading new assets.
    existing = api('POST', 'git/commits', commit_payload(git('cat-file', 'commit', base)))
    assert_sha(base, existing['sha'], 'existing commit roundtrip')
    base_tree = existing['tree']['sha']
    remote_tree = api('GET', f'git/trees/{base_tree}?recursive=1')
    if remote_tree.get('truncated'):
        raise ValueError('Remote tree listing truncated')
    known_blobs = {item['sha'] for item in remote_tree['tree'] if item['type']=='blob'}
    previous_entries = entries(base)
    for commit in commits:
        payload = commit_payload(git('cat-file', 'commit', commit))
        current = entries(commit)
        if set(previous_entries)-set(current):
            raise ValueError('File deletion requires a different reviewed upload path')
        changes = [{'path': path, **entry} for path, entry in current.items()
                   if previous_entries.get(path) != entry]
        for change in changes:
            sha = change['sha']
            if sha not in known_blobs:
                content = git('cat-file', 'blob', sha)
                if len(content) > 10_000_000:
                    raise ValueError('Blob exceeds this project uploader size budget')
                blob = api('POST', 'git/blobs', {'encoding': 'base64',
                           'content': base64.b64encode(content).decode('ascii')})
                assert_sha(sha, blob['sha'], 'blob')
                known_blobs.add(sha)
                print('Verified blob: '+change['path'], flush=True)
        tree = api('POST', 'git/trees', {'base_tree': base_tree, 'tree': changes})
        assert_sha(payload['tree'], tree['sha'], 'tree')
        created = api('POST', 'git/commits', payload)
        assert_sha(commit, created['sha'], 'commit')
        print('Verified exact commit: '+commit, flush=True)
        base_tree, previous_entries = tree['sha'], current
    fast_forward(api, base, head)
    assert_sha(head, api('GET', 'git/ref/heads/main')['object']['sha'], 'final remote')
    print(json.dumps({'synced': True, 'head': head, 'force': False}), flush=True)


if __name__ == '__main__':
    main()
