export interface DocumentChunk {
  id: string;
  content: string;
  metadata: {
    source: 'intake' | 'medical_history' | 'enhanced_summary' | 'external' | 'transcript';
    section: string;
    patientId: string;
    reservationId: string;
    timestamp: Date;
    url?: string; // For external sources
    provider?: string; // For external sources
  };
  embedding: number[];
  confidence: number;
}

export interface Source {
  name: string;
  baseUrl: string;
  apiEndpoint: string;
  apiKey?: string;
  searchParams: Record<string, string>;
  rateLimit: number; // requests per minute
}

export interface ExternalSearchResult {
  title: string;
  abstract: string;
  url: string;
  source: string;
  confidence: number;
  publishedDate?: string;
  authors?: string[];
}

export interface RAGResponse {
  response: string;
  sources: Source[];
  conversationId: string;
  confidence: number;
}

export interface PatientContext {
  age?: number;
  gender?: string;
  medicalConditions?: string[];
  medications?: string[];
  allergies?: string[];
  symptoms?: string[];
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sources?: Source[];
  timestamp: Date;
  confidence?: number;
}

export interface Conversation {
  id: string;
  reservationId: string;
  messages: ChatMessage[];
  createdAt: Date;
  updatedAt: Date;
}
