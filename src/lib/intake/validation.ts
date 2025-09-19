import { z } from 'zod';
import { ValidationResult, IntakeStep } from './types';

// Patient info validation (combined name, DOB, phone)
export function validatePatientInfo(input: string): ValidationResult<{full_name: string, dob: string, phone: string}> {
  const trimmed = input.trim();
  if (!trimmed) {
    return { ok: false, errorCode: "EMPTY", hint: "Please provide your name, date of birth, and phone number." };
  }

  // Try multiple patterns to extract information
  let full_name = "";
  let dob = "";
  let phone = "";

  // Pattern 1: "Name: John Doe, DOB: 01/15/1985, Phone: 555-123-4567"
  const structuredMatch = trimmed.match(/name\s*:?\s*([^,]+?)(?:,|\s+dob\s*:?\s*)/i);
  if (structuredMatch) {
    full_name = structuredMatch[1].trim();
    const dobMatch = trimmed.match(/dob\s*:?\s*([^,]+?)(?:,|\s+phone\s*:?\s*)/i);
    if (dobMatch) dob = dobMatch[1].trim();
    const phoneMatch = trimmed.match(/phone\s*:?\s*([^,]+?)(?:,|$)/i);
    if (phoneMatch) phone = phoneMatch[1].trim();
  }

  // Pattern 2: "My name is John Doe, my date of birth is 01/15/1985, and my phone number is 555-123-4567"
  if (!full_name) {
    const nameMatch = trimmed.match(/(?:my\s+name\s+is|i'm|i am|call me)\s+([a-zA-Z\s]+?)(?:\s*,|\s+my|\s+and|\s+phone)/i);
    if (nameMatch) full_name = nameMatch[1].trim();
  }
  if (!dob) {
    const dobMatch = trimmed.match(/(?:my\s+date\s+of\s+birth\s+is|dob\s+is|born\s+on)\s+(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i);
    if (dobMatch) dob = dobMatch[1].trim();
  }
  if (!phone) {
    const phoneMatch = trimmed.match(/(?:my\s+phone\s+number\s+is|phone\s+is|contact\s+is)\s+([\d\s\-\+\(\)]+?)(?:\s*,|\s+and|$)/i);
    if (phoneMatch) phone = phoneMatch[1].trim();
  }

  // Pattern 3: Simple comma-separated "John Doe, 01/15/1985, 555-123-4567"
  if (!full_name || !dob || !phone) {
    const parts = trimmed.split(',').map(p => p.trim());
    if (parts.length >= 3) {
      // First part is likely name
      if (!full_name && /^[a-zA-Z\s]+$/.test(parts[0])) {
        full_name = parts[0];
      }
      // Look for date pattern in any part (support both MM/DD/YYYY and YYYY-MM-DD)
      if (!dob) {
        for (const part of parts) {
          if (/\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}/.test(part) || /\d{4}-\d{1,2}-\d{1,2}/.test(part)) {
            dob = part;
            break;
          }
          // Check for YYYY MMDD format within comma-separated parts
          const yearMatch = part.match(/^(\d{4})\s+(\d{2})(\d{2})$/);
          if (yearMatch) {
            const year = yearMatch[1];
            const month = yearMatch[2];
            const day = yearMatch[3];
            
            // Validate month and day ranges
            const monthNum = parseInt(month);
            const dayNum = parseInt(day);
            
            if (monthNum >= 1 && monthNum <= 12 && dayNum >= 1 && dayNum <= 31) {
              dob = `${year}-${month}-${day}`;
              break;
            }
          }
        }
      }
      // Look for phone pattern in any part (more specific pattern)
      if (!phone) {
        for (const part of parts) {
          // Skip if it's already identified as a date
          if (/\d{4}-\d{1,2}-\d{1,2}/.test(part) || /\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}/.test(part)) {
            continue;
          }
          // Skip if it matches YYYY MMDD pattern
          if (/^\d{4}\s+\d{4}$/.test(part)) {
            continue;
          }
          if (/\d{3}[-\.\s]?\d{3}[-\.\s]?\d{4}/.test(part) || /\d{7,}/.test(part.replace(/\D/g, ''))) {
            phone = part;
            break;
          }
        }
      }
    }
  }

  // Pattern 4: Space-separated "elena chong 1994-10-10 87709010" or "elena chong 1994 October 10th 87709010"
  if (!full_name || !dob || !phone) {
    const spaceParts = trimmed.split(/\s+/).filter(p => p.trim());
    
    // Find date and phone patterns first
    let dateIndex = -1;
    let phoneIndex = -1;
    
    for (let i = 0; i < spaceParts.length; i++) {
      const part = spaceParts[i];
      // Check for numeric date patterns
      if (/\d{4}-\d{1,2}-\d{1,2}/.test(part) || /\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}/.test(part)) {
        if (dateIndex === -1) {
          dob = part;
          dateIndex = i;
        }
      } else if (/\d{7,}/.test(part.replace(/\D/g, ''))) {
        if (phoneIndex === -1) {
          phone = part;
          phoneIndex = i;
        }
      }
    }
    
    // Check for YYYY MMDD format like "1994 1010" (year followed by month+day)
    if (!dob) {
      for (let i = 0; i < spaceParts.length - 1; i++) {
        const yearMatch = spaceParts[i].match(/^(\d{4})$/);
        const monthDayMatch = spaceParts[i + 1].match(/^(\d{2})(\d{2})$/);
        
        if (yearMatch && monthDayMatch) {
          const year = yearMatch[1];
          const month = monthDayMatch[1];
          const day = monthDayMatch[2];
          
          // Validate month and day ranges
          const monthNum = parseInt(month);
          const dayNum = parseInt(day);
          
          if (monthNum >= 1 && monthNum <= 12 && dayNum >= 1 && dayNum <= 31) {
            dob = `${year}-${month}-${day}`;
            dateIndex = i;
            break;
          }
        }
      }
    }

    // Check for written date patterns like "1994 October 10th" or "October 10th 1994"
    if (!dob) {
      for (let i = 0; i < spaceParts.length - 2; i++) {
        const yearMatch = spaceParts[i].match(/^(\d{4})$/);
        const monthMatch = spaceParts[i + 1].match(/^(january|february|march|april|may|june|july|august|september|october|november|december)$/i);
        const dayMatch = spaceParts[i + 2].match(/^(\d{1,2})(st|nd|rd|th)?$/i);
        
        if (yearMatch && monthMatch && dayMatch) {
          // Format: "1994 October 10th"
          const year = yearMatch[1];
          const month = monthMatch[1].toLowerCase();
          const day = dayMatch[1];
          
          const monthMap: { [key: string]: string } = {
            'january': '01', 'february': '02', 'march': '03', 'april': '04',
            'may': '05', 'june': '06', 'july': '07', 'august': '08',
            'september': '09', 'october': '10', 'november': '11', 'december': '12'
          };
          
          dob = `${year}-${monthMap[month]}-${day.padStart(2, '0')}`;
          dateIndex = i;
          break;
        }
        
        // Check for "October 10th 1994" format
        const monthMatch2 = spaceParts[i].match(/^(january|february|march|april|may|june|july|august|september|october|november|december)$/i);
        const dayMatch2 = spaceParts[i + 1].match(/^(\d{1,2})(st|nd|rd|th)?$/i);
        const yearMatch2 = spaceParts[i + 2].match(/^(\d{4})$/);
        
        if (monthMatch2 && dayMatch2 && yearMatch2) {
          // Format: "October 10th 1994"
          const year = yearMatch2[1];
          const month = monthMatch2[1].toLowerCase();
          const day = dayMatch2[1];
          
          const monthMap: { [key: string]: string } = {
            'january': '01', 'february': '02', 'march': '03', 'april': '04',
            'may': '05', 'june': '06', 'july': '07', 'august': '08',
            'september': '09', 'october': '10', 'november': '11', 'december': '12'
          };
          
          dob = `${year}-${monthMap[month]}-${day.padStart(2, '0')}`;
          dateIndex = i;
          break;
        }
      }
    }
    
    // If we found both date and phone, extract name from remaining parts
    if (dateIndex !== -1 && phoneIndex !== -1) {
      // Name is everything before the date
      const nameParts = spaceParts.slice(0, dateIndex);
      if (nameParts.length > 0) {
        full_name = nameParts.join(' ');
      }
    } else if (spaceParts.length >= 3) {
      // Fallback: try to identify name as first part(s) that are all letters
      let nameEndIndex = 0;
      for (let i = 0; i < spaceParts.length; i++) {
        if (/^[a-zA-Z]+$/.test(spaceParts[i])) {
          nameEndIndex = i + 1;
        } else {
          break;
        }
      }
      if (nameEndIndex > 0) {
        full_name = spaceParts.slice(0, nameEndIndex).join(' ');
      }
    }
  }


  // Validation checks
  if (!full_name) {
    return { ok: false, errorCode: "MISSING_NAME", hint: "Sorry, I didn't get enough information. To proceed with your registration, I need your full name, date of birth, and phone number. Could you please provide all three pieces of information together?" };
  }

  if (!dob) {
    return { ok: false, errorCode: "MISSING_DOB", hint: "Sorry, I didn't get enough information. To proceed with your registration, I need your full name, date of birth, and phone number. Could you please provide all three pieces of information together?" };
  }

  if (!phone) {
    return { ok: false, errorCode: "MISSING_PHONE", hint: "Sorry, I didn't get enough information. To proceed with your registration, I need your full name, date of birth, and phone number. Could you please provide all three pieces of information together?" };
  }

  // Validate name (letters and spaces only)
  if (!/^[a-zA-Z\s]+$/.test(full_name)) {
    return { ok: false, errorCode: "INVALID_NAME", hint: "Name should only contain letters and spaces." };
  }

  // Validate date format and age
  let month: string = '', day: string = '', year: string = '';
  
  // Check for YYYY-MM-DD format first
  const yyyyMmDdMatch = dob.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (yyyyMmDdMatch) {
    [, year, month, day] = yyyyMmDdMatch;
  } else {
    // Check for MM/DD/YYYY or DD/MM/YYYY format
    const dateRegex = /^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})$/;
    const match = dob.match(dateRegex);
    if (!match) {
      return { ok: false, errorCode: "INVALID_DOB", hint: "Please use format YYYY-MM-DD, MM/DD/YYYY or DD/MM/YYYY for your date of birth." };
    }
    
    if (dob.includes('/')) {
      [month, day, year] = dob.split('/');
    } else if (dob.includes('-')) {
      [month, day, year] = dob.split('-');
    } else if (dob.includes('.')) {
      [month, day, year] = dob.split('.');
    }
  }

  // Ensure we have valid values
  if (!month || !day || !year) {
    return { ok: false, errorCode: "INVALID_DOB", hint: "Please provide a valid date of birth." };
  }

  // Handle 2-digit years
  if (year.length === 2) {
    year = parseInt(year) < 50 ? `20${year}` : `19${year}`;
  }

  const birthDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
  const today = new Date();
  const age = today.getFullYear() - birthDate.getFullYear();
  
  if (isNaN(birthDate.getTime()) || age < 0 || age > 120) {
    return { ok: false, errorCode: "INVALID_DOB", hint: "Please provide a valid date of birth." };
  }

  // Validate phone (basic format check)
  const phoneDigits = phone.replace(/\D/g, '');
  if (phoneDigits.length < 7) {
    return { ok: false, errorCode: "INVALID_PHONE", hint: "Please provide a valid phone number with at least 7 digits." };
  }
  
  // Ensure phone has reasonable length (7-15 digits)
  if (phoneDigits.length > 15) {
    return { ok: false, errorCode: "INVALID_PHONE", hint: "Please provide a valid phone number." };
  }

  return { 
    ok: true, 
    normalized: { 
      full_name: full_name.trim(), 
      dob: `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`,
      phone: phoneDigits
    } 
  };
}

// Visit reason validation
export function validateVisitReason(input: string): ValidationResult<string> {
  const trimmed = input.trim();
  if (!trimmed) {
    return { ok: false, errorCode: "EMPTY", hint: "Please describe what brings you in today." };
  }
  if (trimmed.length < 5) {
    return { ok: false, errorCode: "TOO_SHORT", hint: "Please provide more details about your main concern or symptom." };
  }
  return { ok: true, normalized: trimmed };
}

// Symptom onset validation
export function validateSymptomOnset(input: string): ValidationResult<string> {
  const trimmed = input.trim();
  if (!trimmed) {
    return { ok: false, errorCode: "EMPTY", hint: "Please tell me when you first noticed this problem." };
  }
  if (trimmed.length < 3) {
    return { ok: false, errorCode: "TOO_SHORT", hint: "Please provide more details about when this started." };
  }
  return { ok: true, normalized: trimmed };
}

// Previous treatment validation
export function validatePreviousTreatment(input: string): ValidationResult<string> {
  const trimmed = input.trim().toLowerCase();
  if (!trimmed) {
    return { ok: false, errorCode: "EMPTY", hint: "Please let me know if you've seen other doctors for this issue." };
  }
  
  // Accept simple "no" responses
  if (trimmed === "no" || trimmed === "n" || trimmed === "none" || trimmed === "no, i haven't" || trimmed === "no i haven't") {
    return { ok: true, normalized: "No previous treatment" };
  }
  
  if (trimmed.length < 3) {
    return { ok: false, errorCode: "TOO_SHORT", hint: "Please provide more details about any previous treatments." };
  }
  return { ok: true, normalized: trimmed };
}

// Medical conditions validation
export function validateMedicalConditions(input: string): ValidationResult<string> {
  const trimmed = input.trim().toLowerCase();
  if (!trimmed) {
    return { ok: false, errorCode: "EMPTY", hint: "Please let me know about any ongoing medical conditions." };
  }
  
  // Accept simple "no" responses
  if (trimmed === "no" || trimmed === "n" || trimmed === "none" || trimmed === "no, i don't" || trimmed === "no i don't") {
    return { ok: true, normalized: "No medical conditions" };
  }
  
  if (trimmed.length < 3) {
    return { ok: false, errorCode: "TOO_SHORT", hint: "Please provide more details about your medical conditions." };
  }
  return { ok: true, normalized: trimmed };
}

// Allergies validation
export function validateAllergies(input: string): ValidationResult<string> {
  const trimmed = input.trim().toLowerCase();
  if (!trimmed) {
    return { ok: false, errorCode: "EMPTY", hint: "Please let me know about any drug or food allergies." };
  }
  
  // Accept simple "no" responses
  if (trimmed === "no" || trimmed === "n" || trimmed === "none" || trimmed === "no, i don't" || trimmed === "no i don't") {
    return { ok: true, normalized: "No allergies" };
  }
  
  if (trimmed.length < 3) {
    return { ok: false, errorCode: "TOO_SHORT", hint: "Please provide more details about your allergies." };
  }
  return { ok: true, normalized: trimmed };
}

// Concerns validation
export function validateConcerns(input: string): ValidationResult<string> {
  const trimmed = input.trim().toLowerCase();
  if (!trimmed) {
    return { ok: false, errorCode: "EMPTY", hint: "Please let me know if you have any concerns or questions." };
  }
  
  // Accept simple "no" responses
  if (trimmed === "no" || trimmed === "n" || trimmed === "none" || trimmed === "no, i don't" || trimmed === "no i don't") {
    return { ok: true, normalized: "No concerns" };
  }
  
  if (trimmed.length < 3) {
    return { ok: false, errorCode: "TOO_SHORT", hint: "Please provide more details about your concerns." };
  }
  return { ok: true, normalized: trimmed };
}

// Main validation function
export function validateField(step: IntakeStep, input: string): ValidationResult {
  switch (step) {
    case "patient_info":
      return validatePatientInfo(input);
    case "visit_reason":
      return validateVisitReason(input);
    case "symptom_onset":
      return validateSymptomOnset(input);
    case "previous_treatment":
      return validatePreviousTreatment(input);
    case "medical_conditions":
      return validateMedicalConditions(input);
    case "allergies":
      return validateAllergies(input);
    case "concerns":
      return validateConcerns(input);
    default:
      return { ok: true, normalized: input };
  }
}