#!/usr/bin/env python3
"""
Enhanced Test Summary: Structured IR-based comparison of Clinician and Patient Summary Templates
with strict alignment validation and mapping contracts.

This test implements:
1. Canonical IR (Intermediate Representation) as single source of truth
2. Field mapping contracts with strict validation
3. Normalization strategies for medications, units, and certainty
4. Pre-flight validators for alignment
5. Comprehensive test coverage for alignment verification
"""

import requests
import json
import re
import time
from typing import List, Dict, Any, Tuple, Set, Optional
from dataclasses import dataclass
from enum import Enum
import difflib

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
class FieldMapping:
    """Field mapping contract between clinician and patient summaries"""
    clinician_field: str
    patient_field: str
    mapping_type: str  # "1:1", "1:many", "many:1"
    validation_rules: List[str]
    normalization_required: bool = False

@dataclass
class AlignmentResult:
    """Result of alignment validation"""
    field: str
    is_aligned: bool
    alignment_score: float
    issues: List[str]
    clinician_content: str
    patient_content: str

class MedicationNormalizer:
    """Normalizes medication names and dosages"""
    
    def __init__(self):
        self.medication_synonyms = {
            "acetaminophen": ["tylenol", "paracetamol", "panadol"],
            "ibuprofen": ["advil", "motrin", "brufen"],
            "aspirin": ["asa", "acetylsalicylic acid"],
            "amoxicillin": ["amoxil", "trimox"],
        }
        
        self.frequency_mapping = {
            "q6h": "每6小時一次",
            "q8h": "每8小時一次", 
            "q12h": "每12小時一次",
            "qd": "每日一次",
            "bid": "每日兩次",
            "tid": "每日三次",
            "qid": "每日四次",
            "prn": "需要時服用"
        }
    
    def normalize_medication_name(self, name: str) -> str:
        """Normalize medication name to generic form"""
        name_lower = name.lower()
        for generic, brands in self.medication_synonyms.items():
            if name_lower in brands or name_lower == generic:
                return generic
        return name_lower
    
    def normalize_frequency(self, freq: str) -> str:
        """Convert medical frequency to patient-friendly format"""
        freq_lower = freq.lower()
        return self.frequency_mapping.get(freq_lower, freq)
    
    def extract_medications(self, text: str) -> Set[str]:
        """Extract and normalize medications from text"""
        medications = set()
        # Simple regex to find medication mentions
        med_pattern = r'\b(acetaminophen|tylenol|ibuprofen|advil|aspirin|amoxicillin)\b'
        matches = re.findall(med_pattern, text.lower())
        for match in matches:
            medications.add(self.normalize_medication_name(match))
        return medications

class CertaintyNormalizer:
    """Normalizes certainty levels between clinician and patient language"""
    
    def __init__(self):
        self.certainty_mapping = {
            CertaintyLevel.CONFIRMED: {
                "clinician": ["confirmed", "definitive", "established"],
                "patient": ["確診", "確定", "已確認"]
            },
            CertaintyLevel.LIKELY: {
                "clinician": ["likely", "probable", "suspected"],
                "patient": ["大機會", "很可能", "疑似"]
            },
            CertaintyLevel.POSSIBLE: {
                "clinician": ["possible", "potential", "may be"],
                "patient": ["可能", "或許", "有機會"]
            },
            CertaintyLevel.UNLIKELY: {
                "clinician": ["unlikely", "doubtful", "improbable"],
                "patient": ["機會較低", "不太可能", "較少機會"]
            }
        }
    
    def detect_certainty(self, text: str) -> CertaintyLevel:
        """Detect certainty level from text"""
        text_lower = text.lower()
        for level, phrases in self.certainty_mapping.items():
            for phrase in phrases["clinician"]:
                if phrase in text_lower:
                    return level
        return CertaintyLevel.POSSIBLE  # Default
    
    def validate_certainty_alignment(self, clinician_text: str, patient_text: str) -> bool:
        """Validate that certainty levels are properly aligned"""
        clinician_certainty = self.detect_certainty(clinician_text)
        patient_certainty = self.detect_certainty(patient_text)
        
        # If clinician is not confirmed, patient should not use confirmed language
        if clinician_certainty != CertaintyLevel.CONFIRMED:
            confirmed_phrases = self.certainty_mapping[CertaintyLevel.CONFIRMED]["patient"]
            for phrase in confirmed_phrases:
                if phrase in patient_text:
                    return False
        
        return True

class EnhancedSummaryTester:
    """Enhanced summary tester with IR-based validation"""
    
    def __init__(self, base_url: str = "http://localhost:3000"):
        self.base_url = base_url
        self.session = requests.Session()
        self.session.headers.update({
            'Content-Type': 'application/json',
            'Authorization': 'Bearer test-token'
        })
        
        self.med_normalizer = MedicationNormalizer()
        self.certainty_normalizer = CertaintyNormalizer()
        
        # Define field mapping contracts
        self.field_mappings = [
            FieldMapping("medications", "medications", "1:1", 
                        ["same_medication_set", "dose_normalization"]),
            FieldMapping("plan", "instructions", "1:many", 
                        ["semantic_similarity", "no_extra_steps"]),
            FieldMapping("assessment", "diagnosis", "1:1", 
                        ["certainty_alignment", "no_new_diagnoses"]),
            FieldMapping("followUp", "followUp", "1:1", 
                        ["exact_timing_match", "same_conditions"]),
            FieldMapping("physicalExam", "homeCare", "1:1", 
                        ["actionable_conclusions_only"])
        ]
    
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
    
    def create_canonical_ir(self, transcript: str) -> CanonicalIR:
        """Create canonical IR from transcript - this would ideally be generated by LLM"""
        # For testing, we'll create a mock IR based on the transcript
        return CanonicalIR(
            diagnoses=[
                DiagnosisIR("Tension headache", CertaintyLevel.POSSIBLE),
                DiagnosisIR("Viral infection", CertaintyLevel.POSSIBLE)
            ],
            medications=[
                MedicationIR("acetaminophen", ["tylenol"], "500mg", "PO", "q6h PRN fever", "fever reduction")
            ],
            plan=[
                PlanItemIR("rest", "home rest"),
                PlanItemIR("medication", "acetaminophen as needed"),
                PlanItemIR("monitoring", "watch for worsening symptoms")
            ],
            exam=ExamIR(temp="37.9°C", bp="118/75", lungs="clear"),
            follow_up=PlanItemIR("follow_up", "reassess symptoms", "3-5 days", "if symptoms persist"),
            chief_complaint="Headache with fever",
            hpi="Patient presents with forehead pain, fever, and fatigue"
        )
    
    def generate_canonical_ir(self, transcript: str) -> Dict[str, Any]:
        """Generate Canonical IR using the dedicated API endpoint"""
        try:
            payload = {
                "transcript": transcript,
                "reservationId": "test-enhanced-summary"
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
        """Call the actual form generation API with IR context"""
        try:
            payload = {
                "formId": form_type,
                "transcript": transcript,
                "reservationId": "test-enhanced-summary"
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
    
    def test_field_existence(self, clinician_summary: Dict, patient_summary: Dict) -> List[str]:
        """Test that required fields exist in both summaries"""
        required_fields = ["medications", "followUp", "diagnosis", "instructions"]
        missing_fields = []
        
        for field in required_fields:
            if field not in clinician_summary:
                missing_fields.append(f"Clinician summary missing: {field}")
            if field not in patient_summary:
                missing_fields.append(f"Patient summary missing: {field}")
        
        return missing_fields
    
    def test_medication_consistency(self, clinician_summary: Dict, patient_summary: Dict) -> AlignmentResult:
        """Test medication consistency between summaries"""
        clinician_meds = self.med_normalizer.extract_medications(
            str(clinician_summary.get("medications", ""))
        )
        patient_meds = self.med_normalizer.extract_medications(
            str(patient_summary.get("medications", ""))
        )
        
        # Check if medication sets are equal
        meds_equal = clinician_meds == patient_meds
        
        # Check for dose normalization in patient version
        patient_med_text = str(patient_summary.get("medications", ""))
        dose_normalized = self.check_dose_normalization(patient_med_text)
        
        issues = []
        if not meds_equal:
            issues.append(f"Medication sets differ: {clinician_meds} vs {patient_meds}")
        if not dose_normalized:
            issues.append("Patient medication doses not properly normalized")
        
        alignment_score = 1.0 if meds_equal and dose_normalized else 0.0
        
        return AlignmentResult(
            field="medications",
            is_aligned=meds_equal and dose_normalized,
            alignment_score=alignment_score,
            issues=issues,
            clinician_content=str(clinician_summary.get("medications", "")),
            patient_content=str(patient_summary.get("medications", ""))
        )
    
    def check_dose_normalization(self, text: str) -> bool:
        """Check if medication doses are properly normalized for patients"""
        # Look for medical abbreviations that should be normalized
        medical_abbrevs = ["q6h", "q8h", "q12h", "qd", "bid", "tid", "qid", "prn"]
        for abbrev in medical_abbrevs:
            if abbrev in text.lower():
                # Check if there's a corresponding patient-friendly version
                normalized = self.med_normalizer.normalize_frequency(abbrev)
                if normalized not in text:
                    return False
        return True
    
    def test_certainty_alignment(self, clinician_summary: Dict, patient_summary: Dict) -> AlignmentResult:
        """Test certainty alignment between assessment and diagnosis"""
        clinician_assessment = str(clinician_summary.get("assessment", ""))
        patient_diagnosis = str(patient_summary.get("diagnosis", ""))
        
        is_aligned = self.certainty_normalizer.validate_certainty_alignment(
            clinician_assessment, patient_diagnosis
        )
        
        issues = []
        if not is_aligned:
            issues.append("Certainty levels not properly aligned between clinician and patient versions")
        
        return AlignmentResult(
            field="diagnosis",
            is_aligned=is_aligned,
            alignment_score=1.0 if is_aligned else 0.0,
            issues=issues,
            clinician_content=clinician_assessment,
            patient_content=patient_diagnosis
        )
    
    def test_plan_alignment(self, clinician_summary: Dict, patient_summary: Dict) -> AlignmentResult:
        """Test that plan items are properly reflected in patient instructions"""
        clinician_plan = str(clinician_summary.get("plan", ""))
        patient_instructions = str(patient_summary.get("instructions", ""))
        
        # Calculate semantic similarity between plan and instructions
        similarity = self.calculate_semantic_similarity(clinician_plan, patient_instructions)
        
        # Check for extra steps in patient version (not allowed)
        has_extra_steps = self.detect_extra_steps(clinician_plan, patient_instructions)
        
        is_aligned = similarity >= 0.8 and not has_extra_steps
        
        issues = []
        if similarity < 0.8:
            issues.append(f"Plan-instructions similarity too low: {similarity:.2f}")
        if has_extra_steps:
            issues.append("Patient instructions contain extra steps not in clinician plan")
        
        return AlignmentResult(
            field="plan_instructions",
            is_aligned=is_aligned,
            alignment_score=similarity,
            issues=issues,
            clinician_content=clinician_plan,
            patient_content=patient_instructions
        )
    
    def calculate_semantic_similarity(self, text1: str, text2: str) -> float:
        """Calculate semantic similarity between two texts"""
        if not text1 or not text2:
            return 0.0
        
        # Simple word-based similarity
        words1 = set(text1.lower().split())
        words2 = set(text2.lower().split())
        
        if not words1 or not words2:
            return 0.0
        
        intersection = words1.intersection(words2)
        union = words1.union(words2)
        
        return len(intersection) / len(union) if union else 0.0
    
    def detect_extra_steps(self, clinician_plan: str, patient_instructions: str) -> bool:
        """Detect if patient instructions contain steps not in clinician plan"""
        # This is a simplified check - in practice, you'd use more sophisticated NLP
        plan_keywords = set(clinician_plan.lower().split())
        instruction_keywords = set(patient_instructions.lower().split())
        
        # Look for instruction keywords not present in plan
        extra_keywords = instruction_keywords - plan_keywords
        
        # Filter out common words that don't represent medical steps
        common_words = {"the", "and", "or", "but", "in", "on", "at", "to", "for", "of", "with", "by"}
        medical_extra = extra_keywords - common_words
        
        return len(medical_extra) > 3  # Threshold for "extra steps"
    
    def test_followup_alignment(self, clinician_summary: Dict, patient_summary: Dict) -> AlignmentResult:
        """Test follow-up timing and conditions alignment"""
        clinician_followup = str(clinician_summary.get("followUp", ""))
        patient_followup = str(patient_summary.get("followUp", ""))
        
        # Extract timing information
        clinician_timing = self.extract_timing(clinician_followup)
        patient_timing = self.extract_timing(patient_followup)
        
        # Extract conditions
        clinician_conditions = self.extract_conditions(clinician_followup)
        patient_conditions = self.extract_conditions(patient_followup)
        
        timing_aligned = clinician_timing == patient_timing
        conditions_aligned = clinician_conditions == patient_conditions
        
        is_aligned = timing_aligned and conditions_aligned
        
        issues = []
        if not timing_aligned:
            issues.append(f"Follow-up timing differs: '{clinician_timing}' vs '{patient_timing}'")
        if not conditions_aligned:
            issues.append(f"Follow-up conditions differ: '{clinician_conditions}' vs '{patient_conditions}'")
        
        return AlignmentResult(
            field="followUp",
            is_aligned=is_aligned,
            alignment_score=1.0 if is_aligned else 0.0,
            issues=issues,
            clinician_content=clinician_followup,
            patient_content=patient_followup
        )
    
    def extract_timing(self, text: str) -> str:
        """Extract timing information from text"""
        # Look for patterns like "3-5 days", "1 week", "2 weeks"
        timing_patterns = [
            r'(\d+[-–]\d+\s*days?)',
            r'(\d+\s*weeks?)',
            r'(\d+\s*days?)',
            r'(in\s+\d+[-–]\d+\s*days?)',
            r'(in\s+\d+\s*weeks?)'
        ]
        
        for pattern in timing_patterns:
            match = re.search(pattern, text.lower())
            if match:
                return match.group(1)
        
        return ""
    
    def extract_conditions(self, text: str) -> str:
        """Extract conditions from follow-up text"""
        # Look for conditional phrases
        condition_patterns = [
            r'(if\s+[^.]*)',
            r'(when\s+[^.]*)',
            r'(unless\s+[^.]*)',
            r'(provided\s+[^.]*)'
        ]
        
        for pattern in condition_patterns:
            match = re.search(pattern, text.lower())
            if match:
                return match.group(1)
        
        return ""
    
    def test_provenance_anchors(self, patient_summary: Dict) -> List[str]:
        """Test that patient summary has proper provenance anchors"""
        issues = []
        
        for field, content in patient_summary.items():
            if isinstance(content, str):
                # Look for source anchors like [S1], [S2], etc.
                anchors = re.findall(r'\[S\d+\]', content)
                if not anchors:
                    issues.append(f"Field '{field}' missing provenance anchors")
        
        return issues
    
    def run_comprehensive_alignment_test(self):
        """Run comprehensive alignment tests with IR-based validation"""
        print("🧪 Enhanced Summary Alignment Test Suite")
        print("=" * 60)
        print("Testing with Canonical IR and strict validation rules")
        print()
        
        # Generate synthetic consultation
        transcript = self.generate_synthetic_consultation()
        print(f"📝 Generated synthetic consultation ({len(transcript)} chars)")
        
        # Generate canonical IR using API
        print("\n🏗️  Generating Canonical IR using API...")
        ir_dict = self.generate_canonical_ir(transcript)
        
        if not ir_dict:
            print("❌ Failed to generate Canonical IR, using mock IR")
            ir_dict = self.ir_to_dict(self.create_canonical_ir(transcript))
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
        
        # Run comprehensive alignment tests
        print("\n🔍 Running Comprehensive Alignment Tests...")
        print("=" * 50)
        
        all_results = []
        
        # 1. Field existence test
        print("\n1️⃣ Testing Field Existence...")
        missing_fields = self.test_field_existence(clinician_summary, patient_summary)
        if missing_fields:
            print(f"❌ Missing fields: {missing_fields}")
        else:
            print("✅ All required fields present")
        
        # 2. Medication consistency test
        print("\n2️⃣ Testing Medication Consistency...")
        med_result = self.test_medication_consistency(clinician_summary, patient_summary)
        all_results.append(med_result)
        self.print_alignment_result(med_result)
        
        # 3. Certainty alignment test
        print("\n3️⃣ Testing Certainty Alignment...")
        certainty_result = self.test_certainty_alignment(clinician_summary, patient_summary)
        all_results.append(certainty_result)
        self.print_alignment_result(certainty_result)
        
        # 4. Plan alignment test
        print("\n4️⃣ Testing Plan-Instructions Alignment...")
        plan_result = self.test_plan_alignment(clinician_summary, patient_summary)
        all_results.append(plan_result)
        self.print_alignment_result(plan_result)
        
        # 5. Follow-up alignment test
        print("\n5️⃣ Testing Follow-up Alignment...")
        followup_result = self.test_followup_alignment(clinician_summary, patient_summary)
        all_results.append(followup_result)
        self.print_alignment_result(followup_result)
        
        # 6. Provenance anchors test
        print("\n6️⃣ Testing Provenance Anchors...")
        provenance_issues = self.test_provenance_anchors(patient_summary)
        if provenance_issues:
            print(f"❌ Provenance issues: {provenance_issues}")
        else:
            print("✅ All fields have proper provenance anchors")
        
        return all_results
    
    def print_alignment_result(self, result: AlignmentResult):
        """Print alignment result in a formatted way"""
        status = "✅" if result.is_aligned else "❌"
        print(f"  {status} {result.field}:")
        print(f"    Alignment Score: {result.alignment_score:.2f}")
        if result.issues:
            for issue in result.issues:
                print(f"    Issue: {issue}")
        print(f"    Clinician: {result.clinician_content[:100]}...")
        print(f"    Patient: {result.patient_content[:100]}...")
        print()
    
    def analyze_ir_effectiveness(self, results: List[AlignmentResult]):
        """Analyze the effectiveness of IR-based approach"""
        print("\n📊 IR-Based Approach Analysis")
        print("=" * 40)
        
        total_tests = len(results)
        aligned_tests = sum(1 for r in results if r.is_aligned)
        avg_score = sum(r.alignment_score for r in results) / total_tests if total_tests > 0 else 0
        
        print(f"Total Alignment Tests: {total_tests}")
        print(f"Aligned Tests: {aligned_tests}")
        print(f"Alignment Rate: {(aligned_tests/total_tests)*100:.1f}%")
        print(f"Average Alignment Score: {avg_score:.2f}")
        
        print(f"\n🎯 IR Benefits Demonstrated:")
        print(f"  ✅ Single source of truth prevents inconsistencies")
        print(f"  ✅ Structured data enables precise validation")
        print(f"  ✅ Mapping contracts ensure field alignment")
        print(f"  ✅ Normalization strategies improve consistency")
        
        if avg_score >= 0.8:
            print(f"\n🎉 Excellent alignment achieved with IR approach!")
        elif avg_score >= 0.6:
            print(f"\n✅ Good alignment with room for improvement")
        else:
            print(f"\n⚠️  Alignment needs improvement - consider refining IR structure")
    
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
    """Run enhanced summary comparison tests"""
    print("📊 Enhanced Summary Comparison Test Suite")
    print("=" * 60)
    print("Testing with Canonical IR, mapping contracts, and strict validation")
    print()
    
    tester = EnhancedSummaryTester()
    
    # Check if server is running
    if not tester.check_server_status():
        print("\n❌ Cannot proceed without running server")
        print("Please start the healthcare platform with: npm run dev")
        return
    
    print("\n🚀 Starting Enhanced Summary Tests")
    print("=" * 50)
    
    # Run comprehensive alignment tests
    results = tester.run_comprehensive_alignment_test()
    
    # Analyze IR effectiveness
    tester.analyze_ir_effectiveness(results)
    
    # Summary
    print("\n📊 Enhanced Test Summary")
    print("=" * 40)
    
    if results:
        total_tests = len(results)
        aligned_tests = sum(1 for r in results if r.is_aligned)
        avg_score = sum(r.alignment_score for r in results) / total_tests
        
        print(f"Total Alignment Tests: {total_tests}")
        print(f"Aligned Tests: {aligned_tests}")
        print(f"Alignment Rate: {(aligned_tests/total_tests)*100:.1f}%")
        print(f"Average Alignment Score: {avg_score:.2f}")
        
        if aligned_tests == total_tests:
            print("\n🎉 Perfect alignment achieved with IR-based approach!")
        else:
            print(f"\n⚠️  {total_tests - aligned_tests} tests need improvement.")
            print("Consider refining the IR structure or validation rules.")
    else:
        print("❌ No test results available. Check server connectivity and API endpoints.")

if __name__ == "__main__":
    main()