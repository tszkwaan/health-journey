import { IntakeState, IntakeStep, IntakeAnswers, IntakeFlags, INTAKE_STEPS } from './types';

// In-memory session store
const sessionStore = new Map<string, IntakeState>();

// Create a new intake session
export function createSession(sessionId: string): IntakeState {
  const state: IntakeState = {
    sessionId,
    current_step: "patient_info",
    answers: {},
    flags: { skipped: {}, editMode: false },
    progress: 0
  };
  
  sessionStore.set(sessionId, state);
  return state;
}

// Get session by ID
export function getSession(sessionId: string): IntakeState | null {
  return sessionStore.get(sessionId) || null;
}

// Restore session from database data
export function restoreSession(sessionId: string, dbData: {
  currentStep: string;
  answers: any;
  flags: any;
  progress: number;
}): IntakeState {
  const state: IntakeState = {
    sessionId,
    current_step: dbData.currentStep as IntakeStep,
    answers: dbData.answers,
    flags: dbData.flags,
    progress: dbData.progress
  };
  
  sessionStore.set(sessionId, state);
  return state;
}

// Update answer for a specific step
export function updateAnswer(sessionId: string, step: IntakeStep, answer: any): IntakeState | null {
  const session = sessionStore.get(sessionId);
  if (!session) return null;

  const updatedSession = {
    ...session,
    answers: {
      ...session.answers,
      [step]: answer
    }
  };

  // Calculate progress
  updatedSession.progress = calculateProgress(updatedSession.answers);
  
  sessionStore.set(sessionId, updatedSession);
  return updatedSession;
}

// Skip a field
export function skipField(sessionId: string, step: IntakeStep): IntakeState | null {
  const session = sessionStore.get(sessionId);
  if (!session) return null;

  const updatedSession = {
    ...session,
    flags: {
      ...session.flags,
      skipped: {
        ...session.flags.skipped,
        [step]: true
      }
    }
  };

  sessionStore.set(sessionId, updatedSession);
  return updatedSession;
}

// Move to next step
export function moveToNextStep(sessionId: string): IntakeState | null {
  const session = sessionStore.get(sessionId);
  if (!session) {
    console.log('🔍 MOVE_TO_NEXT: No session found for:', sessionId);
    return null;
  }

  const currentIndex = INTAKE_STEPS.indexOf(session.current_step);
  console.log('🔍 MOVE_TO_NEXT: Current step:', session.current_step, 'index:', currentIndex);
  console.log('🔍 MOVE_TO_NEXT: Available steps:', INTAKE_STEPS);
  
  if (currentIndex === -1 || currentIndex >= INTAKE_STEPS.length - 1) {
    console.log('🔍 MOVE_TO_NEXT: Already at last step or invalid step');
    return session; // Already at last step
  }

  const nextStep = INTAKE_STEPS[currentIndex + 1];
  console.log('🔍 MOVE_TO_NEXT: Moving to next step:', nextStep);
  
  const updatedSession = {
    ...session,
    current_step: nextStep
  };

  sessionStore.set(sessionId, updatedSession);
  console.log('🔍 MOVE_TO_NEXT: Updated session stored:', {
    current_step: updatedSession.current_step,
    progress: updatedSession.progress
  });
  
  return updatedSession;
}

// Jump to a specific step (for "change" actions)
export function jumpToStep(sessionId: string, step: IntakeStep): IntakeState | null {
  const session = sessionStore.get(sessionId);
  if (!session) return null;

  const updatedSession = {
    ...session,
    current_step: step
  };

  sessionStore.set(sessionId, updatedSession);
  return updatedSession;
}

// Enter edit mode for a specific step (will return to review after completion)
export function enterEditMode(sessionId: string, step: IntakeStep): IntakeState | null {
  const session = sessionStore.get(sessionId);
  if (!session) return null;

  const updatedSession = {
    ...session,
    current_step: step,
    flags: {
      ...session.flags,
      editMode: true
    }
  };

  sessionStore.set(sessionId, updatedSession);
  return updatedSession;
}

// Exit edit mode and return to review
export function exitEditMode(sessionId: string): IntakeState | null {
  const session = sessionStore.get(sessionId);
  if (!session) return null;

  const updatedSession = {
    ...session,
    current_step: "review" as IntakeStep,
    flags: {
      ...session.flags,
      editMode: false
    }
  };

  sessionStore.set(sessionId, updatedSession);
  return updatedSession;
}

// Calculate progress percentage
export function calculateProgress(answers: IntakeAnswers): number {
  const totalSteps = INTAKE_STEPS.length - 2; // Exclude review and complete
  let completedSteps = 0;

  // Check each step for completion
  for (const step of INTAKE_STEPS) {
    if (step === "review" || step === "complete") continue;
    
    const answer = answers[step as keyof IntakeAnswers];
    if (answer !== undefined && answer !== null && answer !== "") {
      if (step === "patient_info") {
        // For patient_info, check if all three fields are present
        if (answer && typeof answer === "object" && 
            answer.full_name && answer.dob && answer.phone) {
          completedSteps++;
        }
      } else {
        // For other steps, just check if there's a non-empty string
        if (typeof answer === "string" && answer.trim().length > 0) {
          completedSteps++;
        }
      }
    }
  }

  return Math.round((completedSteps / totalSteps) * 100);
}

// Get current answer for a step (for "change" actions)
export function getCurrentAnswer(sessionId: string, step: IntakeStep): any {
  const session = sessionStore.get(sessionId);
  if (!session) return null;

  return session.answers[step as keyof IntakeAnswers];
}