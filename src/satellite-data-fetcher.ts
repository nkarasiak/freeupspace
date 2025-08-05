// Dynamic satellite data fetcher with TLE from external sources
import { SatelliteConfig } from './types/satellite';
import { SATELLITE_CONFIGS_WITH_STARLINK } from './config/satellites';

export interface TLEData {
  id: string;
  name: string;
  tle1: string;
  tle2: string;
  catalogNumber: string;
}


export class SatelliteDataFetcher {
  private cache: Map<string, TLEData[]> = new Map();
  private cacheExpiry: Map<string, number> = new Map();
  private readonly CACHE_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 days
  private readonly STORAGE_PREFIX = 'satellite_cache_';
  
  constructor() {
    this.loadCacheFromStorage();
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
    // Try to find config by exact name match from central config
    let configOverride = SATELLITE_CONFIGS_WITH_STARLINK.find(sat => 
      sat.name === name || sat.alternateName === name
    );
    
    // Try to find by normalized name matching (convert to slug format)
    if (!configOverride) {
      const normalizedTleName = name.toLowerCase().replace(/[^a-z0-9]/g, '-');
      configOverride = SATELLITE_CONFIGS_WITH_STARLINK.find(sat => sat.id === normalizedTleName);
    }
    
    // Try partial matching for satellite families
    if (!configOverride) {
      configOverride = SATELLITE_CONFIGS_WITH_STARLINK.find(sat => {
        // Check if the TLE name contains any part of the config name or vice versa
        const tleName = name.toLowerCase();
        const configName = (sat.name || '').toLowerCase();
        const configAltName = (sat.alternateName || '').toLowerCase();
        
        return (configName && tleName.includes(configName)) ||
               (configAltName && tleName.includes(configAltName)) ||
               (sat.id && tleName.includes(sat.id.toLowerCase()));
      });
    }
    
    // Use central config if found, otherwise use defaults
    const config: SatelliteConfig = {
      id: configOverride?.id || tleData.id,
      name: configOverride?.name || tleData.name,
      shortname: configOverride?.shortname,
      alternateName: configOverride?.alternateName,
      type: configOverride?.type || this.getTypeFromName(name),
      tle1: tleData.tle1,
      tle2: tleData.tle2,
      dimensions: configOverride?.dimensions || this.getDefaultDimensions(name),
      image: configOverride?.image,
      defaultBearing: configOverride?.defaultBearing,
      scaleFactor: configOverride?.scaleFactor
    };
    
    return config;
  }
  
  private getTypeFromName(name: string): 'scientific' | 'communication' | 'navigation' | 'earth-observation' | 'weather' {
    const nameLower = name.toLowerCase();
    
    if (nameLower.includes('sentinel') || nameLower.includes('landsat') || nameLower.includes('terra') || nameLower.includes('aqua')) {
      return 'earth-observation';
    } else if (nameLower.includes('noaa') || nameLower.includes('meteosat') || nameLower.includes('goes')) {
      return 'weather';
    } else if (nameLower.includes('gps') || nameLower.includes('navstar') || nameLower.includes('galileo') || nameLower.includes('glonass')) {
      return 'navigation';
    } else if (nameLower.includes('iss') || nameLower.includes('hubble') || nameLower.includes('telescope')) {
      return 'scientific';
    } else {
      return 'communication';
    }
  }
  
  private getDefaultDimensions(name: string): { length: number; width: number; height: number } {
    const nameLower = name.toLowerCase();
    
    if (nameLower.includes('starlink')) {
      return { length: 2.8, width: 1.4, height: 0.32 };
    } else if (nameLower.includes('sentinel')) {
      return { length: 3.0, width: 2.0, height: 2.0 };
    } else if (nameLower.includes('gps') || nameLower.includes('navstar')) {
      return { length: 5.3, width: 3.7, height: 2.4 };
    } else if (nameLower.includes('galileo')) {
      return { length: 5.0, width: 3.0, height: 2.4 };
    } else if (nameLower.includes('noaa') || nameLower.includes('goes')) {
      return { length: 4.2, width: 2.6, height: 2.6 };
    } else {
      return { length: 2.0, width: 1.0, height: 1.0 };
    }
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