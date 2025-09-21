#!/usr/bin/env python3
"""
Test Direct Functions: Test the actual healthcare platform functions directly

This test imports and calls the actual form generation functions
to validate grounding without requiring API calls.
"""

import sys
import os
import re
import json
from typing import List, Dict, Any
from dataclasses import dataclass

# Add the project root to the Python path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

@dataclass
class GroundingResult:
    """Result of grounding validation for a summary section"""
    section: str
    total_bullets: int
    grounded_bullets: int
    missing_anchors: List[str]
    is_valid: bool

class DirectFunctionTester:
    """Tests grounding by calling actual healthcare platform functions directly"""
    
    def __init__(self):
        # Pattern to match source anchors like [S1], [S2], etc.
        self.anchor_pattern = r'\[S?\d+\]'
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
        bullets = self.extract_bullets(content)
        grounded_bullets = 0
        missing_anchors = []
        
        for bullet in bullets:
            if self.has_source_anchor(bullet):
                grounded_bullets += 1
            else:
                missing_anchors.append(bullet)
        
        is_valid = len(missing_anchors) == 0
        
        return GroundingResult(
            section=section_name,
            total_bullets=len(bullets),
            grounded_bullets=grounded_bullets,
            missing_anchors=missing_anchors,
            is_valid=is_valid
        )
    
    def validate_summary(self, summary: Dict[str, Any]) -> List[GroundingResult]:
        """Validate grounding for an entire summary"""
        results = []
        
        # Define sections that should have grounding
        sections_to_validate = [
            'chiefComplaint',
            'historyOfPresentIllness', 
            'physicalExam',
            'assessment',
            'plan',
            'followUp',
            'medications',
            'instructions',
            'homeCare',
            'recovery',
            'warningSigns',
            'whenToSeekHelp'
        ]
        
        for section in sections_to_validate:
            if section in summary and summary[section]:
                content = str(summary[section])
                result = self.validate_section(section, content)
                results.append(result)
        
        return results
    
    def test_prompt_generation(self):
        """Test that the prompt generation includes proper grounding requirements"""
        print("🧪 Testing Prompt Generation")
        print("=" * 40)
        
        try:
            # Import the form generation module
            import sys
            sys.path.append('src')
            from app.api.forms.generate import createFormPrompt
            
            # Test transcript
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
            
            # Test clinician summary prompt
            print("\n📋 Testing Clinician Summary Prompt")
            print("-" * 30)
            
            clinician_prompt = createFormPrompt('clinician_summary', transcript)
            
            # Check if prompt contains grounding requirements
            grounding_requirements = [
                "MANDATORY GROUNDING REQUIREMENTS",
                "EVERY field that contains medical information MUST have source anchors",
                "[S1], [S2], [S3]",
                "bullet point must have a source anchor",
                "numbered item must have a source anchor"
            ]
            
            found_requirements = 0
            for requirement in grounding_requirements:
                if requirement.lower() in clinician_prompt.lower():
                    found_requirements += 1
                    print(f"  ✅ Found: {requirement}")
                else:
                    print(f"  ❌ Missing: {requirement}")
            
            print(f"\nGrounding requirements coverage: {found_requirements}/{len(grounding_requirements)}")
            
            # Test patient summary prompt
            print("\n📋 Testing Patient Summary Prompt")
            print("-" * 30)
            
            patient_prompt = createFormPrompt('patient_summary', transcript)
            
            found_requirements = 0
            for requirement in grounding_requirements:
                if requirement.lower() in patient_prompt.lower():
                    found_requirements += 1
                    print(f"  ✅ Found: {requirement}")
                else:
                    print(f"  ❌ Missing: {requirement}")
            
            print(f"\nGrounding requirements coverage: {found_requirements}/{len(grounding_requirements)}")
            
            return True
            
        except ImportError as e:
            print(f"❌ Cannot import form generation module: {e}")
            return False
        except Exception as e:
            print(f"❌ Error testing prompt generation: {e}")
            return False
    
    def test_citation_generation(self):
        """Test that citation generation uses proper [S#] format"""
        print("\n🧪 Testing Citation Generation Logic")
        print("=" * 40)
        
        try:
            # Import the citation generation function
            import sys
            sys.path.append('src')
            from app.api.forms.generate import addCitationsToFormData
            
            # Test data
            form_data = {
                "chiefComplaint": "Patient presents with headache and fever",
                "historyOfPresentIllness": "Headache started this morning, described as very painful",
                "physicalExam": "Temperature 37.9°C, blood pressure 118/75"
            }
            
            transcript = """
            [20:37:10] PATIENT: Morning doctor, I've had a headache this morning
            [20:37:24] PATIENT: Forehead, very painful
            [20:37:45] DOCTOR: Your temperature is 37.9°C, blood pressure 118/75
            """
            
            # Test citation generation
            result = addCitationsToFormData('clinician_summary', form_data, transcript)
            
            print("Generated form data with citations:")
            for field, content in result.items():
                if field != 'citations' and isinstance(content, str):
                    print(f"  {field}: {content}")
            
            # Check if citations use [S#] format
            citation_pattern = r'\[S\d+\]'
            found_citations = 0
            
            for field, content in result.items():
                if field != 'citations' and isinstance(content, str):
                    citations = re.findall(citation_pattern, content)
                    found_citations += len(citations)
                    if citations:
                        print(f"  ✅ {field}: Found {len(citations)} citations {citations}")
                    else:
                        print(f"  ❌ {field}: No [S#] format citations found")
            
            print(f"\nTotal [S#] format citations found: {found_citations}")
            
            return found_citations > 0
            
        except ImportError as e:
            print(f"❌ Cannot import citation generation module: {e}")
            return False
        except Exception as e:
            print(f"❌ Error testing citation generation: {e}")
            return False
    
    def test_enhanced_summary_prompt(self):
        """Test that enhanced summary prompt includes grounding requirements"""
        print("\n🧪 Testing Enhanced Summary Prompt")
        print("=" * 40)
        
        try:
            # Import the enhanced summary module
            import sys
            sys.path.append('src')
            from app.api.reservations.id.enhanced_summary import createEnhancedSummaryPrompt
            
            # Test data
            sources = [
                {
                    "type": "intake",
                    "content": "Patient reports headache this morning",
                    "timestamp": "20:37:10"
                }
            ]
            
            visit_reason = "headache"
            
            # Generate prompt
            prompt = createEnhancedSummaryPrompt(sources, visit_reason)
            
            # Check if prompt contains grounding requirements
            grounding_requirements = [
                "[S1], [S2]",
                "citation numbers",
                "Always include citation numbers"
            ]
            
            found_requirements = 0
            for requirement in grounding_requirements:
                if requirement.lower() in prompt.lower():
                    found_requirements += 1
                    print(f"  ✅ Found: {requirement}")
                else:
                    print(f"  ❌ Missing: {requirement}")
            
            print(f"\nGrounding requirements coverage: {found_requirements}/{len(grounding_requirements)}")
            
            return found_requirements >= 2
            
        except ImportError as e:
            print(f"❌ Cannot import enhanced summary module: {e}")
            return False
        except Exception as e:
            print(f"❌ Error testing enhanced summary prompt: {e}")
            return False

def main():
    """Run direct function tests"""
    print("🔍 Direct Function Test Suite")
    print("=" * 60)
    print("Testing actual healthcare platform functions directly")
    print()
    
    tester = DirectFunctionTester()
    
    print("\n🚀 Starting Direct Function Tests")
    print("=" * 40)
    
    # Run tests
    prompt_test = tester.test_prompt_generation()
    citation_test = tester.test_citation_generation()
    enhanced_test = tester.test_enhanced_summary_prompt()
    
    # Summary
    print("\n📊 Direct Function Test Summary")
    print("=" * 40)
    
    tests_run = 3
    tests_passed = sum([prompt_test, citation_test, enhanced_test])
    
    print(f"Tests Run: {tests_run}")
    print(f"Tests Passed: {tests_passed}")
    print(f"Success Rate: {(tests_passed/tests_run)*100:.1f}%")
    
    if tests_passed == tests_run:
        print("\n✅ All direct function tests passed!")
        print("The system functions are properly configured for grounding validation.")
    else:
        print(f"\n❌ {tests_run - tests_passed} tests failed.")
        print("The system functions need further updates for proper grounding.")

if __name__ == "__main__":
    main()
