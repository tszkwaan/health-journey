import { 
  IntakeStep, 
  IntakeState, 
  SpecialIntent, 
  ValidationResult,
  INTAKE_STEPS 
} from './types';
import { 
  createSession, 
  getSession, 
  updateAnswer, 
  moveToNextStep, 
  jumpToStep,
  enterEditMode,
  exitEditMode,
  getCurrentAnswer 
} from './state';
import { validateField } from './validation';
import { 
  detectSpecialIntent, 
  handleSpecialIntent, 
  extractValueFromUpdateIntent,
  generateUtterance,
  generateReviewSnapshot 
} from './llm';

// Process a user message through the intake flow
export function processIntakeMessage(sessionId: string, userText: string): {
  sessionId: string;
  current_step: IntakeStep;
  progress: number;
  utterance: string;
  requires_correction?: boolean;
  review_snapshot?: string | null;
} {
  try {
    console.log('🔍 LANGGRAPH: Processing message for session:', sessionId, 'text:', userText);
    
    // Get or create session
    let session = getSession(sessionId);
    if (!session) {
      console.log('🔍 LANGGRAPH: Creating new session for:', sessionId);
      session = createSession(sessionId);
    }

    // Detect special intents
    const intent = detectSpecialIntent(userText);
  
    // Handle special intents
    if (intent !== 'none') {
      const intentResult = handleSpecialIntent(intent, session.current_step);
      
      // Handle change intents by entering edit mode for the target step
      if (intent.startsWith('change_')) {
        const targetStep = intent.replace('change_', '') as IntakeStep;
        const updatedSession = enterEditMode(sessionId, targetStep);
        
        if (updatedSession) {
          // Get current answer for pre-filling
          const currentAnswer = getCurrentAnswer(sessionId, targetStep);
          let prefillText = '';
          
          if (targetStep === 'patient_info' && currentAnswer) {
            prefillText = `Name: ${currentAnswer.full_name || ''}, DOB: ${currentAnswer.dob || ''}, Phone: ${currentAnswer.phone || ''}`;
          } else if (currentAnswer && typeof currentAnswer === 'string') {
            prefillText = currentAnswer;
          }
          
          return {
            sessionId,
            current_step: targetStep,
            progress: updatedSession.progress,
            utterance: intentResult.utterance + (prefillText ? ` (Current: ${prefillText})` : ''),
            requires_correction: false,
            review_snapshot: null
          };
        }
      }
      
      // Handle direct update intents (extract value and update immediately)
      if (intent.startsWith('update_')) {
        const targetStep = intent.replace('update_', '') as IntakeStep;
        const extracted = extractValueFromUpdateIntent(userText, intent);
        
        if (extracted) {
          const { value, operation } = extracted;
          
          // Validate the extracted value
          const validation = validateField(targetStep, value);
          
          if (validation.ok) {
            // Get current answer to handle add vs replace
            const currentAnswer = getCurrentAnswer(sessionId, targetStep);
            let newValue = validation.normalized;
            
            // Handle add vs replace logic
            if (operation === 'add' && currentAnswer && typeof currentAnswer === 'string' && currentAnswer.trim() !== '') {
              // Append to existing value
              newValue = `${currentAnswer}, ${value}`;
            }
            // For 'replace' or if no current answer, use the new value as-is
            
            // Update the answer directly
            const updatedSession = updateAnswer(sessionId, targetStep, newValue);
            
            if (updatedSession) {
              // Return to review with confirmation
              const reviewSession = jumpToStep(sessionId, 'review');
              if (reviewSession) {
                const reviewSnapshot = generateReviewSnapshot(reviewSession.answers);
                const actionText = operation === 'add' ? 'added' : 'updated';
                return {
                  sessionId,
                  current_step: 'review',
                  progress: reviewSession.progress,
                  utterance: `Perfect! I've ${actionText} that to "${newValue}". Let me show you the review again.`,
                  requires_correction: false,
                  review_snapshot: reviewSnapshot
                };
              }
            }
          } else {
            // Validation failed, fall back to edit mode
            const editSession = enterEditMode(sessionId, targetStep);
            if (editSession) {
              return {
                sessionId,
                current_step: targetStep,
                progress: editSession.progress,
                utterance: `I understand you want to update ${targetStep}, but I need more information. ${validation.hint}`,
                requires_correction: true,
                review_snapshot: null
              };
            }
          }
        }
      }
      
      // Handle other special intents (like "back", "help", etc.)
      return {
        sessionId,
        current_step: session.current_step,
        progress: session.progress,
        utterance: intentResult.utterance,
        requires_correction: false,
        review_snapshot: null
      };
    }

    // Validate user input for current step
    console.log('🔍 LANGGRAPH: Validating input for step:', session.current_step, 'input:', userText);
    console.log('🔍 LANGGRAPH: About to call validateField...');
    const validation = validateField(session.current_step, userText);
    console.log('🔍 LANGGRAPH: Validation result:', validation);
    console.log('🔍 LANGGRAPH: Validation completed successfully');
    
    if (!validation.ok) {
      return {
        sessionId,
        current_step: session.current_step,
        progress: session.progress,
        utterance: validation.hint,
        requires_correction: true,
        review_snapshot: null
      };
    }

    // Update answer
    console.log('🔍 LANGGRAPH: Updating answer for step:', session.current_step, 'with value:', validation.normalized);
    console.log('🔍 LANGGRAPH: About to call updateAnswer...');
    const updatedSession = updateAnswer(sessionId, session.current_step, validation.normalized);
    console.log('🔍 LANGGRAPH: updateAnswer completed, result:', updatedSession);
    console.log('🔍 LANGGRAPH: Updated session:', {
      current_step: updatedSession?.current_step,
      progress: updatedSession?.progress,
      answers: Object.keys(updatedSession?.answers || {})
    });
    
    if (!updatedSession) {
      return {
        sessionId,
        current_step: session.current_step,
        progress: session.progress,
        utterance: "I'm sorry, there was an error processing your response. Please try again.",
        requires_correction: true,
        review_snapshot: null
      };
    }

    // Check if we're in edit mode - if so, return to review
    if (updatedSession.flags.editMode) {
      const reviewSession = exitEditMode(sessionId);
      if (reviewSession) {
        const reviewSnapshot = generateReviewSnapshot(reviewSession.answers);
        return {
          sessionId,
          current_step: 'review',
          progress: reviewSession.progress,
          utterance: "Perfect! I've updated that information. Let me show you the review again.",
          requires_correction: false,
          review_snapshot: reviewSnapshot
        };
      }
    }

    // Move to next step (normal flow)
    console.log('🔍 LANGGRAPH: Moving to next step from:', updatedSession.current_step);
    console.log('🔍 LANGGRAPH: About to call moveToNextStep...');
    const nextSession = moveToNextStep(sessionId);
    console.log('🔍 LANGGRAPH: moveToNextStep completed, result:', nextSession);
    console.log('🔍 LANGGRAPH: Next session result:', {
      current_step: nextSession?.current_step,
      progress: nextSession?.progress
    });
    
    if (!nextSession) {
      console.log('🔍 LANGGRAPH: No next session, staying at current step');
      return {
        sessionId,
        current_step: updatedSession.current_step,
        progress: updatedSession.progress,
        utterance: generateUtterance(updatedSession.current_step, 'confirm'),
        requires_correction: false,
        review_snapshot: null
      };
    }

    // Generate next question
    const nextUtterance = generateUtterance(nextSession.current_step, 'ask');
    
    // Generate review snapshot if we're at the review step
    let reviewSnapshot = null;
    if (nextSession.current_step === 'review') {
      reviewSnapshot = generateReviewSnapshot(nextSession.answers);
    }
    
    return {
      sessionId,
      current_step: nextSession.current_step,
      progress: nextSession.progress,
      utterance: nextUtterance,
      requires_correction: false,
      review_snapshot: reviewSnapshot
    };
    
  } catch (error) {
    console.error('🔍 LANGGRAPH ERROR:', error);
    console.error('🔍 LANGGRAPH ERROR STACK:', error instanceof Error ? error.stack : 'No stack trace');
    
    // Return a safe fallback response
    const session = getSession(sessionId);
    return {
      sessionId,
      current_step: session?.current_step || 'patient_info',
      progress: session?.progress || 0,
      utterance: "I'm sorry, there was an error processing your response. Please try again.",
      requires_correction: true,
      review_snapshot: null
    };
  }
}

// Get current session state
export function getCurrentSession(sessionId: string): IntakeState | null {
  return getSession(sessionId);
}image.png