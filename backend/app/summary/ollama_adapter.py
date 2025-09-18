from typing import Any, Dict, List
import json
import httpx


class OllamaSummaryAdapter:
    def __init__(self, base_url: str = "http://localhost:11434", model: str = "llama3.2"):
        self.base_url = base_url
        self.model = model

    async def summarize(self, steps: List[Dict[str, Any]]) -> Dict[str, Any]:
        # Build context from steps
        context = []
        for step in steps:
            if step.get("confirmed") and step.get("text"):
                context.append(f"{step['step']}: {step['text']}")
        
        prompt = f"""Extract structured information from this patient intake conversation:

{chr(10).join(context)}

Return a JSON object with these exact fields:
{{
  "patient_info": "Name: [extracted name]; DOB: [extracted date of birth]; Contact: [extracted phone/contact]",
  "main_complaint": "[primary reason for visit]",
  "symptom_onset": "[when symptoms started]",
  "severity": "mild|moderate|severe|unknown",
  "relevant_history": ["[any relevant medical history]"],
  "allergies": ["[any allergies mentioned]"],
  "red_flags": ["[urgent symptoms that need immediate attention]"]
}}

Only return valid JSON, no other text."""

        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(
                    f"{self.base_url}/api/generate",
                    json={
                        "model": self.model,
                        "prompt": prompt,
                        "stream": False,
                        "options": {"temperature": 0.1}
                    }
                )
                response.raise_for_status()
                result = response.json()
                response_text = result.get("response", "").strip()
                
                # Extract JSON from response
                try:
                    # Look for JSON in the response
                    start = response_text.find("{")
                    end = response_text.rfind("}") + 1
                    if start >= 0 and end > start:
                        json_str = response_text[start:end]
                        return json.loads(json_str)
                except (json.JSONDecodeError, ValueError):
                    pass
                
                # Fallback to basic extraction
                return self._fallback_extract(steps)
                
        except Exception as e:
            print(f"Ollama API error: {e}")
            return self._fallback_extract(steps)

    def _fallback_extract(self, steps: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Fallback extraction when Ollama fails"""
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
            "relevant_history": [find("history")] if find("history") else [],
            "allergies": [find("allergies")] if find("allergies") else [],
            "red_flags": [],
        }
