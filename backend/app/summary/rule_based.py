from typing import Any, Dict, List
from datetime import datetime


class RuleBasedSummaryAdapter:
    async def summarize(self, steps: List[Dict[str, Any]]) -> Dict[str, Any]:
        # Minimal passthrough; assumes upstream parsing already run
        def first(step_key: str) -> str:
            for s in steps:
                if s.get("step") == step_key and s.get("confirmed"):
                    return s.get("text", "")
            return ""

        relevant_history = [s.get("text", "") for s in steps if s.get("step") == "history" and s.get("confirmed")]
        allergies = [s.get("text", "") for s in steps if s.get("step") == "allergies" and s.get("confirmed")]

        return {
            "patient_info": first("identification"),
            "main_complaint": first("reason"),
            "symptom_onset": first("onset"),
            "severity": "unknown",
            "relevant_history": relevant_history,
            "allergies": allergies,
            "red_flags": [],
            "created_at": datetime.utcnow().isoformat(),
        }


