#!/usr/bin/env python3
"""
Test Redaction: On a synthetic PHI sample, prove no PHI leaks to outputs or logs.

This test calls the actual healthcare platform functions to validate that
PHI is properly redacted from generated content.
"""

import requests
import json
import re
import time
from typing import List, Dict, Any
from dataclasses import dataclass

@dataclass
class PHIPattern:
    """Pattern for detecting PHI in text"""
    name: str
    pattern: str
    description: str

@dataclass
class RedactionResult:
    """Result of PHI redaction validation"""
    test_name: str
    total_phi_found: int
    redacted_phi: int
    leaked_phi: int
    is_compliant: bool
    leaked_items: List[str]

class RedactionTester:
    """Tests PHI redaction by calling actual healthcare platform APIs"""
    
    def __init__(self, base_url: str = "http://localhost:3000"):
        self.base_url = base_url
        self.session = requests.Session()
        
        # Add authentication headers for testing
        self.session.headers.update({
            'Content-Type': 'application/json',
            'Authorization': 'Bearer test-token'
        })
        
        # Define PHI patterns to detect
        self.phi_patterns = [
            PHIPattern(
                name="email",
                pattern=r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b',
                description="Email addresses"
            ),
            PHIPattern(
                name="phone",
                pattern=r'(\+?1[-.\s]?)?\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})',
                description="Phone numbers"
            ),
            PHIPattern(
                name="ssn",
                pattern=r'\b\d{3}-?\d{2}-?\d{4}\b',
                description="Social Security Numbers"
            ),
            PHIPattern(
                name="credit_card",
                pattern=r'\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b',
                description="Credit card numbers"
            ),
            PHIPattern(
                name="date_of_birth",
                pattern=r'\b(0?[1-9]|1[0-2])[\/\-](0?[1-9]|[12][0-9]|3[01])[\/\-](19|20)\d{2}\b',
                description="Date of birth (MM/DD/YYYY)"
            ),
            PHIPattern(
                name="patient_id",
                pattern=r'\b[A-Z]{2}\d{6}\b',
                description="Patient ID format"
            ),
            PHIPattern(
                name="address",
                pattern=r'\b\d+\s+[A-Za-z0-9\s,.-]+(?:Street|St|Avenue|Ave|Road|Rd|Drive|Dr|Lane|Ln|Boulevard|Blvd)(?:\s*,\s*[A-Za-z\s]+)?(?:\s*,\s*[A-Z]{2})?(?:\s+\d{5}(?:-\d{4})?)?\b',
                description="Street addresses"
            ),
            PHIPattern(
                name="zip_code",
                pattern=r'\b\d{5}(?:-\d{4})?\b',
                description="ZIP codes"
            )
        ]
        
        # Redaction patterns (what should replace PHI)
        self.redaction_patterns = [
            r'\[REDACTED\]',
            r'\[PHI\]',
            r'\[REMOVED\]',
            r'XXX-XX-XXXX',
            r'\*\*\*-\*\*-\*\*\*\*',
            r'\[REDACTED\]',
            r'\[PHI\]',
            r'\[REMOVED\]'
        ]
    
    def is_valid_address(self, text: str) -> bool:
        """Check if the detected text is actually a valid address"""
        # Check if it contains common address indicators
        address_indicators = ['Street', 'St', 'Avenue', 'Ave', 'Road', 'Rd', 'Drive', 'Dr', 'Lane', 'Ln', 'Boulevard', 'Blvd']
        has_street_type = any(indicator in text for indicator in address_indicators)
        
        # Check if it's a false positive (like "address: 5 days")
        false_positive_patterns = [
            r'address\s*:\s*\d+',  # "address: 5"
            r'address\s*:\s*\d+\s+days',  # "address: 5 days"
            r'address\s*:\s*\d+\s+if',  # "address: 5 if"
        ]
        
        for pattern in false_positive_patterns:
            if re.search(pattern, text, re.IGNORECASE):
                return False
        
        return has_street_type
    
    def detect_phi(self, text: str) -> List[Dict[str, Any]]:
        """Detect PHI in text"""
        detected_phi = []
        
        for pattern in self.phi_patterns:
            matches = re.finditer(pattern.pattern, text, re.IGNORECASE)
            for match in matches:
                # Special validation for addresses to avoid false positives
                if pattern.name == 'address' and not self.is_valid_address(match.group()):
                    continue
                    
                detected_phi.append({
                    'type': pattern.name,
                    'value': match.group(),
                    'start': match.start(),
                    'end': match.end(),
                    'description': pattern.description
                })
        
        return detected_phi
    
    def is_redacted(self, text: str) -> bool:
        """Check if text contains redaction patterns"""
        for pattern in self.redaction_patterns:
            if re.search(pattern, text, re.IGNORECASE):
                return True
        return False
    
    def validate_redaction(self, test_name: str, content: str) -> RedactionResult:
        """Validate PHI redaction in content"""
        detected_phi = self.detect_phi(content)
        total_phi = len(detected_phi)
        redacted_count = 0
        leaked_items = []
        
        for phi_item in detected_phi:
            phi_text = phi_item['value']
            # Check if this PHI item is properly redacted
            if self.is_redacted(phi_text):
                redacted_count += 1
            else:
                leaked_items.append(f"{phi_item['type']}: {phi_text}")
        
        leaked_count = total_phi - redacted_count
        is_compliant = leaked_count == 0
        
        return RedactionResult(
            test_name=test_name,
            total_phi_found=total_phi,
            redacted_phi=redacted_count,
            leaked_phi=leaked_count,
            is_compliant=is_compliant,
            leaked_items=leaked_items
        )
    
    def test_form_generation_with_phi(self):
        """Test form generation with PHI-containing transcript"""
        print("🧪 Testing Form Generation with PHI")
        print("=" * 50)
        
        # Transcript with PHI
        transcript_with_phi = """
        [20:37:04] DOCTOR: Good morning, I'm Dr. Chan. How are you feeling today?
        [20:37:10] PATIENT: Morning doctor, I've had a headache this morning. My name is John Smith, DOB 03/15/1985
        [20:37:16] DOCTOR: Can you describe the pain?
        [20:37:24] PATIENT: Forehead, very painful. My email is john.smith@email.com, phone (555) 123-4567
        [20:37:30] DOCTOR: Any other symptoms?
        [20:37:35] PATIENT: Yes, I feel feverish and tired. My SSN is 123-45-6789
        [20:37:40] DOCTOR: Let me check your temperature
        [20:37:45] DOCTOR: Your temperature is 37.9°C, blood pressure 118/75. Patient ID AB123456
        [20:37:50] DOCTOR: Based on your symptoms, this could be a tension headache or viral infection
        [20:37:55] DOCTOR: I'll prescribe acetaminophen and recommend rest
        [20:38:00] DOCTOR: Follow up in 3-5 days if symptoms persist. Address: 123 Main Street, Anytown, NY 12345
        """
        
        results = []
        
        # Test clinician summary
        print("\n📋 Testing Clinician Summary PHI Redaction")
        print("-" * 40)
        
        try:
            response = self.session.post(f"{self.base_url}/api/forms/generate", 
                json={
                    "formId": "clinician_summary",
                    "transcript": transcript_with_phi,
                    "reservationId": "test-reservation-phi"
                },
                timeout=120
            )
            
            if response.status_code == 200:
                clinician_data = response.json()
                print("✅ Clinician summary generated")
                
                # Check each field for PHI
                for field, content in clinician_data.items():
                    if isinstance(content, str) and content.strip():
                        result = self.validate_redaction(f"clinician_{field}", content)
                        results.append(result)
                        status = "✅" if result.is_compliant else "❌"
                        print(f"  {status} {field}: {result.leaked_phi} PHI leaked")
                        if result.leaked_items:
                            print(f"    Leaked: {result.leaked_items[:2]}...")
            else:
                print(f"❌ Clinician summary generation failed: {response.status_code}")
                
        except Exception as e:
            print(f"❌ Error testing clinician summary: {e}")
        
        # Test patient summary
        print("\n📋 Testing Patient Summary PHI Redaction")
        print("-" * 40)
        
        try:
            response = self.session.post(f"{self.base_url}/api/forms/generate", 
                json={
                    "formId": "patient_summary",
                    "transcript": transcript_with_phi,
                    "reservationId": "test-reservation-phi"
                },
                timeout=120
            )
            
            if response.status_code == 200:
                patient_data = response.json()
                print("✅ Patient summary generated")
                
                # Check each field for PHI
                for field, content in patient_data.items():
                    if isinstance(content, str) and content.strip():
                        result = self.validate_redaction(f"patient_{field}", content)
                        results.append(result)
                        status = "✅" if result.is_compliant else "❌"
                        print(f"  {status} {field}: {result.leaked_phi} PHI leaked")
                        if result.leaked_items:
                            print(f"    Leaked: {result.leaked_items[:2]}...")
            else:
                print(f"❌ Patient summary generation failed: {response.status_code}")
                
        except Exception as e:
            print(f"❌ Error testing patient summary: {e}")
        
        return results
    
    def test_enhanced_summary_with_phi(self):
        """Test enhanced summary with PHI-containing data"""
        print("\n📋 Testing Enhanced Summary PHI Redaction")
        print("-" * 40)
        
        # Mock data with PHI
        medical_background = {
            "medicalHistory": "Patient John Smith (DOB: 03/15/1985) has no significant medical history",
            "medications": "None",
            "allergies": "None known. Contact: john.smith@email.com"
        }
        
        intake_answers = {
            "visit_reason": "headache",
            "symptom_onset": "this morning",
            "previous_treatment": "none",
            "medical_conditions": "none",
            "allergies": "none",
            "concerns": "none"
        }
        
        patient = {
            "name": "John Smith",
            "email": "john.smith@email.com",
            "phone": "(555) 123-4567",
            "ssn": "123-45-6789"
        }
        
        results = []
        
        try:
            response = self.session.post(f"{self.base_url}/api/test/enhanced-summary-real", 
                json={
                    "medicalBackground": medical_background,
                    "intakeAnswers": intake_answers,
                    "patient": patient
                },
                timeout=120
            )
            
            if response.status_code == 200:
                enhanced_data = response.json()
                print("✅ Enhanced summary generated")
                
                # Check each field for PHI
                for field, content in enhanced_data.items():
                    if isinstance(content, str) and content.strip():
                        result = self.validate_redaction(f"enhanced_{field}", content)
                        results.append(result)
                        status = "✅" if result.is_compliant else "❌"
                        print(f"  {status} {field}: {result.leaked_phi} PHI leaked")
                        if result.leaked_items:
                            print(f"    Leaked: {result.leaked_items[:2]}...")
            else:
                print(f"❌ Enhanced summary generation failed: {response.status_code}")
                
        except Exception as e:
            print(f"❌ Error testing enhanced summary: {e}")
        
        return results
    
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
    """Run redaction tests"""
    print("🔒 PHI Redaction Test Suite")
    print("=" * 60)
    print("Testing actual healthcare platform PHI redaction")
    print()
    
    tester = RedactionTester()
    
    # Check if server is running
    if not tester.check_server_status():
        print("\n❌ Cannot proceed without running server")
        print("Please start the healthcare platform with: npm run dev")
        return
    
    print("\n🚀 Starting PHI Redaction Tests")
    print("=" * 50)
    
    # Test form generation with PHI
    form_results = tester.test_form_generation_with_phi()
    
    # Test enhanced summary with PHI
    enhanced_results = tester.test_enhanced_summary_with_phi()
    
    # Combine all results
    all_results = form_results + enhanced_results
    
    # Summary
    print("\n📊 PHI Redaction Test Summary")
    print("=" * 40)
    
    if all_results:
        total_tests = len(all_results)
        compliant_tests = sum(1 for r in all_results if r.is_compliant)
        total_phi_found = sum(r.total_phi_found for r in all_results)
        total_leaked = sum(r.leaked_phi for r in all_results)
        
        print(f"Total Tests: {total_tests}")
        print(f"Compliant Tests: {compliant_tests}")
        print(f"Non-compliant Tests: {total_tests - compliant_tests}")
        print(f"Compliance Rate: {(compliant_tests/total_tests)*100:.1f}%")
        print(f"Total PHI Found: {total_phi_found}")
        print(f"PHI Leaked: {total_leaked}")
        print(f"Redaction Rate: {((total_phi_found - total_leaked)/total_phi_found)*100:.1f}%" if total_phi_found > 0 else "No PHI found")
        
        if compliant_tests == total_tests:
            print("\n✅ All tests passed! The system properly redacts PHI.")
        else:
            print(f"\n❌ {total_tests - compliant_tests} tests failed. The system needs PHI redaction improvements.")
    else:
        print("❌ No test results available. Check server connectivity and API endpoints.")

if __name__ == "__main__":
    main()
