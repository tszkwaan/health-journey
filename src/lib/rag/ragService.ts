import { DocumentProcessor } from './documentProcessor';
import { RAGRetriever } from './retriever';
import { RAGGenerator } from './generator';
import { ExternalSearchService } from './externalSearch';
import { DocumentChunk, RAGResponse, PatientContext } from './types';

export class RAGService {
  private documentProcessor: DocumentProcessor;
  private retriever: RAGRetriever;
  private generator: RAGGenerator;
  private externalSearch: ExternalSearchService;
  private reservationChunks: Map<string, DocumentChunk[]> = new Map();

  constructor() {
    this.documentProcessor = new DocumentProcessor();
    this.retriever = new RAGRetriever();
    this.generator = new RAGGenerator();
    this.externalSearch = new ExternalSearchService();
  }

  async processReservationData(reservationId: string, patientData: any): Promise<void> {
    try {
      // Clear existing chunks for this reservation
      this.reservationChunks.delete(reservationId);
      
      // Process all patient data into searchable chunks
      const chunks = await this.documentProcessor.processPatientData(reservationId, patientData);
      
      // Generate embeddings for the chunks
      const chunksWithEmbeddings = await this.documentProcessor.generateEmbeddings(chunks);
      
      // Store chunks for this reservation
      this.reservationChunks.set(reservationId, chunksWithEmbeddings);
      
      // Add to retriever
      this.retriever.addChunks(chunksWithEmbeddings);
      
      console.log(`Processed ${chunksWithEmbeddings.length} chunks for reservation ${reservationId}`);
    } catch (error) {
      console.error('Error processing reservation data:', error);
      throw error;
    }
  }

  async generateResponse(
    query: string, 
    reservationId: string, 
    includeExternal: boolean = false
  ): Promise<RAGResponse> {
    try {
      // Get patient context from existing chunks
      const patientContext = this.extractPatientContext(reservationId);
      
      // Retrieve relevant context from internal sources
      const internalContext = await this.retriever.retrieveRelevantContext(query, reservationId, patientContext);
      
      let allContext = [...internalContext];
      
      // If external search is requested, search external sources
      if (includeExternal && patientContext) {
        try {
          const externalResults = await this.externalSearch.searchMedicalLiterature(query, patientContext);
          
          // Convert external results to document chunks
          const externalChunks: DocumentChunk[] = externalResults.map((result, index) => ({
            id: `external_${reservationId}_${index}_${Date.now()}`,
            content: `${result.title}: ${result.abstract}`,
            metadata: {
              source: 'external',
              section: 'medical_literature',
              patientId: patientContext.medicalConditions?.[0] || 'unknown',
              reservationId,
              timestamp: new Date(),
              url: result.url,
              provider: result.source
            },
            embedding: [], // External chunks don't need embeddings for now
            confidence: result.confidence
          }));
          
          allContext.push(...externalChunks);
        } catch (error) {
          console.error('Error searching external sources:', error);
          // Continue with internal sources only
        }
      }
      
      // Generate response using all available context
      const response = await this.generator.generateResponse(query, allContext, reservationId, patientContext);
      
      return response;
    } catch (error) {
      console.error('Error generating RAG response:', error);
      return {
        response: "I apologize, but I'm having trouble processing your request. Please try again.",
        sources: [],
        conversationId: `conv_${reservationId}_${Date.now()}`,
        confidence: 0
      };
    }
  }

  private extractPatientContext(reservationId: string): PatientContext | undefined {
    const chunks = this.reservationChunks.get(reservationId);
    if (!chunks || chunks.length === 0) {
      return undefined;
    }

    const context: PatientContext = {};

    // Extract patient info from chunks
    chunks.forEach(chunk => {
      if (chunk.metadata.source === 'intake' && chunk.metadata.section === 'patient_info') {
        // Parse patient info from content
        const content = chunk.content.toLowerCase();
        if (content.includes('age')) {
          const ageMatch = content.match(/age[:\s]*(\d+)/);
          if (ageMatch) context.age = parseInt(ageMatch[1]);
        }
        if (content.includes('gender')) {
          const genderMatch = content.match(/gender[:\s]*(\w+)/);
          if (genderMatch) context.gender = genderMatch[1];
        }
      }
      
      if (chunk.metadata.source === 'intake' && chunk.metadata.section === 'visit_reason') {
        context.symptoms = [chunk.content];
      }
      
      if (chunk.metadata.source === 'medical_history' && chunk.metadata.section === 'past_medical_conditions') {
        context.medicalConditions = chunk.content.split(',').map(c => c.trim());
      }
      
      if (chunk.metadata.source === 'medical_history' && chunk.metadata.section === 'medications') {
        context.medications = chunk.content.split(';').map(m => m.trim());
      }
      
      if (chunk.metadata.source === 'medical_history' && chunk.metadata.section === 'allergies') {
        context.allergies = chunk.content.split(',').map(a => a.trim());
      }
    });

    return Object.keys(context).length > 0 ? context : undefined;
  }

  getChunksForReservation(reservationId: string): DocumentChunk[] {
    return this.reservationChunks.get(reservationId) || [];
  }

  clearReservationData(reservationId: string): void {
    this.reservationChunks.delete(reservationId);
  }
}
