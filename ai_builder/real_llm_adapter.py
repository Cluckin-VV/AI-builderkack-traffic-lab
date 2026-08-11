"""Optional real-model adapter; shadow evaluation never applies its output."""

import json
import os
from typing import Any, Dict, Optional
from urllib.request import Request, urlopen

from ai_builder.model_adapter import FakeModelAdapter, ModelAdapter


SYSTEM_PROMPT = """You are an AI Builder action generator. Output JSON only.
Output exactly one SceneAction Protocol v0.1 object with only these fields:
version, action_type, target, parameters, source_command, action_id.
Do not output explanations or markdown. Do not modify SceneState. Do not add fields outside the protocol.
Allowed action_type values: add_bus, remove_bus, set_traffic_light, stop_bus, move_bus."""


class RealLLMAdapter(ModelAdapter):
    def __init__(self, api_key: Optional[str] = None, endpoint: Optional[str] = None, model: Optional[str] = None,
                 fallback: Optional[ModelAdapter] = None) -> None:
        self.api_key = api_key or os.getenv("AI_BUILDER_LLM_API_KEY")
        self.endpoint = endpoint or os.getenv("AI_BUILDER_LLM_ENDPOINT", "https://api.openai.com/v1/chat/completions")
        self.model = model or os.getenv("AI_BUILDER_LLM_MODEL", "gpt-4o-mini")
        self.fallback = fallback
        self.last_raw_output = ""

    def generate_action(self, command: str) -> dict:
        if not self.api_key:
            if self.fallback is None:
                raise RuntimeError("AI_BUILDER_LLM_API_KEY is not configured")
            result = self.fallback.generate_action(command)
            self.last_raw_output = result if isinstance(result, str) else json.dumps(result, ensure_ascii=False)
            if isinstance(result, str):
                return result  # type: ignore[return-value]
            return result
        payload = {"model": self.model, "temperature": 0, "messages": [{"role": "system", "content": SYSTEM_PROMPT}, {"role": "user", "content": command}]}
        request = Request(self.endpoint, data=json.dumps(payload).encode("utf-8"), headers={"Authorization": f"Bearer {self.api_key}", "Content-Type": "application/json"}, method="POST")
        with urlopen(request, timeout=30) as response:
            body = json.loads(response.read().decode("utf-8"))
        content = body["choices"][0]["message"]["content"]
        self.last_raw_output = content
        return json.loads(content)


def build_shadow_adapter() -> RealLLMAdapter:
    """Use the real adapter when configured; otherwise use an offline fallback."""
    if os.getenv("AI_BUILDER_LLM_MODE", "shadow") == "mock" or not os.getenv("AI_BUILDER_LLM_API_KEY"):
        return RealLLMAdapter(fallback=FakeModelAdapter())
    return RealLLMAdapter()
