import * as satellite from 'satellite.js';
import { SatellitePosition } from '../types/satellite';

export class SatelliteCalculator {
  static calculatePosition(tle1: string, tle2: string, date?: Date): SatellitePosition {
    try {
      // Basic TLE validation
      if (!tle1 || !tle2 || tle1.length < 69 || tle2.length < 69) {
        console.warn('⚠️ Invalid TLE format:', {tle1: tle1?.length, tle2: tle2?.length});
        return { longitude: NaN, latitude: NaN, altitude: NaN, velocity: NaN };
      }

      const satrec = satellite.twoline2satrec(tle1, tle2);
      
      // Check if TLE parsing was successful
      if (!satrec || satrec.error) {
        console.warn('⚠️ TLE parsing failed:', satrec?.error);
        return { longitude: NaN, latitude: NaN, altitude: NaN, velocity: NaN };
      }

      const now = date || new Date();
      const positionAndVelocity = satellite.propagate(satrec, now);
      
      if (positionAndVelocity.position && typeof positionAndVelocity.position !== 'boolean') {
        const gmst = satellite.gstime(now);
        const positionGd = satellite.eciToGeodetic(positionAndVelocity.position, gmst);
        
        const longitude = satellite.degreesLong(positionGd.longitude);
        const latitude = satellite.degreesLat(positionGd.latitude);
        const altitude = positionGd.height;
        
        // Additional validation
        if (isNaN(longitude) || isNaN(latitude) || isNaN(altitude)) {
          console.warn('⚠️ Invalid calculated position:', {longitude, latitude, altitude});
          return { longitude: NaN, latitude: NaN, altitude: NaN, velocity: NaN };
        }
        
        const velocity = positionAndVelocity.velocity && typeof positionAndVelocity.velocity !== 'boolean' ? 
          Math.sqrt(
            Math.pow(positionAndVelocity.velocity.x, 2) + 
            Math.pow(positionAndVelocity.velocity.y, 2) + 
            Math.pow(positionAndVelocity.velocity.z, 2)
          ) : 0;
        
        return {
          longitude,
          latitude,
          altitude,
          velocity: isNaN(velocity) ? 0 : velocity
        };
      }
    } catch (error) {
      console.warn('⚠️ Error calculating satellite position:', error);
    }
    
    return { longitude: NaN, latitude: NaN, altitude: NaN, velocity: NaN };
  }

  static isValidPosition(position: SatellitePosition): boolean {
    return !isNaN(position.longitude) && 
           !isNaN(position.latitude) && 
           !isNaN(position.altitude) && 
           position.altitude > 0;
  }

  static getDefaultDimensionsForType(type: string, satelliteId: string) {
    // Starlink satellites (all generations)
    if (satelliteId.includes('starlink')) {
      if (satelliteId.includes('gen2') || satelliteId.includes('dtc')) {
        return { length: 4.1, width: 1.2, height: 0.32 }; // Gen2 and DTC are larger
      }
      return { length: 2.8, width: 1.4, height: 0.32 }; // Standard Starlink
    }
    
    // Sentinel satellites by constellation
    if (satelliteId.includes('sentinel-1')) {
      return { length: 10.0, width: 2.4, height: 3.4 }; // Sentinel-1 SAR
    }
    if (satelliteId.includes('sentinel-2')) {
      return { length: 3.7, width: 2.1, height: 2.4 }; // Sentinel-2 optical
    }
    if (satelliteId.includes('sentinel-3')) {
      return { length: 3.9, width: 2.2, height: 2.2 }; // Sentinel-3 ocean/land
    }
    if (satelliteId.includes('sentinel-4')) {
      return { length: 3.2, width: 2.1, height: 1.8 }; // Sentinel-4 geostationary
    }
    if (satelliteId.includes('sentinel-5')) {
      return { length: 3.5, width: 2.1, height: 2.1 }; // Sentinel-5P
    }
    if (satelliteId.includes('sentinel-6')) {
      return { length: 3.3, width: 2.3, height: 2.8 }; // Sentinel-6 oceanography
    }
    
    // Default dimensions by type
    switch (type) {
      case 'scientific':
        return { length: 5.0, width: 3.0, height: 3.0 };
      case 'communication':
        return { length: 3.0, width: 2.0, height: 2.0 };
      case 'weather':
        return { length: 4.0, width: 2.5, height: 2.5 };
      case 'earth-observation':
        return { length: 4.0, width: 2.0, height: 2.5 };
      case 'navigation':
        return { length: 2.4, width: 1.8, height: 1.8 };
      default:
        return { length: 3.0, width: 2.0, height: 2.0 };
    }
  }
}