#!/usr/bin/env python3
"""
Test Prompt Validation: Validate that the updated prompts contain proper grounding requirements

This test reads the actual source files to validate that the prompts
have been updated with proper grounding requirements.
"""

import re
import os
from typing import List, Dict, Any

class PromptValidator:
    """Validates that prompts contain proper grounding requirements"""
    
    def __init__(self):
        self.base_path = "src"
        self.grounding_requirements = [
            "MANDATORY GROUNDING REQUIREMENTS",
            "EVERY field that contains medical information MUST have source anchors",
            "[S1], [S2], [S3]",
            "bullet point must have a source anchor",
            "numbered item must have a source anchor",
            "Use citation numbers [S1], [S2], [S3], etc. for ALL medical findings"
        ]
    
    def read_file_content(self, file_path: str) -> str:
        """Read file content safely"""
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                return f.read()
        except FileNotFoundError:
            return ""
        except Exception as e:
            print(f"Error reading {file_path}: {e}")
            return ""
    
    def validate_file_grounding(self, file_path: str, file_description: str) -> Dict[str, Any]:
        """Validate that a file contains grounding requirements"""
        print(f"\n📋 Validating {file_description}")
        print("-" * 40)
        
        content = self.read_file_content(file_path)
        
        if not content:
            print(f"❌ Could not read file: {file_path}")
            return {"found": 0, "total": len(self.grounding_requirements), "valid": False}
        
        found_requirements = 0
        missing_requirements = []
        
        for requirement in self.grounding_requirements:
            if requirement.lower() in content.lower():
                found_requirements += 1
                print(f"  ✅ Found: {requirement}")
            else:
                missing_requirements.append(requirement)
                print(f"  ❌ Missing: {requirement}")
        
        print(f"\nGrounding requirements coverage: {found_requirements}/{len(self.grounding_requirements)}")
        
        return {
            "found": found_requirements,
            "total": len(self.grounding_requirements),
            "valid": found_requirements >= len(self.grounding_requirements) * 0.8,  # 80% coverage
            "missing": missing_requirements
        }
    
    def validate_form_generation_prompts(self):
        """Validate form generation prompts"""
        print("🧪 Testing Form Generation Prompts")
        print("=" * 50)
        
        file_path = os.path.join(self.base_path, "app", "api", "forms", "generate", "route.ts")
        return self.validate_file_grounding(file_path, "Form Generation API")
    
    def validate_enhanced_summary_prompts(self):
        """Validate enhanced summary prompts"""
        print("\n🧪 Testing Enhanced Summary Prompts")
        print("=" * 50)
        
        file_path = os.path.join(self.base_path, "app", "api", "reservations", "[id]", "enhanced-summary", "route.ts")
        return self.validate_file_grounding(file_path, "Enhanced Summary API")
    
    def validate_intake_summarizer_prompts(self):
        """Validate intake summarizer prompts"""
        print("\n🧪 Testing Intake Summarizer Prompts")
        print("=" * 50)
        
        file_path = os.path.join(self.base_path, "lib", "intake", "summarizer.ts")
        return self.validate_file_grounding(file_path, "Intake Summarizer")
    
    def validate_citation_format(self):
        """Validate that citation format uses [S#] instead of [#]"""
        print("\n🧪 Testing Citation Format")
        print("=" * 50)
        
        file_path = os.path.join(self.base_path, "app", "api", "forms", "generate", "route.ts")
        content = self.read_file_content(file_path)
        
        if not content:
            print("❌ Could not read form generation file")
            return {"valid": False, "details": "File not found"}
        
        # Check for [S#] format
        s_format_pattern = r'\[S\d+\]'
        s_format_matches = re.findall(s_format_pattern, content)
        
        # Check for old [#] format
        old_format_pattern = r'\[(?<!S)\d+\]'
        old_format_matches = re.findall(old_format_pattern, content)
        
        print(f"  [S#] format citations found: {len(s_format_matches)}")
        print(f"  Old [#] format citations found: {len(old_format_matches)}")
        
        if s_format_matches:
            print(f"  ✅ Found [S#] format: {s_format_matches[:3]}...")
        
        if old_format_matches:
            print(f"  ⚠️  Found old [#] format: {old_format_matches[:3]}...")
        
        # Check for citation generation logic
        citation_logic_patterns = [
            r'\[S\${citationId}\]',
            r'\[S\$\{citationId\}\]',
            r'\[S\d+\]'
        ]
        
        found_citation_logic = False
        for pattern in citation_logic_patterns:
            if re.search(pattern, content):
                found_citation_logic = True
                print(f"  ✅ Found citation logic: {pattern}")
                break
        
        if not found_citation_logic:
            print("  ❌ No proper citation logic found")
        
        return {
            "valid": len(s_format_matches) > 0 and found_citation_logic,
            "s_format_count": len(s_format_matches),
            "old_format_count": len(old_format_matches),
            "has_citation_logic": found_citation_logic
        }
    
    def validate_prompt_examples(self):
        """Validate that prompt examples include source anchors"""
        print("\n🧪 Testing Prompt Examples")
        print("=" * 50)
        
        file_path = os.path.join(self.base_path, "app", "api", "forms", "generate", "route.ts")
        content = self.read_file_content(file_path)
        
        if not content:
            print("❌ Could not read form generation file")
            return {"valid": False}
        
        # Look for example JSON structures in prompts
        example_patterns = [
            r'"chiefComplaint":\s*"[^"]*\[S\d+\]',
            r'"historyOfPresentIllness":\s*"[^"]*\[S\d+\]',
            r'"physicalExam":\s*"[^"]*\[S\d+\]',
            r'"assessment":\s*"[^"]*\[S\d+\]',
            r'"plan":\s*"[^"]*\[S\d+\]',
            r'"followUp":\s*"[^"]*\[S\d+\]',
            r'"diagnosis":\s*"[^"]*\[S\d+\]',
            r'"medications":\s*"[^"]*\[S\d+\]',
            r'"instructions":\s*"[^"]*\[S\d+\]',
            r'"homeCare":\s*"[^"]*\[S\d+\]',
            r'"recovery":\s*"[^"]*\[S\d+\]',
            r'"warningSigns":\s*"[^"]*\[S\d+\]',
            r'"whenToSeekHelp":\s*"[^"]*\[S\d+\]'
        ]
        
        found_examples = 0
        for pattern in example_patterns:
            if re.search(pattern, content):
                found_examples += 1
                print(f"  ✅ Found example with [S#]: {pattern[:30]}...")
            else:
                print(f"  ❌ Missing example: {pattern[:30]}...")
        
        print(f"\nExample coverage: {found_examples}/{len(example_patterns)}")
        
        return {
            "valid": found_examples >= len(example_patterns) * 0.8,
            "found": found_examples,
            "total": len(example_patterns)
        }

def main():
    """Run prompt validation tests"""
    print("🔍 Prompt Validation Test Suite")
    print("=" * 60)
    print("Validating that prompts contain proper grounding requirements")
    print()
    
    validator = PromptValidator()
    
    print("\n🚀 Starting Prompt Validation Tests")
    print("=" * 50)
    
    # Run all validation tests
    form_results = validator.validate_form_generation_prompts()
    enhanced_results = validator.validate_enhanced_summary_prompts()
    intake_results = validator.validate_intake_summarizer_prompts()
    citation_results = validator.validate_citation_format()
    example_results = validator.validate_prompt_examples()
    
    # Summary
    print("\n📊 Prompt Validation Summary")
    print("=" * 40)
    
    all_results = [form_results, enhanced_results, intake_results, citation_results, example_results]
    valid_results = sum(1 for r in all_results if r.get("valid", False))
    total_results = len(all_results)
    
    print(f"Total Tests: {total_results}")
    print(f"Valid Tests: {valid_results}")
    print(f"Success Rate: {(valid_results/total_results)*100:.1f}%")
    
    # Detailed results
    print(f"\nDetailed Results:")
    print(f"  Form Generation: {'✅ Valid' if form_results.get('valid', False) else '❌ Invalid'}")
    print(f"  Enhanced Summary: {'✅ Valid' if enhanced_results.get('valid', False) else '❌ Invalid'}")
    print(f"  Intake Summarizer: {'✅ Valid' if intake_results.get('valid', False) else '❌ Invalid'}")
    print(f"  Citation Format: {'✅ Valid' if citation_results.get('valid', False) else '❌ Invalid'}")
    print(f"  Prompt Examples: {'✅ Valid' if example_results.get('valid', False) else '❌ Invalid'}")
    
    if valid_results == total_results:
        print("\n🎉 All prompt validation tests passed!")
        print("The system prompts are properly configured for grounding validation.")
    else:
        print(f"\n⚠️  {total_results - valid_results} tests failed.")
        print("The system prompts need further updates for proper grounding.")
    
    # Recommendations
    print("\n💡 Recommendations:")
    if not form_results.get('valid', False):
        print("  • Update form generation prompts with mandatory grounding requirements")
    if not citation_results.get('valid', False):
        print("  • Ensure citation generation uses [S#] format consistently")
    if not example_results.get('valid', False):
        print("  • Add source anchors to all prompt examples")
    
    print("  • Test with real form generation to validate grounding compliance")
    print("  • Monitor generated forms for proper source anchor coverage")

if __name__ == "__main__":
    main()
