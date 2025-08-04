import { LngLat } from 'maplibre-gl';
import { SatelliteData, SatelliteConfig } from '../types/satellite';
import { SatelliteCalculator } from '../utils/satellite-calculator';
import { SATELLITE_CONFIGS_WITH_STARLINK } from '../config/satellites';

export class SatelliteDataService {
  private satellites: Map<string, SatelliteData> = new Map();

  async initialize(): Promise<void> {
    console.log('🛰️ Initializing satellite data service...');
    this.loadSatelliteConfigs();
  }

  private loadSatelliteConfigs(): void {
    SATELLITE_CONFIGS_WITH_STARLINK.forEach(config => {
      try {
        const position = SatelliteCalculator.calculatePosition(config.tle1, config.tle2);
        
        // Validate position data
        if (!SatelliteCalculator.isValidPosition(position)) {
          console.warn(`⚠️ Invalid position for satellite ${config.id}, skipping`);
          return; // Skip this satellite
        }
        
        // Add default dimensions if not specified
        let dimensions = config.dimensions;
        if (!dimensions) {
          dimensions = SatelliteCalculator.getDefaultDimensionsForType(config.type, config.id);
        }
        
        const satelliteData: SatelliteData = {
          ...config,
          dimensions,
          position: new LngLat(position.longitude, position.latitude),
          altitude: position.altitude,
          velocity: position.velocity
        };
        
        this.satellites.set(config.id, satelliteData);
        
        // Debug Landsat satellites specifically
        if (config.id.includes('landsat')) {
          console.log(`🔍 Loading ${config.id}:`, { 
            id: config.id, 
            name: config.name, 
            image: config.image,
            satelliteData: { ...satelliteData, image: satelliteData.image }
          });
        }
      } catch (error) {
        console.error(`❌ Error loading satellite ${config.id}:`, error);
      }
    });

    console.log(`🛰️ Loaded ${this.satellites.size} satellites total`);
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
        const position = SatelliteCalculator.calculatePosition(config.tle1, config.tle2);
        
        if (SatelliteCalculator.isValidPosition(position)) {
          const satelliteData: SatelliteData = {
            ...config,
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
}