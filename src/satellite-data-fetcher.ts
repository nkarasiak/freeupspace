// Dynamic satellite data fetcher with TLE from external sources
import { SatelliteConfig } from './types/satellite';

export interface TLEData {
  id: string;
  name: string;
  tle1: string;
  tle2: string;
  catalogNumber: string;
}

export interface SatelliteOverride {
  id?: string; // Optional override for satellite ID
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
  private readonly CACHE_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 days
  private readonly STORAGE_PREFIX = 'satellite_cache_';
  
  // Local overrides for satellite properties
  private overrides: Map<string, SatelliteOverride> = new Map();
  
  constructor() {
    this.setupDefaultOverrides();
    this.loadCacheFromStorage();
  }
  
  private setupDefaultOverrides() {
    // ISS override with detailed info
    this.overrides.set('ISS (ZARYA)', {
      id: 'iss-zarya', // Force specific ID to match config and app expectations
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
      dimensions: { length: 5.0, width: 3.0, height: 2.4 },
      image: 'static/images/esa_galileo.png'
    });
    
    // Default dimensions for unknown satellites
    this.overrides.set('DEFAULT', {
      type: 'communication',
      dimensions: { length: 2.0, width: 1.0, height: 1.0 }
    });
  }
  
  /**
   * Load cached data from localStorage on initialization
   */
  private loadCacheFromStorage() {
    try {
      const keys = Object.keys(localStorage).filter(key => key.startsWith(this.STORAGE_PREFIX));
      
      for (const key of keys) {
        const group = key.replace(this.STORAGE_PREFIX, '');
        const storedData = localStorage.getItem(key);
        
        if (storedData) {
          const { data, expiry } = JSON.parse(storedData);
          const now = Date.now();
          
          if (expiry > now) {
            this.cache.set(group, data);
            this.cacheExpiry.set(group, expiry);
          } else {
            localStorage.removeItem(key);
          }
        }
      }
    } catch (error) {
    }
  }
  
  /**
   * Save cache data to localStorage for persistence
   */
  private saveCacheToStorage(group: string, data: TLEData[], expiry: number) {
    try {
      const storageKey = this.STORAGE_PREFIX + group;
      const storageData = {
        data,
        expiry,
        timestamp: Date.now()
      };
      
      localStorage.setItem(storageKey, JSON.stringify(storageData));
    } catch (error) {
      
      if (error instanceof DOMException && error.name === 'QuotaExceededError') {
        this.cleanupOldCache();
        
        try {
          localStorage.setItem(this.STORAGE_PREFIX + group, JSON.stringify({
            data,
            expiry,
            timestamp: Date.now()
          }));
        } catch (retryError) {
        }
      }
    }
  }
  
  /**
   * Clean up old cache entries to free up localStorage space
   */
  private cleanupOldCache() {
    try {
      const keys = Object.keys(localStorage).filter(key => key.startsWith(this.STORAGE_PREFIX));
      const cacheEntries: Array<{key: string, timestamp: number}> = [];
      
      for (const key of keys) {
        const storedData = localStorage.getItem(key);
        if (storedData) {
          try {
            const { timestamp } = JSON.parse(storedData);
            cacheEntries.push({ key, timestamp: timestamp || 0 });
          } catch {
            localStorage.removeItem(key);
          }
        }
      }
      
      cacheEntries.sort((a, b) => a.timestamp - b.timestamp);
      
      const keysToRemove = Math.max(1, Math.floor(cacheEntries.length * 0.3));
      for (let i = 0; i < keysToRemove; i++) {
        localStorage.removeItem(cacheEntries[i].key);
        const group = cacheEntries[i].key.replace(this.STORAGE_PREFIX, '');
        this.cache.delete(group);
        this.cacheExpiry.delete(group);
      }
    } catch (error) {
    }
  }
  
  /**
   * Fetch TLE data from Celestrak
   */
  async fetchTLEData(group: string): Promise<TLEData[]> {
    const cacheKey = group.toLowerCase();
    const now = Date.now();
    
    // Check cache first
    if (this.cache.has(cacheKey) && this.cacheExpiry.get(cacheKey)! > now) {
      return this.cache.get(cacheKey)!;
    }
    
    try {
      const response = await fetch('https://celestrak.org/NORAD/elements/gp.php?GROUP=active&FORMAT=tle');
      if (!response.ok) {
        throw new Error(`Failed to fetch TLE data from Celestrak: ${response.status} ${response.statusText}`);
      }
      
      const tleText = await response.text();
      
      if (tleText.length < 100) {
        throw new Error('TLE data from Celestrak appears to be empty or too small');
      }
      
      const allTleData = this.parseTLEData(tleText);
      
      if (allTleData.length === 0) {
        throw new Error('No valid TLE data found from Celestrak');
      }
      
      // Cache the results both in memory and localStorage
      const expiry = now + this.CACHE_DURATION;
      this.cache.set(cacheKey, allTleData);
      this.cacheExpiry.set(cacheKey, expiry);
      this.saveCacheToStorage(cacheKey, allTleData, expiry);
      
      return allTleData;
      
    } catch (error) {
      
      // Return cached data if available, even if expired
      if (this.cache.has(cacheKey)) {
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
    const existingIds = new Set<string>();
    
    for (let i = 0; i < lines.length; i += 3) {
      if (i + 2 >= lines.length) break;
      
      const name = lines[i].trim();
      const tle1 = lines[i + 1].trim();
      const tle2 = lines[i + 2].trim();
      
      // Validate TLE format
      if (!tle1.startsWith('1 ') || !tle2.startsWith('2 ')) {
        continue;
      }
      
      // Extract catalog number from TLE line 1
      const catalogNumber = tle1.substring(2, 7).trim();
      
      // Generate unique ID, preferring clean name without catalog number
      const id = this.generateSatelliteId(name, catalogNumber, existingIds);
      existingIds.add(id);
      
      satellites.push({
        id: id,
        name: name,
        tle1: tle1,
        tle2: tle2,
        catalogNumber: catalogNumber
      });
    }
    
    return satellites;
  }
  
  /**
   * Generate a unique satellite ID from name, avoiding catalog numbers when possible
   */
  private generateSatelliteId(name: string, catalogNumber: string, existingIds?: Set<string>): string {
    // Clean name for ID use
    const cleanName = name.toLowerCase()
      .replace(/[^a-z0-9-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
    
    // Try using just the clean name first
    if (!existingIds || !existingIds.has(cleanName)) {
      return cleanName;
    }
    
    // If there's a conflict, append the catalog number
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
      id: override?.id || tleData.id, // Use override ID if specified
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
    
    // Special case: load everything from GP file
    if (groups.includes('all')) {
      try {
        const tleData = await this.fetchTLEData('all');
        
        for (const tle of tleData) {
          const config = this.applyOverrides(tle.name, tle);
          allSatellites.push(config);
        }
        
        return allSatellites;
        
      } catch (error) {
        return allSatellites;
      }
    }
    
    // Original group-by-group loading (kept for compatibility)
    for (const group of groups) {
      try {
        const tleData = await this.fetchTLEData(group);
        
        for (const tle of tleData) {
          const config = this.applyOverrides(tle.name, tle);
          allSatellites.push(config);
        }
        
      } catch (error) {
      }
    }
    
    return allSatellites;
  }
  
  /**
   * Add or update a local override for a satellite
   */
  addOverride(satelliteName: string, override: SatelliteOverride) {
    this.overrides.set(satelliteName, override);
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
    
    // Clear localStorage cache as well
    try {
      const keys = Object.keys(localStorage).filter(key => key.startsWith(this.STORAGE_PREFIX));
      for (const key of keys) {
        localStorage.removeItem(key);
      }
    } catch (error) {
    }
  }
  
  /**
   * Get cache statistics
   */
  getCacheStats(): { groups: number, totalSatellites: number, cacheAgeHours: { [group: string]: number } } {
    const stats = {
      groups: this.cache.size,
      totalSatellites: 0,
      cacheAgeHours: {} as { [group: string]: number }
    };
    
    const now = Date.now();
    
    for (const [group, data] of this.cache.entries()) {
      stats.totalSatellites += data.length;
      const expiry = this.cacheExpiry.get(group);
      if (expiry) {
        const ageMs = this.CACHE_DURATION - (expiry - now);
        stats.cacheAgeHours[group] = Math.round(ageMs / (60 * 60 * 1000) * 10) / 10;
      }
    }
    
    return stats;
  }
}