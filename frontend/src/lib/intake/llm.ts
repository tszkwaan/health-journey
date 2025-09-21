import { IntakeStep, SpecialIntent, BotAction } from './types';

// System prompt for the caring, empathetic chatbot
const SYSTEM_PROMPT = `You are a warm, caring, and professional patient registration assistant. Your role is to help patients feel comfortable and supported during their intake process.

Key guidelines:
- Be empathetic and understanding - patients may be anxious or in discomfort
- Use a warm, professional tone that shows genuine care
- Keep responses concise but reassuring
- Acknowledge their concerns and validate their feelings
- Never provide medical advice or diagnosis
- Focus only on the current step - don't ask about other fields
- If they provide extra information, acknowledge it briefly and return to the current field
- Be encouraging and supportive throughout the process

Current step: {current_step}
User input: {user_input}`;

// Examples for each step with caring, empathetic responses
const EXAMPLES: Record<IntakeStep, { ask: string; confirm: string; error: string }> = {
  patient_info: {
    ask: "Hello! I'm here to help you get registered today. Could you please confirm your full name, date of birth, and contact number?",
    confirm: "Thank you so much! I have your information recorded. Let's move on to understanding what brings you in today.",
    error: "I want to make sure I get your information correctly. Could you please provide your full name, date of birth, and phone number all together?"
  },
  visit_reason: {
    ask: "What brings you in today? Could you describe your main concern or symptom?",
    confirm: "Thank you for sharing that with me. I can see this is important to you, and I want to make sure we address everything that matters.",
    error: "I want to make sure I understand your concern properly. Could you tell me more about what's bringing you in today?"
  },
  symptom_onset: {
    ask: "When did you first notice this problem? Has it been getting better, worse, or stayed the same?",
    confirm: "Thank you for that information. It helps us understand the timeline of your symptoms.",
    error: "I want to make sure I understand the timing correctly. Could you tell me when you first noticed this and how it's been changing?"
  },
  previous_treatment: {
    ask: "Have you seen other doctors for this issue before? If yes, what treatments or advice did you receive?",
    confirm: "Thank you for sharing that information. It's helpful to know what you've tried before.",
    error: "I want to make sure I have the complete picture. Could you tell me about any previous doctors or treatments for this issue?"
  },
  medical_conditions: {
    ask: "Do you have any ongoing medical conditions (e.g., diabetes, hypertension)?",
    confirm: "Thank you for letting me know about your medical history. This information is very helpful.",
    error: "I want to make sure I have your complete medical history. Could you tell me about any ongoing conditions you have?"
  },
  allergies: {
    ask: "Do you have any drug or food allergies we should know about?",
    confirm: "Thank you for sharing that important information. We'll make sure to note your allergies for your safety.",
    error: "It's really important that we know about any allergies. Could you tell me about any drug or food allergies you have?"
  },
  concerns: {
    ask: "Do you have any concerns or questions you'd like the doctor to address?",
    confirm: "Thank you for sharing your concerns. I'll make sure the doctor knows about these important points.",
    error: "I want to make sure we don't miss anything important. Could you tell me about any concerns or questions you have?"
  },
  review: {
    ask: "Let me review what we've discussed so far. Please let me know if anything needs to be changed.",
    confirm: "Perfect! Everything looks good. Let me know if you'd like to change anything.",
    error: "Let me help you review this information. What would you like to change?"
  },
  complete: {
    ask: "Thank you for completing the intake process. The doctor will be with you shortly.",
    confirm: "All set! The doctor will have all your information and will be with you soon.",
    error: "We're almost done! Is there anything else you'd like to add?"
  }
};

// Detect special intents from user input
export function detectSpecialIntent(input: string): SpecialIntent {
  const text = input.toLowerCase().trim();
  
  // Check for explicit change/edit/modify/update keywords first
  const hasChangeWord = text.includes('change') || text.includes('edit') || text.includes('modify') || text.includes('update') || text.includes('add') || text.includes('set');
  
  // Patient info detection - name, DOB, phone related
  if ((hasChangeWord && (text.includes('name') || text.includes('patient') || text.includes('personal') || text.includes('birth') || text.includes('phone'))) ||
      text.includes('registration') && (text.includes('name') || text.includes('birth') || text.includes('phone'))) {
    return 'change_patient_info';
  }
  
  // Visit reason detection - very flexible
  if ((hasChangeWord && (text.includes('reason') || text.includes('visit') || text.includes('concern') || text.includes('symptom') || text.includes('problem') || text.includes('issue'))) ||
      text.includes('registration reason') ||
      text.includes('visit reason') ||
      text.includes('main concern') ||
      text.includes('brings you') ||
      (text.includes('reason') && (text.includes('is') || text.includes('add') || text.includes('set')))) {
    
    // Check if it's a direct update (contains a value after the field name)
    if (text.includes('reason') && (text.includes('add') || text.includes('is') || text.includes('set') || text.includes('=')) && 
        text.split('reason')[1] && text.split('reason')[1].trim().length > 2) {
      return 'update_visit_reason';
    }
    
    return 'change_visit_reason';
  }
  
  // Symptom onset detection
  if ((hasChangeWord && (text.includes('symptom') || text.includes('onset') || text.includes('when') || text.includes('started') || text.includes('notice'))) ||
      text.includes('symptom') && (text.includes('started') || text.includes('when') || text.includes('onset')) ||
      text.includes('first notice') ||
      text.includes('getting better') ||
      text.includes('getting worse')) {
    
    // Check if it's a direct update
    if (text.includes('symptom') && (text.includes('add') || text.includes('is') || text.includes('set') || text.includes('started') || text.includes('=')) && 
        text.split('symptom')[1] && text.split('symptom')[1].trim().length > 2) {
      return 'update_symptom_onset';
    }
    
    return 'change_symptom_onset';
  }
  
  // Previous treatment detection
  if ((hasChangeWord && (text.includes('treatment') || text.includes('doctor') || text.includes('previous') || text.includes('before') || text.includes('seen'))) ||
      text.includes('seen other doctors') ||
      text.includes('previous treatment') ||
      text.includes('before this')) {
    
    // Check if it's a direct update
    if (text.includes('treatment') && (text.includes('add') || text.includes('is') || text.includes('set') || text.includes('=')) && 
        text.split('treatment')[1] && text.split('treatment')[1].trim().length > 2) {
      return 'update_previous_treatment';
    }
    
    return 'change_previous_treatment';
  }
  
  // Medical conditions detection
  if ((hasChangeWord && (text.includes('condition') || text.includes('medical') || text.includes('health'))) ||
      text.includes('medical condition') ||
      text.includes('ongoing condition')) {
    
    // Check if it's a direct update
    if (text.includes('condition') && (text.includes('add') || text.includes('is') || text.includes('set') || text.includes('=')) && 
        text.split('condition')[1] && text.split('condition')[1].trim().length > 2) {
      return 'update_medical_conditions';
    }
    
    return 'change_medical_conditions';
  }
  
  // Allergies detection
  if ((hasChangeWord && (text.includes('allerg') || text.includes('allergic'))) ||
      text.includes('drug allerg') ||
      text.includes('food allerg') ||
      text.includes('allergic to')) {
    
    // Check if it's a direct update
    if (text.includes('allerg') && (text.includes('add') || text.includes('is') || text.includes('set') || text.includes('=')) && 
        text.split('allerg')[1] && text.split('allerg')[1].trim().length > 2) {
      return 'update_allergies';
    }
    
    return 'change_allergies';
  }
  
  // Concerns detection
  if ((hasChangeWord && (text.includes('concern') || text.includes('question'))) ||
      text.includes('concerns') ||
      text.includes('questions for doctor')) {
    
    // Check if it's a direct update - support multiple formats
    if (text.includes('concern') && 
        (text.includes('add') || text.includes('is') || text.includes('set') || text.includes('=')) && 
        text.split('concern')[1] && text.split('concern')[1].trim().length > 2) {
      return 'update_concerns';
    }
    
    return 'change_concerns';
  }
  
  // Other intents
  if (text.includes('back') || text.includes('previous')) return 'back';
  if (text.includes('skip') || text.includes('later')) return 'skip';
  if (text.includes('done') || text.includes('finish') || text.includes('submit') || text.includes('complete')) return 'done';
  if (text.includes('review') || text.includes('check')) return 'review';
  
  return 'none';
}

// Handle special intents
export function handleSpecialIntent(intent: SpecialIntent, currentStep: IntakeStep): BotAction {
  switch (intent) {
    case 'change_patient_info':
      return {
        next_action: 'ask',
        field: 'patient_info',
        utterance: "Of course! Let me help you update your name, date of birth, and contact number. Please provide all three pieces of information again."
      };
    case 'change_visit_reason':
      return {
        next_action: 'ask',
        field: 'visit_reason',
        utterance: "No problem! Let's update what brings you in today. Could you describe your main concern or symptom?"
      };
    case 'change_symptom_onset':
      return {
        next_action: 'ask',
        field: 'symptom_onset',
        utterance: "Of course! Let's update when you first noticed this problem. When did it start and how has it been changing?"
      };
    case 'change_previous_treatment':
      return {
        next_action: 'ask',
        field: 'previous_treatment',
        utterance: "Sure! Let's update your previous treatment information. Have you seen other doctors for this issue before?"
      };
    case 'change_medical_conditions':
      return {
        next_action: 'ask',
        field: 'medical_conditions',
        utterance: "Absolutely! Let's update your medical conditions. Do you have any ongoing conditions we should know about?"
      };
    case 'change_allergies':
      return {
        next_action: 'ask',
        field: 'allergies',
        utterance: "Of course! Let's update your allergy information. Do you have any drug or food allergies?"
      };
    case 'change_concerns':
      return {
        next_action: 'ask',
        field: 'concerns',
        utterance: "Sure! Let's update your concerns. Do you have any questions you'd like the doctor to address?"
      };
    case 'back':
      return {
        next_action: 'ask',
        field: currentStep,
        utterance: "I understand you'd like to go back. Let me help you with the current question."
      };
    case 'skip':
      return {
        next_action: 'ask',
        field: currentStep,
        utterance: "I understand you'd like to skip this for now. We can come back to it later if needed."
      };
    case 'review':
      return {
        next_action: 'ask',
        field: 'review',
        utterance: "Let me review what we've discussed so far. Please let me know if anything needs to be changed."
      };
    case 'done':
      return {
        next_action: 'confirm',
        field: 'complete',
        utterance: "Perfect! Thank you for completing your intake. The doctor will be with you shortly."
      };
    default:
      return {
        next_action: 'ask',
        field: currentStep,
        utterance: EXAMPLES[currentStep].ask
      };
  }
}

// Extract value and operation type from direct update intent
export function extractValueFromUpdateIntent(input: string, intent: SpecialIntent): { value: string; operation: 'add' | 'replace' } | null {
  const text = input.toLowerCase().trim();
  
  switch (intent) {
    case 'update_visit_reason':
      // Extract value after "reason add/is/set/="
      const reasonMatch = text.match(/reason\s*(add|is|set|=)\s*(.+)/);
      if (reasonMatch) {
        return {
          value: reasonMatch[2].trim(),
          operation: reasonMatch[1] === 'add' ? 'add' : 'replace'
        };
      }
      return null;
      
    case 'update_symptom_onset':
      // Extract value after "symptom add/started/is/when/="
      const symptomMatch = text.match(/symptom\s*(add|started|is|when|=)\s*(.+)/);
      if (symptomMatch) {
        return {
          value: symptomMatch[2].trim(),
          operation: symptomMatch[1] === 'add' ? 'add' : 'replace'
        };
      }
      return null;
      
    case 'update_previous_treatment':
      // Extract value after "treatment add/is/set/="
      const treatmentMatch = text.match(/treatment\s*(add|is|set|=)\s*(.+)/);
      if (treatmentMatch) {
        return {
          value: treatmentMatch[2].trim(),
          operation: treatmentMatch[1] === 'add' ? 'add' : 'replace'
        };
      }
      return null;
      
    case 'update_medical_conditions':
      // Extract value after "condition add/is/set/="
      const conditionMatch = text.match(/condition\s*(add|is|set|=)\s*(.+)/);
      if (conditionMatch) {
        return {
          value: conditionMatch[2].trim(),
          operation: conditionMatch[1] === 'add' ? 'add' : 'replace'
        };
      }
      return null;
      
    case 'update_allergies':
      // Extract value after "allerg add/is/set/="
      const allergyMatch = text.match(/allerg\w*\s*(add|is|set|=)\s*(.+)/);
      if (allergyMatch) {
        return {
          value: allergyMatch[2].trim(),
          operation: allergyMatch[1] === 'add' ? 'add' : 'replace'
        };
      }
      return null;
      
    case 'update_concerns':
      // Extract value after "concern add/is/set/="
      const concernMatch = text.match(/concern\s*(add|is|set|=)\s*(.+)/);
      if (concernMatch) {
        return {
          value: concernMatch[2].trim(),
          operation: concernMatch[1] === 'add' ? 'add' : 'replace'
        };
      }
      return null;
      
    default:
      return null;
  }
}

// Generate utterance for current step
export function generateUtterance(step: IntakeStep, context: 'ask' | 'confirm' | 'error' = 'ask'): string {
  return EXAMPLES[step][context];
}

// Generate review snapshot
export function generateReviewSnapshot(answers: any): string {
  const parts = [];
  
  if (answers.patient_info) {
    parts.push(`Name: ${answers.patient_info.full_name}`);
    parts.push(`Date of Birth: ${answers.patient_info.dob}`);
    parts.push(`Phone: ${answers.patient_info.phone}`);
  }
  
  if (answers.visit_reason) {
    parts.push(`Visit Reason: ${answers.visit_reason}`);
  }
  
  if (answers.symptom_onset) {
    parts.push(`Symptom Onset: ${answers.symptom_onset}`);
  }
  
  if (answers.previous_treatment) {
    parts.push(`Previous Treatment: ${answers.previous_treatment}`);
  }
  
  if (answers.medical_conditions) {
    parts.push(`Medical Conditions: ${answers.medical_conditions}`);
  }
  
  if (answers.allergies) {
    parts.push(`Allergies: ${answers.allergies}`);
  }
  
  if (answers.concerns) {
    parts.push(`Concerns: ${answers.concerns}`);
  }
  
  return parts.join('\n');
}