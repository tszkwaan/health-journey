import { NextRequest, NextResponse } from 'next/server';
import { addDocument, getSession } from '@/lib/intake/state';
import { generateUtterance } from '@/lib/intake/llm';
import { AttachDocRequest, AttachDocResponse, Document } from '@/lib/intake/types';

export async function POST(request: NextRequest): Promise<NextResponse<AttachDocResponse>> {
  try {
    const body: AttachDocRequest = await request.json();
    const { sessionId, document } = body;
    
    // Validate request
    if (!sessionId || !document) {
      return NextResponse.json(
        {
          sessionId: '',
          current_step: 'full_name',
          progress: 0,
          utterance: 'Please provide both sessionId and document.',
          success: false
        },
        { status: 400 }
      );
    }
    
    // Check if session exists
    const session = getSession(sessionId);
    if (!session) {
      return NextResponse.json(
        {
          sessionId,
          current_step: 'full_name',
          progress: 0,
          utterance: 'Session not found. Please start a new intake session.',
          success: false
        },
        { status: 404 }
      );
    }
    
    // Validate document
    if (!document.id || !document.type || !document.url) {
      return NextResponse.json(
        {
          sessionId,
          current_step: session.current_step,
          progress: session.progress,
          utterance: 'Invalid document format. Please provide id, type, and url.',
          success: false
        },
        { status: 400 }
      );
    }
    
    // Add document to session
    const updatedSession = addDocument(sessionId, document);
    if (!updatedSession) {
      return NextResponse.json(
        {
          sessionId,
          current_step: session.current_step,
          progress: session.progress,
          utterance: 'Failed to attach document. Please try again.',
          success: false
        },
        { status: 500 }
      );
    }
    
    // Generate confirmation utterance
    const utterance = generateUtterance('docs', {
      userText: 'document uploaded',
      isConfirming: true,
      isError: false
    });
    
    const response: AttachDocResponse = {
      sessionId: updatedSession.sessionId,
      current_step: updatedSession.current_step,
      progress: updatedSession.progress,
      utterance: `Document uploaded successfully! ${utterance}`,
      success: true
    };
    
    return NextResponse.json(response);
  } catch (error) {
    console.error('Error attaching document:', error);
    return NextResponse.json(
      {
        sessionId: '',
        current_step: 'full_name',
        progress: 0,
        utterance: 'I apologize, but I encountered an error uploading your document. Please try again.',
        success: false
      },
      { status: 500 }
    );
  }
}
