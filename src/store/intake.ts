import { create } from 'zustand'

export type StepKey = 'greeting'|'identification'|'reason'|'onset'|'severity'|'history'|'allergies'|'safety'

type StepData = {
  text: string
  confirmed: boolean
  language: 'en'|'zh-HK'
}

type IntakeState = {
  sessionId?: string
  currentIndex: number
  steps: Record<StepKey, StepData | undefined>
  setSession: (id: string) => void
  setStep: (key: StepKey, data: StepData) => void
  next: () => void
  reset: () => void
}

export const orderedSteps: StepKey[] = ['greeting','identification','reason','onset','severity','history','allergies','safety']

export const useIntakeStore = create<IntakeState>((set, get) => ({
  currentIndex: 0,
  steps: {},
  setSession: (id) => set({ sessionId: id }),
  setStep: (key, data) => set((s) => ({ steps: { ...s.steps, [key]: data } })),
  next: () => set((s) => ({ currentIndex: Math.min(s.currentIndex + 1, orderedSteps.length - 1) })),
  reset: () => set({ currentIndex: 0, steps: {}, sessionId: undefined }),
}))



