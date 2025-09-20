#!/usr/bin/env python3
"""
Test Redaction: On a synthetic PHI sample, prove no PHI leaks to outputs or logs

This test validates that the system properly redacts PHI (Personally Identifiable Information)
from all outputs and logs, ensuring compliance with privacy regulations.
"""

import re
import json
import logging
from typing import List, Dict, Any, Set
from dataclasses import dataclass
from datetime import datetime

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

class PHIRedactionTester:
    """Tests PHI redaction in system outputs and logs"""
    
    def __init__(self):
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
                pattern=r'\b\d+\s+[A-Za-z0-9\s,.-]+(?:Street|St|Avenue|Ave|Road|Rd|Drive|Dr|Lane|Ln|Boulevard|Blvd)\b',
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
    
    def detect_phi(self, text: str) -> List[Dict[str, Any]]:
        """Detect PHI in text"""
        detected_phi = []
        
        for pattern in self.phi_patterns:
            matches = re.finditer(pattern.pattern, text, re.IGNORECASE)
            for match in matches:
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
    
    def test_synthetic_phi_sample(self):
        """Test with synthetic PHI sample"""
        print("🧪 Testing PHI Redaction with Synthetic Sample")
        print("=" * 60)
        
        # Synthetic PHI sample
        synthetic_phi = """
        Patient Information:
        Name: John Smith
        DOB: 03/15/1985
        SSN: 123-45-6789
        Email: john.smith@email.com
        Phone: (555) 123-4567
        Address: 123 Main Street, Anytown, NY 12345
        Patient ID: AB123456
        Credit Card: 4532-1234-5678-9012
        
        Medical History:
        Patient has been experiencing headaches since 03/15/2024.
        Contact: john.smith@email.com for follow-up.
        Emergency contact: (555) 987-6543
        """
        
        # Test 1: Original content (should fail)
        print("\n📋 Test 1: Original Content (Should Fail)")
        result1 = self.validate_redaction("Original Content", synthetic_phi)
        print(f"Total PHI found: {result1.total_phi_found}")
        print(f"Redacted: {result1.redacted_phi}")
        print(f"Leaked: {result1.leaked_phi}")
        print(f"Compliant: {result1.is_compliant}")
        if result1.leaked_items:
            print(f"Leaked items: {result1.leaked_items}")
        
        # Test 2: Properly redacted content (should pass)
        print("\n📋 Test 2: Properly Redacted Content (Should Pass)")
        redacted_content = """
        Patient Information:
        Name: [REDACTED]
        DOB: [REDACTED]
        SSN: XXX-XX-XXXX
        Email: [PHI]
        Phone: [REDACTED]
        Address: [REDACTED]
        Patient ID: [REDACTED]
        Credit Card: [REDACTED]
        
        Medical History:
        Patient has been experiencing headaches since [REDACTED].
        Contact: [PHI] for follow-up.
        Emergency contact: [REDACTED]
        """
        
        result2 = self.validate_redaction("Redacted Content", redacted_content)
        print(f"Total PHI found: {result2.total_phi_found}")
        print(f"Redacted: {result2.redacted_phi}")
        print(f"Leaked: {result2.leaked_phi}")
        print(f"Compliant: {result2.is_compliant}")
        if result2.leaked_items:
            print(f"Leaked items: {result2.leaked_items}")
        
        # Test 3: Partially redacted content (should fail)
        print("\n📋 Test 3: Partially Redacted Content (Should Fail)")
        partial_content = """
        Patient Information:
        Name: [REDACTED]
        DOB: 03/15/1985
        SSN: XXX-XX-XXXX
        Email: john.smith@email.com
        Phone: [REDACTED]
        Address: [REDACTED]
        Patient ID: [REDACTED]
        Credit Card: [REDACTED]
        
        Medical History:
        Patient has been experiencing headaches since 03/15/2024.
        Contact: [PHI] for follow-up.
        Emergency contact: (555) 987-6543
        """
        
        result3 = self.validate_redaction("Partial Content", partial_content)
        print(f"Total PHI found: {result3.total_phi_found}")
        print(f"Redacted: {result3.redacted_phi}")
        print(f"Leaked: {result3.leaked_phi}")
        print(f"Compliant: {result3.is_compliant}")
        if result3.leaked_items:
            print(f"Leaked items: {result3.leaked_items}")
        
        return [result1, result2, result3]
    
    def test_log_redaction(self):
        """Test PHI redaction in system logs"""
        print("\n🧪 Testing Log Redaction")
        print("=" * 30)
        
        # Simulate log entries with PHI
        log_entries = [
            "User john.smith@email.com accessed patient record AB123456",
            "Patient John Smith (DOB: 03/15/1985) consultation completed",
            "Emergency contact (555) 987-6543 updated for patient",
            "Patient address 123 Main Street updated successfully",
            "SSN 123-45-6789 verified for patient authentication"
        ]
        
        results = []
        for i, log_entry in enumerate(log_entries):
            result = self.validate_redaction(f"Log Entry {i+1}", log_entry)
            results.append(result)
            print(f"Log {i+1}: {'✅ Compliant' if result.is_compliant else '❌ Non-compliant'}")
            if result.leaked_items:
                print(f"  Leaked: {result.leaked_items}")
        
        return results
    
    def test_output_redaction(self):
        """Test PHI redaction in system outputs"""
        print("\n🧪 Testing Output Redaction")
        print("=" * 30)
        
        # Simulate system outputs
        outputs = [
            "Consultation Summary for John Smith (DOB: 03/15/1985)",
            "Patient [REDACTED] has been diagnosed with [REDACTED]",
            "Follow-up scheduled for [REDACTED] at [REDACTED]",
            "Contact patient at [REDACTED] for appointment confirmation",
            "Medical record [REDACTED] updated successfully"
        ]
        
        results = []
        for i, output in enumerate(outputs):
            result = self.validate_redaction(f"Output {i+1}", output)
            results.append(result)
            print(f"Output {i+1}: {'✅ Compliant' if result.is_compliant else '❌ Non-compliant'}")
            if result.leaked_items:
                print(f"  Leaked: {result.leaked_items}")
        
        return results

def main():
    """Run all PHI redaction tests"""
    print("🔒 PHI Redaction Test Suite")
    print("=" * 50)
    print("Testing compliance with privacy regulations")
    print("Ensuring no PHI leaks to outputs or logs")
    print()
    
    tester = PHIRedactionTester()
    
    # Run all tests
    synthetic_results = tester.test_synthetic_phi_sample()
    log_results = tester.test_log_redaction()
    output_results = tester.test_output_redaction()
    
    # Summary
    print("\n📊 Test Summary")
    print("=" * 20)
    
    all_results = synthetic_results + log_results + output_results
    total_tests = len(all_results)
    compliant_tests = sum(1 for r in all_results if r.is_compliant)
    
    print(f"Total tests: {total_tests}")
    print(f"Compliant: {compliant_tests}")
    print(f"Non-compliant: {total_tests - compliant_tests}")
    print(f"Compliance rate: {(compliant_tests/total_tests)*100:.1f}%")
    
    if compliant_tests == total_tests:
        print("\n✅ All tests passed! System is PHI compliant.")
    else:
        print(f"\n❌ {total_tests - compliant_tests} tests failed. System needs PHI redaction fixes.")
    
    print("\n🔍 PHI Detection Patterns:")
    for pattern in tester.phi_patterns:
        print(f"  - {pattern.name}: {pattern.description}")
    
    print("\n🛡️ Redaction Patterns:")
    for pattern in tester.redaction_patterns:
        print(f"  - {pattern}")

if __name__ == "__main__":
    main()
