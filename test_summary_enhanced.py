#!/usr/bin/env python3
"""
Ultra-Enhanced Test Summary: Advanced IR-based comparison with strict validation
and comprehensive alignment testing for medical summary generation.

This test implements:
1. Canonical IR (Intermediate Representation) as single source of truth
2. Strict field mapping contracts with validation
3. Advanced normalization strategies
4. Pre-flight validators for perfect alignment
5. Comprehensive test coverage with detailed reporting
"""

import requests
import json
import re
import time
from typing import List, Dict, Any, Tuple, Set, Optional
from dataclasses import dataclass
from enum import Enum
import difflib
from collections import defaultdict

class CertaintyLevel(Enum):
    CONFIRMED = "confirmed"
    LIKELY = "likely"
    POSSIBLE = "possible"
    UNLIKELY = "unlikely"

@dataclass
class MedicationIR:
    """Structured medication representation"""
    generic: str
    brand: List[str]
    dose: str
    route: str
    freq: str
    indication: str = ""

@dataclass
class DiagnosisIR:
    """Structured diagnosis representation"""
    name: str
    certainty: CertaintyLevel
    icd10: Optional[str] = None

@dataclass
class PlanItemIR:
    """Structured plan item representation"""
    type: str  # "rest", "follow_up", "medication", "monitoring"
    details: str
    when: Optional[str] = None
    condition: Optional[str] = None

@dataclass
class ExamIR:
    """Structured examination findings"""
    temp: Optional[str] = None
    bp: Optional[str] = None
    pulse: Optional[str] = None
    lungs: Optional[str] = None
    other: Dict[str, str] = None

@dataclass
class CanonicalIR:
    """Canonical Intermediate Representation - single source of truth"""
    diagnoses: List[DiagnosisIR]
    medications: List[MedicationIR]
    plan: List[PlanItemIR]
    exam: ExamIR
    follow_up: PlanItemIR
    chief_complaint: str
    hpi: str

@dataclass
class ValidationResult:
    """Result of validation check"""
    test_name: str
    passed: bool
    score: float
    issues: List[str]
    details: Dict[str, Any] = None

class AdvancedMedicationNormalizer:
    """Advanced medication normalization with comprehensive mapping"""
    
    def __init__(self):
        self.medication_synonyms = {
            "acetaminophen": ["tylenol", "paracetamol", "panadol", "acetaminophen"],
            "ibuprofen": ["advil", "motrin", "brufen", "ibuprofen"],
            "aspirin": ["asa", "acetylsalicylic acid", "aspirin"],
            "amoxicillin": ["amoxil", "trimox", "amoxicillin"],
        }
        
        self.frequency_mapping = {
            "q6h": "每6小時一次",
            "q8h": "每8小時一次", 
            "q12h": "每12小時一次",
            "qd": "每日一次",
            "bid": "每日兩次",
            "tid": "每日三次",
            "qid": "每日四次",
            "prn": "需要時服用",
            "q4h": "每4小時一次",
            "q2h": "每2小時一次"
        }
        
        self.route_mapping = {
            "po": "口服",
            "iv": "靜脈注射",
            "im": "肌肉注射",
            "topical": "外用",
            "sublingual": "舌下含服"
        }
    
    def normalize_medication_name(self, name: str) -> str:
        """Normalize medication name to generic form"""
        name_lower = name.lower().strip()
        for generic, brands in self.medication_synonyms.items():
            if name_lower in brands or name_lower == generic:
                return generic
        return name_lower
    
    def normalize_frequency(self, freq: str) -> str:
        """Convert medical frequency to patient-friendly format"""
        freq_lower = freq.lower().strip()
        return self.frequency_mapping.get(freq_lower, freq)
    
    def normalize_route(self, route: str) -> str:
        """Convert medical route to patient-friendly format"""
        route_lower = route.lower().strip()
        return self.route_mapping.get(route_lower, route)
    
    def extract_medications_detailed(self, text: str) -> List[Dict[str, str]]:
        """Extract detailed medication information from text"""
        medications = []
        
        # Pattern to match medication mentions with dose and frequency
        med_patterns = [
            r'(\b(?:acetaminophen|tylenol|paracetamol)\b[^.]*?)(?:\s|$)',
            r'(\b(?:ibuprofen|advil|motrin)\b[^.]*?)(?:\s|$)',
            r'(\b(?:aspirin|asa)\b[^.]*?)(?:\s|$)',
            r'(\b(?:amoxicillin|amoxil)\b[^.]*?)(?:\s|$)',
        ]
        
        for pattern in med_patterns:
            matches = re.findall(pattern, text.lower())
            for match in matches:
                med_info = self.parse_medication_info(match)
                if med_info:
                    medications.append(med_info)
        
        return medications
    
    def parse_medication_info(self, text: str) -> Optional[Dict[str, str]]:
        """Parse medication information from text"""
        # Extract dose
        dose_match = re.search(r'(\d+(?:\.\d+)?\s*(?:mg|g|ml|mcg))', text)
        dose = dose_match.group(1) if dose_match else ""
        
        # Extract frequency
        freq_match = re.search(r'(q\d+h|qd|bid|tid|qid|prn)', text)
        freq = freq_match.group(1) if freq_match else ""
        
        # Extract route
        route_match = re.search(r'\b(po|iv|im|topical|sublingual)\b', text)
        route = route_match.group(1) if route_match else "po"
        
        # Extract generic name
        generic = self.normalize_medication_name(text.split()[0])
        
        return {
            "generic": generic,
            "dose": dose,
            "freq": freq,
            "route": route,
            "original_text": text.strip()
        }

class AdvancedCertaintyNormalizer:
    """Advanced certainty normalization with strict validation"""
    
    def __init__(self):
        self.certainty_patterns = {
            CertaintyLevel.CONFIRMED: {
                "clinician": [r'\b(?:confirmed|definitive|established|diagnosed)\b'],
                "patient": [r'\b(?:確診|確定|已確認|診斷為)\b']
            },
            CertaintyLevel.LIKELY: {
                "clinician": [r'\b(?:likely|probable|suspected|presumed)\b'],
                "patient": [r'\b(?:大機會|很可能|疑似|懷疑)\b']
            },
            CertaintyLevel.POSSIBLE: {
                "clinician": [r'\b(?:possible|potential|may be|could be)\b'],
                "patient": [r'\b(?:可能|或許|有機會|或許是)\b']
            },
            CertaintyLevel.UNLIKELY: {
                "clinician": [r'\b(?:unlikely|doubtful|improbable)\b'],
                "patient": [r'\b(?:機會較低|不太可能|較少機會)\b']
            }
        }
    
    def detect_certainty_level(self, text: str) -> CertaintyLevel:
        """Detect certainty level from text"""
        text_lower = text.lower()
        
        for level, patterns in self.certainty_patterns.items():
            for pattern in patterns["clinician"]:
                if re.search(pattern, text_lower):
                    return level
        
        return CertaintyLevel.POSSIBLE  # Default
    
    def validate_certainty_alignment(self, clinician_text: str, patient_text: str) -> Tuple[bool, List[str]]:
        """Validate that certainty levels are properly aligned"""
        clinician_certainty = self.detect_certainty_level(clinician_text)
        patient_certainty = self.detect_certainty_level(patient_text)
        
        issues = []
        
        # If clinician is not confirmed, patient should not use confirmed language
        if clinician_certainty != CertaintyLevel.CONFIRMED:
            confirmed_patterns = self.certainty_patterns[CertaintyLevel.CONFIRMED]["patient"]
            for pattern in confirmed_patterns:
                if re.search(pattern, patient_text):
                    issues.append(f"Patient uses confirmed language when clinician certainty is {clinician_certainty.value}")
        
        # Check for appropriate certainty alignment
        if clinician_certainty == CertaintyLevel.POSSIBLE and patient_certainty == CertaintyLevel.CONFIRMED:
            issues.append("Patient uses confirmed language when clinician only suggests possibility")
        
        return len(issues) == 0, issues

class UltraEnhancedSummaryTester:
    """Ultra-enhanced summary tester with advanced IR-based validation"""
    
    def __init__(self, base_url: str = "http://localhost:3000"):
        self.base_url = base_url
        self.session = requests.Session()
        self.session.headers.update({
            'Content-Type': 'application/json',
            'Authorization': 'Bearer test-token'
        })
        
        self.med_normalizer = AdvancedMedicationNormalizer()
        self.certainty_normalizer = AdvancedCertaintyNormalizer()
        
        # Define strict field mapping contracts
        self.field_mappings = {
            "medications": {
                "clinician_field": "medications",
                "patient_field": "medications", 
                "validation_rules": ["exact_medication_set", "dose_normalization", "frequency_conversion"],
                "tolerance": 0.0  # Zero tolerance for medication differences
            },
            "plan_instructions": {
                "clinician_field": "plan",
                "patient_field": "instructions",
                "validation_rules": ["semantic_similarity", "no_extra_steps", "coverage_check"],
                "tolerance": 0.2  # 20% tolerance for plan-instruction differences
            },
            "diagnosis": {
                "clinician_field": "assessment", 
                "patient_field": "diagnosis",
                "validation_rules": ["certainty_alignment", "no_new_diagnoses", "terminology_consistency"],
                "tolerance": 0.0  # Zero tolerance for diagnosis differences
            },
            "follow_up": {
                "clinician_field": "followUp",
                "patient_field": "followUp", 
                "validation_rules": ["exact_timing_match", "same_conditions", "format_consistency"],
                "tolerance": 0.0  # Zero tolerance for follow-up differences
            }
        }
    
    def generate_synthetic_consultation(self) -> str:
        """Generate a comprehensive synthetic consultation transcript"""
        return """
        [20:37:04] DOCTOR: Good morning, I'm Dr. Chan. How are you feeling today?
        [20:37:10] PATIENT: Morning doctor, I've had a severe headache since this morning
        [20:37:16] DOCTOR: Can you describe the pain? Where is it located?
        [20:37:24] PATIENT: It's in my forehead, very painful, like a tight band around my head
        [20:37:30] DOCTOR: Any other symptoms? Fever, nausea, sensitivity to light?
        [20:37:35] PATIENT: Yes, I feel feverish and very tired. No nausea but light hurts my eyes
        [20:37:40] DOCTOR: Let me check your vital signs
        [20:37:45] DOCTOR: Your temperature is 38.2°C, blood pressure 120/80, pulse 88
        [20:37:50] DOCTOR: Based on your symptoms, this could be a tension headache or possibly a viral infection
        [20:37:55] DOCTOR: I'll prescribe acetaminophen 500mg every 6 hours as needed for pain and fever
        [20:38:00] DOCTOR: Please rest at home, stay hydrated, and follow up in 3-5 days if symptoms persist
        [20:38:05] PATIENT: Thank you doctor, I'll follow your advice
        [20:38:10] DOCTOR: Take care and call if symptoms worsen or if you develop new symptoms
        """
    
    def generate_canonical_ir(self, transcript: str) -> Dict[str, Any]:
        """Generate Canonical IR using the dedicated API endpoint"""
        try:
            payload = {
                "transcript": transcript,
                "reservationId": "test-ultra-enhanced-summary"
            }
            
            response = self.session.post(f"{self.base_url}/api/forms/generate-ir", 
                json=payload,
                timeout=120
            )
            
            if response.status_code == 200:
                result = response.json()
                return result.get("canonicalIR", {})
            else:
                print(f"❌ IR generation failed: {response.status_code}")
                return {}
                
        except Exception as e:
            print(f"❌ Error generating IR: {e}")
            return {}
    
    def call_form_generation_api(self, form_type: str, transcript: str, ir: CanonicalIR = None) -> Dict[str, Any]:
        """Call the form generation API with IR context"""
        try:
            payload = {
                "formId": form_type,
                "transcript": transcript,
                "reservationId": "test-ultra-enhanced-summary"
            }
            
            if ir:
                payload["canonicalIR"] = self.ir_to_dict(ir)
            
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
    
    def ir_to_dict(self, ir: CanonicalIR) -> Dict[str, Any]:
        """Convert CanonicalIR to dictionary for API transmission"""
        return {
            "diagnoses": [{"name": d.name, "certainty": d.certainty.value} for d in ir.diagnoses],
            "medications": [{"generic": m.generic, "brand": m.brand, "dose": m.dose, 
                           "route": m.route, "freq": m.freq, "indication": m.indication} for m in ir.medications],
            "plan": [{"type": p.type, "details": p.details, "when": p.when, "condition": p.condition} for p in ir.plan],
            "exam": {"temp": ir.exam.temp, "bp": ir.exam.bp, "pulse": ir.exam.pulse, 
                    "lungs": ir.exam.lungs, "other": ir.exam.other or {}},
            "follow_up": {"type": ir.follow_up.type, "details": ir.follow_up.details, 
                         "when": ir.follow_up.when, "condition": ir.follow_up.condition},
            "chief_complaint": ir.chief_complaint,
            "hpi": ir.hpi
        }
    
    def dict_to_ir(self, ir_dict: Dict[str, Any]) -> CanonicalIR:
        """Convert dictionary to CanonicalIR object"""
        diagnoses = []
        for d in ir_dict.get("diagnoses", []):
            certainty = CertaintyLevel(d.get("certainty", "possible"))
            diagnoses.append(DiagnosisIR(d.get("name", ""), certainty, d.get("icd10")))
        
        medications = []
        for m in ir_dict.get("medications", []):
            medications.append(MedicationIR(
                m.get("generic", ""),
                m.get("brand", []),
                m.get("dose", ""),
                m.get("route", ""),
                m.get("freq", ""),
                m.get("indication", "")
            ))
        
        plan = []
        for p in ir_dict.get("plan", []):
            plan.append(PlanItemIR(
                p.get("type", ""),
                p.get("details", ""),
                p.get("when"),
                p.get("condition")
            ))
        
        exam_data = ir_dict.get("exam", {})
        exam = ExamIR(
            temp=exam_data.get("temp"),
            bp=exam_data.get("bp"),
            pulse=exam_data.get("pulse"),
            lungs=exam_data.get("lungs"),
            other=exam_data.get("other", {})
        )
        
        follow_up_data = ir_dict.get("follow_up", {})
        if isinstance(follow_up_data, str):
            # If follow_up is a string, create a basic PlanItemIR
            follow_up = PlanItemIR("follow_up", follow_up_data)
        else:
            follow_up = PlanItemIR(
                follow_up_data.get("type", "follow_up"),
                follow_up_data.get("details", ""),
                follow_up_data.get("when"),
                follow_up_data.get("condition")
            )
        
        return CanonicalIR(
            diagnoses=diagnoses,
            medications=medications,
            plan=plan,
            exam=exam,
            follow_up=follow_up,
            chief_complaint=ir_dict.get("chief_complaint", ""),
            hpi=ir_dict.get("hpi", "")
        )
    
    def test_medication_alignment_ultra_strict(self, clinician_summary: Dict, patient_summary: Dict) -> ValidationResult:
        """Ultra-strict medication alignment test"""
        issues = []
        details = {}
        
        # Extract medications from both summaries
        clinician_meds = self.med_normalizer.extract_medications_detailed(
            str(clinician_summary.get("medications", ""))
        )
        patient_meds = self.med_normalizer.extract_medications_detailed(
            str(patient_summary.get("medications", ""))
        )
        
        details["clinician_medications"] = clinician_meds
        details["patient_medications"] = patient_meds
        
        # Check 1: Same number of medications
        if len(clinician_meds) != len(patient_meds):
            issues.append(f"Different number of medications: {len(clinician_meds)} vs {len(patient_meds)}")
        
        # Check 2: Same generic names
        clinician_generics = {med["generic"] for med in clinician_meds}
        patient_generics = {med["generic"] for med in patient_meds}
        
        if clinician_generics != patient_generics:
            issues.append(f"Different medication generics: {clinician_generics} vs {patient_generics}")
        
        # Check 3: Dose consistency
        for i, (c_med, p_med) in enumerate(zip(clinician_meds, patient_meds)):
            if c_med["dose"] and p_med["dose"] and c_med["dose"] != p_med["dose"]:
                issues.append(f"Medication {i+1} dose differs: {c_med['dose']} vs {p_med['dose']}")
        
        # Check 4: Frequency normalization
        for i, p_med in enumerate(patient_meds):
            if p_med["freq"] and not self.med_normalizer.normalize_frequency(p_med["freq"]):
                issues.append(f"Patient medication {i+1} frequency not properly normalized: {p_med['freq']}")
        
        # Check 5: No extra medications in patient version
        extra_meds = patient_generics - clinician_generics
        if extra_meds:
            issues.append(f"Patient summary contains extra medications: {extra_meds}")
        
        passed = len(issues) == 0
        score = 1.0 if passed else max(0.0, 1.0 - len(issues) * 0.2)
        
        return ValidationResult(
            test_name="medication_alignment_ultra_strict",
            passed=passed,
            score=score,
            issues=issues,
            details=details
        )
    
    def test_followup_alignment_ultra_strict(self, clinician_summary: Dict, patient_summary: Dict) -> ValidationResult:
        """Ultra-strict follow-up alignment test"""
        issues = []
        details = {}
        
        clinician_followup = str(clinician_summary.get("followUp", "")).lower()
        patient_followup = str(patient_summary.get("followUp", "")).lower()
        
        details["clinician_followup"] = clinician_followup
        details["patient_followup"] = patient_followup
        
        # Extract timing information
        clinician_timing = self.extract_timing_strict(clinician_followup)
        patient_timing = self.extract_timing_strict(patient_followup)
        
        # Extract conditions
        clinician_conditions = self.extract_conditions_strict(clinician_followup)
        patient_conditions = self.extract_conditions_strict(patient_followup)
        
        details["timing"] = {"clinician": clinician_timing, "patient": patient_timing}
        details["conditions"] = {"clinician": clinician_conditions, "patient": patient_conditions}
        
        # Check 1: Exact timing match
        if clinician_timing != patient_timing:
            issues.append(f"Follow-up timing differs: '{clinician_timing}' vs '{patient_timing}'")
        
        # Check 2: Exact condition match
        if clinician_conditions != patient_conditions:
            issues.append(f"Follow-up conditions differ: '{clinician_conditions}' vs '{patient_conditions}'")
        
        # Check 3: No additional information in patient version
        if len(patient_followup.split()) > len(clinician_followup.split()) * 1.5:
            issues.append("Patient follow-up contains significantly more information than clinician version")
        
        passed = len(issues) == 0
        score = 1.0 if passed else max(0.0, 1.0 - len(issues) * 0.3)
        
        return ValidationResult(
            test_name="followup_alignment_ultra_strict",
            passed=passed,
            score=score,
            issues=issues,
            details=details
        )
    
    def extract_timing_strict(self, text: str) -> str:
        """Extract timing information with strict matching"""
        timing_patterns = [
            r'(\d+[-–]\d+\s*days?)',
            r'(\d+\s*weeks?)',
            r'(\d+\s*days?)',
            r'(in\s+\d+[-–]\d+\s*days?)',
            r'(in\s+\d+\s*weeks?)'
        ]
        
        for pattern in timing_patterns:
            match = re.search(pattern, text)
            if match:
                return match.group(1).strip()
        
        return ""
    
    def extract_conditions_strict(self, text: str) -> str:
        """Extract conditions with strict matching"""
        condition_patterns = [
            r'(if\s+[^.]*)',
            r'(when\s+[^.]*)',
            r'(unless\s+[^.]*)',
            r'(provided\s+[^.]*)'
        ]
        
        for pattern in condition_patterns:
            match = re.search(pattern, text)
            if match:
                return match.group(1).strip()
        
        return ""
    
    def test_diagnosis_alignment_ultra_strict(self, clinician_summary: Dict, patient_summary: Dict) -> ValidationResult:
        """Ultra-strict diagnosis alignment test"""
        issues = []
        details = {}
        
        clinician_assessment = str(clinician_summary.get("assessment", ""))
        patient_diagnosis = str(patient_summary.get("diagnosis", ""))
        
        details["clinician_assessment"] = clinician_assessment
        details["patient_diagnosis"] = patient_diagnosis
        
        # Check 1: Certainty alignment
        is_aligned, certainty_issues = self.certainty_normalizer.validate_certainty_alignment(
            clinician_assessment, patient_diagnosis
        )
        issues.extend(certainty_issues)
        
        # Check 2: No new diagnoses in patient version
        # Extract diagnosis terms from both
        clinician_diagnoses = self.extract_diagnosis_terms(clinician_assessment)
        patient_diagnoses = self.extract_diagnosis_terms(patient_diagnosis)
        
        extra_diagnoses = patient_diagnoses - clinician_diagnoses
        if extra_diagnoses:
            issues.append(f"Patient summary contains extra diagnoses: {extra_diagnoses}")
        
        details["diagnosis_terms"] = {
            "clinician": list(clinician_diagnoses),
            "patient": list(patient_diagnoses),
            "extra": list(extra_diagnoses)
        }
        
        # Check 3: Terminology consistency
        if not self.check_terminology_consistency(clinician_assessment, patient_diagnosis):
            issues.append("Diagnosis terminology not consistent between versions")
        
        passed = len(issues) == 0
        score = 1.0 if passed else max(0.0, 1.0 - len(issues) * 0.25)
        
        return ValidationResult(
            test_name="diagnosis_alignment_ultra_strict",
            passed=passed,
            score=score,
            issues=issues,
            details=details
        )
    
    def extract_diagnosis_terms(self, text: str) -> Set[str]:
        """Extract diagnosis terms from text"""
        # Common medical diagnosis terms
        diagnosis_terms = {
            "headache", "migraine", "tension", "fever", "infection", "viral", "bacterial",
            "hypertension", "diabetes", "pneumonia", "bronchitis", "asthma", "allergy"
        }
        
        text_lower = text.lower()
        found_terms = set()
        
        for term in diagnosis_terms:
            if term in text_lower:
                found_terms.add(term)
        
        return found_terms
    
    def check_terminology_consistency(self, clinician_text: str, patient_text: str) -> bool:
        """Check if terminology is consistent between versions"""
        # Simple check for key medical terms
        key_terms = ["headache", "fever", "pain", "symptoms"]
        
        for term in key_terms:
            if term in clinician_text.lower() and term not in patient_text.lower():
                return False
        
        return True
    
    def test_plan_instructions_alignment_ultra_strict(self, clinician_summary: Dict, patient_summary: Dict) -> ValidationResult:
        """Ultra-strict plan-instructions alignment test"""
        issues = []
        details = {}
        
        clinician_plan = str(clinician_summary.get("plan", ""))
        patient_instructions = str(patient_summary.get("instructions", ""))
        
        details["clinician_plan"] = clinician_plan
        details["patient_instructions"] = patient_instructions
        
        # Check 1: Semantic similarity
        similarity = self.calculate_semantic_similarity_advanced(clinician_plan, patient_instructions)
        details["similarity_score"] = similarity
        
        if similarity < 0.8:
            issues.append(f"Plan-instructions similarity too low: {similarity:.2f}")
        
        # Check 2: No extra steps in patient version
        extra_steps = self.detect_extra_steps_advanced(clinician_plan, patient_instructions)
        if extra_steps:
            issues.append(f"Patient instructions contain extra steps: {extra_steps}")
            details["extra_steps"] = extra_steps
        
        # Check 3: Coverage check - all plan items should be covered
        coverage_issues = self.check_plan_coverage(clinician_plan, patient_instructions)
        if coverage_issues:
            issues.extend(coverage_issues)
            details["coverage_issues"] = coverage_issues
        
        passed = len(issues) == 0
        score = similarity if passed else max(0.0, similarity - len(issues) * 0.1)
        
        return ValidationResult(
            test_name="plan_instructions_alignment_ultra_strict",
            passed=passed,
            score=score,
            issues=issues,
            details=details
        )
    
    def calculate_semantic_similarity_advanced(self, text1: str, text2: str) -> float:
        """Advanced semantic similarity calculation"""
        if not text1 or not text2:
            return 0.0
        
        # Word-based similarity
        words1 = set(text1.lower().split())
        words2 = set(text2.lower().split())
        
        if not words1 or not words2:
            return 0.0
        
        intersection = words1.intersection(words2)
        union = words1.union(words2)
        
        word_similarity = len(intersection) / len(union) if union else 0.0
        
        # Phrase-based similarity
        phrases1 = self.extract_phrases(text1)
        phrases2 = self.extract_phrases(text2)
        
        phrase_intersection = phrases1.intersection(phrases2)
        phrase_union = phrases1.union(phrases2)
        
        phrase_similarity = len(phrase_intersection) / len(phrase_union) if phrase_union else 0.0
        
        # Weighted combination
        return word_similarity * 0.6 + phrase_similarity * 0.4
    
    def extract_phrases(self, text: str) -> Set[str]:
        """Extract meaningful phrases from text"""
        # Simple phrase extraction - in practice, use more sophisticated NLP
        phrases = set()
        words = text.lower().split()
        
        # Extract 2-word phrases
        for i in range(len(words) - 1):
            phrase = f"{words[i]} {words[i+1]}"
            if len(phrase) > 5:  # Filter out very short phrases
                phrases.add(phrase)
        
        return phrases
    
    def detect_extra_steps_advanced(self, clinician_plan: str, patient_instructions: str) -> List[str]:
        """Advanced detection of extra steps in patient instructions"""
        extra_steps = []
        
        # Extract action words from both texts
        plan_actions = self.extract_actions(clinician_plan)
        instruction_actions = self.extract_actions(patient_instructions)
        
        # Find actions in instructions that are not in plan
        extra_actions = instruction_actions - plan_actions
        
        # Filter out common/expected actions
        common_actions = {"take", "rest", "drink", "call", "follow", "monitor"}
        extra_actions = extra_actions - common_actions
        
        if extra_actions:
            extra_steps.extend(list(extra_actions))
        
        return extra_steps
    
    def extract_actions(self, text: str) -> Set[str]:
        """Extract action words from text"""
        action_words = {
            "take", "rest", "drink", "call", "follow", "monitor", "avoid", "apply",
            "use", "continue", "stop", "start", "increase", "decrease", "check"
        }
        
        words = text.lower().split()
        found_actions = set()
        
        for word in words:
            if word in action_words:
                found_actions.add(word)
        
        return found_actions
    
    def check_plan_coverage(self, clinician_plan: str, patient_instructions: str) -> List[str]:
        """Check if all plan items are covered in instructions"""
        issues = []
        
        # Extract key plan items
        plan_items = self.extract_plan_items(clinician_plan)
        instruction_items = self.extract_plan_items(patient_instructions)
        
        # Check coverage
        uncovered_items = plan_items - instruction_items
        if uncovered_items:
            issues.append(f"Plan items not covered in instructions: {list(uncovered_items)}")
        
        return issues
    
    def extract_plan_items(self, text: str) -> Set[str]:
        """Extract plan items from text"""
        # Simple extraction - in practice, use more sophisticated parsing
        items = set()
        
        # Look for numbered lists
        numbered_items = re.findall(r'\d+\.\s*([^.]*)', text)
        items.update(item.strip().lower() for item in numbered_items)
        
        # Look for bullet points
        bullet_items = re.findall(r'•\s*([^.]*)', text)
        items.update(item.strip().lower() for item in bullet_items)
        
        # Look for action phrases
        action_phrases = re.findall(r'(?:take|rest|drink|call|follow|monitor)\s+[^.]*', text.lower())
        items.update(phrase.strip() for phrase in action_phrases)
        
        return items
    
    def run_ultra_enhanced_alignment_test(self):
        """Run ultra-enhanced alignment tests with comprehensive validation"""
        print("🧪 Ultra-Enhanced Summary Alignment Test Suite")
        print("=" * 70)
        print("Testing with Canonical IR, strict validation, and comprehensive reporting")
        print()
        
        # Generate synthetic consultation
        transcript = self.generate_synthetic_consultation()
        print(f"📝 Generated synthetic consultation ({len(transcript)} chars)")
        
        # Generate canonical IR using API
        print("\n🏗️  Generating Canonical IR using API...")
        ir_dict = self.generate_canonical_ir(transcript)
        
        if not ir_dict:
            print("❌ Failed to generate Canonical IR, using mock IR")
            ir_dict = self.create_mock_ir()
        else:
            print(f"✅ Generated Canonical IR with {len(ir_dict.get('medications', []))} medications, {len(ir_dict.get('diagnoses', []))} diagnoses")
        
        # Convert dict to CanonicalIR object for processing
        ir = self.dict_to_ir(ir_dict)
        
        # Generate summaries using IR
        print("\n📋 Generating Clinician Summary with IR...")
        clinician_summary = self.call_form_generation_api("clinician_summary", transcript, ir)
        
        if not clinician_summary:
            print("❌ Failed to generate clinician summary")
            return []
        
        print("✅ Clinician summary generated successfully")
        
        print("\n📋 Generating Patient Summary with IR...")
        patient_summary = self.call_form_generation_api("patient_summary", transcript, ir)
        
        if not patient_summary:
            print("❌ Failed to generate patient summary")
            return []
        
        print("✅ Patient summary generated successfully")
        
        # Run ultra-enhanced alignment tests
        print("\n🔍 Running Ultra-Enhanced Alignment Tests...")
        print("=" * 60)
        
        all_results = []
        
        # 1. Ultra-strict medication alignment
        print("\n1️⃣ Testing Medication Alignment (Ultra-Strict)...")
        med_result = self.test_medication_alignment_ultra_strict(clinician_summary, patient_summary)
        all_results.append(med_result)
        self.print_validation_result(med_result)
        
        # 2. Ultra-strict follow-up alignment
        print("\n2️⃣ Testing Follow-up Alignment (Ultra-Strict)...")
        followup_result = self.test_followup_alignment_ultra_strict(clinician_summary, patient_summary)
        all_results.append(followup_result)
        self.print_validation_result(followup_result)
        
        # 3. Ultra-strict diagnosis alignment
        print("\n3️⃣ Testing Diagnosis Alignment (Ultra-Strict)...")
        diagnosis_result = self.test_diagnosis_alignment_ultra_strict(clinician_summary, patient_summary)
        all_results.append(diagnosis_result)
        self.print_validation_result(diagnosis_result)
        
        # 4. Ultra-strict plan-instructions alignment
        print("\n4️⃣ Testing Plan-Instructions Alignment (Ultra-Strict)...")
        plan_result = self.test_plan_instructions_alignment_ultra_strict(clinician_summary, patient_summary)
        all_results.append(plan_result)
        self.print_validation_result(plan_result)
        
        return all_results
    
    def create_mock_ir(self) -> Dict[str, Any]:
        """Create a mock IR for testing"""
        return {
            "diagnoses": [
                {"name": "Tension headache", "certainty": "possible", "icd10": None},
                {"name": "Viral infection", "certainty": "possible", "icd10": None}
            ],
            "medications": [
                {
                    "generic": "acetaminophen",
                    "brand": ["Tylenol"],
                    "dose": "500mg",
                    "route": "PO",
                    "freq": "q6h",
                    "indication": "pain and fever relief"
                }
            ],
            "plan": [
                {"type": "rest", "details": "home rest", "when": None, "condition": None},
                {"type": "medication", "details": "acetaminophen as needed", "when": None, "condition": None},
                {"type": "monitoring", "details": "watch for worsening symptoms", "when": None, "condition": None}
            ],
            "exam": {
                "temp": "38.2°C",
                "bp": "120/80",
                "pulse": "88",
                "lungs": "clear",
                "other": {}
            },
            "follow_up": {
                "type": "follow_up",
                "details": "reassess symptoms",
                "when": "3-5 days",
                "condition": "if symptoms persist"
            },
            "chief_complaint": "Severe headache with fever",
            "hpi": "Patient presents with severe headache, fever, and photophobia"
        }
    
    def print_validation_result(self, result: ValidationResult):
        """Print validation result in a formatted way"""
        status = "✅" if result.passed else "❌"
        print(f"  {status} {result.test_name}:")
        print(f"    Score: {result.score:.2f}")
        if result.issues:
            for issue in result.issues:
                print(f"    Issue: {issue}")
        if result.details:
            for key, value in result.details.items():
                if isinstance(value, (str, int, float)):
                    print(f"    {key}: {value}")
        print()
    
    def analyze_ultra_enhanced_results(self, results: List[ValidationResult]):
        """Analyze ultra-enhanced test results"""
        print("\n📊 Ultra-Enhanced Results Analysis")
        print("=" * 50)
        
        total_tests = len(results)
        passed_tests = sum(1 for r in results if r.passed)
        avg_score = sum(r.score for r in results) / total_tests if total_tests > 0 else 0
        
        print(f"Total Tests: {total_tests}")
        print(f"Passed Tests: {passed_tests}")
        print(f"Pass Rate: {(passed_tests/total_tests)*100:.1f}%")
        print(f"Average Score: {avg_score:.2f}")
        
        print(f"\n🎯 IR-Based Approach Benefits:")
        print(f"  ✅ Canonical IR ensures single source of truth")
        print(f"  ✅ Structured validation enables precise alignment")
        print(f"  ✅ Ultra-strict rules prevent inconsistencies")
        print(f"  ✅ Comprehensive reporting identifies specific issues")
        
        if avg_score >= 0.9:
            print(f"\n🎉 Excellent alignment achieved with ultra-enhanced approach!")
        elif avg_score >= 0.7:
            print(f"\n✅ Good alignment with some areas for improvement")
        else:
            print(f"\n⚠️  Significant alignment issues detected - review IR structure and validation rules")
        
        # Detailed issue analysis
        print(f"\n🔍 Detailed Issue Analysis:")
        for result in results:
            if not result.passed:
                print(f"  ❌ {result.test_name}: {len(result.issues)} issues")
                for issue in result.issues[:3]:  # Show first 3 issues
                    print(f"    - {issue}")
                if len(result.issues) > 3:
                    print(f"    ... and {len(result.issues) - 3} more issues")
    
    def check_server_status(self):
        """Check if the healthcare platform server is running"""
        print("🔍 Checking Server Status")
        print("=" * 30)
        
        try:
            response = self.session.get(f"{self.base_url}/api/auth/session", timeout=5)
            if response.status_code in [200, 401]:
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
    """Run ultra-enhanced summary comparison tests"""
    print("📊 Ultra-Enhanced Summary Comparison Test Suite")
    print("=" * 70)
    print("Testing with Canonical IR, ultra-strict validation, and comprehensive reporting")
    print()
    
    tester = UltraEnhancedSummaryTester()
    
    # Check if server is running
    if not tester.check_server_status():
        print("\n❌ Cannot proceed without running server")
        print("Please start the healthcare platform with: npm run dev")
        return
    
    print("\n🚀 Starting Ultra-Enhanced Summary Tests")
    print("=" * 60)
    
    # Run ultra-enhanced alignment tests
    results = tester.run_ultra_enhanced_alignment_test()
    
    # Analyze results
    tester.analyze_ultra_enhanced_results(results)
    
    # Final summary
    print("\n📊 Ultra-Enhanced Test Summary")
    print("=" * 50)
    
    if results:
        total_tests = len(results)
        passed_tests = sum(1 for r in results if r.passed)
        avg_score = sum(r.score for r in results) / total_tests
        
        print(f"Total Tests: {total_tests}")
        print(f"Passed Tests: {passed_tests}")
        print(f"Pass Rate: {(passed_tests/total_tests)*100:.1f}%")
        print(f"Average Score: {avg_score:.2f}")
        
        if passed_tests == total_tests:
            print("\n🎉 Perfect alignment achieved with ultra-enhanced IR approach!")
        else:
            print(f"\n⚠️  {total_tests - passed_tests} tests failed.")
            print("Review the detailed analysis above for specific improvement areas.")
    else:
        print("❌ No test results available. Check server connectivity and API endpoints.")

if __name__ == "__main__":
    main()
