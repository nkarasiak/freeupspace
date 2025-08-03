// Dynamic satellite data fetcher with TLE from external sources
import { SatelliteConfig } from './satellite-config';

export interface TLEData {
  id: string;
  name: string;
  tle1: string;
  tle2: string;
  catalogNumber: string;
}

export interface SatelliteOverride {
  name?: string;
  shortname?: string;
  type?: 'scientific' | 'communication' | 'navigation' | 'earth-observation' | 'weather';
  dimensions?: {
    length: number;
    width: number;
    height: number;
  };
  image?: string;
}

export class SatelliteDataFetcher {
  private cache: Map<string, TLEData[]> = new Map();
  private cacheExpiry: Map<string, number> = new Map();
  private readonly CACHE_DURATION = 30 * 60 * 1000; // 30 minutes
  
  // Local overrides for satellite properties
  private overrides: Map<string, SatelliteOverride> = new Map();
  
  constructor() {
    this.setupDefaultOverrides();
  }
  
  private setupDefaultOverrides() {
    // ISS override with detailed info
    this.overrides.set('ISS (ZARYA)', {
      name: 'International Space Station',
      shortname: 'ISS',
      type: 'scientific',
      dimensions: { length: 108.5, width: 72.8, height: 20.0 },
      image: 'static/images/ISS.png'
    });
    
    // Hubble Space Telescope
    this.overrides.set('HST', {
      name: 'Hubble Space Telescope',
      shortname: 'HUBBLE',
      type: 'scientific',
      dimensions: { length: 13.2, width: 4.2, height: 4.2 },
      image: 'static/images/hubble.png'
    });
    
    // Starlink satellites with standard dimensions and image
    this.overrides.set('STARLINK', {
      type: 'communication',
      dimensions: { length: 2.8, width: 1.4, height: 0.32 },
      image: 'static/images/starlink.png'
    });
    
    // Sentinel satellites
    this.overrides.set('SENTINEL-1A', {
      name: 'Sentinel-1A',
      type: 'earth-observation',
      dimensions: { length: 10.0, width: 2.4, height: 3.4 },
      image: 'static/images/esa_sentinel1.png'
    });
    
    this.overrides.set('SENTINEL-1B', {
      name: 'Sentinel-1B',
      type: 'earth-observation',
      dimensions: { length: 10.0, width: 2.4, height: 3.4 },
      image: 'static/images/esa_sentinel1.png'
    });
    
    this.overrides.set('SENTINEL-2A', {
      name: 'Sentinel-2A',
      type: 'earth-observation',
      dimensions: { length: 3.7, width: 2.1, height: 2.4 },
      image: 'static/images/esa_sentinel2.png'
    });
    
    this.overrides.set('SENTINEL-2B', {
      name: 'Sentinel-2B',
      type: 'earth-observation',
      dimensions: { length: 3.7, width: 2.1, height: 2.4 },
      image: 'static/images/esa_sentinel2.png'
    });
    
    this.overrides.set('SENTINEL-3A', {
      name: 'Sentinel-3A',
      type: 'earth-observation',
      dimensions: { length: 3.9, width: 2.2, height: 2.2 },
      image: 'static/images/esa_sentinel3.png'
    });
    
    this.overrides.set('SENTINEL-3B', {
      name: 'Sentinel-3B',
      type: 'earth-observation',
      dimensions: { length: 3.9, width: 2.2, height: 2.2 },
      image: 'static/images/esa_sentinel3.png'
    });
    
    this.overrides.set('SENTINEL-5P', {
      name: 'Sentinel-5P (TROPOMI)',
      type: 'earth-observation',
      dimensions: { length: 3.5, width: 2.1, height: 2.1 },
      image: 'static/images/esa_sentinel5.png'
    });
    
    this.overrides.set('SENTINEL-6A', {
      name: 'Sentinel-6A (Michael Freilich)',
      type: 'earth-observation',
      dimensions: { length: 3.3, width: 2.3, height: 2.8 },
      image: 'static/images/esa_sentinel6.png'
    });
    
    // Weather satellites
    this.overrides.set('NOAA', {
      type: 'weather',
      dimensions: { length: 4.2, width: 2.6, height: 2.6 }
    });
    
    // Navigation satellites
    this.overrides.set('GPS', {
      type: 'navigation',
      dimensions: { length: 5.3, width: 3.7, height: 2.4 }
    });
    
    this.overrides.set('GALILEO', {
      type: 'navigation',
      dimensions: { length: 5.0, width: 3.0, height: 2.4 }
    });
    
    // Default dimensions for unknown satellites
    this.overrides.set('DEFAULT', {
      type: 'communication',
      dimensions: { length: 2.0, width: 1.0, height: 1.0 }
    });
  }
  
  /**
   * Fetch TLE data from Celestrak for a specific satellite group
   * Handles pagination to get ALL satellites
   */
  async fetchTLEData(group: string): Promise<TLEData[]> {
    const cacheKey = group.toLowerCase();
    const now = Date.now();
    
    // Check cache first
    if (this.cache.has(cacheKey) && this.cacheExpiry.get(cacheKey)! > now) {
      console.log(`📡 Using cached TLE data for ${group}`);
      return this.cache.get(cacheKey)!;
    }
    
    try {
      // Try different URLs and formats to get all satellites
      let urls: string[] = [];
      
      if (group === 'starlink') {
        // Special handling for Starlink - use multiple sources
        urls = [
          `https://celestrak.org/NORAD/elements/gp.php?GROUP=starlink&FORMAT=tle`,
          `https://celestrak.org/NORAD/elements/supplemental/gp.php?GROUP=starlink&FORMAT=tle`
        ];
      } else {
        // Standard URLs for other satellite groups - only use main endpoint for now
        urls = [
          `https://celestrak.org/NORAD/elements/gp.php?GROUP=${group}&FORMAT=tle`
        ];
        
        // Add supplemental only for groups that we know have supplemental data
        const hasSupplemental = ['planet', 'starlink', 'oneweb', 'kuiper'];
        if (hasSupplemental.includes(group)) {
          urls.push(`https://celestrak.org/NORAD/elements/supplemental/gp.php?GROUP=${group}&FORMAT=tle`);
        }
      }
      
      let allTleData: TLEData[] = [];
      let successfulFetches = 0;
      
      for (const url of urls) {
        try {
          console.log(`🌐 Trying URL: ${url}`);
          
          const response = await fetch(url);
          if (!response.ok) {
            console.log(`⚠️ URL failed (${response.status}): ${url}`);
            continue;
          }
          
          const tleText = await response.text();
          
          // Skip if response is too small (likely error page)
          if (tleText.length < 100) {
            console.log(`⚠️ Response too small for ${url}`);
            continue;
          }
          
          const tleData = this.parseTLEData(tleText);
          
          if (tleData.length > 0) {
            console.log(`✅ Fetched ${tleData.length} satellites from ${url}`);
            
            // Merge with existing data, avoiding duplicates
            const existingIds = new Set(allTleData.map(sat => sat.id));
            const newSatellites = tleData.filter(sat => !existingIds.has(sat.id));
            
            allTleData = [...allTleData, ...newSatellites];
            successfulFetches++;
            
            // For Starlink, always try all URLs to get maximum coverage
            if (group === 'starlink') {
              continue; // Always try more URLs for Starlink
            } else if (allTleData.length < 100) {
              continue; // Try more URLs for better coverage if we don't have enough
            } else {
              break; // For other groups, stop when we have a good amount
            }
          }
          
        } catch (urlError) {
          console.log(`⚠️ Error with URL ${url}:`, urlError);
          continue;
        }
      }
      
      if (allTleData.length === 0) {
        throw new Error(`No valid TLE data found for ${group} from any URL`);
      }
      
      // Cache the results
      this.cache.set(cacheKey, allTleData);
      this.cacheExpiry.set(cacheKey, now + this.CACHE_DURATION);
      
      console.log(`✅ Total fetched: ${allTleData.length} satellites from ${group} (${successfulFetches} successful fetches)`);
      return allTleData;
      
    } catch (error) {
      console.error(`❌ Failed to fetch TLE data for ${group}:`, error);
      
      // Return cached data if available, even if expired
      if (this.cache.has(cacheKey)) {
        console.log(`⚠️ Using expired cache for ${group}`);
        return this.cache.get(cacheKey)!;
      }
      
      throw error;
    }
  }
  
  /**
   * Parse TLE text format into structured data
   */
  private parseTLEData(tleText: string): TLEData[] {
    const lines = tleText.trim().split('\n');
    const satellites: TLEData[] = [];
    
    for (let i = 0; i < lines.length; i += 3) {
      if (i + 2 >= lines.length) break;
      
      const name = lines[i].trim();
      const tle1 = lines[i + 1].trim();
      const tle2 = lines[i + 2].trim();
      
      // Validate TLE format
      if (!tle1.startsWith('1 ') || !tle2.startsWith('2 ')) {
        console.warn(`⚠️ Invalid TLE format for ${name}`);
        continue;
      }
      
      // Extract catalog number from TLE line 1
      const catalogNumber = tle1.substring(2, 7).trim();
      
      satellites.push({
        id: this.generateSatelliteId(name, catalogNumber),
        name: name,
        tle1: tle1,
        tle2: tle2,
        catalogNumber: catalogNumber
      });
    }
    
    return satellites;
  }
  
  /**
   * Generate a unique satellite ID from name and catalog number
   */
  private generateSatelliteId(name: string, catalogNumber: string): string {
    // Clean name for ID use
    const cleanName = name.toLowerCase()
      .replace(/[^a-z0-9-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
    
    return `${cleanName}-${catalogNumber}`;
  }
  
  /**
   * Apply local overrides to satellite configuration
   */
  private applyOverrides(name: string, tleData: TLEData): SatelliteConfig {
    // Try to find specific override by exact name match
    let override = this.overrides.get(name);
    
    // If not found, try pattern matching for satellite families
    if (!override) {
      if (name.includes('STARLINK')) {
        override = this.overrides.get('STARLINK');
      } else if (name.includes('SENTINEL')) {
        // Try specific Sentinel matches first
        for (const [key, value] of this.overrides.entries()) {
          if (key.includes('SENTINEL') && name.includes(key.replace('SENTINEL-', ''))) {
            override = value;
            break;
          }
        }
        if (!override && name.includes('SENTINEL')) {
          // Fallback to generic earth observation
          override = { type: 'earth-observation', dimensions: { length: 3.0, width: 2.0, height: 2.0 } };
        }
      } else if (name.includes('NOAA') || name.includes('METEOSAT') || name.includes('GOES')) {
        override = this.overrides.get('NOAA');
      } else if (name.includes('GPS') || name.includes('NAVSTAR')) {
        override = this.overrides.get('GPS');
      } else if (name.includes('GALILEO')) {
        override = this.overrides.get('GALILEO');
      } else {
        // Use default for unknown satellites
        override = this.overrides.get('DEFAULT');
      }
    }
    
    // Merge TLE data with overrides
    const config: SatelliteConfig = {
      id: tleData.id,
      name: override?.name || tleData.name,
      shortname: override?.shortname,
      type: override?.type || 'communication',
      tle1: tleData.tle1,
      tle2: tleData.tle2,
      dimensions: override?.dimensions || { length: 2.0, width: 1.0, height: 1.0 },
      image: override?.image
    };
    
    return config;
  }
  
  /**
   * Fetch and convert TLE data to SatelliteConfig format
   */
  async fetchSatellites(groups: string[]): Promise<SatelliteConfig[]> {
    const allSatellites: SatelliteConfig[] = [];
    
    for (const group of groups) {
      try {
        const tleData = await this.fetchTLEData(group);
        
        for (const tle of tleData) {
          const config = this.applyOverrides(tle.name, tle);
          allSatellites.push(config);
        }
        
      } catch (error) {
        console.error(`❌ Failed to process group ${group}:`, error);
      }
    }
    
    console.log(`🛰️ Total satellites loaded: ${allSatellites.length}`);
    return allSatellites;
  }
  
  /**
   * Add or update a local override for a satellite
   */
  addOverride(satelliteName: string, override: SatelliteOverride) {
    this.overrides.set(satelliteName, override);
    console.log(`✅ Added override for ${satelliteName}`);
  }
  
  /**
   * Get list of available satellite groups on Celestrak
   */
  getAvailableGroups(): string[] {
    return [
      'starlink',      // Starlink constellation
      'stations',      // Space stations (ISS, etc.)
      'science',       // Scientific satellites
      'weather',       // Weather satellites
      'noaa',          // NOAA satellites
      'goes',          // GOES weather satellites
      'earth-resources', // Earth observation
      'sarsat',        // Search and rescue
      'gps-ops',       // GPS operational
      'galileo',       // Galileo navigation
      'beidou',        // BeiDou navigation
      'sbas',          // Satellite-based augmentation
      'nnss',          // Navy navigation
      'musson',        // Russian navigation
      'science',       // Scientific satellites
      'geodetic',      // Geodetic satellites
      'engineering',   // Engineering satellites
      'education',     // Educational satellites
      'military',      // Military satellites
      'radar',         // Radar calibration
      'cubesat',       // CubeSats
      'other'          // Other satellites
    ];
  }
  
  /**
   * Clear cache (useful for testing or manual refresh)
   */
  clearCache() {
    this.cache.clear();
    this.cacheExpiry.clear();
    console.log('🗑️ Satellite data cache cleared');
  }
}