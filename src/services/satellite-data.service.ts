import { LngLat } from 'maplibre-gl';
import { SatelliteData, SatelliteConfig } from '../types/satellite';
import { SatelliteCalculator } from '../utils/satellite-calculator';
import { SATELLITE_CONFIGS_WITH_STARLINK } from '../config/satellites';

export class SatelliteDataService extends EventTarget {
  private satellites: Map<string, SatelliteData> = new Map();
  private onlineSatellitesLoaded: boolean = false;

  async initialize(): Promise<void> {
    this.loadSatelliteConfigs();
    
    // Since we're using local data, mark online satellites as loaded
    this.setOnlineSatellitesLoaded(true);
  }

  private loadSatelliteConfigs(): void {
    console.log(`🐛 loadSatelliteConfigs: Processing ${SATELLITE_CONFIGS_WITH_STARLINK.length} configs`);
    
    SATELLITE_CONFIGS_WITH_STARLINK.forEach(config => {
      try {
        // Skip configs without TLE data - they will be loaded from external sources
        if (!config.tle1 || !config.tle2) {
          return;
        }
        
        console.log(`🐛 Loading satellite from service config: ${config.id}`);
        
        const position = SatelliteCalculator.calculatePosition(config.tle1, config.tle2);
        
        // Validate position data
        if (!SatelliteCalculator.isValidPosition(position)) {
          return; // Skip this satellite
        }
        
        // Add default dimensions if not specified
        let dimensions = config.dimensions;
        if (!dimensions) {
          dimensions = SatelliteCalculator.getDefaultDimensionsForType(config.type || 'communication', config.id);
        }
        
        const satelliteData: SatelliteData = {
          id: config.id,
          name: config.name || config.id,
          shortname: config.shortname,
          alternateName: config.alternateName,
          type: config.type || 'communication',
          tle1: config.tle1,
          tle2: config.tle2,
          dimensions,
          image: config.image,
          defaultBearing: config.defaultBearing,
          defaultZoom: config.defaultZoom,
          defaultPitch: config.defaultPitch,
          scaleFactor: config.scaleFactor,
          position: new LngLat(position.longitude, position.latitude),
          altitude: position.altitude,
          velocity: position.velocity
        };
        
        this.satellites.set(config.id, satelliteData);
        
        // Debug Landsat satellites specifically
        if (config.id.includes('landsat')) {
        }
      } catch (error) {
        console.error(`❌ Error loading satellite ${config.id}:`, error);
      }
    });
    
    console.log(`🐛 loadSatelliteConfigs: Loaded ${this.satellites.size} satellites`);
  }

  getSatellites(): Map<string, SatelliteData> {
    return this.satellites;
  }

  getSatellite(id: string): SatelliteData | undefined {
    return this.satellites.get(id);
  }

  updateSatellitePositions(): void {
    for (const [id, satellite] of this.satellites) {
      try {
        const position = SatelliteCalculator.calculatePosition(satellite.tle1, satellite.tle2);
        
        if (SatelliteCalculator.isValidPosition(position)) {
          satellite.position = new LngLat(position.longitude, position.latitude);
          satellite.altitude = position.altitude;
          satellite.velocity = position.velocity;
        }
      } catch (error) {
        console.error(`❌ Error updating satellite ${id}:`, error);
      }
    }
  }

  getSatelliteConfigs(): SatelliteConfig[] {
    return SATELLITE_CONFIGS_WITH_STARLINK;
  }

  loadConfigSatelliteById(satelliteId: string): boolean {
    const config = SATELLITE_CONFIGS_WITH_STARLINK.find(sat => sat.id === satelliteId);
    if (config) {
      try {
        // Skip configs without TLE data - they will be loaded from external sources
        if (!config.tle1 || !config.tle2) {
          return false;
        }
        
        const position = SatelliteCalculator.calculatePosition(config.tle1, config.tle2);
        
        if (SatelliteCalculator.isValidPosition(position)) {
          const satelliteData: SatelliteData = {
            id: config.id,
            name: config.name || config.id,
            shortname: config.shortname,
            alternateName: config.alternateName,
            type: config.type || 'communication',
            tle1: config.tle1,
            tle2: config.tle2,
            dimensions: config.dimensions || SatelliteCalculator.getDefaultDimensionsForType(config.type || 'communication', config.id),
            image: config.image,
            defaultBearing: config.defaultBearing,
            defaultZoom: config.defaultZoom,
            defaultPitch: config.defaultPitch,
            scaleFactor: config.scaleFactor,
            position: new LngLat(position.longitude, position.latitude),
            altitude: position.altitude,
            velocity: position.velocity
          };
          
          this.satellites.set(config.id, satelliteData);
          return true;
        }
      } catch (error) {
        console.error(`❌ Error loading config satellite ${satelliteId}:`, error);
      }
    }
    return false;
  }

  searchSatellites(query: string): SatelliteData[] {
    const lowerQuery = query.toLowerCase().trim();
    if (lowerQuery.length < 2) return [];

    return Array.from(this.satellites.values())
      .filter(satellite => 
        satellite.name.toLowerCase().includes(lowerQuery) ||
        satellite.id.toLowerCase().includes(lowerQuery) ||
        satellite.type.toLowerCase().includes(lowerQuery) ||
        (satellite.shortname && satellite.shortname.toLowerCase().includes(lowerQuery))
      )
      .sort((a, b) => a.name.localeCompare(b.name))
      .slice(0, 10); // Limit to 10 results
  }

  removeSatellite(id: string): boolean {
    return this.satellites.delete(id);
  }

  getStats(): { total: number; static: number; online: number } {
    const total = this.satellites.size;
    return {
      total,
      static: total, // All satellites are from local file now
      online: 0     // No online satellites since we use local file
    };
  }

  isOnlineSatellitesLoaded(): boolean {
    return this.onlineSatellitesLoaded;
  }

  setOnlineSatellitesLoaded(loaded: boolean): void {
    this.onlineSatellitesLoaded = loaded;
    this.dispatchEvent(new CustomEvent('satellites-updated', {
      detail: {
        addedCount: 0,
        totalCount: this.satellites.size
      }
    }));
  }
}