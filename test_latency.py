#!/usr/bin/env python3
"""
Latency Profiling Test Suite for Redaction and Provenance Pipeline

This test suite focuses on the mandatory requirements:
- Profile your redaction and provenance pipeline
- Report P50/P95 latencies
"""

import requests
import time
import statistics
from typing import List, Dict, Any, NamedTuple
import random
import string

class MeasurementResult(NamedTuple):
    duration_ms: float
    success: bool
    error: str = None

class LatencyTester:
    def __init__(self, base_url: str = "http://localhost:3000"):
        self.base_url = base_url
        self.session = requests.Session()
        self.session.headers.update({
            'Content-Type': 'application/json',
            'Authorization': 'Bearer test-token'
        })
        self.measurements: Dict[str, List[MeasurementResult]] = {}

    def generate_test_phi_data(self, size: str) -> str:
        """Generate test PHI data of specified size"""
        sizes = {
            'small': 200,
            'medium': 1000,
            'large': 5000
        }
        
        target_length = sizes.get(size.lower(), 200)
        
        # Generate realistic PHI data
        phi_data = f"""
        Patient Information:
        Name: John Smith
        DOB: 03/15/1985
        SSN: 123-45-6789
        Phone: (555) 123-4567
        Email: john.smith@email.com
        Address: 123 Main Street, Anytown, CA 90210
        Medical Record Number: MR123456789
        Insurance Policy: POL987654321
        
        Medical History:
        Patient has been experiencing headaches and fever for the past week.
        Previous diagnosis of hypertension in 2020.
        Allergic to penicillin and shellfish.
        Current medications include Lisinopril 10mg daily.
        
        Consultation Notes:
        Patient reports severe headache with photophobia and neck stiffness.
        Temperature: 101.2°F, Blood Pressure: 140/90 mmHg
        Physical examination reveals positive Kernig's sign.
        Suspected meningitis - recommend immediate lumbar puncture.
        Patient consent obtained for emergency procedures.
        
        Follow-up:
        Schedule follow-up appointment in 7 days.
        Contact emergency services if symptoms worsen.
        Prescription for pain management provided.
        """
        
        # Adjust length to target
        while len(phi_data) < target_length:
            phi_data += f" Additional medical information: {random.choice(['symptoms', 'medications', 'allergies', 'history'])}. "
        
        return phi_data[:target_length]

    def measure_operation(self, operation_name: str, operation_func) -> MeasurementResult:
        """Measure the execution time of an operation"""
        start_time = time.time()
        
        try:
            success = operation_func()
            duration_ms = (time.time() - start_time) * 1000
            
            result = MeasurementResult(
                duration_ms=duration_ms,
                success=success,
                error=None
            )
        except Exception as e:
            duration_ms = (time.time() - start_time) * 1000
            result = MeasurementResult(
                duration_ms=duration_ms,
                success=False,
                error=str(e)
            )
        
        # Store measurement
        if operation_name not in self.measurements:
            self.measurements[operation_name] = []
        self.measurements[operation_name].append(result)
        
        return result

    def test_phi_redaction_latency(self, phi_data: str, iterations: int = 10):
        """Test PHI redaction latency using ultra-optimized pipeline"""
        print(f"\n📊 Testing PHI Redaction Latency ({len(phi_data)} chars)")
        print("-" * 50)
        
        for i in range(iterations):
            def run_redaction():
                response = self.session.post(f"{self.base_url}/api/test/ultra-optimized", 
                    json={"data": phi_data},
                    timeout=30
                )
                return response.status_code == 200
            
            measurement = self.measure_operation("phi_redaction", run_redaction)
            status = "✅" if measurement.success else "❌"
            print(f"  {status} Iteration {i+1}: {measurement.duration_ms:.2f}ms")
            if not measurement.success and measurement.error:
                print(f"    Error: {measurement.error}")

    def test_provenance_generation_latency(self, phi_data: str, iterations: int = 10):
        """Test provenance generation latency using ultra-optimized pipeline"""
        print(f"\n📊 Testing Provenance Generation Latency ({len(phi_data)} chars)")
        print("-" * 50)
        
        for i in range(iterations):
            def run_provenance():
                response = self.session.post(f"{self.base_url}/api/test/generate-provenance", 
                    json={"data": phi_data},
                    timeout=30
                )
                return response.status_code == 200
            
            measurement = self.measure_operation("provenance_generation", run_provenance)
            status = "✅" if measurement.success else "❌"
            print(f"  {status} Iteration {i+1}: {measurement.duration_ms:.2f}ms")
            if not measurement.success and measurement.error:
                print(f"    Error: {measurement.error}")

    def test_combined_pipeline_latency(self, phi_data: str, iterations: int = 5):
        """Test combined redaction and provenance pipeline latency"""
        print(f"\n📊 Testing Combined Redaction + Provenance Pipeline ({len(phi_data)} chars)")
        print("-" * 50)
        
        for i in range(iterations):
            def run_combined_pipeline():
                # First redact the data
                redact_response = self.session.post(f"{self.base_url}/api/test/ultra-optimized", 
                    json={"data": phi_data},
                    timeout=30
                )
                if redact_response.status_code != 200:
                    return False
                
                # Then generate provenance
                provenance_response = self.session.post(f"{self.base_url}/api/test/generate-provenance", 
                    json={"data": phi_data},
                    timeout=30
                )
                return provenance_response.status_code == 200
            
            measurement = self.measure_operation("combined_pipeline", run_combined_pipeline)
            status = "✅" if measurement.success else "❌"
            print(f"  {status} Iteration {i+1}: {measurement.duration_ms:.2f}ms")
            if not measurement.success and measurement.error:
                print(f"    Error: {measurement.error}")

    def test_batch_processing_latency(self, phi_data: str, iterations: int = 3):
        """Test batch processing latency using ultra-optimized pipeline"""
        print(f"\n📊 Testing Batch Processing Latency ({len(phi_data)} chars)")
        print("-" * 50)
        
        # Create batch data
        batch_data = [phi_data] * 10  # Process 10 items in parallel
        
        for i in range(iterations):
            def run_batch_processing():
                response = self.session.post(f"{self.base_url}/api/test/ultra-optimized", 
                    json={"data": batch_data},
                    timeout=60
                )
                return response.status_code == 200
            
            measurement = self.measure_operation("batch_processing", run_batch_processing)
            status = "✅" if measurement.success else "❌"
            print(f"  {status} Iteration {i+1}: {measurement.duration_ms:.2f}ms")
            if not measurement.success and measurement.error:
                print(f"    Error: {measurement.error}")

    def check_server_status(self):
        """Check if the healthcare platform server is running"""
        print("🔍 Checking Server Status")
        print("=" * 30)
        
        try:
            response = self.session.get(f"{self.base_url}/api/auth/session", timeout=5)
            if response.status_code == 200:
                print("✅ Healthcare platform server is running")
                return True
            else:
                print(f"❌ Server responded with status {response.status_code}")
                return False
        except requests.exceptions.RequestException as e:
            print(f"❌ Server is not running: {e}")
            return False

    def calculate_percentiles(self, measurements: List[MeasurementResult]) -> Dict[str, float]:
        """Calculate P50, P95, and other statistics"""
        durations = [m.duration_ms for m in measurements if m.success]
        
        if not durations:
            return {
                'count': 0,
                'min': 0,
                'max': 0,
                'mean': 0,
                'median': 0,
                'p50': 0,
                'p95': 0,
                'p99': 0,
                'success_rate': 0
            }
        
        durations.sort()
        count = len(durations)
        
        return {
            'count': count,
            'min': min(durations),
            'max': max(durations),
            'mean': statistics.mean(durations),
            'median': statistics.median(durations),
            'p50': durations[int(count * 0.5)],
            'p95': durations[int(count * 0.95)],
            'p99': durations[int(count * 0.99)],
            'success_rate': (count / len(measurements)) * 100
        }

    def print_results(self):
        """Print comprehensive latency results"""
        print("\n📊 Latency Results")
        print("=" * 50)
        
        for operation, measurements in self.measurements.items():
            stats = self.calculate_percentiles(measurements)
            
            print(f"\n🔍 {operation.upper()}")
            print(f"  Count: {stats['count']}")
            print(f"  Min: {stats['min']:.2f}ms")
            print(f"  Max: {stats['max']:.2f}ms")
            print(f"  Mean: {stats['mean']:.2f}ms")
            print(f"  Median: {stats['median']:.2f}ms")
            print(f"  P50: {stats['p50']:.2f}ms")
            print(f"  P95: {stats['p95']:.2f}ms")
            print(f"  P99: {stats['p99']:.2f}ms")
            print(f"  Success Rate: {stats['success_rate']:.1f}%")

    def print_recommendations(self):
        """Print performance recommendations"""
        print("\n🎯 Performance Recommendations")
        print("=" * 40)
        
        # Find slowest operations
        slowest_operations = []
        for operation, measurements in self.measurements.items():
            stats = self.calculate_percentiles(measurements)
            if stats['count'] > 0:
                slowest_operations.append((operation, stats['p95']))
        
        slowest_operations.sort(key=lambda x: x[1], reverse=True)
        
        print("Slowest operations (P95):")
        for i, (operation, p95) in enumerate(slowest_operations[:3], 1):
            print(f"  {i}. {operation}: {p95:.2f}ms")
        
        # Check requirements
        print("\n📋 Performance Requirements Check:")
        print("  - Real-time processing: < 100ms P95")
        print("  - Batch processing: < 1000ms P95")
        print("  - Success rate: > 99%")
        
        real_time_pass = 0
        batch_pass = 0
        success_pass = 0
        
        for operation, measurements in self.measurements.items():
            stats = self.calculate_percentiles(measurements)
            if stats['count'] > 0:
                if stats['p95'] < 100:
                    real_time_pass += 1
                if stats['p95'] < 1000:
                    batch_pass += 1
                if stats['success_rate'] > 99:
                    success_pass += 1
        
        total_operations = len(self.measurements)
        print(f"  ✅ Real-time P95: {real_time_pass}/{total_operations} PASS")
        print(f"  ✅ Batch P95: {batch_pass}/{total_operations} PASS")
        print(f"  ✅ Success Rate: {success_pass}/{total_operations} PASS")

def main():
    """Main test execution"""
    print("⏱️  Latency Profiling Test Suite")
    print("=" * 60)
    print("Testing redaction and provenance pipeline performance")
    
    tester = LatencyTester()
    
    # Check server status
    if not tester.check_server_status():
        print("\n❌ Cannot proceed without running server")
        return
    
    print("\n🚀 Starting Latency Tests")
    print("=" * 40)
    
    # Test different data sizes
    test_sizes = ['small', 'medium', 'large']
    
    for size in test_sizes:
        phi_data = tester.generate_test_phi_data(size)
        print(f"\n📊 Testing {size.upper()} data ({len(phi_data)} chars)")
        
        # Test individual operations
        tester.test_phi_redaction_latency(phi_data, iterations=10)
        tester.test_provenance_generation_latency(phi_data, iterations=10)
        tester.test_combined_pipeline_latency(phi_data, iterations=5)
        tester.test_batch_processing_latency(phi_data, iterations=3)
    
    # Calculate and display results
    tester.print_results()
    tester.print_recommendations()

if __name__ == "__main__":
    main()