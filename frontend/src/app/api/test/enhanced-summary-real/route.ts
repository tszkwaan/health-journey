import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { medicalBackground, intakeAnswers, patient } = await request.json();

    if (!medicalBackground || !intakeAnswers || !patient) {
      return NextResponse.json(
        { error: 'Medical background, intake answers, and patient data are required' },
        { status: 400 }
      );
    }

    const startTime = performance.now();

    // Mock enhanced summary generation with realistic content
    const mockEnhancedSummary = {
      clinicianSummary: {
        assessment: "Patient presents with headache and fever, likely tension headache or viral infection",
        plan: "1. Rest at home\n2. Acetaminophen 500mg every 6 hours as needed\n3. Monitor symptoms",
        medications: "Acetaminophen 500mg PO q6h PRN for pain and fever",
        followUp: "Follow up in 3-5 days if symptoms persist or worsen"
      },
      patientSummary: {
        diagnosis: "頭痛和發燒，可能是緊張性頭痛或病毒感染",
        instructions: "1. 在家休息\n2. 需要時服用撲熱息痛500毫克，每6小時一次\n3. 監測症狀",
        medications: "撲熱息痛500毫克，需要時每6小時服用一次",
        homeCare: "充分休息，多喝水，避免劇烈活動",
        recovery: "通常3-5天內會好轉，如症狀持續請就醫",
        followUp: "3-5天後回診檢查",
        warningSigns: "如出現嚴重頭痛、高燒超過38.5°C或意識不清請立即就醫",
        whenToSeekHelp: "症狀惡化或3天後無改善請聯繫醫生"
      },
      sources: [
        {
          id: 1,
          type: 'medical_background',
          section: 'Past Medical Conditions',
          content: patient.medicalHistory?.pastMedicalConditions || 'No significant past medical history',
          timestamp: '2024-01-20T10:00:00Z'
        },
        {
          id: 2,
          type: 'intake_answers',
          section: 'Chief Complaint',
          content: intakeAnswers.chiefComplaint || 'Headache and fever',
          timestamp: '2024-01-20T10:15:00Z'
        },
        {
          id: 3,
          type: 'intake_answers',
          section: 'Symptoms',
          content: intakeAnswers.symptoms || 'Head pain, feverish feeling, fatigue',
          timestamp: '2024-01-20T10:20:00Z'
        }
      ],
      citations: [
        {
          id: 1,
          type: 'consultation',
          section: 'Assessment',
          content: 'Patient presents with headache and fever, likely tension headache or viral infection',
          source: 'Consultation transcript',
          timestamp: '10:30:00'
        },
        {
          id: 2,
          type: 'consultation',
          section: 'Treatment Plan',
          content: 'Rest at home, acetaminophen for pain management, follow-up in 3-5 days',
          source: 'Consultation transcript',
          timestamp: '10:35:00'
        }
      ]
    };

    const totalTime = performance.now() - startTime;

    return NextResponse.json({
      success: true,
      enhancedSummary: mockEnhancedSummary,
      processingTime: totalTime,
      performance_stats: {
        totalTime: totalTime,
        sourceCount: mockEnhancedSummary.sources.length,
        citationCount: mockEnhancedSummary.citations.length,
        optimization: 'test-friendly-mock'
      }
    });

  } catch (error) {
    console.error('Error in test enhanced summary:', error);
    return NextResponse.json(
      { error: 'Failed to generate test enhanced summary' },
      { status: 500 }
    );
  }
}
