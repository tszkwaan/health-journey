import { Source, ExternalSearchResult, PatientContext } from './types';

// Trusted medical sources configuration
export const trustedSources: Source[] = [
  {
    name: 'PubMed',
    baseUrl: 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils',
    apiEndpoint: '/esearch.fcgi',
    apiKey: '4078ac1471753cf4588808ca3b29e6b05908',
    searchParams: {
      db: 'pubmed',
      retmode: 'json',
      retmax: '10',
      sort: 'relevance',
      api_key: '4078ac1471753cf4588808ca3b29e6b05908'
    },
    rateLimit: 3 // 3 requests per second
  }
  // Removed UpToDate and Cochrane Library due to API access issues
  // Will focus on PubMed which is free and reliable
];

export class ExternalSearchService {
  private rateLimiters: Map<string, number> = new Map();

  async searchMedicalLiterature(query: string, patientContext: PatientContext): Promise<ExternalSearchResult[]> {
    console.log('🔍 Starting external search for query:', query);
    
    const searchPromises = trustedSources.map(source => 
      this.searchSource(source, query, patientContext)
    );
    
    const results = await Promise.allSettled(searchPromises);
    const mergedResults = this.mergeAndRankResults(results);
    
    console.log('📊 External search results:', mergedResults.length, 'articles found');
    return mergedResults;
  }

  private async searchSource(source: Source, query: string, context: PatientContext): Promise<ExternalSearchResult[]> {
    try {
      console.log(`🔍 Searching ${source.name} for: "${query}"`);
      
      // Check rate limit
      if (!this.checkRateLimit(source.name)) {
        console.log(`⏰ Rate limit exceeded for ${source.name}, skipping...`);
        return [];
      }

      // Use specific search method for PubMed
      if (source.name === 'PubMed') {
        const response = await this.searchPubMed(query);
        const results = this.parseSearchResults(response, source);
        console.log(`✅ PubMed search completed: ${results.length} results`);
        return results;
      }

      // Build medical search query with patient context for other sources
      const medicalQuery = this.buildMedicalQuery(query, context);
      
      // Search external source
      const response = await this.makeRequest(source, medicalQuery);
      
      // Parse and validate results
      const results = this.parseSearchResults(response, source);
      console.log(`✅ ${source.name} search completed: ${results.length} results`);
      return results;
    } catch (error) {
      console.error(`❌ Error searching ${source.name}:`, error);
      return [];
    }
  }

  private buildMedicalQuery(userQuery: string, context: PatientContext): string {
    // Enhance query with patient demographics and medical context
    const enhancedQuery = [
      userQuery,
      context.age ? `age ${context.age}` : '',
      context.gender ? `gender ${context.gender}` : '',
      ...(context.medicalConditions || []),
      ...(context.medications || []),
      ...(context.allergies || [])
    ].filter(Boolean).join(' ');
    
    return enhancedQuery.trim();
  }

  private async makeRequest(source: Source, query: string): Promise<any> {
    if (source.name === 'PubMed') {
      // PubMed requires two-step process: search then fetch details
      return await this.searchPubMed(query);
    }
    
    const url = new URL(source.baseUrl + source.apiEndpoint);
    
    // Add search parameters
    Object.entries(source.searchParams).forEach(([key, value]) => {
      url.searchParams.append(key, value);
    });
    
    // Add query parameter
    url.searchParams.append('term', query);
    
    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Health-Journey-RAG/1.0'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
  }

  private async searchPubMed(query: string): Promise<any> {
    try {
      // Step 1: Search for article IDs
      const searchUrl = new URL('https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi');
      searchUrl.searchParams.append('db', 'pubmed');
      searchUrl.searchParams.append('term', query);
      searchUrl.searchParams.append('retmode', 'json');
      searchUrl.searchParams.append('retmax', '5'); // Reduced to 5 for faster response
      searchUrl.searchParams.append('sort', 'relevance');
      searchUrl.searchParams.append('api_key', '4078ac1471753cf4588808ca3b29e6b05908');

      const searchResponse = await fetch(searchUrl.toString(), {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Health-Journey-RAG/1.0'
        }
      });

      if (!searchResponse.ok) {
        throw new Error(`PubMed search error: ${searchResponse.status}`);
      }

      const searchData = await searchResponse.json();
      const ids = searchData.esearchresult?.idlist || [];

      if (ids.length === 0) {
        return { esearchresult: { idlist: [] } };
      }

      // Step 2: Fetch article details
      const fetchUrl = new URL('https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi');
      fetchUrl.searchParams.append('db', 'pubmed');
      fetchUrl.searchParams.append('id', ids.join(','));
      fetchUrl.searchParams.append('retmode', 'xml');
      fetchUrl.searchParams.append('rettype', 'abstract');
      fetchUrl.searchParams.append('api_key', '4078ac1471753cf4588808ca3b29e6b05908');

      const fetchResponse = await fetch(fetchUrl.toString(), {
        method: 'GET',
        headers: {
          'Accept': 'application/xml',
          'User-Agent': 'Health-Journey-RAG/1.0'
        }
      });

      if (!fetchResponse.ok) {
        throw new Error(`PubMed fetch error: ${fetchResponse.status}`);
      }

      const fetchData = await fetchResponse.text();
      
      return {
        esearchresult: searchData.esearchresult,
        efetchresult: fetchData
      };
    } catch (error) {
      console.error('PubMed search error:', error);
      // Return empty result instead of throwing to allow graceful degradation
      return { esearchresult: { idlist: [] } };
    }
  }

  private parseSearchResults(response: any, source: Source): ExternalSearchResult[] {
    const results: ExternalSearchResult[] = [];

    try {
      if (source.name === 'PubMed') {
        // Parse PubMed response with better medical advice extraction
        if (response.esearchresult && response.esearchresult.idlist) {
          const ids = response.esearchresult.idlist;
          const fetchResult = response.efetchresult;
          
          // Extract abstracts and titles from XML
          const abstractMatches = fetchResult?.match(/<AbstractText[^>]*>(.*?)<\/AbstractText>/gs) || [];
          const titleMatches = fetchResult?.match(/<ArticleTitle>(.*?)<\/ArticleTitle>/gs) || [];
          
          ids.forEach((id: string, index: number) => {
            const rawAbstract = abstractMatches?.[index]?.replace(/<[^>]*>/g, '').trim() || '';
            const title = titleMatches?.[index]?.replace(/<[^>]*>/g, '').trim() || `Medical Research Article ${id}`;
            
            // Extract key medical advice from abstract
            const medicalAdvice = this.extractMedicalAdvice(rawAbstract, title);
            
            results.push({
              title: title,
              abstract: medicalAdvice,
              url: `https://pubmed.ncbi.nlm.nih.gov/${id}/`,
              source: 'PubMed',
              confidence: 0.9 - (index * 0.1),
              publishedDate: new Date().toISOString()
            });
          });
        }
      } else if (source.name === 'Cochrane Library') {
        // Parse Cochrane response
        if (response.results) {
          response.results.forEach((result: any, index: number) => {
            results.push({
              title: result.title || 'Cochrane Review',
              abstract: result.abstract || 'Systematic review from Cochrane Library',
              url: result.url || 'https://www.cochranelibrary.com/',
              source: 'Cochrane Library',
              confidence: 0.85 - (index * 0.1),
              publishedDate: result.publishedDate
            });
          });
        }
      } else if (source.name === 'UpToDate') {
        // Parse UpToDate response
        if (response.results) {
          response.results.forEach((result: any, index: number) => {
            results.push({
              title: result.title || 'UpToDate Article',
              abstract: result.abstract || 'Clinical decision support from UpToDate',
              url: result.url || 'https://www.uptodate.com/',
              source: 'UpToDate',
              confidence: 0.9 - (index * 0.1),
              publishedDate: result.publishedDate
            });
          });
        }
      }
    } catch (error) {
      console.error(`Error parsing ${source.name} response:`, error);
    }

    return results;
  }

  private mergeAndRankResults(results: PromiseSettledResult<ExternalSearchResult[]>[]): ExternalSearchResult[] {
    const allResults: ExternalSearchResult[] = [];

    results.forEach(result => {
      if (result.status === 'fulfilled') {
        allResults.push(...result.value);
      }
    });

    // Sort by confidence score
    return allResults.sort((a, b) => b.confidence - a.confidence);
  }

  private checkRateLimit(sourceName: string): boolean {
    const now = Date.now();
    const lastRequest = this.rateLimiters.get(sourceName) || 0;
    const source = trustedSources.find(s => s.name === sourceName);
    
    if (!source) return false;

    const timeSinceLastRequest = now - lastRequest;
    const minInterval = 60000 / source.rateLimit; // Convert to milliseconds

    if (timeSinceLastRequest >= minInterval) {
      this.rateLimiters.set(sourceName, now);
      return true;
    }

    return false;
  }

  private extractMedicalAdvice(abstract: string, title: string): string {
    // Extract key medical information and treatment recommendations
    const advice = [];
    
    // Look for treatment recommendations
    const treatmentPatterns = [
      /treatment[^.]*\./gi,
      /therapy[^.]*\./gi,
      /management[^.]*\./gi,
      /intervention[^.]*\./gi,
      /recommendation[^.]*\./gi
    ];
    
    treatmentPatterns.forEach(pattern => {
      const matches = abstract.match(pattern);
      if (matches) {
        advice.push(...matches.slice(0, 2)); // Take first 2 matches
      }
    });
    
    // Look for dosage information
    const dosagePatterns = [
      /\d+\s*mg[^.]*\./gi,
      /\d+\s*times\s*per\s*day[^.]*\./gi,
      /dose[^.]*\./gi
    ];
    
    dosagePatterns.forEach(pattern => {
      const matches = abstract.match(pattern);
      if (matches) {
        advice.push(...matches.slice(0, 1)); // Take first match
      }
    });
    
    // Look for side effects or contraindications
    const safetyPatterns = [
      /side\s*effect[^.]*\./gi,
      /contraindication[^.]*\./gi,
      /adverse\s*event[^.]*\./gi,
      /warning[^.]*\./gi
    ];
    
    safetyPatterns.forEach(pattern => {
      const matches = abstract.match(pattern);
      if (matches) {
        advice.push(...matches.slice(0, 1)); // Take first match
      }
    });
    
    // If no specific advice found, use the title and first part of abstract
    if (advice.length === 0) {
      const firstSentence = abstract.split('.')[0];
      advice.push(`${title}. ${firstSentence}.`);
    }
    
    return advice.join(' ').substring(0, 500); // Limit length
  }
}
