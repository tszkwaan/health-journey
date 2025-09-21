#!/usr/bin/env python3
"""
Test Real Grounding: Call actual healthcare platform functions to test grounding

This test calls the real form generation API endpoints to validate that
the updated prompts generate properly grounded content.
"""

import requests
import json
import re
import time
from typing import List, Dict, Any, Tuple
from dataclasses import dataclass
from test_data_setup import TestDataSetup

@dataclass
class GroundingResult:
    """Result of grounding validation for a summary section"""
    section: str
    total_bullets: int
    grounded_bullets: int
    missing_anchors: List[str]
    is_valid: bool

class RealGroundingTester:
    """Tests grounding by calling actual healthcare platform APIs"""
    
    def __init__(self, base_url: str = "http://localhost:3000"):
        self.base_url = base_url
        self.session = requests.Session()
        
        # Add authentication headers for testing
        self.session.headers.update({
            'Content-Type': 'application/json',
            'Authorization': 'Bearer test-token'
        })
        
        # Pattern to match source anchors like [S1], [S2], (S1), (S2), etc.
        self.anchor_pattern = r'[\[\(]S?\d+[\]\)]'
        # Pattern to match bullet points (various formats)
        self.bullet_patterns = [
            r'^[\s]*[-•*]\s+(.+)$',  # Standard bullet points
            r'^[\s]*\d+\.\s+(.+)$',  # Numbered lists
            r'^[\s]*[a-z]\.\s+(.+)$',  # Lettered lists
        ]
    
    def extract_bullets(self, text: str) -> List[str]:
        """Extract all bullet points from text"""
        bullets = []
        lines = text.split('\n')
        
        for line in lines:
            line = line.strip()
            if not line:
                continue
                
            for pattern in self.bullet_patterns:
                match = re.match(pattern, line, re.MULTILINE)
                if match:
                    bullets.append(match.group(1).strip())
                    break
        
        return bullets
    
    def has_source_anchor(self, text: str) -> bool:
        """Check if text contains a source anchor"""
        return bool(re.search(self.anchor_pattern, text))
    
    def validate_section(self, section_name: str, content: str) -> GroundingResult:
        """Validate grounding for a specific section"""
        # Check if the content has source anchors
        has_anchors = self.has_source_anchor(content)
        
        # Both patient and clinician summaries use paragraph-style fields
        # Each field should have at least one source anchor
        is_valid = has_anchors
        return GroundingResult(
            section=section_name,
            total_bullets=1,
            grounded_bullets=1 if has_anchors else 0,
            missing_anchors=[] if has_anchors else [content[:50] + "..."],
            is_valid=is_valid
        )
    
    def is_patient_summary(self, summary: Dict[str, Any]) -> bool:
        """Check if this is a patient summary based on field names"""
        patient_fields = ['diagnosis', 'instructions', 'homeCare', 'recovery', 'warningSigns', 'whenToSeekHelp']
        return any(field in summary for field in patient_fields)
    
    def validate_summary(self, summary: Dict[str, Any]) -> List[GroundingResult]:
        """Validate grounding for an entire summary"""
        results = []
        
        # Determine if this is a patient summary or clinician summary
        is_patient = self.is_patient_summary(summary)
        
        if is_patient:
            # Patient summary fields
            sections_to_validate = [
                'diagnosis',
                'medications',
                'instructions',
                'homeCare',
                'recovery',
                'followUp',
                'warningSigns',
                'whenToSeekHelp'
            ]
        else:
            # Clinician summary fields
            sections_to_validate = [
                'chiefComplaint',
                'historyOfPresentIllness', 
                'physicalExam',
                'assessment',
                'plan',
                'followUp',
                'medications'
            ]
        
        for section in sections_to_validate:
            if section in summary and summary[section]:
                content = str(summary[section])
                result = self.validate_section(section, content)
                results.append(result)
        
        return results
    
    def test_form_generation_api(self):
        """Test the actual form generation API"""
        print("🧪 Testing Real Form Generation API")
        print("=" * 50)
        
        # Sample consultation transcript
        transcript = """
        [20:37:04] DOCTOR: Good morning, I'm Dr. Chan. How are you feeling today?
        [20:37:10] PATIENT: Morning doctor, I've had a headache this morning
        [20:37:16] DOCTOR: Can you describe the pain?
        [20:37:24] PATIENT: Forehead, very painful
        [20:37:30] DOCTOR: Any other symptoms?
        [20:37:35] PATIENT: Yes, I feel feverish and tired
        [20:37:40] DOCTOR: Let me check your temperature
        [20:37:45] DOCTOR: Your temperature is 37.9°C, blood pressure 118/75
        [20:37:50] DOCTOR: Based on your symptoms, this could be a tension headache or viral infection
        [20:37:55] DOCTOR: I'll prescribe acetaminophen and recommend rest
        [20:38:00] DOCTOR: Follow up in 3-5 days if symptoms persist
        """
        
        # Test clinician summary generation
        print("\n📋 Testing Clinician Summary Generation")
        print("-" * 40)
        
        try:
            response = self.session.post(f"{self.base_url}/api/forms/generate", 
                json={
                    "formId": "clinician_summary",
                    "transcript": transcript,
                    "reservationId": "test-reservation-123"
                },
                timeout=120
            )
            
            if response.status_code == 200:
                clinician_data = response.json()
                print("✅ Clinician summary generated successfully")
                print(f"Generated data keys: {list(clinician_data.keys())}")
                
                # Validate grounding
                results = self.validate_summary(clinician_data)
                print(f"\nGrounding validation results:")
                for result in results:
                    status = "✅" if result.is_valid else "❌"
                    print(f"  {status} {result.section}: {result.grounded_bullets}/{result.total_bullets} grounded")
                    if not result.is_valid and result.missing_anchors:
                        print(f"    Missing anchors: {result.missing_anchors[:2]}...")
                
                return clinician_data
            else:
                print(f"❌ Clinician summary generation failed: {response.status_code}")
                print(f"Error: {response.text}")
                return None
                
        except requests.exceptions.RequestException as e:
            print(f"❌ Network error: {e}")
            return None
        except Exception as e:
            print(f"❌ Unexpected error: {e}")
            return None
    
    def test_patient_summary_generation(self, clinician_summary: Dict[str, Any] = None):
        """Test patient summary generation with clinician summary"""
        print("\n📋 Testing Patient Summary Generation")
        print("-" * 40)
        
        transcript = """
        [20:37:04] DOCTOR: Good morning, I'm Dr. Chan. How are you feeling today?
        [20:37:10] PATIENT: Morning doctor, I've had a headache this morning
        [20:37:16] DOCTOR: Can you describe the pain?
        [20:37:24] PATIENT: Forehead, very painful
        [20:37:30] DOCTOR: Any other symptoms?
        [20:37:35] PATIENT: Yes, I feel feverish and tired
        [20:37:40] DOCTOR: Let me check your temperature
        [20:37:45] DOCTOR: Your temperature is 37.9°C, blood pressure 118/75
        [20:37:50] DOCTOR: Based on your symptoms, this could be a tension headache or viral infection
        [20:37:55] DOCTOR: I'll prescribe acetaminophen and recommend rest
        [20:38:00] DOCTOR: Follow up in 3-5 days if symptoms persist
        """
        
        try:
            response = self.session.post(f"{self.base_url}/api/forms/generate", 
                json={
                    "formId": "patient_summary",
                    "transcript": transcript,
                    "reservationId": "test-reservation-123",
                    "clinicianSummary": clinician_summary
                },
                timeout=120
            )
            
            if response.status_code == 200:
                patient_data = response.json()
                print("✅ Patient summary generated successfully")
                print(f"Generated data keys: {list(patient_data.keys())}")
                
                # Validate grounding
                results = self.validate_summary(patient_data)
                print(f"\nGrounding validation results:")
                for result in results:
                    status = "✅" if result.is_valid else "❌"
                    print(f"  {status} {result.section}: {result.grounded_bullets}/{result.total_bullets} grounded")
                    if not result.is_valid and result.missing_anchors:
                        print(f"    Missing anchors: {result.missing_anchors[:2]}...")
                    
                    # Debug: Show actual content for patient summary fields
                    if 'diagnosis' in result.section or 'instructions' in result.section:
                        content = str(patient_data.get(result.section, ''))
                        print(f"    Debug - Content: {content[:100]}...")
                        print(f"    Debug - Has anchors: {self.has_source_anchor(content)}")
                
                return patient_data
            else:
                print(f"❌ Patient summary generation failed: {response.status_code}")
                print(f"Error: {response.text}")
                return None
                
        except requests.exceptions.RequestException as e:
            print(f"❌ Network error: {e}")
            return None
        except Exception as e:
            print(f"❌ Unexpected error: {e}")
            return None
    
    def test_clinician_summary_generation(self):
        """Test clinician summary generation with real test data"""
        print("\n📋 Testing Clinician Summary Generation")
        print("-" * 40)
        
        try:
            # Test clinician summary generation
            response = self.session.post(
                f"{self.base_url}/api/forms/generate",
                json={
                    "formId": "clinician_summary",
                    "transcript": "Patient presents with headache and fever. Physical exam shows temperature 37.9°C, blood pressure 118/75. Assessment: possible viral infection. Plan: acetaminophen for pain management, follow-up in 3-5 days.",
                    "reservationId": "test-reservation-123",
                    "doctorNotes": "Patient appears fatigued but alert. No signs of serious complications.",
                    "intakeAnswers": {
                        "chiefComplaint": "Headache and fever",
                        "symptoms": "Head pain, feverish feeling, fatigue",
                        "duration": "2 days",
                        "severity": "Moderate"
                    },
                    "medicalHistory": {
                        "pastMedicalHistory": "No significant past medical history",
                        "allergies": "None known",
                        "currentMedications": "None"
                    }
                },
                timeout=120
            )
            
            if response.status_code == 200:
                data = response.json()
                print("✅ Clinician summary generated successfully")
                
                # Get clinician summary data
                clinician_data = data.get('clinician_summary', {})
                if not clinician_data:
                    print("❌ No clinician summary data found in response")
                    return None
                    
                print(f"Generated summary keys: {list(clinician_data.keys())}")
                
                # Validate grounding
                results = self.validate_summary(clinician_data)
                print(f"\nGrounding validation results:")
                for result in results:
                    status = "✅" if result.is_valid else "❌"
                    print(f"  {status} {result.section}: {result.grounded_bullets}/{result.total_bullets} grounded")
                    if not result.is_valid and result.missing_anchors:
                        print(f"    Missing anchors: {result.missing_anchors[:2]}...")
                
                return clinician_data
            else:
                print(f"❌ Clinician summary generation failed: {response.status_code}")
                print(f"Error: {response.text}")
                return None
                
        except requests.exceptions.RequestException as e:
            print(f"❌ Network error: {e}")
            return None
        except Exception as e:
            print(f"❌ Unexpected error: {e}")
            return None
    
    def check_server_status(self):
        """Check if the healthcare platform server is running"""
        print("🔍 Checking Server Status")
        print("=" * 30)
        
        try:
            response = self.session.get(f"{self.base_url}/api/auth/session", timeout=5)
            if response.status_code in [200, 401]:  # 401 is expected for unauthenticated
                print("✅ Healthcare platform server is running")
                return True
            else:
                print(f"❌ Server returned unexpected status: {response.status_code}")
                return False
        except requests.exceptions.RequestException as e:
            print(f"❌ Cannot connect to server: {e}")
            print("Please ensure the healthcare platform is running on http://localhost:3000")
            return False

def main():
    """Run real grounding tests"""
    print("🔍 Real Grounding Validation Test Suite")
    print("=" * 60)
    print("Testing actual healthcare platform form generation")
    print()
    
    tester = RealGroundingTester()
    
    # Check if server is running
    if not tester.check_server_status():
        print("\n❌ Cannot proceed without running server")
        print("Please start the healthcare platform with: npm run dev")
        return
    
    print("\n🚀 Starting Real API Tests")
    print("=" * 40)
    
    # Test form generation
    clinician_data = tester.test_form_generation_api()
    patient_data = tester.test_patient_summary_generation(clinician_data)
    clinician_summary_data = tester.test_clinician_summary_generation()
    
    # Summary
    print("\n📊 Real API Test Summary")
    print("=" * 30)
    
    tests_run = 0
    tests_passed = 0
    
    if clinician_data:
        tests_run += 1
        clinician_results = tester.validate_summary(clinician_data)
        if all(r.is_valid for r in clinician_results):
            tests_passed += 1
            print("✅ Clinician Summary: Properly grounded")
        else:
            print("❌ Clinician Summary: Missing source anchors")
    
    if patient_data:
        tests_run += 1
        patient_results = tester.validate_summary(patient_data)
        if all(r.is_valid for r in patient_results):
            tests_passed += 1
            print("✅ Patient Summary: Properly grounded")
        else:
            print("❌ Patient Summary: Missing source anchors")
    
    if clinician_summary_data:
        tests_run += 1
        clinician_summary_results = tester.validate_summary(clinician_summary_data)
        if all(r.is_valid for r in clinician_summary_results):
            tests_passed += 1
            print("✅ Clinician Summary: Properly grounded")
        else:
            print("❌ Clinician Summary: Missing source anchors")
    
    print(f"\nTests Run: {tests_run}")
    print(f"Tests Passed: {tests_passed}")
    print(f"Success Rate: {(tests_passed/tests_run)*100:.1f}%" if tests_run > 0 else "No tests run")
    
    if tests_passed == tests_run and tests_run > 0:
        print("\n🎉 All real API tests passed! The system is generating properly grounded content.")
    else:
        print("\n⚠️  Some tests failed. The system may need further prompt improvements.")

if __name__ == "__main__":
    main()
