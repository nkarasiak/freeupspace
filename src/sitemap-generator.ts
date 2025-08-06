/**
 * Dynamic sitemap generator for all satellites from Celestrak
 */
import { SatelliteDataFetcher } from './satellite-data-fetcher';

export interface SitemapEntry {
  url: string;
  lastmod: string;
  changefreq: 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never';
  priority: number;
}

export class SitemapGenerator {
  private static readonly BASE_URL = 'https://www.fromupthe.re';
  private static readonly MAX_URLS_PER_SITEMAP = 2000;
  private satelliteDataFetcher: SatelliteDataFetcher;

  constructor() {
    this.satelliteDataFetcher = new SatelliteDataFetcher();
  }

  /**
   * Generate sitemap index file that references all satellite sitemaps
   */
  async generateSitemapIndex(): Promise<string> {
    try {
      // Get all satellites to determine how many sitemap files we need
      const allSatellites = await this.satelliteDataFetcher.fetchSatellites(['all']);
      const totalSatellites = allSatellites.length;
      const numSitemapFiles = Math.ceil(totalSatellites / SitemapGenerator.MAX_URLS_PER_SITEMAP);
      
      const lastmod = new Date().toISOString().split('T')[0];
      
      let sitemapIndex = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <!-- Main sitemap with homepage and popular satellites -->
  <sitemap>
    <loc>${SitemapGenerator.BASE_URL}/sitemap.xml</loc>
    <lastmod>${lastmod}</lastmod>
  </sitemap>
`;

      // Add sitemap files for all satellites
      for (let i = 0; i < numSitemapFiles; i++) {
        sitemapIndex += `  <sitemap>
    <loc>${SitemapGenerator.BASE_URL}/sitemap-satellites-${i + 1}.xml</loc>
    <lastmod>${lastmod}</lastmod>
  </sitemap>
`;
      }

      sitemapIndex += `</sitemapindex>`;
      
      console.log(`Generated sitemap index with ${numSitemapFiles} satellite sitemap files for ${totalSatellites} satellites`);
      return sitemapIndex;
      
    } catch (error) {
      console.error('Error generating sitemap index:', error);
      throw error;
    }
  }

  /**
   * Generate a specific satellite sitemap file
   */
  async generateSatelliteSitemap(fileNumber: number): Promise<string> {
    try {
      const allSatellites = await this.satelliteDataFetcher.fetchSatellites(['all']);
      const startIndex = (fileNumber - 1) * SitemapGenerator.MAX_URLS_PER_SITEMAP;
      const endIndex = Math.min(startIndex + SitemapGenerator.MAX_URLS_PER_SITEMAP, allSatellites.length);
      const satellitesForThisFile = allSatellites.slice(startIndex, endIndex);
      
      const lastmod = new Date().toISOString().split('T')[0];
      
      let sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
`;

      // Add URLs for satellites in this file
      for (const satellite of satellitesForThisFile) {
        const satelliteId = this.sanitizeSatelliteId(satellite.id);
        const priority = this.calculatePriority(satellite);
        const changefreq = this.calculateChangeFreq(satellite);
        
        sitemap += `  <url>
    <loc>${SitemapGenerator.BASE_URL}/${encodeURIComponent(satelliteId)}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority.toFixed(1)}</priority>
  </url>
`;
      }

      sitemap += `</urlset>`;
      
      console.log(`Generated satellite sitemap ${fileNumber} with ${satellitesForThisFile.length} satellites`);
      return sitemap;
      
    } catch (error) {
      console.error(`Error generating satellite sitemap ${fileNumber}:`, error);
      throw error;
    }
  }

  /**
   * Generate all sitemap files and save them
   */
  async generateAllSitemaps(): Promise<void> {
    try {
      // Generate sitemap index
      const sitemapIndex = await this.generateSitemapIndex();
      this.saveSitemapFile('sitemapindex.xml', sitemapIndex);
      
      // Get total number of satellites to determine how many files to generate
      const allSatellites = await this.satelliteDataFetcher.fetchSatellites(['all']);
      const numSitemapFiles = Math.ceil(allSatellites.length / SitemapGenerator.MAX_URLS_PER_SITEMAP);
      
      // Generate each satellite sitemap file
      for (let i = 1; i <= numSitemapFiles; i++) {
        const sitemap = await this.generateSatelliteSitemap(i);
        this.saveSitemapFile(`sitemap-satellites-${i}.xml`, sitemap);
        
        // Add a small delay to avoid overwhelming the system
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      console.log(`Successfully generated ${numSitemapFiles} satellite sitemap files for ${allSatellites.length} total satellites`);
      
    } catch (error) {
      console.error('Error generating all sitemaps:', error);
      throw error;
    }
  }

  /**
   * Sanitize satellite ID for URL use
   */
  private sanitizeSatelliteId(satelliteId: string): string {
    return satelliteId
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '-')
      .replace(/--+/g, '-')
      .replace(/^-|-$/g, '');
  }

  /**
   * Calculate priority based on satellite type and importance
   */
  private calculatePriority(satellite: any): number {
    const name = satellite.name?.toLowerCase() || satellite.id?.toLowerCase() || '';
    
    // Highest priority
    if (name.includes('iss') || name.includes('zarya')) return 1.0;
    if (name.includes('tiangong')) return 0.9;
    
    // Space telescopes
    if (name.includes('hubble') || name.includes('webb') || name.includes('spitzer') || 
        name.includes('kepler') || name.includes('tess')) return 0.9;
    
    // Popular constellations
    if (name.includes('starlink')) return 0.8;
    if (name.includes('oneweb')) return 0.6;
    
    // Earth observation
    if (name.includes('landsat') || name.includes('terra') || name.includes('aqua') || 
        name.includes('sentinel') || name.includes('noaa')) return 0.7;
    
    // Weather satellites
    if (name.includes('goes') || name.includes('meteosat')) return 0.6;
    
    // Navigation satellites
    if (name.includes('gps') || name.includes('galileo') || name.includes('glonass') || 
        name.includes('cosmos')) return 0.5;
    
    // Communication satellites
    if (name.includes('intelsat') || name.includes('ses-') || name.includes('eutelsat')) return 0.4;
    
    // Small satellites and CubeSats
    if (name.includes('cubesat') || name.includes('flock') || name.includes('planet') ||
        satellite.type === 'cubesat') return 0.3;
    
    // Default priority for other satellites
    return 0.4;
  }

  /**
   * Calculate change frequency based on satellite type
   */
  private calculateChangeFreq(satellite: any): string {
    const name = satellite.name?.toLowerCase() || satellite.id?.toLowerCase() || '';
    
    // High activity satellites
    if (name.includes('iss') || name.includes('tiangong') || name.includes('starlink')) {
      return 'daily';
    }
    
    // Earth observation and weather satellites
    if (name.includes('terra') || name.includes('aqua') || name.includes('landsat') || 
        name.includes('sentinel') || name.includes('goes') || name.includes('noaa')) {
      return 'weekly';
    }
    
    // Most other satellites
    return 'monthly';
  }

  /**
   * Save sitemap file (in real implementation, this would write to filesystem)
   */
  private saveSitemapFile(filename: string, content: string): void {
    console.log(`Would save ${filename} (${content.length} bytes)`);
    // In a real implementation, this would write to the public directory
    // For now, just log the intent
  }
}

/**
 * CLI utility to generate sitemaps
 */
export async function generateSitemaps(): Promise<void> {
  const generator = new SitemapGenerator();
  
  try {
    console.log('Starting sitemap generation for all satellites...');
    await generator.generateAllSitemaps();
    console.log('Sitemap generation completed successfully!');
  } catch (error) {
    console.error('Failed to generate sitemaps:', error);
    process.exit(1);
  }
}

// If running directly
if (require.main === module) {
  generateSitemaps();
}