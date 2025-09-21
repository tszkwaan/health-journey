#!/usr/bin/env python3
"""
Test Real Latency: Call actual healthcare platform functions to test performance

This test calls the real form generation API endpoints to measure
actual latency and performance metrics.
"""

import requests
import time
import statistics
import asyncio
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
    
    def generate_test_transcript(self, size: str) -> str:
        """Generate test transcript of specified size"""
        sizes = {
            'small': 100,
            'medium': 1000,
            'large': 5000,
            'xlarge': 10000
        }
        
        target_length = sizes.get(size, 1000)
        
        base_transcript = """
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
        
        # Repeat and vary the transcript to reach target length
        result = base_transcript
        while len(result) < target_length:
            variation = base_transcript.replace("headache", "pain")
            variation = variation.replace("feverish", "unwell")
            variation = variation.replace("37.9°C", "38.1°C")
            result += "\n\n" + variation
        
        return result[:target_length]
    
    def test_form_generation_latency(self, form_type: str, transcript: str, iterations: int = 5):
        """Test form generation latency"""
        print(f"\n📊 Testing {form_type} Generation Latency ({len(transcript)} chars)")
        print("-" * 50)
        
        for i in range(iterations):
            def generate_form():
                response = self.session.post(f"{self.base_url}/api/forms/generate", 
                    json={
                        "formId": form_type,
                        "transcript": transcript,
                        "reservationId": f"test-reservation-{i}"
                    },
                    timeout=60
                )
                return response.status_code == 200
            
            measurement = self.measure_operation(f"{form_type}_generation", generate_form)
            status = "✅" if measurement.success else "❌"
            print(f"  {status} Iteration {i+1}: {measurement.duration_ms:.2f}ms")
            if not measurement.success and measurement.error:
                print(f"    Error: {measurement.error}")
    
    def test_enhanced_summary_latency(self, iterations: int = 5):
        """Test enhanced summary generation latency"""
        print(f"\n📊 Testing Enhanced Summary Generation Latency")
        print("-" * 50)
        
        medical_background = {
            "medicalHistory": "No significant medical history",
            "medications": "None",
            "allergies": "None known"
        }
        
        intake_answers = {
            "visit_reason": "headache",
            "symptom_onset": "this morning",
            "previous_treatment": "none",
            "medical_conditions": "none",
            "allergies": "none",
            "concerns": "none"
        }
        
        patient = {
            "name": "Test Patient",
            "email": "test@example.com"
        }
        
        for i in range(iterations):
            def generate_enhanced_summary():
                response = self.session.post(f"{self.base_url}/api/reservations/test-reservation-{i}/enhanced-summary", 
                    json={
                        "medicalBackground": medical_background,
                        "intakeAnswers": intake_answers,
                        "patient": patient
                    },
                    timeout=60
                )
                return response.status_code == 200
            
            measurement = self.measure_operation("enhanced_summary_generation", generate_enhanced_summary)
            status = "✅" if measurement.success else "❌"
            print(f"  {status} Iteration {i+1}: {measurement.duration_ms:.2f}ms")
            if not measurement.success and measurement.error:
                print(f"    Error: {measurement.error}")
    
    def test_combined_pipeline_latency(self, transcript: str, iterations: int = 3):
        """Test combined pipeline latency (clinician + patient summary)"""
        print(f"\n📊 Testing Combined Pipeline Latency ({len(transcript)} chars)")
        print("-" * 50)
        
        for i in range(iterations):
            def run_combined_pipeline():
                # Generate clinician summary first
                clinician_response = self.session.post(f"{self.base_url}/api/forms/generate", 
                    json={
                        "formId": "clinician_summary",
                        "transcript": transcript,
                        "reservationId": f"test-pipeline-{i}"
                    },
                    timeout=60
                )
                
                if clinician_response.status_code != 200:
                    return False
                
                clinician_data = clinician_response.json()
                
                # Generate patient summary with clinician data
                patient_response = self.session.post(f"{self.base_url}/api/forms/generate", 
                    json={
                        "formId": "patient_summary",
                        "transcript": transcript,
                        "reservationId": f"test-pipeline-{i}",
                        "clinicianSummary": clinician_data
                    },
                    timeout=60
                )
                
                return patient_response.status_code == 200
            
            measurement = self.measure_operation("combined_pipeline", run_combined_pipeline)
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
    print("Testing actual healthcare platform performance")
    print()
    
    tester = RealLatencyTester()
    
    # Check if server is running
    if not tester.check_server_status():
        print("\n❌ Cannot proceed without running server")
        print("Please start the healthcare platform with: npm run dev")
        return
    
    print("\n🚀 Starting Real Latency Tests")
    print("=" * 40)
    
    # Test different transcript sizes
    test_sizes = ['small', 'medium', 'large']
    
    for size in test_sizes:
        transcript = tester.generate_test_transcript(size)
        print(f"\n📊 Testing {size.upper()} data ({len(transcript)} chars)")
        
        # Test individual form generation
        tester.test_form_generation_latency('clinician_summary', transcript, 3)
        tester.test_form_generation_latency('patient_summary', transcript, 3)
        
        # Test enhanced summary
        tester.test_enhanced_summary_latency(3)
        
        # Test combined pipeline
        tester.test_combined_pipeline_latency(transcript, 2)
    
    # Generate and display results
    print("\n📊 Real Latency Results")
    print("=" * 50)
    
    all_stats = tester.get_all_stats()
    
    for stats in all_stats:
        if stats.count > 0:
            print(f"\n🔍 {stats.operation.upper()}")
            print(f"  Count: {stats.count}")
            print(f"  Min: {stats.min_ms:.2f}ms")
            print(f"  Max: {stats.max_ms:.2f}ms")
            print(f"  Mean: {stats.mean_ms:.2f}ms")
            print(f"  Median: {stats.median_ms:.2f}ms")
            print(f"  P50: {stats.p50_ms:.2f}ms")
            print(f"  P95: {stats.p95_ms:.2f}ms")
            print(f"  P99: {stats.p99_ms:.2f}ms")
            print(f"  Success Rate: {stats.success_rate*100:.1f}%")
    
    # Performance recommendations
    print("\n🎯 Performance Recommendations")
    print("=" * 40)
    
    # Find the slowest operations
    slowest_ops = sorted(all_stats, key=lambda x: x.p95_ms, reverse=True)[:3]
    
    print("Slowest operations (P95):")
    for i, op in enumerate(slowest_ops, 1):
        print(f"  {i}. {op.operation}: {op.p95_ms:.2f}ms")
    
    # Check if performance meets requirements
    print("\n📋 Performance Requirements Check:")
    print("  - Real-time processing: < 100ms P95")
    print("  - Batch processing: < 1000ms P95")
    print("  - Success rate: > 99%")
    
    realtime_ops = [op for op in all_stats if 'small' in op.operation or 'medium' in op.operation]
    batch_ops = [op for op in all_stats if 'large' in op.operation or 'xlarge' in op.operation]
    
    realtime_p95 = max([op.p95_ms for op in realtime_ops]) if realtime_ops else 0
    batch_p95 = max([op.p95_ms for op in batch_ops]) if batch_ops else 0
    
    print(f"  ✅ Real-time P95: {realtime_p95:.2f}ms {'PASS' if realtime_p95 < 100 else 'FAIL'}")
    print(f"  ✅ Batch P95: {batch_p95:.2f}ms {'PASS' if batch_p95 < 1000 else 'FAIL'}")
    
    success_rates = [op.success_rate for op in all_stats if op.count > 0]
    avg_success_rate = statistics.mean(success_rates) if success_rates else 0
    print(f"  ✅ Success Rate: {avg_success_rate*100:.1f}% {'PASS' if avg_success_rate > 0.99 else 'FAIL'}")

if __name__ == "__main__":
    main()
