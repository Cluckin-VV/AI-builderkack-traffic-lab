# SceneAction v0.2 Bad Cases

1. Unknown action: `destroy_city` → `UNKNOWN_ACTION_TYPE`.
2. Extra envelope field: `execute_python` → `UNKNOWN_FIELD`.
3. Code injection string in parameters → rejected as unknown field or invalid parameter.
4. `parameters: []` → `INVALID_TYPE`.
5. `color: 7` → `INVALID_ENUM`.
6. `bus_id: bus-999` when no bus exists → semantic target rejection.
7. Stop an already stopped bus → semantic transition rejection.
8. `protocol_version: 0.1` → `UNSUPPORTED_PROTOCOL_VERSION`.
9. Empty `action_id` → invalid parameter.
10. Combined action disguised as one action type → unknown action or unknown parameters.
11. Confidence `1.5` → invalid parameter.
