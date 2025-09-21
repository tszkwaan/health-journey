#!/usr/bin/env python3
"""
Test Runner for Healthcare Platform

This script runs the mandatory tests:
1. test_grounding.py - Validate grounding requirements
2. test_redaction.py - Validate PHI redaction
3. test_latency.py - Profile redaction and provenance pipeline
4. test_summary.py - Compare form templates
"""

import subprocess
import sys
import os
from typing import List, Tuple

class TestRunner:
    def __init__(self):
        self.test_files = [
            "test_grounding.py",
            "test_redaction.py", 
            "test_latency.py",
            "test_summary.py"
        ]
        self.results: List[Tuple[str, bool, str]] = []

    def run_test(self, test_file: str) -> Tuple[bool, str]:
        """Run a single test file and return success status and output"""
        print(f"\n🧪 Running {test_file}...")
        print("=" * 50)
        
        try:
            result = subprocess.run(
                [sys.executable, test_file],
                capture_output=True,
                text=True,
                timeout=300  # 5 minute timeout
            )
            
            if result.returncode == 0:
                print("✅ Test passed")
                return True, result.stdout
            else:
                print("❌ Test failed")
                print("STDOUT:", result.stdout)
                print("STDERR:", result.stderr)
                return False, result.stderr
                
        except subprocess.TimeoutExpired:
            print("⏰ Test timed out")
            return False, "Test timed out after 5 minutes"
        except Exception as e:
            print(f"💥 Test error: {e}")
            return False, str(e)

    def run_all_tests(self):
        """Run all test files"""
        print("🚀 Starting Healthcare Platform Test Suite")
        print("=" * 60)
        
        total_tests = len(self.test_files)
        passed_tests = 0
        
        for test_file in self.test_files:
            if not os.path.exists(test_file):
                print(f"⚠️  Test file {test_file} not found, skipping...")
                continue
                
            success, output = self.run_test(test_file)
            self.results.append((test_file, success, output))
            
            if success:
                passed_tests += 1
        
        # Print summary
        print("\n📊 Test Summary")
        print("=" * 30)
        print(f"Total tests: {total_tests}")
        print(f"Passed: {passed_tests}")
        print(f"Failed: {total_tests - passed_tests}")
        print(f"Success rate: {(passed_tests/total_tests)*100:.1f}%")
        
        # Print individual results
        print("\n📋 Individual Test Results:")
        for test_file, success, output in self.results:
            status = "✅ PASS" if success else "❌ FAIL"
            print(f"  {test_file}: {status}")
        
        return passed_tests == total_tests

def main():
    """Main execution"""
    runner = TestRunner()
    success = runner.run_all_tests()
    
    if success:
        print("\n🎉 All tests passed!")
        sys.exit(0)
    else:
        print("\n💥 Some tests failed!")
        sys.exit(1)

if __name__ == "__main__":
    main()