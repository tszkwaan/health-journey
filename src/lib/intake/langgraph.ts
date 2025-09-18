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
  // Get or create session
  let session = getSession(sessionId);
  if (!session) {
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
              utterance: `I understand you want to update that, but "${value}" doesn't look quite right. ${validation.hint} Could you try again?`,
              requires_correction: true,
              review_snapshot: null
            };
          }
        }
      } else {
        // Couldn't extract value, fall back to edit mode
        const editSession = enterEditMode(sessionId, targetStep);
        if (editSession) {
          return {
            sessionId,
            current_step: targetStep,
            progress: editSession.progress,
            utterance: `I understand you want to update that field. Could you provide the new value?`,
            requires_correction: false,
            review_snapshot: null
          };
        }
      }
    }
    
    // Handle other special intents
    if (intent === 'review') {
      const updatedSession = jumpToStep(sessionId, 'review');
      if (updatedSession) {
        const reviewSnapshot = generateReviewSnapshot(updatedSession.answers);
        return {
          sessionId,
          current_step: 'review',
          progress: updatedSession.progress,
          utterance: intentResult.utterance,
          requires_correction: false,
          review_snapshot: reviewSnapshot
        };
      }
    }
    
    if (intent === 'done') {
      const updatedSession = jumpToStep(sessionId, 'complete');
      if (updatedSession) {
        return {
          sessionId,
          current_step: 'complete',
          progress: updatedSession.progress,
          utterance: intentResult.utterance,
          requires_correction: false,
          review_snapshot: null
        };
      }
    }
    
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
  const validation = validateField(session.current_step, userText);
  
  if (!validation.ok) {
    return {
      sessionId,
      current_step: session.current_step,
      progress: session.progress,
      utterance: generateUtterance(session.current_step, 'error') + ` ${validation.hint}`,
      requires_correction: true,
      review_snapshot: null
    };
  }

  // Update answer
  const updatedSession = updateAnswer(sessionId, session.current_step, validation.normalized);
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
  
  // Check if we should move to review (normal flow)
  if (updatedSession.current_step === 'concerns') {
    // Move to review after concerns
    const reviewSession = jumpToStep(sessionId, 'review');
    if (reviewSession) {
      const reviewSnapshot = generateReviewSnapshot(reviewSession.answers);
      return {
        sessionId,
        current_step: 'review',
        progress: reviewSession.progress,
        utterance: generateUtterance('review', 'confirm'),
        requires_correction: false,
        review_snapshot: reviewSnapshot
      };
    }
  }

  // Move to next step (normal flow)
  const nextSession = moveToNextStep(sessionId);
  if (!nextSession) {
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
  
  return {
    sessionId,
    current_step: nextSession.current_step,
    progress: nextSession.progress,
    utterance: nextUtterance,
    requires_correction: false,
    review_snapshot: null
  };
}

// Get current session state
export function getCurrentSession(sessionId: string): IntakeState | null {
  return getSession(sessionId);
}