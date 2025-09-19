import { DocumentChunk, RAGResponse, PatientContext } from './types';

export class RAGGenerator {
  async generateResponse(
    query: string, 
    context: DocumentChunk[], 
    reservationId: string,
    patientContext?: PatientContext
  ): Promise<RAGResponse> {
    try {
      // 1. Build context prompt with retrieved documents
      const contextPrompt = this.buildContextPrompt(query, context, patientContext);
      
      // 2. Add medical disclaimer and instructions
      const systemPrompt = this.buildSystemPrompt();
      
      // 3. Generate response using Ollama
      const response = await this.callOllama(systemPrompt, contextPrompt);
      
      // 4. Validate response against context
      const validatedResponse = await this.validateResponse(response, context);
      
      // 5. Extract sources
      const sources = this.extractSources(context);
      
      return {
        response: validatedResponse,
        sources,
        conversationId: `conv_${reservationId}_${Date.now()}`,
        confidence: this.calculateConfidence(validatedResponse, context)
      };
    } catch (error) {
      console.error('Error generating RAG response:', error);
      return {
        response: "I apologize, but I'm having trouble processing your request. Please try again or consult with the patient directly.",
        sources: [],
        conversationId: `conv_${reservationId}_${Date.now()}`,
        confidence: 0
      };
    }
  }

  private buildContextPrompt(query: string, context: DocumentChunk[], patientContext?: PatientContext): string {
    let prompt = `You are a medical AI assistant helping doctors prepare for patient consultations. Answer the doctor's question based on the provided patient data from intake records and medical history.\n\n`;
    
    prompt += `DOCTOR'S QUESTION: ${query}\n\n`;
    
    if (patientContext) {
      prompt += `PATIENT CONTEXT:\n`;
      if (patientContext.age) prompt += `- Age: ${patientContext.age}\n`;
      if (patientContext.gender) prompt += `- Gender: ${patientContext.gender}\n`;
      if (patientContext.medicalConditions?.length) prompt += `- Medical Conditions: ${patientContext.medicalConditions.join(', ')}\n`;
      if (patientContext.medications?.length) prompt += `- Medications: ${patientContext.medications.join(', ')}\n`;
      if (patientContext.allergies?.length) prompt += `- Allergies: ${patientContext.allergies.join(', ')}\n`;
      prompt += `\n`;
    }

    if (context.length === 0) {
      prompt += `No relevant patient data found for this question.\n\n`;
    } else {
      prompt += `RELEVANT PATIENT DATA:\n`;
      context.forEach((chunk, index) => {
        prompt += `\n[${index + 1}] ${chunk.metadata.section.toUpperCase()} (${chunk.metadata.source}):\n${chunk.content}\n`;
      });
    }

    prompt += `\nINSTRUCTIONS:\n`;
    prompt += `- Answer based ONLY on the provided patient data from intake and medical history\n`;
    prompt += `- Use citation numbers [1], [2], etc. to reference specific sources\n`;
    prompt += `- If information is not available in the provided data, say "Not available in patient records"\n`;
    prompt += `- Be concise and professional\n`;
    prompt += `- Focus on facts and observations from the patient's records\n`;
    prompt += `- If asked about medical advice or diagnosis, remind the doctor to consult with the patient directly\n`;
    prompt += `- Highlight any important patterns or concerns from the patient's history\n\n`;

    return prompt;
  }

  private buildSystemPrompt(): string {
    return `You are a medical AI assistant designed to help doctors prepare for patient consultations. 

IMPORTANT GUIDELINES:
- You can ONLY provide information that is explicitly stated in the patient data provided
- You CANNOT provide medical advice, diagnoses, or treatment recommendations
- You CANNOT make assumptions or inferences beyond what is clearly stated
- Always cite your sources using [1], [2], etc.
- If information is not available, clearly state "Not available in patient records"
- Be professional, concise, and helpful
- Focus on facts and observations, not medical opinions

Your role is to help doctors quickly access and understand patient information, not to provide medical care.`;
  }

  private async callOllama(systemPrompt: string, contextPrompt: string): Promise<string> {
    try {
      const response = await fetch('http://localhost:11434/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'llama3.2',
          prompt: `${systemPrompt}\n\n${contextPrompt}`,
          stream: false,
          options: {
            temperature: 0.3,
            top_p: 0.9,
            max_tokens: 500,
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`Ollama API error: ${response.status}`);
      }

      const result = await response.json();
      return result.response || 'No response generated';
    } catch (error) {
      console.error('Error calling Ollama:', error);
      throw error;
    }
  }

  private async validateResponse(response: string, context: DocumentChunk[]): Promise<string> {
    // Basic validation to ensure response is grounded in context
    if (!response || response.trim().length === 0) {
      return "I don't have enough information to answer that question based on the patient's records.";
    }

    // Check if response contains appropriate disclaimers
    const hasDisclaimer = response.toLowerCase().includes('not available') || 
                         response.toLowerCase().includes('patient records') ||
                         response.toLowerCase().includes('consult with the patient');

    // If no context and no disclaimer, add one
    if (context.length === 0 && !hasDisclaimer) {
      return response + "\n\nNote: This information is not available in the patient's current records.";
    }

    return response;
  }

  private extractSources(context: DocumentChunk[]): any[] {
    return context.map((chunk, index) => ({
      id: index + 1,
      content: chunk.content.substring(0, 100) + '...',
      source: chunk.metadata.source,
      section: chunk.metadata.section,
      confidence: chunk.confidence,
      url: chunk.metadata.url,
      provider: chunk.metadata.provider
    }));
  }

  private calculateConfidence(response: string, context: DocumentChunk[]): number {
    if (context.length === 0) {
      return 0.1; // Low confidence if no context
    }

    // Base confidence on context quality and response length
    const avgContextConfidence = context.reduce((sum, chunk) => sum + chunk.confidence, 0) / context.length;
    const responseLength = response.length;
    
    // Higher confidence for longer, more detailed responses with good context
    let confidence = avgContextConfidence;
    
    if (responseLength > 200) {
      confidence += 0.1;
    }
    
    if (responseLength > 500) {
      confidence += 0.1;
    }

    return Math.min(confidence, 1.0);
  }
}
