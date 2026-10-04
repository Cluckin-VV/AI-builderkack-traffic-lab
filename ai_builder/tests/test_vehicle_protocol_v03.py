import unittest

from ai_builder.scene import Renderer, SceneState, ValidationResult, validate_scene_action_schema
from ai_builder.scene_plan import DeterministicScenePlanner, preview_scene_plan, execute_pending_plan, PendingPlanStore


class VehicleProtocolV03Tests(unittest.TestCase):
    def test_v03_add_vehicle_schema_accepts_only_catalogue_types(self):
        valid = {"protocol_version": "0.3", "action_id": "v1", "action_type": "add_vehicle", "parameters": {"vehicle_type": "suv"}}
        self.assertEqual(validate_scene_action_schema(valid), [])
        invalid = {**valid, "parameters": {"vehicle_type": "truck"}}
        self.assertEqual(validate_scene_action_schema(invalid)[0].code, "INVALID_ENUM")

    def test_vehicle_ids_are_stable_after_removal(self):
        planner = DeterministicScenePlanner()
        state, store = SceneState(), PendingPlanStore()
        plan = planner.generate_plan("增加两辆SUV")
        preview = preview_scene_plan(plan, state)
        store.put(plan, preview, state)
        execute_pending_plan(plan["plan_id"], state, store)
        ids = [vehicle["id"] for vehicle in state.vehicles]
        remove = planner.generate_plan("删除一辆SUV")
        preview = preview_scene_plan(remove, state)
        store.put(remove, preview, state)
        execute_pending_plan(remove["plan_id"], state, store)
        self.assertEqual([vehicle["id"] for vehicle in state.vehicles], ids[1:])

    def test_mixed_vehicle_command_previews_atomically(self):
        state = SceneState()
        plan = DeterministicScenePlanner().generate_plan("添加三辆小轿车和一辆公交车")
        result = preview_scene_plan(plan, state)
        self.assertEqual(result["status"], "preview_ready")
        self.assertEqual([v["type"] for v in result["projected_state"]["vehicles"]], ["sedan"] * 3 + ["bus"])
        self.assertEqual(state.vehicles, [])

    def test_capacity_rejects_entire_plan_without_mutation(self):
        state = SceneState(vehicles=[{"id": f"v-{i}", "type": "sedan"} for i in range(24)])
        before = state.snapshot()
        result = preview_scene_plan(DeterministicScenePlanner().generate_plan("增加一辆SUV"), state)
        self.assertEqual(result["validation_stage"], "semantic")
        self.assertEqual(state.snapshot(), before)

    def test_signal_mode_defaults_to_automatic_for_v03_state(self):
        self.assertEqual(SceneState().signal_mode, "automatic")

    def test_v03_signal_mode_schema_accepts_only_supported_modes(self):
        valid = {"protocol_version": "0.3", "action_id": "signal-mode", "action_type": "set_signal_mode", "parameters": {"mode": "automatic"}}
        self.assertEqual(validate_scene_action_schema(valid), [])
        invalid = {**valid, "parameters": {"mode": "chaos"}}
        self.assertEqual(validate_scene_action_schema(invalid)[0].code, "INVALID_ENUM")

    def test_setting_signal_color_enters_manual_mode_in_projected_state(self):
        planner = DeterministicScenePlanner()
        state = SceneState.demo()
        plan = planner.generate_plan("把信号灯改成红色")
        result = preview_scene_plan(plan, state)
        self.assertEqual(result["status"], "preview_ready")
        self.assertEqual(result["projected_state"]["signal_mode"], "manual")
        self.assertEqual(result["projected_state"]["traffic_light"], "红灯")
        self.assertEqual(state.signal_mode, "automatic")

    def test_resume_automatic_signal_plan_restores_automatic_mode(self):
        planner = DeterministicScenePlanner()
        state = SceneState.demo()
        state.signal_mode = "manual"
        state.traffic_light = "红灯"
        plan = planner.generate_plan("恢复自动信号")
        self.assertEqual(plan["actions"][0]["action_type"], "set_signal_mode")
        self.assertEqual(plan["actions"][0]["protocol_version"], "0.3")
        result = preview_scene_plan(plan, state)
        self.assertEqual(result["status"], "preview_ready")
        self.assertEqual(result["projected_state"]["signal_mode"], "automatic")
        self.assertEqual(result["projected_state"]["traffic_light"], "绿灯")
        self.assertEqual(state.traffic_light, "红灯")

    def test_signal_mode_changes_only_after_confirmed_plan_execution(self):
        planner = DeterministicScenePlanner()
        state = SceneState.demo()
        store = PendingPlanStore()
        plan = planner.generate_plan("把信号灯改成红色")
        preview = preview_scene_plan(plan, state)
        store.put(plan, preview, state)
        self.assertEqual(state.signal_mode, "automatic")
        execute_pending_plan(plan["plan_id"], state, store)
        self.assertEqual(state.signal_mode, "manual")
        self.assertEqual(Renderer().render_data(state)["signal_mode"], "manual")

    def test_confirmed_automatic_signal_restore_clears_stale_manual_color(self):
        planner = DeterministicScenePlanner()
        state = SceneState.demo()
        state.signal_mode = "manual"
        state.traffic_light = "黄灯"
        plan = planner.generate_plan("恢复自动信号")
        preview = preview_scene_plan(plan, state)
        store = PendingPlanStore()
        store.put(plan, preview, state)
        execute_pending_plan(plan["plan_id"], state, store)
        self.assertEqual(state.signal_mode, "automatic")
        self.assertEqual(state.traffic_light, "绿灯")

    def test_renderer_exposes_automatic_signal_mode_for_empty_scene(self):
        self.assertEqual(Renderer().render_data(SceneState())["signal_mode"], "automatic")

if __name__ == "__main__":
    unittest.main()
