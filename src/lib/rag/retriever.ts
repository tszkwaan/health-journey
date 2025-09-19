import { DocumentChunk, PatientContext } from './types';

export class RAGRetriever {
  private chunks: DocumentChunk[] = [];

  constructor(chunks: DocumentChunk[] = []) {
    this.chunks = chunks;
  }

  async retrieveRelevantContext(query: string, reservationId: string, patientContext?: PatientContext): Promise<DocumentChunk[]> {
    // Filter chunks for this specific reservation
    const reservationChunks = this.chunks.filter(chunk => 
      chunk.metadata.reservationId === reservationId
    );

    if (reservationChunks.length === 0) {
      return [];
    }

    // Generate query embedding
    const queryEmbedding = this.generateQueryEmbedding(query);

    // Calculate similarity scores
    const scoredChunks = reservationChunks.map(chunk => ({
      chunk,
      score: this.calculateSimilarity(queryEmbedding, chunk.embedding)
    }));

    // Add keyword-based matching as fallback
    const keywordMatches = this.findKeywordMatches(query, reservationChunks);
    
    // Combine similarity and keyword matches
    const allMatches = [...scoredChunks, ...keywordMatches];
    
    // Remove duplicates and sort by score
    const uniqueMatches = this.removeDuplicateChunks(allMatches);
    
    // Sort by score and return top results
    const topChunks = uniqueMatches
      .sort((a, b) => b.score - a.score)
      .slice(0, 5) // Return top 5 most relevant chunks
      .map(item => item.chunk);

    return topChunks;
  }

  private generateQueryEmbedding(query: string): number[] {
    // Use the same improved embedding approach as document processor
    const words = query.toLowerCase()
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

  private calculateSimilarity(queryEmbedding: number[], chunkEmbedding: number[]): number {
    if (queryEmbedding.length !== chunkEmbedding.length) {
      return 0;
    }

    // Calculate cosine similarity
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < queryEmbedding.length; i++) {
      dotProduct += queryEmbedding[i] * chunkEmbedding[i];
      normA += queryEmbedding[i] * queryEmbedding[i];
      normB += chunkEmbedding[i] * chunkEmbedding[i];
    }

    if (normA === 0 || normB === 0) {
      return 0;
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  addChunks(newChunks: DocumentChunk[]): void {
    this.chunks.push(...newChunks);
  }

  getChunksForReservation(reservationId: string): DocumentChunk[] {
    return this.chunks.filter(chunk => 
      chunk.metadata.reservationId === reservationId
    );
  }

  clearChunks(): void {
    this.chunks = [];
  }

  private findKeywordMatches(query: string, chunks: DocumentChunk[]): Array<{chunk: DocumentChunk, score: number}> {
    const queryLower = query.toLowerCase();
    const matches: Array<{chunk: DocumentChunk, score: number}> = [];
    
    // Define keyword mappings for common medical queries
    const keywordMappings: { [key: string]: string[] } = {
      'family': ['family_history', 'family', 'genetic', 'hereditary', 'parental', 'maternal', 'paternal'],
      'history': ['family_history', 'past_medical_conditions', 'medical_history', 'history'],
      'background': ['family_history', 'past_medical_conditions', 'medical_history'],
      'medication': ['medications', 'medication', 'drug', 'prescription'],
      'allergy': ['allergies', 'allergy', 'reaction'],
      'condition': ['past_medical_conditions', 'medical_conditions', 'condition'],
      'symptom': ['visit_reason', 'symptoms', 'complaint'],
      'lifestyle': ['lifestyle', 'smoking', 'alcohol', 'exercise', 'occupation']
    };
    
    // Extract keywords from query
    const queryWords = queryLower.split(/\s+/).filter(word => word.length > 2);
    
    chunks.forEach(chunk => {
      let score = 0;
      
      // Check for direct keyword matches in content
      queryWords.forEach(word => {
        if (chunk.content.toLowerCase().includes(word)) {
          score += 0.3;
        }
      });
      
      // Check for section-based matches
      queryWords.forEach(word => {
        if (keywordMappings[word]) {
          keywordMappings[word].forEach(section => {
            if (chunk.metadata.section === section) {
              score += 0.5;
            }
          });
        }
      });
      
      // Check for source-based matches
      if (queryWords.includes('family') && chunk.metadata.section === 'family_history') {
        score += 0.7;
      }
      if (queryWords.includes('medical') && chunk.metadata.source === 'medical_history') {
        score += 0.6;
      }
      if (queryWords.includes('intake') && chunk.metadata.source === 'intake') {
        score += 0.5;
      }
      
      if (score > 0) {
        matches.push({ chunk, score });
      }
    });
    
    return matches;
  }
  
  private removeDuplicateChunks(matches: Array<{chunk: DocumentChunk, score: number}>): Array<{chunk: DocumentChunk, score: number}> {
    const seen = new Set<string>();
    const unique: Array<{chunk: DocumentChunk, score: number}> = [];
    
    matches.forEach(match => {
      if (!seen.has(match.chunk.id)) {
        seen.add(match.chunk.id);
        unique.push(match);
      }
    });
    
    return unique;
  }
}
