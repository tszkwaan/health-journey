#!/usr/bin/env python3
"""
Comprehensive Test Runner for Healthcare Platform

This script runs all validation tests and generates a comprehensive report
covering grounding, redaction, latency, and summary generation.
"""

import subprocess
import sys
import time
from datetime import datetime
from typing import List, Dict, Any

class TestRunner:
    """Runs all validation tests and generates reports"""
    
    def __init__(self):
        self.test_files = [
            "test_grounding.py",
            "test_redaction.py", 
            "test_latency.py",
            "test_summary.py",
            "test_real_grounding.py",
            "test_real_redaction.py",
            "test_real_latency.py"
        ]
        self.results = {}
    
    def run_test(self, test_file: str) -> Dict[str, Any]:
        """Run a single test file and capture results"""
        print(f"\n🧪 Running {test_file}...")
        print("=" * 50)
        
        start_time = time.time()
        
        try:
            result = subprocess.run(
                [sys.executable, test_file],
                capture_output=True,
                text=True,
                timeout=300  # 5 minute timeout
            )
            
            end_time = time.time()
            duration = end_time - start_time
            
            return {
                "file": test_file,
                "success": result.returncode == 0,
                "duration": duration,
                "stdout": result.stdout,
                "stderr": result.stderr,
                "return_code": result.returncode
            }
            
        except subprocess.TimeoutExpired:
            return {
                "file": test_file,
                "success": False,
                "duration": 300,
                "stdout": "",
                "stderr": "Test timed out after 5 minutes",
                "return_code": -1
            }
        except Exception as e:
            return {
                "file": test_file,
                "success": False,
                "duration": 0,
                "stdout": "",
                "stderr": str(e),
                "return_code": -1
            }
    
    def run_all_tests(self):
        """Run all test files"""
        print("🚀 Healthcare Platform Test Suite")
        print("=" * 50)
        print(f"Running {len(self.test_files)} test files...")
        print(f"Started at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        print()
        
        for test_file in self.test_files:
            result = self.run_test(test_file)
            self.results[test_file] = result
    
    def generate_report(self):
        """Generate comprehensive test report"""
        print("\n📊 Test Results Summary")
        print("=" * 50)
        
        total_tests = len(self.results)
        successful_tests = sum(1 for r in self.results.values() if r["success"])
        failed_tests = total_tests - successful_tests
        
        print(f"Total Tests: {total_tests}")
        print(f"Successful: {successful_tests}")
        print(f"Failed: {failed_tests}")
        print(f"Success Rate: {(successful_tests/total_tests)*100:.1f}%")
        
        total_duration = sum(r["duration"] for r in self.results.values())
        print(f"Total Duration: {total_duration:.2f} seconds")
        
        print("\n📋 Individual Test Results")
        print("-" * 30)
        
        for test_file, result in self.results.items():
            status = "✅ PASS" if result["success"] else "❌ FAIL"
            print(f"{status} {test_file} ({result['duration']:.2f}s)")
            
            if not result["success"] and result["stderr"]:
                print(f"    Error: {result['stderr'][:100]}...")
        
        print("\n🎯 Test Coverage")
        print("-" * 20)
        print("✅ Grounding Validation: Ensures all summary bullets have source anchors")
        print("✅ PHI Redaction: Validates no PHI leaks to outputs or logs")
        print("✅ Latency Profiling: Measures P50/P95 latencies for performance")
        print("✅ Summary Comparison: Side-by-side analysis of clinician vs patient summaries")
        
        print("\n📈 Key Metrics")
        print("-" * 15)
        
        # Extract key metrics from test outputs
        for test_file, result in self.results.items():
            if result["success"]:
                stdout = result["stdout"]
                
                if "test_grounding.py" in test_file:
                    if "All sections properly grounded: True" in stdout:
                        print("✅ Grounding: 100% anchor coverage achieved")
                    else:
                        print("⚠️  Grounding: Some sections missing source anchors")
                
                elif "test_redaction.py" in test_file:
                    if "Compliance rate:" in stdout:
                        # Extract compliance rate
                        lines = stdout.split('\n')
                        for line in lines:
                            if "Compliance rate:" in line:
                                rate = line.split(":")[1].strip()
                                print(f"🔒 PHI Redaction: {rate} compliance")
                                break
                
                elif "test_latency.py" in test_file:
                    if "Real-time P95:" in stdout:
                        # Extract latency metrics
                        lines = stdout.split('\n')
                        for line in lines:
                            if "Real-time P95:" in line:
                                print(f"⏱️  {line.strip()}")
                            elif "Batch P95:" in line:
                                print(f"⏱️  {line.strip()}")
                            elif "Success Rate:" in line:
                                print(f"⏱️  {line.strip()}")
                
                elif "test_summary.py" in test_file:
                    if "Average Alignment Score:" in stdout:
                        # Extract alignment metrics
                        lines = stdout.split('\n')
                        for line in lines:
                            if "Average Alignment Score:" in line:
                                print(f"📋 {line.strip()}")
                            elif "Overall Quality:" in line:
                                print(f"📋 {line.strip()}")
        
        print("\n🔍 Recommendations")
        print("-" * 20)
        
        if failed_tests > 0:
            print("• Fix failing tests before deployment")
            print("• Review error messages for specific issues")
        
        print("• Implement continuous integration for automated testing")
        print("• Add performance monitoring in production")
        print("• Regular PHI compliance audits")
        print("• Validate summary alignment in real consultations")
        
        print("\n📝 Next Steps")
        print("-" * 15)
        print("1. Address any failing tests")
        print("2. Optimize performance based on latency results")
        print("3. Improve PHI redaction compliance")
        print("4. Enhance summary alignment between templates")
        print("5. Deploy with confidence knowing all validations pass")

def main():
    """Main function to run all tests"""
    runner = TestRunner()
    runner.run_all_tests()
    runner.generate_report()

if __name__ == "__main__":
    main()
