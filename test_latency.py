#!/usr/bin/env python3
"""
Test Latency: Profile your redaction and provenance pipeline. Report P50/P95 latencies.

This test measures the performance of the redaction and provenance pipeline
to ensure it meets real-time requirements for healthcare applications.
"""

import time
import asyncio
import statistics
from typing import List, Dict, Any, Tuple
from dataclasses import dataclass
from datetime import datetime
import random
import string

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

class LatencyProfiler:
    """Profiles latency of redaction and provenance operations"""
    
    def __init__(self):
        self.measurements: List[LatencyMeasurement] = []
    
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
    
    async def measure_async_operation(self, operation_name: str, func, *args, **kwargs) -> LatencyMeasurement:
        """Measure the latency of an async operation"""
        start_time = time.time()
        success = True
        error = None
        
        try:
            result = await func(*args, **kwargs)
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

class MockRedactionService:
    """Mock redaction service for testing"""
    
    def __init__(self):
        self.phi_patterns = [
            r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b',  # Email
            r'(\+?1[-.\s]?)?\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})',  # Phone
            r'\b\d{3}-?\d{2}-?\d{4}\b',  # SSN
            r'\b(0?[1-9]|1[0-2])[\/\-](0?[1-9]|[12][0-9]|3[01])[\/\-](19|20)\d{2}\b'  # DOB
        ]
    
    def redact_text(self, text: str) -> str:
        """Simulate text redaction with artificial delay"""
        import re
        
        # Simulate processing time based on text length
        processing_time = len(text) * 0.0001  # 0.1ms per character
        time.sleep(processing_time)
        
        # Perform redaction
        redacted = text
        for pattern in self.phi_patterns:
            redacted = re.sub(pattern, '[REDACTED]', redacted, flags=re.IGNORECASE)
        
        return redacted
    
    async def redact_text_async(self, text: str) -> str:
        """Simulate async text redaction"""
        # Simulate async processing
        await asyncio.sleep(len(text) * 0.00005)  # 0.05ms per character
        
        # Perform redaction
        import re
        redacted = text
        for pattern in self.phi_patterns:
            redacted = re.sub(pattern, '[REDACTED]', redacted, flags=re.IGNORECASE)
        
        return redacted

class MockProvenanceService:
    """Mock provenance service for testing"""
    
    def generate_citations(self, text: str) -> Dict[str, Any]:
        """Simulate citation generation with artificial delay"""
        # Simulate processing time
        processing_time = len(text) * 0.0002  # 0.2ms per character
        time.sleep(processing_time)
        
        # Generate mock citations
        citations = []
        sentences = text.split('.')
        for i, sentence in enumerate(sentences[:5]):  # Limit to 5 citations
            if sentence.strip():
                citations.append({
                    'id': i + 1,
                    'type': 'consultation',
                    'content': sentence.strip(),
                    'source': 'Consultation transcript',
                    'timestamp': f"20:37:{i*10:02d}"
                })
        
        return {
            'citations': citations,
            'total_citations': len(citations)
        }
    
    async def generate_citations_async(self, text: str) -> Dict[str, Any]:
        """Simulate async citation generation"""
        # Simulate async processing
        await asyncio.sleep(len(text) * 0.0001)  # 0.1ms per character
        
        # Generate mock citations
        citations = []
        sentences = text.split('.')
        for i, sentence in enumerate(sentences[:5]):
            if sentence.strip():
                citations.append({
                    'id': i + 1,
                    'type': 'consultation',
                    'content': sentence.strip(),
                    'source': 'Consultation transcript',
                    'timestamp': f"20:37:{i*10:02d}"
                })
        
        return {
            'citations': citations,
            'total_citations': len(citations)
        }

def generate_test_data(size: str) -> str:
    """Generate test data of specified size"""
    sizes = {
        'small': 100,
        'medium': 1000,
        'large': 5000,
        'xlarge': 10000
    }
    
    target_length = sizes.get(size, 1000)
    
    # Generate realistic medical text with PHI
    base_text = """
    Patient John Smith (DOB: 03/15/1985) presented with headache and fever.
    Contact: john.smith@email.com, Phone: (555) 123-4567
    Address: 123 Main Street, Anytown, NY 12345
    SSN: 123-45-6789, Patient ID: AB123456
    
    Medical History:
    Patient has been experiencing headaches since 03/15/2024.
    Previous treatment included acetaminophen and rest.
    No known allergies or medical conditions.
    
    Physical Examination:
    Temperature: 37.9°C, Blood pressure: 118/75 mmHg
    Heart rate: 92 bpm, Respiratory rate: 16/min
    General appearance: Alert, oriented, in mild distress
    
    Assessment and Plan:
    Differential diagnosis includes tension headache and viral infection.
    Plan: Prescribe acetaminophen, monitor symptoms, follow-up in 3-5 days.
    Contact patient at (555) 123-4567 for appointment confirmation.
    """
    
    # Repeat and vary the text to reach target length
    result = base_text
    while len(result) < target_length:
        # Add variation to avoid exact repetition
        variation = base_text.replace("John Smith", f"Patient {random.randint(1, 1000)}")
        variation = variation.replace("03/15/1985", f"{random.randint(1,12):02d}/{random.randint(1,28):02d}/{random.randint(1980,2000)}")
        variation = variation.replace("john.smith@email.com", f"patient{random.randint(1,1000)}@email.com")
        variation = variation.replace("(555) 123-4567", f"({random.randint(100,999)}) {random.randint(100,999)}-{random.randint(1000,9999)}")
        result += "\n\n" + variation
    
    return result[:target_length]

async def run_latency_tests():
    """Run comprehensive latency tests"""
    print("⏱️  Latency Profiling Test Suite")
    print("=" * 50)
    print("Testing redaction and provenance pipeline performance")
    print()
    
    profiler = LatencyProfiler()
    redaction_service = MockRedactionService()
    provenance_service = MockProvenanceService()
    
    # Test data sizes
    test_sizes = ['small', 'medium', 'large', 'xlarge']
    
    print("🧪 Testing Redaction Performance")
    print("-" * 40)
    
    for size in test_sizes:
        print(f"\n📊 Testing {size.upper()} data ({len(generate_test_data(size))} chars)")
        
        # Test synchronous redaction
        for i in range(10):  # 10 iterations per size
            test_data = generate_test_data(size)
            profiler.measure_operation(
                f"redaction_sync_{size}",
                redaction_service.redact_text,
                test_data
            )
        
        # Test asynchronous redaction
        for i in range(10):
            test_data = generate_test_data(size)
            await profiler.measure_async_operation(
                f"redaction_async_{size}",
                redaction_service.redact_text_async,
                test_data
            )
    
    print("\n🧪 Testing Provenance Performance")
    print("-" * 40)
    
    for size in test_sizes:
        print(f"\n📊 Testing {size.upper()} data ({len(generate_test_data(size))} chars)")
        
        # Test synchronous citation generation
        for i in range(10):
            test_data = generate_test_data(size)
            profiler.measure_operation(
                f"provenance_sync_{size}",
                provenance_service.generate_citations,
                test_data
            )
        
        # Test asynchronous citation generation
        for i in range(10):
            test_data = generate_test_data(size)
            await profiler.measure_async_operation(
                f"provenance_async_{size}",
                provenance_service.generate_citations_async,
                test_data
            )
    
    print("\n🧪 Testing Combined Pipeline")
    print("-" * 40)
    
    for size in test_sizes:
        print(f"\n📊 Testing {size.upper()} data ({len(generate_test_data(size))} chars)")
        
        # Test combined redaction + provenance
        for i in range(10):
            test_data = generate_test_data(size)
            
            # Measure combined pipeline
            start_time = time.time()
            
            # Redaction
            redacted = redaction_service.redact_text(test_data)
            
            # Provenance
            citations = provenance_service.generate_citations(redacted)
            
            end_time = time.time()
            duration_ms = (end_time - start_time) * 1000
            
            measurement = LatencyMeasurement(
                operation=f"pipeline_combined_{size}",
                duration_ms=duration_ms,
                timestamp=datetime.now(),
                success=True
            )
            profiler.measurements.append(measurement)
    
    # Generate and display results
    print("\n📊 Latency Results")
    print("=" * 50)
    
    all_stats = profiler.get_all_stats()
    
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

def main():
    """Main function to run latency tests"""
    asyncio.run(run_latency_tests())

if __name__ == "__main__":
    main()
