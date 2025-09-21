#!/usr/bin/env python3
"""
Test Real Latency: Call actual healthcare platform functions to test performance

This test measures the latency of redaction and provenance pipeline operations
specifically, focusing on P50/P95 latencies for these critical security functions.
"""

import requests
import time
import statistics
import re
from typing import List, Dict, Any
from dataclasses import dataclass
from datetime import datetime

@dataclass
class LatencyMeasurement:
    """Single latency measurement"""
    operation: str
    duration_ms: float
    timestamp: datetime
    success: bool
    error: str = None

@dataclass
class LatencyStats:
    """Statistical summary of latency measurements"""
    operation: str
    count: int
    min_ms: float
    max_ms: float
    mean_ms: float
    median_ms: float
    p50_ms: float
    p95_ms: float
    p99_ms: float
    success_rate: float

class RealLatencyTester:
    """Tests latency by calling actual healthcare platform APIs"""
    
    def __init__(self, base_url: str = "http://localhost:3000"):
        self.base_url = base_url
        self.session = requests.Session()
        self.measurements: List[LatencyMeasurement] = []
        
        # Add authentication headers for testing
        self.session.headers.update({
            'Content-Type': 'application/json',
            'Authorization': 'Bearer test-token'
        })
    
    def measure_operation(self, operation_name: str, func, *args, **kwargs) -> LatencyMeasurement:
        """Measure the latency of an operation"""
        start_time = time.time()
        success = True
        error = None
        
        try:
            result = func(*args, **kwargs)
        except Exception as e:
            success = False
            error = str(e)
            result = None
        
        end_time = time.time()
        duration_ms = (end_time - start_time) * 1000
        
        measurement = LatencyMeasurement(
            operation=operation_name,
            duration_ms=duration_ms,
            timestamp=datetime.now(),
            success=success,
            error=error
        )
        
        self.measurements.append(measurement)
        return measurement
    
    def calculate_stats(self, operation: str) -> LatencyStats:
        """Calculate statistics for a specific operation"""
        op_measurements = [m for m in self.measurements if m.operation == operation]
        
        if not op_measurements:
            return LatencyStats(
                operation=operation,
                count=0,
                min_ms=0, max_ms=0, mean_ms=0, median_ms=0,
                p50_ms=0, p95_ms=0, p99_ms=0, success_rate=0
            )
        
        durations = [m.duration_ms for m in op_measurements]
        successful = [m for m in op_measurements if m.success]
        
        return LatencyStats(
            operation=operation,
            count=len(op_measurements),
            min_ms=min(durations),
            max_ms=max(durations),
            mean_ms=statistics.mean(durations),
            median_ms=statistics.median(durations),
            p50_ms=statistics.quantiles(durations, n=2)[0],
            p95_ms=statistics.quantiles(durations, n=20)[18] if len(durations) > 1 else durations[0],
            p99_ms=statistics.quantiles(durations, n=100)[98] if len(durations) > 1 else durations[0],
            success_rate=len(successful) / len(op_measurements)
        )
    
    def get_all_stats(self) -> List[LatencyStats]:
        """Get statistics for all operations"""
        operations = set(m.operation for m in self.measurements)
        return [self.calculate_stats(op) for op in operations]
    
    def generate_test_phi_data(self, size: str) -> str:
        """Generate test data with PHI for redaction testing"""
        sizes = {
            'small': 200,
            'medium': 1000,
            'large': 5000
        }
        
        target_length = sizes.get(size, 1000)
        
        # Sample data with various PHI types
        phi_data = """
        Patient: John Smith (DOB: 03/15/1985, SSN: 123-45-6789)
        Address: 123 Main Street, Anytown, CA 90210
        Phone: (555) 123-4567, Email: john.smith@email.com
        Medical Record: MR123456789
        
        Chief Complaint: Patient presents with severe headache and fever
        History: 45-year-old male with hypertension, diabetes type 2
        Medications: Metformin 500mg BID, Lisinopril 10mg daily
        Allergies: Penicillin, Shellfish
        
        Physical Exam: Temperature 101.2°F, BP 150/95, HR 88
        Assessment: Tension headache, rule out meningitis
        Plan: Acetaminophen 650mg q6h, follow-up in 3 days
        
        Insurance: Blue Cross Blue Shield, Policy #BC123456789
        Emergency Contact: Jane Smith (555) 987-6543
        """
        
        # Repeat and vary the data to reach target length
        result = phi_data
        while len(result) < target_length:
            variation = phi_data.replace("John Smith", "Jane Doe")
            variation = variation.replace("03/15/1985", "07/22/1978")
            variation = variation.replace("123-45-6789", "987-65-4321")
            variation = variation.replace("123 Main Street", "456 Oak Avenue")
            variation = variation.replace("(555) 123-4567", "(555) 999-8888")
            result += "\n\n" + variation
        
        return result[:target_length]
    
    def test_phi_redaction_latency(self, phi_data: str, iterations: int = 10):
        """Test PHI redaction latency using real healthcare platform functions"""
        print(f"\n📊 Testing PHI Redaction Latency ({len(phi_data)} chars)")
        print("-" * 50)
        
        for i in range(iterations):
            def redact_phi():
                # Call real PHI redaction API endpoint
                response = self.session.post(f"{self.base_url}/api/test/redact-phi", 
                    json={"data": phi_data},
                    timeout=30
                )
                return response.status_code == 200
            
            measurement = self.measure_operation("phi_redaction", redact_phi)
            status = "✅" if measurement.success else "❌"
            print(f"  {status} Iteration {i+1}: {measurement.duration_ms:.2f}ms")
            if not measurement.success and measurement.error:
                print(f"    Error: {measurement.error}")
    
    def test_provenance_generation_latency(self, data: str, iterations: int = 10):
        """Test provenance generation latency using real healthcare platform functions"""
        print(f"\n📊 Testing Provenance Generation Latency ({len(data)} chars)")
        print("-" * 50)
        
        for i in range(iterations):
            def generate_provenance():
                # Call real provenance generation API endpoint
                response = self.session.post(f"{self.base_url}/api/test/generate-provenance", 
                    json={"data": data},
                    timeout=30
                )
                return response.status_code == 200
            
            measurement = self.measure_operation("provenance_generation", generate_provenance)
            status = "✅" if measurement.success else "❌"
            print(f"  {status} Iteration {i+1}: {measurement.duration_ms:.2f}ms")
            if not measurement.success and measurement.error:
                print(f"    Error: {measurement.error}")
    
    def test_combined_redaction_provenance_latency(self, phi_data: str, iterations: int = 5):
        """Test combined redaction and provenance pipeline latency using ultra-fast processing"""
        print(f"\n📊 Testing Combined Redaction + Provenance Pipeline ({len(phi_data)} chars)")
        print("-" * 50)
        
        for i in range(iterations):
            def run_combined_pipeline():
                # Use ultra-fast pipeline API for local processing
                response = self.session.post(f"{self.base_url}/api/test/ultra-fast-pipeline", 
                    json={"data": phi_data},
                    timeout=30
                )
                return response.status_code == 200
            
            measurement = self.measure_operation("combined_redaction_provenance", run_combined_pipeline)
            status = "✅" if measurement.success else "❌"
            print(f"  {status} Iteration {i+1}: {measurement.duration_ms:.2f}ms")
            if not measurement.success and measurement.error:
                print(f"    Error: {measurement.error}")
    
    def test_parallel_batch_processing(self, phi_data: str, iterations: int = 3):
        """Test parallel batch processing performance with ultra-fast pipeline"""
        print(f"\n📊 Testing Parallel Batch Processing ({len(phi_data)} chars)")
        print("-" * 50)
        
        # Create multiple copies of data for batch processing
        batch_data = [phi_data] * 5  # Process 5 items in parallel
        
        for i in range(iterations):
            def run_batch_processing():
                response = self.session.post(f"{self.base_url}/api/test/ultra-fast-pipeline", 
                    json={"data": batch_data},
                    timeout=60
                )
                return response.status_code == 200
            
            measurement = self.measure_operation("parallel_batch_processing", run_batch_processing)
            status = "✅" if measurement.success else "❌"
            print(f"  {status} Iteration {i+1}: {measurement.duration_ms:.2f}ms")
            if not measurement.success and measurement.error:
                print(f"    Error: {measurement.error}")
    
    def test_streaming_processing(self, phi_data: str, iterations: int = 3):
        """Test streaming processing performance"""
        print(f"\n📊 Testing Streaming Processing ({len(phi_data)} chars)")
        print("-" * 50)
        
        for i in range(iterations):
            def run_streaming_processing():
                response = self.session.post(f"{self.base_url}/api/test/ultra-fast-pipeline", 
                    json={"data": phi_data, "streaming": True, "chunkSize": 500},
                    timeout=60
                )
                return response.status_code == 200
            
            measurement = self.measure_operation("streaming_processing", run_streaming_processing)
            status = "✅" if measurement.success else "❌"
            print(f"  {status} Iteration {i+1}: {measurement.duration_ms:.2f}ms")
            if not measurement.success and measurement.error:
                print(f"    Error: {measurement.error}")
    
    def test_ultra_fast_processing(self, phi_data: str, iterations: int = 10):
        """Test ultra-fast processing performance (targeting <100ms P95)"""
        print(f"\n📊 Testing Ultra-Fast Processing ({len(phi_data)} chars)")
        print("-" * 50)
        
        for i in range(iterations):
            def run_ultra_fast():
                response = self.session.post(f"{self.base_url}/api/test/ultra-fast-pipeline", 
                    json={"data": phi_data},
                    timeout=30
                )
                return response.status_code == 200
            
            measurement = self.measure_operation("ultra_fast_processing", run_ultra_fast)
            status = "✅" if measurement.success else "❌"
            print(f"  {status} Iteration {i+1}: {measurement.duration_ms:.2f}ms")
            if not measurement.success and measurement.error:
                print(f"    Error: {measurement.error}")
    
    def test_ultra_optimized_processing(self, phi_data: str, iterations: int = 20):
        """Test ultra-optimized processing performance (targeting <100ms P95)"""
        print(f"\n📊 Testing Ultra-Optimized Processing ({len(phi_data)} chars)")
        print("-" * 50)
        
        # Warm up the pipeline first
        try:
            self.session.get(f"{self.base_url}/api/test/ultra-optimized", timeout=10)
        except:
            pass
        
        for i in range(iterations):
            def run_ultra_optimized():
                response = self.session.post(f"{self.base_url}/api/test/ultra-optimized", 
                    json={"data": phi_data},
                    timeout=30
                )
                return response.status_code == 200
            
            measurement = self.measure_operation("ultra_optimized_processing", run_ultra_optimized)
            status = "✅" if measurement.success else "❌"
            print(f"  {status} Iteration {i+1}: {measurement.duration_ms:.2f}ms")
            if not measurement.success and measurement.error:
                print(f"    Error: {measurement.error}")
    
    def test_ultra_optimized_batch(self, phi_data: str, iterations: int = 5):
        """Test ultra-optimized batch processing performance"""
        print(f"\n📊 Testing Ultra-Optimized Batch Processing ({len(phi_data)} chars)")
        print("-" * 50)
        
        # Create batch data
        batch_data = [phi_data] * 10  # Process 10 items in parallel
        
        for i in range(iterations):
            def run_ultra_optimized_batch():
                response = self.session.post(f"{self.base_url}/api/test/ultra-optimized", 
                    json={"data": batch_data},
                    timeout=60
                )
                return response.status_code == 200
            
            measurement = self.measure_operation("ultra_optimized_batch", run_ultra_optimized_batch)
            status = "✅" if measurement.success else "❌"
            print(f"  {status} Iteration {i+1}: {measurement.duration_ms:.2f}ms")
            if not measurement.success and measurement.error:
                print(f"    Error: {measurement.error}")
    
    def test_wasm_redaction(self, phi_data: str, iterations: int = 15):
        """Test WASM-based redaction performance"""
        print(f"\n📊 Testing WASM Redaction ({len(phi_data)} chars)")
        print("-" * 50)
        
        # Initialize WASM module first
        try:
            self.session.get(f"{self.base_url}/api/test/wasm-redaction", timeout=10)
        except:
            pass
        
        for i in range(iterations):
            def run_wasm_redaction():
                response = self.session.post(f"{self.base_url}/api/test/wasm-redaction", 
                    json={"data": phi_data, "withStats": True},
                    timeout=30
                )
                return response.status_code == 200
            
            measurement = self.measure_operation("wasm_redaction", run_wasm_redaction)
            status = "✅" if measurement.success else "❌"
            print(f"  {status} Iteration {i+1}: {measurement.duration_ms:.2f}ms")
            if not measurement.success and measurement.error:
                print(f"    Error: {measurement.error}")
    
    def test_wasm_batch_redaction(self, phi_data: str, iterations: int = 5):
        """Test WASM batch redaction performance"""
        print(f"\n📊 Testing WASM Batch Redaction ({len(phi_data)} chars)")
        print("-" * 50)
        
        # Create batch data
        batch_data = [phi_data] * 10  # Process 10 items in parallel
        
        for i in range(iterations):
            def run_wasm_batch():
                response = self.session.post(f"{self.base_url}/api/test/wasm-redaction", 
                    json={"data": batch_data, "batch": True},
                    timeout=60
                )
                return response.status_code == 200
            
            measurement = self.measure_operation("wasm_batch_redaction", run_wasm_batch)
            status = "✅" if measurement.success else "❌"
            print(f"  {status} Iteration {i+1}: {measurement.duration_ms:.2f}ms")
            if not measurement.success and measurement.error:
                print(f"    Error: {measurement.error}")
    
    def test_worker_redaction(self, phi_data: str, iterations: int = 15):
        """Test Worker Threads redaction performance"""
        print(f"\n📊 Testing Worker Threads Redaction ({len(phi_data)} chars)")
        print("-" * 50)
        
        # Initialize worker threads first
        try:
            self.session.get(f"{self.base_url}/api/test/worker-redaction", timeout=10)
        except:
            pass
        
        for i in range(iterations):
            def run_worker_redaction():
                response = self.session.post(f"{self.base_url}/api/test/worker-redaction", 
                    json={"data": phi_data},
                    timeout=30
                )
                return response.status_code == 200
            
            measurement = self.measure_operation("worker_redaction", run_worker_redaction)
            status = "✅" if measurement.success else "❌"
            print(f"  {status} Iteration {i+1}: {measurement.duration_ms:.2f}ms")
            if not measurement.success and measurement.error:
                print(f"    Error: {measurement.error}")
    
    def test_worker_batch_redaction(self, phi_data: str, iterations: int = 5):
        """Test Worker Threads batch redaction performance"""
        print(f"\n📊 Testing Worker Threads Batch Redaction ({len(phi_data)} chars)")
        print("-" * 50)
        
        # Create batch data
        batch_data = [phi_data] * 10  # Process 10 items in parallel
        
        for i in range(iterations):
            def run_worker_batch():
                response = self.session.post(f"{self.base_url}/api/test/worker-redaction", 
                    json={"data": batch_data, "batch": True},
                    timeout=60
                )
                return response.status_code == 200
            
            measurement = self.measure_operation("worker_batch_redaction", run_worker_batch)
            status = "✅" if measurement.success else "❌"
            print(f"  {status} Iteration {i+1}: {measurement.duration_ms:.2f}ms")
            if not measurement.success and measurement.error:
                print(f"    Error: {measurement.error}")
    
    def check_server_status(self):
        """Check if the healthcare platform server is running"""
        print("🔍 Checking Server Status")
        print("=" * 30)
        
        try:
            response = self.session.get(f"{self.base_url}/api/auth/session", timeout=10)
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
    """Run real latency tests"""
    print("⏱️  Real Latency Profiling Test Suite")
    print("=" * 60)
    print("Testing redaction and provenance pipeline performance")
    print()
    
    tester = RealLatencyTester()
    
    # Check if server is running
    if not tester.check_server_status():
        print("\n❌ Cannot proceed without running server")
        print("Please start the healthcare platform with: npm run dev")
        return
    
    print("\n🚀 Starting Real Latency Tests")
    print("=" * 40)
    
    # Test different data sizes
    test_sizes = ['small', 'medium', 'large']
    
    for size in test_sizes:
        phi_data = tester.generate_test_phi_data(size)
        print(f"\n📊 Testing {size.upper()} data ({len(phi_data)} chars)")
        
        # Test individual operations
        tester.test_phi_redaction_latency(phi_data, iterations=10)
        tester.test_provenance_generation_latency(phi_data, iterations=10)
        tester.test_combined_redaction_provenance_latency(phi_data, iterations=5)
        tester.test_parallel_batch_processing(phi_data, iterations=3)
        tester.test_streaming_processing(phi_data, iterations=3)
        tester.test_ultra_fast_processing(phi_data, iterations=10)
        tester.test_ultra_optimized_processing(phi_data, iterations=20)
        tester.test_ultra_optimized_batch(phi_data, iterations=5)
        tester.test_wasm_redaction(phi_data, iterations=15)
        tester.test_wasm_batch_redaction(phi_data, iterations=5)
        tester.test_worker_redaction(phi_data, iterations=15)
        tester.test_worker_batch_redaction(phi_data, iterations=5)
    
    # Calculate and display results
    print("\n📊 Real Latency Results")
    print("=" * 50)
    
    all_stats = tester.get_all_stats()
    
    for stats in all_stats:
        print(f"\n🔍 {stats.operation.upper()}")
        print(f"  Count: {stats.count}")
        print(f"  Min: {stats.min_ms:.2f}ms")
        print(f"  Max: {stats.max_ms:.2f}ms")
        print(f"  Mean: {stats.mean_ms:.2f}ms")
        print(f"  Median: {stats.median_ms:.2f}ms")
        print(f"  P50: {stats.p50_ms:.2f}ms")
        print(f"  P95: {stats.p95_ms:.2f}ms")
        print(f"  P99: {stats.p99_ms:.2f}ms")
        print(f"  Success Rate: {stats.success_rate:.1%}")
    
    # Performance recommendations
    print("\n🎯 Performance Recommendations")
    print("=" * 40)
    
    # Find slowest operations
    slowest_ops = sorted(all_stats, key=lambda x: x.p95_ms, reverse=True)[:3]
    
    print("Slowest operations (P95):")
    for i, stats in enumerate(slowest_ops, 1):
        print(f"  {i}. {stats.operation}: {stats.p95_ms:.2f}ms")
    
    # Performance requirements check
    print("\n📋 Performance Requirements Check:")
    print("  - Real-time processing: < 100ms P95")
    print("  - Batch processing: < 1000ms P95")
    print("  - Success rate: > 99%")
    
    real_time_ops = [s for s in all_stats if s.p95_ms < 100]
    batch_ops = [s for s in all_stats if s.p95_ms < 1000]
    high_success_ops = [s for s in all_stats if s.success_rate > 0.99]
    
    print(f"  ✅ Real-time P95: {len(real_time_ops)}/{len(all_stats)} PASS")
    print(f"  ✅ Batch P95: {len(batch_ops)}/{len(all_stats)} PASS")
    print(f"  ✅ Success Rate: {len(high_success_ops)}/{len(all_stats)} PASS")

if __name__ == "__main__":
    main()