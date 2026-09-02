"""Provider-neutral Real LLM shadow adapter and read-only evaluator."""
import json, os, time, socket, urllib.request, urllib.error
from typing import Any, Dict, Optional
from ai_builder.scene import SceneAction, SceneState, validate_scene_action_schema, validate_scene_action_semantics

SYSTEM_INSTRUCTIONS = """You are a SceneAction compiler. Return exactly one SceneAction Protocol v0.2 JSON object. Never output code, explanations, multiple actions, unknown fields, or state mutations. Use only the supported action types. Unsupported requests must not invent an action."""
ACTION_SCHEMA = {"type":"object","additionalProperties":False,"required":["protocol_version","action_id","action_type","parameters"],"properties":{
    "protocol_version":{"type":"string","const":"0.2"},"action_id":{"type":"string","minLength":1},
    "action_type":{"type":"string","enum":["add_bus","remove_bus","set_traffic_light","stop_bus","move_bus"]},
    "parameters":{"type":"object","additionalProperties":False,"properties":{"color":{"type":"string","enum":["红灯","黄灯","绿灯"]}}},
    "source":{"type":"string"},"metadata":{"type":"object"}}}

class RealLLMAdapter:
    def generate_scene_action(self, command: str, request_id: Optional[str] = None) -> Dict[str, Any]:
        raise NotImplementedError

class OpenAIRealLLMAdapter(RealLLMAdapter):
    def __init__(self, api_key=None, model=None, endpoint="https://api.openai.com/v1/responses", timeout=20, opener=None):
        self.api_key = api_key or os.getenv("OPENAI_API_KEY")
        self.model = model or os.getenv("AI_BUILDER_LLM_MODEL", "gpt-4o-mini")
        self.endpoint, self.timeout, self.opener = endpoint, timeout, opener or urllib.request.urlopen

    def generate_scene_action(self, command, request_id=None):
        if os.getenv("AI_BUILDER_ENABLE_REAL_LLM", "0") != "1": return {"ok":False,"error_category":"CONFIG_ERROR","message":"real LLM is disabled","diagnostic":{"response_received":False}}
        if not self.api_key: return {"ok":False,"error_category":"CONFIG_ERROR","message":"OPENAI_API_KEY is not configured","diagnostic":{"response_received":False}}
        body={"model":self.model,"store":False,"instructions":SYSTEM_INSTRUCTIONS,"input":command,"text":{"format":{"type":"json_schema","name":"scene_action_v02","strict":True,"schema":ACTION_SCHEMA}}}
        request=urllib.request.Request(self.endpoint,data=json.dumps(body,ensure_ascii=False).encode(),headers={"Authorization":"Bearer "+self.api_key,"Content-Type":"application/json"},method="POST")
        try:
            with self.opener(request, timeout=self.timeout) as response:
                data=json.loads(response.read().decode())
            if data.get("status") == "failed" or data.get("error"):
                return {"ok":False,"error_category":"API_ERROR","message":"provider response reported failure","diagnostic":{"response_received":True,"openai_error_type":_safe(data.get("error",{}).get("type")),"openai_error_code":_safe(data.get("error",{}).get("code")),"message_sanitized":_safe(data.get("error",{}).get("message"))}}
            text=data.get("output_text")
            if not text:
                for item in data.get("output",[]):
                    if item.get("type") == "message" and item.get("status") == "incomplete": return {"ok":False,"error_category":"API_ERROR","message":"incomplete response","diagnostic":{"response_received":True}}
                    for content in item.get("content",[]):
                        if content.get("type") == "refusal": return {"ok":False,"error_category":"MODEL_REFUSAL","message":"model refusal","diagnostic":{"response_received":True}}
                        if content.get("type") in {"output_text","text"}: text=content.get("text"); break
            if not text: return {"ok":False,"error_category":"MALFORMED_RESPONSE","message":"no structured output","diagnostic":{"response_received":True}}
            try: return json.loads(text)
            except json.JSONDecodeError: return {"ok":False,"error_category":"INVALID_JSON","message":"model output was not JSON","diagnostic":{"response_received":True}}
        except urllib.error.HTTPError as error:
            detail={"http_status":error.code,"response_received":True}
            try:
                body=json.loads(error.read().decode("utf-8")); info=body.get("error",{}); detail.update({"openai_error_type":_safe(info.get("type")),"openai_error_code":_safe(info.get("code")),"message_sanitized":_safe(info.get("message"))})
            except Exception: pass
            return {"ok":False,"error_category":"API_ERROR","message":"HTTP request failed","diagnostic":detail}
        except (socket.timeout, TimeoutError): return {"ok":False,"error_category":"TIMEOUT","message":"LLM request timed out","diagnostic":{"response_received":False}}
        except (urllib.error.URLError, OSError) as error: return {"ok":False,"error_category":"API_ERROR","message":"network request failed","diagnostic":{"response_received":False,"message_sanitized":_safe(getattr(error,"reason",error))}}

def _safe(value):
    text=str(value or "")
    import re
    text=re.sub(r"Bearer\s+\S+|(?:sk|api)[-_][A-Za-z0-9_-]{12,}","[REDACTED]",text,flags=re.I)
    return text[:300]

def reference_action(command):
    from ai_builder.scene import SceneCompiler
    action=SceneCompiler().compile(command)
    return None if action is None else {"action_type":action.action_type,"parameters":dict(action.parameters)}

def evaluate_candidate(command, candidate, state=None, reference=None, latency_ms=0, model="unknown"):
    state=state or SceneState(); reference=reference if reference is not None else reference_action(command)
    result={"command":command,"reference":reference,"candidate":candidate if isinstance(candidate,dict) else None,"candidate_generated":False,"schema_valid":False,"semantic_valid":False,"action_type_match":False,"parameters_match":False,"overall_match":False,"latency_ms":latency_ms,"model":model,"error_category":None}
    if not isinstance(candidate,dict): result["error_category"]="INVALID_JSON"; return result
    if candidate.get("ok") is False or candidate.get("error_category"):
        result["error_category"]=candidate.get("error_category","API_ERROR"); result["diagnostic"]=candidate.get("diagnostic",{}); result["error_message_sanitized"]=_safe(candidate.get("message")); return result
    result["candidate_generated"]=True
    schema_errors=validate_scene_action_schema(candidate)
    if schema_errors: result["error_category"]="SCHEMA_FAILURE"; return result
    result["schema_valid"]=True
    target={"add_bus":"road","remove_bus":"road","set_traffic_light":"traffic_light","stop_bus":"bus","move_bus":"bus"}[candidate["action_type"]]
    action=SceneAction(candidate["action_type"],target,candidate["parameters"],command,candidate["action_id"])
    if validate_scene_action_semantics(action,state): result["error_category"]="SEMANTIC_FAILURE"; return result
    result["semantic_valid"]=True; result["action_type_match"]=reference is not None and candidate["action_type"]==reference["action_type"]; result["parameters_match"]=reference is not None and candidate["parameters"]==reference["parameters"]; result["overall_match"]=result["action_type_match"] and result["parameters_match"]
    if not result["action_type_match"]: result["error_category"]="ACTION_TYPE_MISMATCH"
    elif not result["parameters_match"]: result["error_category"]="PARAMETER_MISMATCH"
    return result

def shadow_case(adapter, command, state=None):
    started=time.perf_counter(); candidate=adapter.generate_scene_action(command); elapsed=round((time.perf_counter()-started)*1000,2)
    return evaluate_candidate(command,candidate,state,latency_ms=elapsed,model=getattr(adapter,"model","unknown"))
