// Minimal Web Speech API types for TS
type SpeechRecognitionLang = 'en-US' | 'zh-HK' | string

interface SpeechRecognitionResultItem { transcript: string }
interface SpeechRecognitionResult {
  readonly isFinal: boolean
  [index: number]: SpeechRecognitionResultItem
}
interface SpeechRecognitionEvent extends Event {
  readonly resultIndex: number
  readonly results: SpeechRecognitionResultList
}
interface SpeechRecognitionResultList {
  readonly length: number
  [index: number]: SpeechRecognitionResult
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean
  interimResults: boolean
  lang: SpeechRecognitionLang
  start(): void
  stop(): void
  onresult: ((ev: SpeechRecognitionEvent) => any) | null
  onerror: ((ev: any) => any) | null
  onend: ((ev: any) => any) | null
}

interface Window {
  webkitSpeechRecognition?: { new(): SpeechRecognition }
  SpeechRecognition?: { new(): SpeechRecognition }
}


