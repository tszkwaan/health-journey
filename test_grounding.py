#!/usr/bin/env python3
"""
Test Grounding: Validate that every summary bullet has a source anchor [S#]

This test ensures that all generated summaries maintain proper grounding
by requiring every bullet point to have a source anchor that can be traced
back to the original consultation transcript or medical data.
"""

import re
import json
import asyncio
from typing import List, Dict, Any, Tuple
from dataclasses import dataclass

@dataclass
class GroundingResult:
    """Result of grounding validation for a summary section"""
    section: str
    total_bullets: int
    grounded_bullets: int
    missing_anchors: List[str]
    is_valid: bool

class GroundingValidator:
    """Validates grounding in generated summaries"""
    
    def __init__(self):
        # Pattern to match source anchors like [1], [2], [S1], etc.
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

def test_grounding_validation():
    """Test the grounding validation system"""
    print("🧪 Testing Grounding Validation System")
    print("=" * 50)
    
    validator = GroundingValidator()
    
    # Test case 1: Properly grounded summary
    print("\n📋 Test Case 1: Properly Grounded Summary")
    grounded_summary = {
        "chiefComplaint": "Patient presents with headache [S1] and fever [S2]",
        "historyOfPresentIllness": "• Headache started this morning [S3]\n• Fever developed overnight [S4]",
        "physicalExam": "1. Temperature: 37.9°C [S5]\n2. Blood pressure: 118/75 [S6]",
        "assessment": "Differential diagnosis includes tension headache [S7] and viral infection [S8]",
        "plan": "• Prescribe acetaminophen [S9]\n• Monitor symptoms [S10]",
        "followUp": "Schedule follow-up in 3-5 days [S11]"
    }
    
    results = validator.validate_summary(grounded_summary)
    print(f"✅ All sections properly grounded: {all(r.is_valid for r in results)}")
    
    for result in results:
        print(f"  {result.section}: {result.grounded_bullets}/{result.total_bullets} grounded")
        if not result.is_valid:
            print(f"    ❌ Missing anchors: {result.missing_anchors}")
    
    # Test case 2: Missing grounding
    print("\n📋 Test Case 2: Missing Grounding")
    ungrounded_summary = {
        "chiefComplaint": "Patient presents with headache and fever",
        "historyOfPresentIllness": "• Headache started this morning\n• Fever developed overnight",
        "physicalExam": "1. Temperature: 37.9°C\n2. Blood pressure: 118/75",
        "assessment": "Differential diagnosis includes tension headache and viral infection",
        "plan": "• Prescribe acetaminophen\n• Monitor symptoms",
        "followUp": "Schedule follow-up in 3-5 days"
    }
    
    results = validator.validate_summary(ungrounded_summary)
    print(f"❌ All sections properly grounded: {all(r.is_valid for r in results)}")
    
    for result in results:
        print(f"  {result.section}: {result.grounded_bullets}/{result.total_bullets} grounded")
        if not result.is_valid:
            print(f"    ❌ Missing anchors: {result.missing_anchors}")
    
    # Test case 3: Mixed grounding
    print("\n📋 Test Case 3: Mixed Grounding")
    mixed_summary = {
        "chiefComplaint": "Patient presents with headache [S1] and fever",
        "historyOfPresentIllness": "• Headache started this morning [S2]\n• Fever developed overnight",
        "physicalExam": "1. Temperature: 37.9°C [S3]\n2. Blood pressure: 118/75",
        "assessment": "Differential diagnosis includes tension headache [S4] and viral infection",
        "plan": "• Prescribe acetaminophen [S5]\n• Monitor symptoms",
        "followUp": "Schedule follow-up in 3-5 days [S6]"
    }
    
    results = validator.validate_summary(mixed_summary)
    print(f"⚠️  All sections properly grounded: {all(r.is_valid for r in results)}")
    
    for result in results:
        print(f"  {result.section}: {result.grounded_bullets}/{result.total_bullets} grounded")
        if not result.is_valid:
            print(f"    ❌ Missing anchors: {result.missing_anchors}")
    
    # Summary
    print("\n📊 Grounding Validation Summary")
    print("=" * 30)
    print("✅ Properly grounded summaries should have 100% anchor coverage")
    print("❌ Ungrounded summaries will fail validation")
    print("⚠️  Mixed grounding shows partial compliance")
    print("\n🔍 Source anchors should follow format: [S#] or [#]")
    print("📝 All bullet points must be traceable to original sources")

if __name__ == "__main__":
    test_grounding_validation()
