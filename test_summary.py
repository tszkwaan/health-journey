#!/usr/bin/env python3
"""
Test Summary: Side-by-side comparison of Clinician Summary and Patient Summary templates

This test generates both summary templates from the same synthetic consultation
and provides a detailed comparison to explain design choices and ensure alignment.
"""

import json
import re
from typing import Dict, Any, List, Tuple
from dataclasses import dataclass
from datetime import datetime

@dataclass
class SummaryComparison:
    """Comparison between clinician and patient summaries"""
    field: str
    clinician_content: str
    patient_content: str
    alignment_score: float
    tone_difference: str
    content_overlap: float

class SummaryAnalyzer:
    """Analyzes and compares summary templates"""
    
    def __init__(self):
        self.medical_terms = {
            'diagnosis': ['diagnosis', 'condition', 'disorder', 'syndrome'],
            'medications': ['medication', 'drug', 'prescription', 'treatment'],
            'symptoms': ['symptom', 'sign', 'complaint', 'presentation'],
            'examination': ['examination', 'assessment', 'evaluation', 'findings'],
            'plan': ['plan', 'treatment', 'management', 'approach'],
            'followup': ['follow-up', 'followup', 'monitoring', 'surveillance']
        }
    
    def extract_medical_terms(self, text: str) -> List[str]:
        """Extract medical terms from text"""
        terms = []
        text_lower = text.lower()
        
        for category, term_list in self.medical_terms.items():
            for term in term_list:
                if term in text_lower:
                    terms.append(term)
        
        return terms
    
    def calculate_content_overlap(self, text1: str, text2: str) -> float:
        """Calculate content overlap between two texts"""
        words1 = set(re.findall(r'\b\w+\b', text1.lower()))
        words2 = set(re.findall(r'\b\w+\b', text2.lower()))
        
        if not words1 or not words2:
            return 0.0
        
        intersection = words1.intersection(words2)
        union = words1.union(words2)
        
        return len(intersection) / len(union) if union else 0.0
    
    def analyze_tone(self, text: str) -> Dict[str, float]:
        """Analyze the tone of text"""
        # Simple tone analysis based on word patterns
        professional_words = ['patient', 'diagnosis', 'treatment', 'assessment', 'clinical']
        caring_words = ['you', 'your', 'feel', 'comfortable', 'help', 'support']
        technical_words = ['syndrome', 'pathology', 'etiology', 'prognosis', 'differential']
        
        text_lower = text.lower()
        
        professional_score = sum(1 for word in professional_words if word in text_lower)
        caring_score = sum(1 for word in caring_words if word in text_lower)
        technical_score = sum(1 for word in technical_words if word in text_lower)
        
        total_words = len(re.findall(r'\b\w+\b', text_lower))
        
        return {
            'professional': professional_score / total_words if total_words > 0 else 0,
            'caring': caring_score / total_words if total_words > 0 else 0,
            'technical': technical_score / total_words if total_words > 0 else 0
        }
    
    def compare_summaries(self, clinician: Dict[str, Any], patient: Dict[str, Any]) -> List[SummaryComparison]:
        """Compare clinician and patient summaries"""
        comparisons = []
        
        # Define field mappings between clinician and patient summaries
        field_mappings = {
            'chiefComplaint': 'diagnosis',
            'historyOfPresentIllness': 'diagnosis',
            'physicalExam': 'examination',
            'assessment': 'diagnosis',
            'plan': 'medications',
            'followUp': 'followUp',
            'medications': 'medications',
            'instructions': 'instructions',
            'homeCare': 'homeCare',
            'recovery': 'recovery',
            'warningSigns': 'warningSigns',
            'whenToSeekHelp': 'whenToSeekHelp'
        }
        
        for clin_field, pat_field in field_mappings.items():
            if clin_field in clinician and pat_field in patient:
                clin_content = str(clinician[clin_field])
                pat_content = str(patient[pat_field])
                
                # Calculate alignment metrics
                content_overlap = self.calculate_content_overlap(clin_content, pat_content)
                
                # Analyze tone differences
                clin_tone = self.analyze_tone(clin_content)
                pat_tone = self.analyze_tone(pat_content)
                
                # Calculate alignment score (0-1, higher is better)
                alignment_score = content_overlap * 0.7 + (1 - abs(clin_tone['technical'] - pat_tone['technical'])) * 0.3
                
                # Determine tone difference
                if pat_tone['caring'] > clin_tone['caring']:
                    tone_diff = "Patient summary is more caring/empathetic"
                elif clin_tone['technical'] > pat_tone['technical']:
                    tone_diff = "Clinician summary is more technical"
                else:
                    tone_diff = "Similar tone levels"
                
                comparison = SummaryComparison(
                    field=clin_field,
                    clinician_content=clin_content,
                    patient_content=pat_content,
                    alignment_score=alignment_score,
                    tone_difference=tone_diff,
                    content_overlap=content_overlap
                )
                
                comparisons.append(comparison)
        
        return comparisons

def generate_synthetic_consultation() -> Dict[str, Any]:
    """Generate a synthetic consultation for testing"""
    return {
        "transcript": """
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
        """,
        "notes": "Temperature 37.9°C, blood pressure 118/75, heart rate 92. Patient appears alert but in mild distress.",
        "patient_info": {
            "name": "John Doe",
            "dob": "1990-05-15",
            "allergies": "None known",
            "medications": "None"
        }
    }

def generate_clinician_summary(consultation: Dict[str, Any]) -> Dict[str, Any]:
    """Generate clinician summary from consultation"""
    return {
        "chiefComplaint": "Patient presents with headache and fever [S1]",
        "historyOfPresentIllness": "Headache started this morning, described as very painful in forehead region [S2]. Patient reports feeling feverish and tired [S3]",
        "physicalExam": "Vital signs: Temperature 37.9°C, blood pressure 118/75 mmHg, heart rate 92 bpm [S4]. Patient appears alert but in mild distress [S5]",
        "assessment": "Differential diagnosis includes tension headache and viral infection [S6]. Symptoms consistent with viral syndrome [S7]",
        "plan": "Prescribe acetaminophen 500mg every 6 hours as needed for pain and fever [S8]. Recommend rest and adequate hydration [S9]",
        "followUp": "Schedule follow-up appointment in 3-5 days to reassess symptoms and adjust treatment plan as needed [S10]",
        "citations": [
            {"id": 1, "content": "headache this morning", "source": "Consultation transcript", "timestamp": "20:37:10"},
            {"id": 2, "content": "Forehead, very painful", "source": "Consultation transcript", "timestamp": "20:37:24"},
            {"id": 3, "content": "feel feverish and tired", "source": "Consultation transcript", "timestamp": "20:37:35"},
            {"id": 4, "content": "temperature is 37.9°C, blood pressure 118/75", "source": "Consultation transcript", "timestamp": "20:37:45"},
            {"id": 5, "content": "Patient appears alert but in mild distress", "source": "Doctor notes", "timestamp": "20:37:45"},
            {"id": 6, "content": "tension headache or viral infection", "source": "Consultation transcript", "timestamp": "20:37:50"},
            {"id": 7, "content": "viral syndrome", "source": "Clinical assessment", "timestamp": "20:37:50"},
            {"id": 8, "content": "prescribe acetaminophen", "source": "Consultation transcript", "timestamp": "20:37:55"},
            {"id": 9, "content": "recommend rest", "source": "Consultation transcript", "timestamp": "20:37:55"},
            {"id": 10, "content": "Follow up in 3-5 days", "source": "Consultation transcript", "timestamp": "20:38:00"}
        ]
    }

def generate_patient_summary(consultation: Dict[str, Any]) -> Dict[str, Any]:
    """Generate patient summary from consultation"""
    return {
        "diagnosis": "You have a headache with fever, which could be caused by tension or a viral infection [S1]",
        "medications": "Acetaminophen (Tylenol) 500mg every 6 hours as needed for pain and fever [S2]",
        "instructions": "Take acetaminophen as directed by your doctor, usually every 4-6 hours as needed [S3]",
        "homeCare": "Rest and stay hydrated to help manage your symptoms [S4]. Get plenty of sleep and avoid stress [S5]",
        "recovery": "You can expect to feel better with rest and over-the-counter pain relief [S6]. Most symptoms should improve within 3-5 days [S7]",
        "followUp": "Schedule a follow-up appointment in 3-5 days if your symptoms persist or worsen [S8]",
        "warningSigns": "Watch for signs of worsening headache, such as increased severity or frequency [S9]. Contact your doctor if you experience severe symptoms [S10]",
        "whenToSeekHelp": "Contact your doctor immediately if your headache worsens or if you experience any of the following: fever above 38.5°C, severe headache, neck stiffness, or confusion [S11]",
        "citations": [
            {"id": 1, "content": "headache with fever", "source": "Consultation transcript", "timestamp": "20:37:10"},
            {"id": 2, "content": "prescribe acetaminophen", "source": "Consultation transcript", "timestamp": "20:37:55"},
            {"id": 3, "content": "every 4-6 hours as needed", "source": "Treatment plan", "timestamp": "20:37:55"},
            {"id": 4, "content": "recommend rest", "source": "Consultation transcript", "timestamp": "20:37:55"},
            {"id": 5, "content": "adequate hydration", "source": "Treatment plan", "timestamp": "20:37:55"},
            {"id": 6, "content": "feel better with rest", "source": "Recovery guidance", "timestamp": "20:37:55"},
            {"id": 7, "content": "improve within 3-5 days", "source": "Follow-up plan", "timestamp": "20:38:00"},
            {"id": 8, "content": "Follow up in 3-5 days", "source": "Consultation transcript", "timestamp": "20:38:00"},
            {"id": 9, "content": "worsening headache", "source": "Warning signs", "timestamp": "20:38:00"},
            {"id": 10, "content": "severe symptoms", "source": "Warning signs", "timestamp": "20:38:00"},
            {"id": 11, "content": "fever above 38.5°C", "source": "Emergency criteria", "timestamp": "20:38:00"}
        ]
    }

def run_summary_comparison_test():
    """Run the summary comparison test"""
    print("📋 Summary Template Comparison Test")
    print("=" * 50)
    print("Comparing Clinician Summary vs Patient Summary")
    print("Generated from the same synthetic consultation")
    print()
    
    # Generate test data
    consultation = generate_synthetic_consultation()
    clinician_summary = generate_clinician_summary(consultation)
    patient_summary = generate_patient_summary(consultation)
    
    # Analyze summaries
    analyzer = SummaryAnalyzer()
    comparisons = analyzer.compare_summaries(clinician_summary, patient_summary)
    
    print("🔍 Detailed Field-by-Field Comparison")
    print("=" * 50)
    
    for comparison in comparisons:
        print(f"\n📊 {comparison.field.upper()}")
        print(f"Alignment Score: {comparison.alignment_score:.2f}/1.0")
        print(f"Content Overlap: {comparison.content_overlap:.2f}/1.0")
        print(f"Tone Difference: {comparison.tone_difference}")
        print()
        print("👨‍⚕️ CLINICIAN SUMMARY:")
        print(f"  {comparison.clinician_content}")
        print()
        print("👤 PATIENT SUMMARY:")
        print(f"  {comparison.patient_content}")
        print("-" * 80)
    
    # Overall analysis
    print("\n📈 Overall Analysis")
    print("=" * 30)
    
    avg_alignment = sum(c.alignment_score for c in comparisons) / len(comparisons)
    avg_overlap = sum(c.content_overlap for c in comparisons) / len(comparisons)
    
    print(f"Average Alignment Score: {avg_alignment:.2f}/1.0")
    print(f"Average Content Overlap: {avg_overlap:.2f}/1.0")
    print(f"Total Fields Compared: {len(comparisons)}")
    
    # Design choices explanation
    print("\n🎯 Design Choices Explanation")
    print("=" * 40)
    
    print("""
    📋 CLINICIAN SUMMARY DESIGN:
    - Uses medical terminology and clinical language
    - Focuses on diagnostic reasoning and treatment rationale
    - Includes detailed physical examination findings
    - Emphasizes differential diagnosis and clinical assessment
    - Structured for medical record keeping and peer review
    
    👤 PATIENT SUMMARY DESIGN:
    - Uses plain language and patient-friendly terms
    - Focuses on what the patient needs to know and do
    - Emphasizes self-care instructions and warning signs
    - Includes emotional support and reassurance
    - Structured for patient understanding and compliance
    
    🔗 ALIGNMENT STRATEGY:
    - Both summaries cover the same medical information
    - Content overlap ensures consistency in medical facts
    - Tone differences serve different audiences appropriately
    - Citations provide traceability to original sources
    - Follow-up plans are synchronized between both summaries
    """)
    
    # Quality metrics
    print("\n✅ Quality Metrics")
    print("=" * 20)
    
    high_alignment = sum(1 for c in comparisons if c.alignment_score > 0.7)
    good_overlap = sum(1 for c in comparisons if c.content_overlap > 0.5)
    
    print(f"High Alignment Fields (>0.7): {high_alignment}/{len(comparisons)}")
    print(f"Good Content Overlap (>0.5): {good_overlap}/{len(comparisons)}")
    print(f"Overall Quality: {'EXCELLENT' if avg_alignment > 0.8 else 'GOOD' if avg_alignment > 0.6 else 'NEEDS IMPROVEMENT'}")
    
    # Recommendations
    print("\n💡 Recommendations")
    print("=" * 20)
    
    if avg_alignment < 0.8:
        print("• Improve content alignment between clinician and patient summaries")
        print("• Ensure medical facts are consistent across both templates")
        print("• Synchronize follow-up plans and medication instructions")
    
    if avg_overlap < 0.6:
        print("• Increase content overlap while maintaining appropriate tone differences")
        print("• Ensure both summaries cover the same key medical information")
    
    print("• Maintain current tone differentiation for target audiences")
    print("• Continue using citations for traceability and grounding")
    print("• Regular validation of summary alignment in production")

def main():
    """Main function to run summary comparison test"""
    run_summary_comparison_test()

if __name__ == "__main__":
    main()
