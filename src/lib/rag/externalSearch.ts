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
  },
  {
    name: 'Cochrane Library',
    baseUrl: 'https://www.cochranelibrary.com/api',
    apiEndpoint: '/search',
    searchParams: {
      format: 'json',
      limit: '5'
    },
    rateLimit: 2
  },
  {
    name: 'UpToDate',
    baseUrl: 'https://www.uptodate.com/api',
    apiEndpoint: '/search',
    searchParams: {
      format: 'json',
      limit: '5'
    },
    rateLimit: 1
  }
];

export class ExternalSearchService {
  private rateLimiters: Map<string, number> = new Map();

  async searchMedicalLiterature(query: string, patientContext: PatientContext): Promise<ExternalSearchResult[]> {
    const searchPromises = trustedSources.map(source => 
      this.searchSource(source, query, patientContext)
    );
    
    const results = await Promise.allSettled(searchPromises);
    return this.mergeAndRankResults(results);
  }

  private async searchSource(source: Source, query: string, context: PatientContext): Promise<ExternalSearchResult[]> {
    try {
      // Check rate limit
      if (!this.checkRateLimit(source.name)) {
        console.log(`Rate limit exceeded for ${source.name}, skipping...`);
        return [];
      }

      // Build medical search query with patient context
      const medicalQuery = this.buildMedicalQuery(query, context);
      
      // Search external source
      const response = await this.makeRequest(source, medicalQuery);
      
      // Parse and validate results
      return this.parseSearchResults(response, source);
    } catch (error) {
      console.error(`Error searching ${source.name}:`, error);
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
    // Step 1: Search for article IDs
    const searchUrl = new URL('https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi');
    searchUrl.searchParams.append('db', 'pubmed');
    searchUrl.searchParams.append('term', query);
    searchUrl.searchParams.append('retmode', 'json');
    searchUrl.searchParams.append('retmax', '10');
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
      efetchresult: fetchData // Store as text for now
    };
  }

  private parseSearchResults(response: any, source: Source): ExternalSearchResult[] {
    const results: ExternalSearchResult[] = [];

    try {
      if (source.name === 'PubMed') {
        // Parse PubMed response - simplified approach
        if (response.esearchresult && response.esearchresult.idlist) {
          const ids = response.esearchresult.idlist;
          
          ids.forEach((id: string, index: number) => {
            results.push({
              title: `PubMed Article ${id}`,
              abstract: `Medical literature reference from PubMed. Click the link to view full details.`,
              url: `https://pubmed.ncbi.nlm.nih.gov/${id}/`,
              source: 'PubMed',
              confidence: 0.9 - (index * 0.1), // High confidence for PubMed
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
}
