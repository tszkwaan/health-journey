from typing import Any, Dict, List
import json
import httpx


class RAGSummaryAdapter:
    """RAG-based summary adapter that prevents hallucination by only extracting actual data"""
    
    def __init__(self, base_url: str = "http://ollama:11434", model: str = "llama3.2"):
        self.base_url = base_url
        self.model = model

    async def summarize(self, steps: List[Dict[str, Any]]) -> Dict[str, Any]:
        print(f"🔍 RAG: Processing {len(steps)} conversation steps")
        
        # Step 1: Extract only confirmed, actual data
        actual_data = self._extract_actual_data(steps)
        print(f"🔍 RAG: Extracted actual data: {actual_data}")
        
        # Step 2: Use LLM only for structuring, not generating content
        structured_summary = await self._structure_with_llm(actual_data)
        print(f"🔍 RAG: Structured summary: {structured_summary}")
        
        return structured_summary

    def _extract_actual_data(self, steps: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Extract only data that was explicitly provided by the patient"""
        data = {
            "identification": "",
            "reason": "",
            "onset": "",
            "history": "",
            "allergies": "",
            "safety": ""
        }
        
        for step in steps:
            if step.get("confirmed") and step.get("text"):
                step_name = step.get("step", "")
                if step_name in data:
                    data[step_name] = step.get("text", "")
        
        return data

    async def _structure_with_llm(self, actual_data: Dict[str, Any]) -> Dict[str, Any]:
        """Use LLM only to structure the actual data, not to generate new content"""
        
        prompt = f"""You are a medical data processor. Structure the following patient data into a JSON format. 
        
IMPORTANT: Only use the data provided below. Do NOT add, assume, or generate any information that wasn't explicitly provided.

Patient Data:
- Identification: {actual_data['identification'] or 'Not provided'}
- Reason for visit: {actual_data['reason'] or 'Not provided'}
- Symptom onset: {actual_data['onset'] or 'Not provided'}
- Medical history: {actual_data['history'] or 'Not provided'}
- Allergies: {actual_data['allergies'] or 'Not provided'}
- Safety concerns: {actual_data['safety'] or 'Not provided'}

Return a JSON object with these exact fields:
{{
  "patient_info": "Name: [extract name if provided]; DOB: [extract DOB if provided]; Contact: [extract contact if provided]",
  "main_complaint": "[use reason for visit if provided, otherwise 'Not provided']",
  "symptom_onset": "[use symptom onset if provided, otherwise 'Not provided']",
  "relevant_history": ["[use medical history if provided, otherwise empty array]"],
  "allergies": ["[use allergies if provided, otherwise empty array]"],
  "red_flags": ["[use safety concerns if provided, otherwise empty array]"]
}}

Rules:
- If a field contains "Not provided", use that exact text
- If a field is empty, use "Not provided" or empty array []
- Do NOT add any information not in the provided data
- Do NOT make assumptions about lifestyle, occupation, or medical conditions

Return only valid JSON, no other text."""

        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(
                    f"{self.base_url}/api/generate",
                    json={
                        "model": self.model,
                        "prompt": prompt,
                        "stream": False,
                        "options": {"temperature": 0.0}  # Very low temperature to prevent hallucination
                    }
                )
                response.raise_for_status()
                result = response.json()
                response_text = result.get("response", "").strip()
                
                print(f"🔍 RAG: LLM response: {response_text}")
                
                # Extract JSON from response
                try:
                    start = response_text.find("{")
                    end = response_text.rfind("}") + 1
                    if start >= 0 and end > start:
                        json_str = response_text[start:end]
                        parsed_json = json.loads(json_str)
                        print(f"🔍 RAG: Parsed JSON: {parsed_json}")
                        return parsed_json
                except (json.JSONDecodeError, ValueError) as e:
                    print(f"🔍 RAG: JSON parsing failed: {e}")
                
                # Fallback to conservative extraction
                return self._conservative_fallback(actual_data)
                
        except Exception as e:
            print(f"🔍 RAG: LLM API error: {e}")
            return self._conservative_fallback(actual_data)

    def _conservative_fallback(self, actual_data: Dict[str, Any]) -> Dict[str, Any]:
        """Conservative fallback that only uses actual provided data"""
        
        # Extract patient info components
        identification = actual_data.get('identification', '')
        patient_info_parts = []
        
        if identification:
            # Simple extraction - just use what was provided
            patient_info_parts.append(identification)
        
        patient_info = "; ".join(patient_info_parts) if patient_info_parts else "Not provided"
        
        return {
            "patient_info": patient_info,
            "main_complaint": actual_data.get('reason', 'Not provided'),
            "symptom_onset": actual_data.get('onset', 'Not provided'),
            "relevant_history": [actual_data.get('history')] if actual_data.get('history') else [],
            "allergies": [actual_data.get('allergies')] if actual_data.get('allergies') else [],
            "red_flags": [actual_data.get('safety')] if actual_data.get('safety') else [],
        }
