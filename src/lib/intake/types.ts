import { z } from 'zod';

// Intake steps in order
export type IntakeStep = 
  | "patient_info" 
  | "visit_reason" 
  | "symptom_onset" 
  | "previous_treatment" 
  | "medical_conditions" 
  | "allergies" 
  | "concerns" 
  | "review" 
  | "complete";

// Patient info schema for combined name, DOB, phone
export const PatientInfoSchema = z.object({
  full_name: z.string().min(1, "Name is required"),
  dob: z.string().min(1, "Date of birth is required"), // Will be validated as date
  phone: z.string().min(1, "Phone number is required"),
});

// Intake answers schema
export const IntakeAnswersSchema = z.object({
  patient_info: PatientInfoSchema.optional(),
  visit_reason: z.string().optional(),
  symptom_onset: z.string().optional(),
  previous_treatment: z.string().optional(),
  medical_conditions: z.string().optional(),
  allergies: z.string().optional(),
  concerns: z.string().optional(),
});

// Intake flags for tracking skipped fields and edit mode
export const IntakeFlagsSchema = z.object({
  skipped: z.record(z.boolean()).optional(),
  editMode: z.boolean().optional(), // When true, after answering current field, go back to review
});

// Main intake state schema
export const IntakeStateSchema = z.object({
  sessionId: z.string(),
  current_step: z.enum(["patient_info", "visit_reason", "symptom_onset", "previous_treatment", "medical_conditions", "allergies", "concerns", "review", "complete"]),
  answers: IntakeAnswersSchema,
  flags: IntakeFlagsSchema,
  progress: z.number().min(0).max(100),
});

// TypeScript types derived from schemas
export type IntakeAnswers = z.infer<typeof IntakeAnswersSchema>;
export type IntakeFlags = z.infer<typeof IntakeFlagsSchema>;
export type IntakeState = z.infer<typeof IntakeStateSchema>;
export type PatientInfo = z.infer<typeof PatientInfoSchema>;

// Validation result types
export type ValidationResult<T = any> = 
  | { ok: true; normalized?: T }
  | { ok: false; errorCode: string; hint: string };

// API request/response types
export interface StartIntakeRequest {
  // No body needed for start
}

export interface StartIntakeResponse {
  sessionId: string;
  current_step: IntakeStep;
  progress: number;
  utterance: string;
}

export interface MessageIntakeRequest {
  sessionId: string;
  userText: string;
}

export interface MessageIntakeResponse {
  sessionId: string;
  current_step: IntakeStep;
  progress: number;
  utterance: string;
  requires_correction?: boolean;
  review_snapshot?: string | null;
}

// Bot action types for LLM output
export type BotAction = {
  next_action: "ask" | "confirm" | "validate_error";
  field: IntakeStep;
  utterance: string;
};

// Special intents for user input
export type SpecialIntent = 
  | "back" 
  | "change_patient_info" 
  | "change_visit_reason" 
  | "change_symptom_onset"
  | "change_previous_treatment"
  | "change_medical_conditions"
  | "change_allergies"
  | "change_concerns"
  | "update_patient_info" 
  | "update_visit_reason" 
  | "update_symptom_onset"
  | "update_previous_treatment"
  | "update_medical_conditions"
  | "update_allergies"
  | "update_concerns"
  | "skip" 
  | "done" 
  | "review" 
  | "none";

// Step order for progress calculation
export const INTAKE_STEPS: IntakeStep[] = [
  "patient_info",
  "visit_reason",
  "symptom_onset", 
  "previous_treatment",
  "medical_conditions",
  "allergies",
  "concerns",
  "review",
  "complete"
];

// Step display names
export const STEP_DISPLAY_NAMES: Record<IntakeStep, string> = {
  patient_info: "Patient Information",
  visit_reason: "Visit Reason",
  symptom_onset: "Symptom Onset",
  previous_treatment: "Previous Treatment",
  medical_conditions: "Medical Conditions",
  allergies: "Allergies",
  concerns: "Concerns",
  review: "Review",
  complete: "Complete"
};