import unittest

from ai_builder.model_adapter import FakeModelAdapter, run_model_command
from ai_builder.scene import EventLog, SceneState


class WeatherStateTests(unittest.TestCase):
    def run_command(self, command, state=None, adapter=None):
        return run_model_command(adapter or FakeModelAdapter(), command,
                                 state if state is not None else SceneState(), EventLog())

    def test_weather_aliases_pass_both_validation_stages(self):
        for weather, commands in {
            'clear': ['晴天', '恢复晴天', 'clear weather'],
            'rain': ['下雨', '让天气下雨', 'make it rain'],
            'snow': ['下雪', '让天气下暴雪', 'make it snow'],
            'fog': ['起雾', '让天气起雾', 'make it foggy'],
        }.items():
            for command in commands:
                with self.subTest(command=command):
                    result = self.run_command(command)
                    self.assertEqual(result['status'], 'accepted')
                    self.assertEqual(result['event']['validation_stage'], 'execution')
                    self.assertEqual(result['scene']['weather'], weather)

    def test_original_command_survives_normalization(self):
        command = '  MAKE IT SNOW!  '
        result = self.run_command(command)
        self.assertEqual(result['status'], 'accepted')
        self.assertEqual(result['event']['source_command'], command)

    def test_weather_log_records_complete_state(self):
        state = SceneState(buses=2, bus_running=False)
        before = state.snapshot()
        result = self.run_command('下雪', state)
        self.assertEqual(result['event']['state_before'], before)
        self.assertEqual(result['event']['state_after'], {**before, 'weather': 'snow'})

    def test_unknown_and_combined_commands_preserve_all_state(self):
        for command in ['让天气下陨石', '下雪并增加一辆公交车']:
            with self.subTest(command=command):
                state = SceneState(buses=2, bus_running=False, weather='fog')
                before = state.snapshot()
                result = self.run_command(command, state)
                self.assertEqual(result['status'], 'rejected')
                self.assertEqual(state.snapshot(), before)
                self.assertTrue(result['event']['rejected_reason'])

    def test_invalid_weather_never_executes(self):
        class InvalidWeather(FakeModelAdapter):
            def generate_action(self, command):
                payload = super().generate_action('下雪')
                payload['parameters']['weather'] = self.value
                return payload
        for value in ['meteor', [], {}, 1, None]:
            with self.subTest(value=value):
                adapter = InvalidWeather()
                adapter.value = value
                state = SceneState(weather='snow')
                before = state.snapshot()
                result = self.run_command('下雪', state, adapter)
                self.assertEqual(result['status'], 'rejected')
                self.assertEqual(result['event']['validation_stage'], 'schema')
                self.assertEqual(state.snapshot(), before)

    def test_light_changes_do_not_resume_manual_stop(self):
        state = SceneState(buses=1, bus_running=False)
        for command in ['红灯', '绿灯']:
            self.assertEqual(self.run_command(command, state)['status'], 'accepted')
            self.assertFalse(state.bus_running)

    def test_adding_vehicle_does_not_resume_manual_stop(self):
        state = SceneState(buses=1, bus_running=False)
        self.assertEqual(self.run_command('增加一辆公交车', state)['status'], 'accepted')
        self.assertEqual(state.buses, 2)
        self.assertFalse(state.bus_running)

    def test_snapshot_is_detached_and_contains_motion_and_weather(self):
        state = SceneState(bus_running=False, weather='rain')
        snapshot = state.snapshot()
        self.assertEqual(set(snapshot), {'buses', 'traffic_light', 'bus_running', 'weather'})
        snapshot['weather'] = 'snow'
        self.assertEqual(state.weather, 'rain')
