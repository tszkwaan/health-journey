import { NextRequest, NextResponse } from 'next/server';
import { processIntakeMessage } from '@/lib/intake/langgraph';
import { MessageIntakeRequest, MessageIntakeResponse } from '@/lib/intake/types';
import { getSession } from '@/lib/intake/state';

export async function POST(request: NextRequest): Promise<NextResponse<MessageIntakeResponse>> {
  try {
    const body: MessageIntakeRequest = await request.json();
    const { sessionId, userText } = body;
    
    // Validate request
    if (!sessionId || !userText) {
      return NextResponse.json(
        {
          sessionId: '',
          current_step: 'full_name',
          progress: 0,
          utterance: 'Please provide both sessionId and userText.',
          requires_correction: true
        },
        { status: 400 }
      );
    }
    
    // Process message through LangGraph (handles session creation if needed)
    const result = processIntakeMessage(sessionId, userText);
    
    const response: MessageIntakeResponse = {
      sessionId: result.sessionId,
      current_step: result.current_step,
      progress: result.progress,
      utterance: result.utterance,
      requires_correction: result.requires_correction,
      review_snapshot: result.review_snapshot
    };
    
    return NextResponse.json(response);
  } catch (error) {
    console.error('Error processing intake message:', error);
    return NextResponse.json(
      {
        sessionId: '',
        current_step: 'full_name',
        progress: 0,
        utterance: 'I apologize, but I encountered an error processing your message. Please try again.',
        requires_correction: true
      },
      { status: 500 }
    );
  }
}
