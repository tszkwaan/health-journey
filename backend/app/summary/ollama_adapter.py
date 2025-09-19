from typing import Any, Dict, List
import json
import httpx


class OllamaSummaryAdapter:
    def __init__(self, base_url: str = "http://ollama:11434", model: str = "llama3.2"):
        self.base_url = base_url
        self.model = model

    async def summarize(self, steps: List[Dict[str, Any]]) -> Dict[str, Any]:
        print(f"🤖 DEBUG: Ollama adapter called with {len(steps)} steps")
        
        # Build context from steps - only confirmed responses
        context = []
        for step in steps:
            if step.get("confirmed") and step.get("text"):
                context.append(f"{step['step']}: {step['text']}")
        
        print(f"🤖 DEBUG: Context built: {context}")
        
        # RAG-based prompt - only extract what was actually said
        prompt = f"""You are a medical intake assistant. Extract ONLY information that was explicitly provided by the patient in this conversation. Do NOT add, assume, or hallucinate any information.

Conversation:
{chr(10).join(context)}

Extract and return a JSON object with these fields. Use "Not provided" for any field that wasn't explicitly mentioned:
{{
  "patient_info": "Name: [only if name was given]; DOB: [only if date of birth was given]; Contact: [only if contact was given]",
  "main_complaint": "[only the reason for visit that was stated]",
  "symptom_onset": "[only if onset time was mentioned]",
  "relevant_history": ["[only medical history that was explicitly mentioned]"],
  "allergies": ["[only allergies that were specifically stated]"],
  "red_flags": ["[only urgent symptoms that were mentioned]"]
}}

CRITICAL: 
- If a field was not mentioned, use "Not provided" or empty array []
- Do NOT add information that wasn't in the conversation
- Do NOT make assumptions about lifestyle, occupation, or medical history
- Only include what the patient actually said

Return only valid JSON, no other text."""

        print(f"🤖 DEBUG: Sending request to Ollama at {self.base_url}/api/generate")
        print(f"🤖 DEBUG: Using model: {self.model}")

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
                
                print(f"🤖 DEBUG: Ollama response: {response_text}")
                
                # Extract JSON from response
                try:
                    # Look for JSON in the response
                    start = response_text.find("{")
                    end = response_text.rfind("}") + 1
                    if start >= 0 and end > start:
                        json_str = response_text[start:end]
                        parsed_json = json.loads(json_str)
                        print(f"🤖 DEBUG: Parsed JSON from Ollama: {parsed_json}")
                        return parsed_json
                except (json.JSONDecodeError, ValueError) as e:
                    print(f"🤖 DEBUG: JSON parsing failed: {e}")
                
                # Fallback to basic extraction
                print(f"🤖 DEBUG: Using fallback extraction")
                return self._fallback_extract(steps)
                
        except Exception as e:
            print(f"🤖 DEBUG: Ollama API error: {e}")
            return self._fallback_extract(steps)

    def _fallback_extract(self, steps: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Conservative fallback extraction - only what was explicitly provided"""
        def find(step: str):
            for s in steps:
                if s.get("step") == step and s.get("confirmed"):
                    return s.get("text", "")
            return ""
        
        # Only extract what was actually provided
        patient_info = find("identification")
        main_complaint = find("reason")
        symptom_onset = find("onset")
        history = find("history")
        allergies = find("allergies")
        
        # Build patient_info string only if we have data
        patient_info_str = ""
        if patient_info:
            patient_info_str = patient_info
        else:
            patient_info_str = "Not provided"
        
        return {
            "patient_info": patient_info_str,
            "main_complaint": main_complaint if main_complaint else "Not provided",
            "symptom_onset": symptom_onset if symptom_onset else "Not provided",
            "relevant_history": [history] if history else [],
            "allergies": [allergies] if allergies else [],
            "red_flags": [],  # Only add if explicitly mentioned
        }
