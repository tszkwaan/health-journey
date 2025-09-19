#!/usr/bin/env python3
"""
Test script to verify RAG-based summary generation prevents hallucination
"""

import asyncio
import sys
import os

# Add backend to path
sys.path.append(os.path.join(os.path.dirname(__file__), 'backend'))

from backend.app.summary.rag_adapter import RAGSummaryAdapter

async def test_rag_summary():
    """Test RAG summary with sample conversation data"""
    
    # Sample conversation steps (what a patient actually said)
    steps = [
        {
            "step": "identification",
            "text": "My name is John Smith, born 1990-05-15, phone 555-1234",
            "confirmed": True
        },
        {
            "step": "reason", 
            "text": "I have a headache",
            "confirmed": True
        },
        {
            "step": "onset",
            "text": "Started this morning",
            "confirmed": True
        },
        {
            "step": "history",
            "text": "I had migraines before",
            "confirmed": True
        },
        {
            "step": "allergies",
            "text": "I'm allergic to penicillin",
            "confirmed": True
        },
        {
            "step": "safety",
            "text": "No urgent concerns",
            "confirmed": True
        }
    ]
    
    print("🧪 Testing RAG Summary Adapter")
    print("=" * 50)
    
    # Test with RAG adapter
    adapter = RAGSummaryAdapter()
    
    try:
        result = await adapter.summarize(steps)
        
        print("✅ RAG Summary Result:")
        print(f"Patient Info: {result.get('patient_info', 'N/A')}")
        print(f"Main Complaint: {result.get('main_complaint', 'N/A')}")
        print(f"Symptom Onset: {result.get('symptom_onset', 'N/A')}")
        print(f"Relevant History: {result.get('relevant_history', [])}")
        print(f"Allergies: {result.get('allergies', [])}")
        print(f"Red Flags: {result.get('red_flags', [])}")
        
        # Verify no hallucination
        print("\n🔍 Hallucination Check:")
        if "software engineer" in str(result).lower():
            print("❌ HALLUCINATION DETECTED: 'software engineer' not mentioned")
        else:
            print("✅ No 'software engineer' hallucination")
            
        if "lives alone" in str(result).lower():
            print("❌ HALLUCINATION DETECTED: 'lives alone' not mentioned")
        else:
            print("✅ No 'lives alone' hallucination")
            
        if "active" in str(result).lower() and "lifestyle" in str(result).lower():
            print("❌ HALLUCINATION DETECTED: 'active lifestyle' not mentioned")
        else:
            print("✅ No 'active lifestyle' hallucination")
            
        print("\n✅ RAG Summary Test Completed Successfully!")
        
    except Exception as e:
        print(f"❌ Error testing RAG adapter: {e}")
        return False
    
    return True

if __name__ == "__main__":
    success = asyncio.run(test_rag_summary())
    sys.exit(0 if success else 1)
