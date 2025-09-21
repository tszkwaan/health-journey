import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { reservationId = 'test-reservation-001' } = await request.json();

    const startTime = performance.now();

    // Mock enhanced summary generation
    const mockSummary = {
      clinicianSummary: {
        assessment: "Patient presents with headache and fever, likely tension headache or viral infection",
        plan: "1. Rest at home\n2. Acetaminophen 500mg every 6 hours as needed\n3. Monitor symptoms",
        medications: "Acetaminophen 500mg PO q6h PRN for pain and fever",
        followUp: "Follow up in 3-5 days if symptoms persist or worsen"
      },
      patientSummary: {
        diagnosis: "頭痛和發燒，可能是緊張性頭痛或病毒感染",
        instructions: "1. 在家休息\n2. 需要時服用撲熱息痛500毫克，每6小時一次\n3. 監測症狀",
        medications: "撲熱息痛500毫克，每6小時一次，用於疼痛和發燒",
        followUp: "如果症狀持續或惡化，請在3-5天內回診"
      },
      canonicalIR: {
        diagnoses: [
          { name: "Tension headache", certainty: "possible" },
          { name: "Viral infection", certainty: "possible" }
        ],
        medications: [
          {
            generic: "acetaminophen",
            dose: "500mg",
            route: "PO",
            freq: "q6h",
            indication: "pain and fever relief"
          }
        ],
        plan: [
          { type: "rest", details: "home rest" },
          { type: "medication", details: "acetaminophen as needed" },
          { type: "monitoring", details: "watch for worsening symptoms" }
        ],
        follow_up: {
          type: "follow_up",
          details: "reassess symptoms",
          when: "3-5 days",
          condition: "if symptoms persist"
        }
      }
    };

    const totalTime = performance.now() - startTime;

    return NextResponse.json({
      success: true,
      ...mockSummary,
      processingTime: totalTime,
      testMode: true
    });

  } catch (error) {
    console.error('Error in test enhanced summary API:', error);
    return NextResponse.json(
      { error: 'Failed to generate enhanced summary', details: (error as Error).message },
      { status: 500 }
    );
  }
}
