import { DocumentChunk, RAGResponse, PatientContext } from './types';

export class RAGGenerator {
  async generateResponse(
    query: string, 
    context: DocumentChunk[], 
    reservationId: string,
    patientContext?: PatientContext
  ): Promise<RAGResponse> {
    try {
      // 1. Pre-validate query against context to prevent hallucination
      const preValidation = this.preValidateQuery(query, context);
      if (preValidation.shouldReject) {
        return {
          response: preValidation.response,
          sources: this.extractSources(context),
          conversationId: `conv_${reservationId}_${Date.now()}`,
          confidence: 0.1
        };
      }

      // 2. Build context prompt with retrieved documents
      const contextPrompt = this.buildContextPrompt(query, context, patientContext);
      
      // 3. Add medical disclaimer and instructions
      const systemPrompt = this.buildSystemPrompt();
      
      // 4. Generate response using Ollama
      const response = await this.callOllama(systemPrompt, contextPrompt);
      
      // 5. Validate response against context
      const validatedResponse = await this.validateResponse(response, context, query);
      
      // 6. Extract sources
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

    prompt += `\nCRITICAL ANTI-HALLUCINATION RULES:\n`;
    prompt += `1. ONLY answer based on information explicitly stated in the patient data above\n`;
    prompt += `2. If the question asks about a specific symptom (e.g., "headache"), check if that symptom is mentioned in the patient data\n`;
    prompt += `3. If the symptom is NOT mentioned in the patient data, say "Not available in patient records"\n`;
    prompt += `4. DO NOT assume or infer symptoms that are not explicitly stated\n`;
    prompt += `5. DO NOT provide information about symptoms that are not in the patient's records\n`;
    prompt += `6. Use citation numbers [1], [2], etc. to reference specific sources\n`;
    prompt += `7. If information is not available in the provided data, say "Not available in patient records"\n`;
    prompt += `8. Be concise and professional\n`;
    prompt += `9. Focus on facts and observations from the patient's records\n`;
    prompt += `10. If asked about medical advice or diagnosis, remind the doctor to consult with the patient directly\n`;
    prompt += `11. Highlight any important patterns or concerns from the patient's history\n`;
    prompt += `12. If external medical literature is provided, you may reference it for general medical knowledge but always clarify it's from medical literature, not patient-specific data\n`;
    prompt += `13. When citing external medical literature, use format: "According to medical literature [X], ..." where X is the citation number\n`;
    prompt += `14. Always provide specific treatment recommendations from medical literature when available\n\n`;

    return prompt;
  }

  private buildSystemPrompt(): string {
    return `You are a medical AI assistant designed to help doctors prepare for patient consultations. 

CRITICAL ANTI-HALLUCINATION GUIDELINES:
- You can ONLY provide information that is explicitly stated in the patient data provided
- You CANNOT provide medical advice, diagnoses, or treatment recommendations based on patient data alone
- You CANNOT make assumptions or inferences beyond what is clearly stated
- If asked about a specific symptom, ONLY answer if that symptom is explicitly mentioned in the patient data
- If a symptom is NOT mentioned in the patient data, say "Not available in patient records"
- DO NOT assume common symptoms or make medical inferences
- Always cite your sources using [1], [2], etc.
- If information is not available, clearly state "Not available in patient records"
- Be professional, concise, and helpful
- Focus on facts and observations, not medical opinions
- DO NOT hallucinate symptoms or conditions not in the patient's records

EXTERNAL MEDICAL LITERATURE GUIDELINES:
- When external medical literature is provided, you MAY reference it for general medical knowledge
- Always clarify when information comes from medical literature vs patient-specific data
- Use format: "According to medical literature [X], ..." for external citations
- Provide evidence-based treatment recommendations from literature when available
- Distinguish between patient-specific findings and general medical knowledge

Your role is to help doctors quickly access and understand patient information and relevant medical literature, not to provide direct medical care.`;
  }

  private async callOllama(systemPrompt: string, contextPrompt: string): Promise<string> {
    try {
      const ollamaUrl = process.env.OLLAMA_BASE_URL || 'http://ollama:11434';
      const response = await fetch(`${ollamaUrl}/api/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'llama3.2',
          prompt: `${systemPrompt}\n\n${contextPrompt}`,
          stream: false,
          options: {
            temperature: 0.1, // Lower temperature to reduce hallucination
            top_p: 0.8,
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

  private preValidateQuery(query: string, context: DocumentChunk[]): { shouldReject: boolean; response: string } {
    const queryLower = query.toLowerCase();
    const contextText = context.map(chunk => chunk.content.toLowerCase()).join(' ');
    
    // Extract potential symptoms from the query
    const commonSymptoms = ['headache', 'fever', 'nausea', 'dizziness', 'fatigue', 'pain', 'cough', 'shortness of breath', 'chest pain', 'abdominal pain'];
    
    for (const symptom of commonSymptoms) {
      if (queryLower.includes(symptom) && !contextText.includes(symptom)) {
        console.warn(`🚨 Pre-validation: Query asks about "${symptom}" but it's not in patient data`);
        return {
          shouldReject: true,
          response: `Not available in patient records. The patient's records do not mention ${symptom}. Please ask the patient directly about this symptom.`
        };
      }
    }
    
    return { shouldReject: false, response: '' };
  }

  private async validateResponse(response: string, context: DocumentChunk[], query?: string): Promise<string> {
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

    // Additional validation: Check if response mentions symptoms not in context
    const responseLower = response.toLowerCase();
    const contextText = context.map(chunk => chunk.content.toLowerCase()).join(' ');
    
    // Common symptoms that might be hallucinated
    const commonSymptoms = ['headache', 'fever', 'nausea', 'dizziness', 'fatigue', 'pain', 'cough', 'shortness of breath'];
    
    for (const symptom of commonSymptoms) {
      if (responseLower.includes(symptom) && !contextText.includes(symptom)) {
        console.warn(`🚨 Potential hallucination detected: "${symptom}" mentioned in response but not in context`);
        return response + `\n\nNote: Please verify this information with the patient as it may not be in the current records.`;
      }
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
