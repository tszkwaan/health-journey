import { DocumentChunk, PatientContext } from './types';

export class DocumentProcessor {
  async processPatientData(reservationId: string, patientData: any): Promise<DocumentChunk[]> {
    const chunks: DocumentChunk[] = [];

    // 1. Process intake data
    if (patientData.intakeSession?.answers) {
      const intakeChunks = await this.processIntakeData(patientData.intakeSession.answers, reservationId, patientData.patient.id);
      chunks.push(...intakeChunks);
    }

    // 2. Process medical background
    if (patientData.medicalBackground) {
      const medicalChunks = await this.processMedicalBackground(patientData.medicalBackground, reservationId, patientData.patient.id);
      chunks.push(...medicalChunks);
    }

    // 3. Process enhanced summary
    if (patientData.medicalBackground?.enhancedSummary) {
      const summaryChunks = await this.processEnhancedSummary(patientData.medicalBackground.enhancedSummary, reservationId, patientData.patient.id);
      chunks.push(...summaryChunks);
    }

    return chunks;
  }

  private async processIntakeData(answers: any, reservationId: string, patientId: string): Promise<DocumentChunk[]> {
    const chunks: DocumentChunk[] = [];

    Object.entries(answers).forEach(([key, value]) => {
      if (value && typeof value === 'string' && value.trim() !== '') {
        const chunk: DocumentChunk = {
          id: `intake_${reservationId}_${key}_${Date.now()}`,
          content: this.cleanText(value),
          metadata: {
            source: 'intake',
            section: key,
            patientId,
            reservationId,
            timestamp: new Date()
          },
          embedding: [], // Will be generated later
          confidence: 0.9
        };
        chunks.push(chunk);
      } else if (key === 'patient_info' && typeof value === 'object' && value !== null) {
        // Special handling for patient_info object
        const patientInfo = value as { full_name?: string; dob?: string; phone?: string };
        const content = `Name: ${patientInfo.full_name || 'Not provided'}, DOB: ${patientInfo.dob || 'Not provided'}, Phone: ${patientInfo.phone || 'Not provided'}`;
        
        const chunk: DocumentChunk = {
          id: `intake_${reservationId}_patient_info_${Date.now()}`,
          content: this.cleanText(content),
          metadata: {
            source: 'intake',
            section: 'patient_info',
            patientId,
            reservationId,
            timestamp: new Date()
          },
          embedding: [],
          confidence: 0.95
        };
        chunks.push(chunk);
      }
    });

    return chunks;
  }

  private async processMedicalBackground(medicalBackground: any, reservationId: string, patientId: string): Promise<DocumentChunk[]> {
    const chunks: DocumentChunk[] = [];

    // Process past medical conditions
    if (medicalBackground.pastMedicalConditions?.length > 0) {
      const content = medicalBackground.pastMedicalConditions.join(', ');
      chunks.push(this.createChunk('past_medical_conditions', content, 'medical_history', reservationId, patientId));
    }

    if (medicalBackground.otherMedicalCondition) {
      chunks.push(this.createChunk('other_medical_condition', medicalBackground.otherMedicalCondition, 'medical_history', reservationId, patientId));
    }

    // Process medications
    if (medicalBackground.medications?.length > 0) {
      const content = medicalBackground.medications.map((med: any) => 
        `${med.name}: ${med.dosage} ${med.frequency}`
      ).join('; ');
      chunks.push(this.createChunk('medications', content, 'medical_history', reservationId, patientId));
    }

    // Process allergies
    if (medicalBackground.allergies?.length > 0) {
      const content = medicalBackground.allergies.map((allergy: any) => 
        `${allergy.type} (${allergy.reaction})`
      ).join(', ');
      chunks.push(this.createChunk('allergies', content, 'medical_history', reservationId, patientId));
    }

    if (medicalBackground.otherAllergy) {
      chunks.push(this.createChunk('other_allergy', medicalBackground.otherAllergy, 'medical_history', reservationId, patientId));
    }

    // Process family history
    if (medicalBackground.familyHistory?.length > 0) {
      const content = medicalBackground.familyHistory.join(', ');
      console.log(`🏠 Creating family history chunk: "${content}"`);
      chunks.push(this.createChunk('family_history', content, 'medical_history', reservationId, patientId));
    } else {
      console.log(`❌ No family history found in medical background:`, medicalBackground.familyHistory);
    }

    if (medicalBackground.otherFamilyHistory) {
      chunks.push(this.createChunk('other_family_history', medicalBackground.otherFamilyHistory, 'medical_history', reservationId, patientId));
    }

    // Process lifestyle factors
    const lifestyleFactors = [];
    if (medicalBackground.smoking?.smokes) {
      lifestyleFactors.push(`Smoking: ${medicalBackground.smoking.packsPerDay || 'Unknown'} packs/day for ${medicalBackground.smoking.yearsSmoked || 'Unknown'} years`);
    }
    if (medicalBackground.alcohol?.drinks) {
      lifestyleFactors.push(`Alcohol: ${medicalBackground.alcohol.type || 'Unknown'} ${medicalBackground.alcohol.frequency || 'Unknown frequency'}`);
    }
    if (medicalBackground.exerciseFrequency) {
      lifestyleFactors.push(`Exercise: ${medicalBackground.exerciseFrequency}`);
    }
    if (medicalBackground.occupation) {
      lifestyleFactors.push(`Occupation: ${medicalBackground.occupation}`);
    }

    if (lifestyleFactors.length > 0) {
      chunks.push(this.createChunk('lifestyle', lifestyleFactors.join('; '), 'medical_history', reservationId, patientId));
    }

    return chunks;
  }

  private async processEnhancedSummary(enhancedSummary: any, reservationId: string, patientId: string): Promise<DocumentChunk[]> {
    const chunks: DocumentChunk[] = [];

    const sections = [
      'currentSituation',
      'mainConcerns', 
      'medicalBackground',
      'aiDiagnosis',
      'aiSuggestions'
    ];

    sections.forEach(section => {
      if (enhancedSummary[section]) {
        chunks.push(this.createChunk(section, enhancedSummary[section], 'enhanced_summary', reservationId, patientId, 0.8));
      }
    });

    return chunks;
  }

  private createChunk(
    section: string, 
    content: string, 
    source: 'intake' | 'medical_history' | 'enhanced_summary' | 'external' | 'transcript',
    reservationId: string, 
    patientId: string, 
    confidence: number = 0.9
  ): DocumentChunk {
    return {
      id: `${source}_${reservationId}_${section}_${Date.now()}`,
      content: this.cleanText(content),
      metadata: {
        source,
        section,
        patientId,
        reservationId,
        timestamp: new Date()
      },
      embedding: [], // Will be generated later
      confidence
    };
  }

  private cleanText(text: string): string {
    return text
      .replace(/\s+/g, ' ')
      .replace(/[^\w\s.,!?;:()-]/g, '')
      .trim();
  }

  async generateEmbeddings(chunks: DocumentChunk[]): Promise<DocumentChunk[]> {
    // For now, we'll use a simple text-based similarity
    // In production, you'd use a proper embedding model like OpenAI's text-embedding-ada-002
    // or a local model via Ollama
    
    for (const chunk of chunks) {
      // Simple hash-based embedding for demo purposes
      const text = chunk.content.toLowerCase();
      const embedding = this.simpleTextEmbedding(text);
      chunk.embedding = embedding;
    }

    return chunks;
  }

  private simpleTextEmbedding(text: string): number[] {
    // Improved simple text embedding using word frequency and TF-IDF-like approach
    const words = text.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 2);
    
    // Create a vocabulary of common medical and general terms with synonyms
    const vocabulary = [
      'patient', 'medical', 'condition', 'symptom', 'pain', 'treatment', 'medication',
      'allergy', 'history', 'family', 'smoking', 'alcohol', 'exercise', 'occupation',
      'diabetes', 'hypertension', 'heart', 'blood', 'pressure', 'cholesterol',
      'cancer', 'disease', 'infection', 'fever', 'headache', 'nausea', 'vomiting',
      'chest', 'abdominal', 'back', 'joint', 'muscle', 'skin', 'eye', 'ear', 'nose',
      'throat', 'breathing', 'cough', 'cold', 'flu', 'virus', 'bacteria', 'injury',
      'surgery', 'hospital', 'doctor', 'nurse', 'clinic', 'appointment', 'visit',
      'emergency', 'urgent', 'severe', 'mild', 'moderate', 'chronic', 'acute',
      'diagnosis', 'test', 'examination', 'checkup', 'prescription', 'dose',
      'frequency', 'side', 'effect', 'reaction', 'adverse', 'contraindication',
      // Add family history synonyms
      'background', 'heritage', 'genetic', 'hereditary', 'ancestral', 'lineage',
      'parental', 'maternal', 'paternal', 'grandparent', 'relative', 'kin',
      // Add medical history synonyms
      'record', 'chart', 'file', 'documentation', 'past', 'previous', 'prior',
      'medical', 'health', 'clinical', 'patient', 'case', 'history'
    ];
    
    // Create embedding vector based on vocabulary
    const embedding = new Array(vocabulary.length).fill(0);
    
    // Count word frequencies
    const wordCounts: { [key: string]: number } = {};
    words.forEach(word => {
      wordCounts[word] = (wordCounts[word] || 0) + 1;
    });
    
    // Map to vocabulary indices
    vocabulary.forEach((vocabWord, index) => {
      if (wordCounts[vocabWord]) {
        embedding[index] = wordCounts[vocabWord];
      }
    });
    
    // Add some general text features
    const totalWords = words.length;
    const uniqueWords = Object.keys(wordCounts).length;
    const avgWordLength = words.reduce((sum, word) => sum + word.length, 0) / totalWords;
    
    // Normalize and add features
    const sum = embedding.reduce((a, b) => a + b, 0);
    const normalizedEmbedding = embedding.map(x => sum > 0 ? x / sum : 0);
    
    // Add text features at the end
    normalizedEmbedding.push(totalWords / 100); // Normalize word count
    normalizedEmbedding.push(uniqueWords / 50); // Normalize unique word count
    normalizedEmbedding.push(avgWordLength / 10); // Normalize average word length
    
    return normalizedEmbedding;
  }
}
