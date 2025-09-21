import { NextRequest, NextResponse } from 'next/server';
import { RAGService } from '@/lib/rag/ragService';
import { OptimizedPHIRedactor } from '@/lib/phi-redaction-optimized';

// Global RAG service instance
const ragService = new RAGService();

export async function POST(request: NextRequest) {
  try {
    const { message, reservationId = 'test-reservation-001' } = await request.json();

    if (!message || typeof message !== 'string') {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    const startTime = performance.now();

    // Generate RAG response with mock patient data
    const mockPatientData = {
      medicalBackground: {
        conditions: ['Hypertension', 'Diabetes'],
        medications: ['Lisinopril 10mg daily', 'Metformin 500mg twice daily'],
        allergies: ['Penicillin', 'Shellfish']
      },
      intakeAnswers: {
        chiefComplaint: 'Headache and fever',
        symptoms: 'Severe headache, fever, photophobia',
        duration: '2 days',
        severity: 'Moderate to severe'
      }
    };

    // Generate RAG response
    const ragResponse = await ragService.generateResponse(message, reservationId, false);

    // Redact PHI from response
    const redactedResponse = {
      ...ragResponse,
      response: OptimizedPHIRedactor.redact(ragResponse.response),
      sources: ragResponse.sources?.map(source => ({
        ...source,
        content: OptimizedPHIRedactor.redact(source.content)
      }))
    };

    const totalTime = performance.now() - startTime;

    return NextResponse.json({
      ...redactedResponse,
      processingTime: totalTime,
      testMode: true
    });

  } catch (error) {
    console.error('Error in test chat API:', error);
    return NextResponse.json(
      { error: 'Failed to process chat message', details: (error as Error).message },
      { status: 500 }
    );
  }
}
