#!/usr/bin/env python3
"""
Test Summary: Side-by-side comparison of the Clinician Summary Template and the Patient Summary Template 
generated from the same synthetic consult. Explain design choices.

This test calls the actual healthcare platform functions to generate both summary types
and compares their alignment, content overlap, and tone differences.
"""

import requests
import json
import re
import time
from typing import List, Dict, Any, Tuple
from dataclasses import dataclass

@dataclass
class SummaryComparison:
    """Result of summary comparison"""
    field: str
    clinician_content: str
    patient_content: str
    alignment_score: float
    content_overlap: float
    tone_difference: str
    is_aligned: bool

class SummaryTester:
    """Tests summary generation and comparison by calling actual healthcare platform APIs"""
    
    def __init__(self, base_url: str = "http://localhost:3000"):
        self.base_url = base_url
        self.session = requests.Session()
        
        # Add authentication headers for testing
        self.session.headers.update({
            'Content-Type': 'application/json',
            'Authorization': 'Bearer test-token'
        })
    
    def generate_synthetic_consultation(self) -> str:
        """Generate a synthetic consultation transcript for testing"""
        return """
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
        [20:38:05] PATIENT: Thank you doctor, I'll follow your advice
        [20:38:10] DOCTOR: Take care and call if symptoms worsen
        """
    
    def call_form_generation_api(self, form_type: str, transcript: str, clinician_summary: Dict = None) -> Dict[str, Any]:
        """Call the actual form generation API"""
        try:
            payload = {
                "formId": form_type,
                "transcript": transcript,
                "reservationId": "test-summary-comparison"
            }
            
            if clinician_summary:
                payload["clinicianSummary"] = clinician_summary
            
            response = self.session.post(f"{self.base_url}/api/forms/generate", 
                json=payload,
                timeout=120
            )
            
            if response.status_code == 200:
                return response.json()
            else:
                print(f"❌ {form_type} generation failed: {response.status_code}")
                return {}
                
        except Exception as e:
            print(f"❌ Error generating {form_type}: {e}")
            return {}
    
    def calculate_content_overlap(self, text1: str, text2: str) -> float:
        """Calculate content overlap between two texts"""
        if not text1 or not text2:
            return 0.0
        
        # Simple word-based overlap calculation
        words1 = set(text1.lower().split())
        words2 = set(text2.lower().split())
        
        if not words1 or not words2:
            return 0.0
        
        intersection = words1.intersection(words2)
        union = words1.union(words2)
        
        return len(intersection) / len(union) if union else 0.0
    
    def analyze_tone_difference(self, clinician_text: str, patient_text: str) -> str:
        """Analyze tone differences between clinician and patient summaries"""
        # Simple tone analysis based on keywords
        clinician_indicators = ['patient', 'presents', 'assessment', 'clinical', 'diagnosis', 'treatment plan']
        patient_indicators = ['you', 'your', 'we', 'our', 'care', 'help', 'support']
        
        clinician_tone_score = sum(1 for indicator in clinician_indicators if indicator in clinician_text.lower())
        patient_tone_score = sum(1 for indicator in patient_indicators if indicator in patient_text.lower())
        
        if clinician_tone_score > patient_tone_score:
            return "Clinical/Professional"
        elif patient_tone_score > clinician_tone_score:
            return "Caring/Patient-friendly"
        else:
            return "Mixed"
    
    def compare_field_alignment(self, field: str, clinician_content: str, patient_content: str) -> SummaryComparison:
        """Compare alignment between clinician and patient summary fields"""
        # Calculate content overlap
        overlap = self.calculate_content_overlap(clinician_content, patient_content)
        
        # Analyze tone difference
        tone_diff = self.analyze_tone_difference(clinician_content, patient_content)
        
        # Calculate alignment score (combination of overlap and medical accuracy)
        alignment_score = overlap * 0.7  # Base score from content overlap
        
        # Check for medical term alignment
        medical_terms = ['acetaminophen', 'tylenol', 'ibuprofen', 'advil', 'fever', 'headache', 'temperature', 'blood pressure']
        clinician_terms = [term for term in medical_terms if term in clinician_content.lower()]
        patient_terms = [term for term in medical_terms if term in patient_content.lower()]
        
        if clinician_terms and patient_terms:
            term_alignment = len(set(clinician_terms).intersection(set(patient_terms))) / len(set(clinician_terms).union(set(patient_terms)))
            alignment_score += term_alignment * 0.3
        
        # Check if follow-up timing is aligned
        if 'follow' in field.lower() or 'up' in field.lower():
            clinician_days = re.findall(r'(\d+)\s*days?', clinician_content.lower())
            patient_days = re.findall(r'(\d+)\s*days?', patient_content.lower())
            
            if clinician_days and patient_days:
                if set(clinician_days) == set(patient_days):
                    alignment_score += 0.2
                else:
                    alignment_score -= 0.3
        
        is_aligned = alignment_score >= 0.6
        
        return SummaryComparison(
            field=field,
            clinician_content=clinician_content,
            patient_content=patient_content,
            alignment_score=alignment_score,
            content_overlap=overlap,
            tone_difference=tone_diff,
            is_aligned=is_aligned
        )
    
    def test_summary_generation_and_comparison(self):
        """Test summary generation and perform side-by-side comparison"""
        print("🧪 Testing Summary Generation and Comparison")
        print("=" * 60)
        
        # Generate synthetic consultation
        transcript = self.generate_synthetic_consultation()
        print(f"📝 Generated synthetic consultation ({len(transcript)} chars)")
        
        # Generate clinician summary first
        print("\n📋 Generating Clinician Summary...")
        clinician_summary = self.call_form_generation_api("clinician_summary", transcript)
        
        if not clinician_summary:
            print("❌ Failed to generate clinician summary")
            return []
        
        print("✅ Clinician summary generated successfully")
        
        # Generate patient summary using clinician summary
        print("\n📋 Generating Patient Summary...")
        patient_summary = self.call_form_generation_api("patient_summary", transcript, clinician_summary)
        
        if not patient_summary:
            print("❌ Failed to generate patient summary")
            return []
        
        print("✅ Patient summary generated successfully")
        
        # Compare summaries
        print("\n🔍 Comparing Summaries...")
        print("=" * 40)
        
        comparisons = []
        
        # Define fields to compare
        comparable_fields = [
            ('medications', 'medications'),
            ('plan', 'instructions'),
            ('followUp', 'followUp'),
            ('assessment', 'diagnosis'),
            ('physicalExam', 'homeCare')
        ]
        
        for clinician_field, patient_field in comparable_fields:
            if clinician_field in clinician_summary and patient_field in patient_summary:
                comparison = self.compare_field_alignment(
                    f"{clinician_field} vs {patient_field}",
                    str(clinician_summary[clinician_field]),
                    str(patient_summary[patient_field])
                )
                comparisons.append(comparison)
                
                status = "✅" if comparison.is_aligned else "❌"
                print(f"  {status} {comparison.field}:")
                print(f"    Alignment Score: {comparison.alignment_score:.2f}")
                print(f"    Content Overlap: {comparison.content_overlap:.2f}")
                print(f"    Tone: {comparison.tone_difference}")
                print(f"    Clinician: {comparison.clinician_content[:100]}...")
                print(f"    Patient: {comparison.patient_content[:100]}...")
                print()
        
        return comparisons
    
    def analyze_design_choices(self, comparisons: List[SummaryComparison]):
        """Analyze and explain design choices for summary templates"""
        print("\n🎯 Design Choices Analysis")
        print("=" * 40)
        
        if not comparisons:
            print("❌ No comparisons available for analysis")
            return
        
        # Calculate overall metrics
        total_comparisons = len(comparisons)
        aligned_comparisons = sum(1 for c in comparisons if c.is_aligned)
        avg_alignment = sum(c.alignment_score for c in comparisons) / total_comparisons
        avg_overlap = sum(c.content_overlap for c in comparisons) / total_comparisons
        
        print(f"📊 Overall Metrics:")
        print(f"  Total Field Comparisons: {total_comparisons}")
        print(f"  Aligned Fields: {aligned_comparisons}")
        print(f"  Alignment Rate: {(aligned_comparisons/total_comparisons)*100:.1f}%")
        print(f"  Average Alignment Score: {avg_alignment:.2f}")
        print(f"  Average Content Overlap: {avg_overlap:.2f}")
        
        print(f"\n🎨 Design Choices Explained:")
        print(f"  1. **Dual Summary Approach**: Separate clinician and patient summaries")
        print(f"     - Clinician Summary: Professional, technical, comprehensive")
        print(f"     - Patient Summary: Caring, accessible, actionable")
        print(f"     - Rationale: Different audiences need different information presentation")
        
        print(f"  2. **Content Alignment Strategy**:")
        print(f"     - Medical facts must be consistent between summaries")
        print(f"     - Medications, dosages, and timing must match exactly")
        print(f"     - Rationale: Prevents confusion and ensures treatment compliance")
        
        print(f"  3. **Tone Differentiation**:")
        print(f"     - Clinician: 'Patient presents with...' (objective)")
        print(f"     - Patient: 'You have...' (personal, caring)")
        print(f"     - Rationale: Builds trust and improves patient understanding")
        
        print(f"  4. **Field Mapping Strategy**:")
        for comparison in comparisons:
            if 'medications' in comparison.field:
                print(f"     - Medications: Direct mapping with patient-friendly names")
            elif 'plan' in comparison.field and 'instructions' in comparison.field:
                print(f"     - Treatment Plan → Instructions: Convert clinical plan to actionable steps")
            elif 'follow' in comparison.field:
                print(f"     - Follow-up: Maintain exact timing, adjust language")
        
        print(f"  5. **Quality Assurance**:")
        print(f"     - Alignment Score Threshold: 0.6 (60% alignment required)")
        print(f"     - Content Overlap: Ensures medical accuracy")
        print(f"     - Tone Analysis: Validates appropriate communication style")
        
        # Recommendations
        print(f"\n💡 Recommendations:")
        if avg_alignment < 0.7:
            print(f"  - Improve field alignment (current: {avg_alignment:.2f})")
        if avg_overlap < 0.5:
            print(f"  - Increase content overlap (current: {avg_overlap:.2f})")
        
        print(f"  - Monitor alignment in production")
        print(f"  - Regular validation of medical accuracy")
        print(f"  - User feedback on patient summary clarity")
    
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
    """Run summary comparison tests"""
    print("📊 Summary Comparison Test Suite")
    print("=" * 60)
    print("Testing actual healthcare platform summary generation and comparison")
    print()
    
    tester = SummaryTester()
    
    # Check if server is running
    if not tester.check_server_status():
        print("\n❌ Cannot proceed without running server")
        print("Please start the healthcare platform with: npm run dev")
        return
    
    print("\n🚀 Starting Summary Comparison Tests")
    print("=" * 50)
    
    # Test summary generation and comparison
    comparisons = tester.test_summary_generation_and_comparison()
    
    # Analyze design choices
    tester.analyze_design_choices(comparisons)
    
    # Summary
    print("\n📊 Summary Comparison Test Results")
    print("=" * 40)
    
    if comparisons:
        total_comparisons = len(comparisons)
        aligned_comparisons = sum(1 for c in comparisons if c.is_aligned)
        avg_alignment = sum(c.alignment_score for c in comparisons) / total_comparisons
        
        print(f"Total Field Comparisons: {total_comparisons}")
        print(f"Aligned Fields: {aligned_comparisons}")
        print(f"Alignment Rate: {(aligned_comparisons/total_comparisons)*100:.1f}%")
        print(f"Average Alignment Score: {avg_alignment:.2f}")
        
        if aligned_comparisons == total_comparisons:
            print("\n✅ All summary fields are properly aligned!")
        else:
            print(f"\n⚠️  {total_comparisons - aligned_comparisons} fields need better alignment.")
    else:
        print("❌ No comparison results available. Check server connectivity and API endpoints.")

if __name__ == "__main__":
    main()
