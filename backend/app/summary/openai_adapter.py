from typing import Any, Dict, List
import json
import os


class OpenAISummaryAdapter:
    def __init__(self, api_key: str):
        self.api_key = api_key

    async def summarize(self, steps: List[Dict[str, Any]]) -> Dict[str, Any]:
        # Placeholder to avoid adding extra deps. Pseudo-call to OpenAI.
        # In real use, install openai>=1 and call responses API with a system prompt.
        # Here we just fall back to a simple deterministic mapping.
        def find(step: str):
            for s in steps:
                if s.get("step") == step and s.get("confirmed"):
                    return s.get("text", "")
            return ""
        return {
            "patient_info": find("identification"),
            "main_complaint": find("reason"),
            "symptom_onset": find("onset"),
            "severity": "unknown",
            "relevant_history": [find("history")],
            "allergies": [find("allergies")],
            "red_flags": [],
        }


