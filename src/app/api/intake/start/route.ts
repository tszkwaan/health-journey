import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { createSession } from '@/lib/intake/state';
import { generateUtterance } from '@/lib/intake/llm';
import { StartIntakeResponse } from '@/lib/intake/types';

export async function POST(request: NextRequest): Promise<NextResponse<StartIntakeResponse>> {
  try {
    // Generate new session ID
    const sessionId = uuidv4();
    
    // Create new session
    const session = createSession(sessionId);
    
    // Generate initial utterance
    const utterance = generateUtterance('patient_info', 'ask');
    
    const response: StartIntakeResponse = {
      sessionId: session.sessionId,
      current_step: session.current_step,
      progress: session.progress,
      utterance
    };
    
    return NextResponse.json(response);
  } catch (error) {
    console.error('Error starting intake session:', error);
    return NextResponse.json(
      { 
        sessionId: '',
        current_step: 'full_name',
        progress: 0,
        utterance: 'I apologize, but I encountered an error. Please try again.'
      },
      { status: 500 }
    );
  }
}
