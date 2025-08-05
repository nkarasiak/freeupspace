import * as satellite from 'satellite.js';
import { SatellitePosition } from '../orbital-interpolator';
import { CachedPosition, VelocityVector, GeodeticPosition } from '../types/rendering';

export interface BatchPositionRequest {
  satelliteId: string;
  tle1: string;
  tle2: string;
  skipCache?: boolean; // For followed satellites that need real-time updates
}

export interface BatchPositionResult {
  satelliteId: string;
  position: {
    longitude: number;
    latitude: number;
    altitude: number;
    velocity: number;
    bearing: number;
  };
  timestamp: number;
}

export class PositionCalculator {
  private satelliteRecords: Map<string, any> = new Map();
  private positionCache: Map<string, CachedPosition> = new Map();
  private readonly POSITION_CACHE_TTL = 2000; // 2 seconds cache

  /**
   * Calculate positions for multiple satellites in a single batch operation
   * This is much more efficient than individual calculations
   */
  calculateBatchPositions(requests: BatchPositionRequest[]): BatchPositionResult[] {
    const now = Date.now();
    const currentTime = new Date();
    const gmst = satellite.gstime(currentTime);
    const results: BatchPositionResult[] = [];

    for (const request of requests) {
      // Check cache first (unless skipCache is true for followed satellites)
      if (!request.skipCache) {
        const cached = this.positionCache.get(request.satelliteId);
        if (cached && now - cached.timestamp < this.POSITION_CACHE_TTL) {
          results.push({
            satelliteId: request.satelliteId,
            position: cached.position,
            timestamp: cached.timestamp
          });
          continue;
        }
      }

      // Calculate new position
      const position = this.calculateSinglePosition(
        request.tle1, 
        request.tle2, 
        currentTime, 
        gmst,
        now
      );

      if (position) {
        // Cache the result
        this.positionCache.set(request.satelliteId, { 
          position, 
          timestamp: now 
        });

        results.push({
          satelliteId: request.satelliteId,
          position,
          timestamp: now
        });
      }
    }

    return results;
  }

  /**
   * Calculate position for a single satellite (optimized for batch operations)
   */
  private calculateSinglePosition(
    tle1: string, 
    tle2: string, 
    currentTime: Date, 
    gmst: number,
    _timestamp: number
  ) {
    // Get or create satellite record (cached)
    const cacheKey = `${tle1}-${tle2}`;
    let satrec = this.satelliteRecords.get(cacheKey);
    if (!satrec) {
      satrec = satellite.twoline2satrec(tle1, tle2);
      this.satelliteRecords.set(cacheKey, satrec);
    }
    
    const positionAndVelocity = satellite.propagate(satrec, currentTime);
    
    if (positionAndVelocity.position && typeof positionAndVelocity.position !== 'boolean') {
      const positionGd = satellite.eciToGeodetic(positionAndVelocity.position, gmst);
      
      // Calculate bearing from velocity vector
      let bearing = 0;
      if (positionAndVelocity.velocity && typeof positionAndVelocity.velocity !== 'boolean') {
        bearing = this.calculateBearing(positionAndVelocity.velocity, positionGd, gmst);
      }
      
      const velocity = positionAndVelocity.velocity && typeof positionAndVelocity.velocity !== 'boolean' ? 
        Math.sqrt(
          Math.pow(positionAndVelocity.velocity.x, 2) + 
          Math.pow(positionAndVelocity.velocity.y, 2) + 
          Math.pow(positionAndVelocity.velocity.z, 2)
        ) : 0;

      return {
        longitude: satellite.degreesLong(positionGd.longitude),
        latitude: satellite.degreesLat(positionGd.latitude),
        altitude: positionGd.height,
        velocity,
        bearing
      };
    }
    
    return null;
  }

  /**
   * Calculate bearing from velocity vector (extracted for reusability)
   */
  private calculateBearing(velocityEci: VelocityVector, positionGd: GeodeticPosition, gmst: number): number {
    // Transform velocity from ECI to ECEF (Earth-fixed) coordinates
    const cosGmst = Math.cos(gmst);
    const sinGmst = Math.sin(gmst);
    
    const vx_ecef = velocityEci.x * cosGmst + velocityEci.y * sinGmst;
    const vy_ecef = -velocityEci.x * sinGmst + velocityEci.y * cosGmst;
    const vz_ecef = velocityEci.z;
    
    // Convert position to ECEF for local coordinate transformation
    const lat_rad = positionGd.latitude;
    const lon_rad = positionGd.longitude;
    
    // Transform velocity to local tangent plane (East, North, Up)
    const cosLat = Math.cos(lat_rad);
    const sinLat = Math.sin(lat_rad);
    const cosLon = Math.cos(lon_rad);
    const sinLon = Math.sin(lon_rad);
    
    // East-North-Up transformation
    const v_east = -sinLon * vx_ecef + cosLon * vy_ecef;
    const v_north = -sinLat * cosLon * vx_ecef - sinLat * sinLon * vy_ecef + cosLat * vz_ecef;
    
    // Calculate bearing (0° = North, 90° = East)
    let bearing = Math.atan2(v_east, v_north) * 180 / Math.PI;
    
    // Normalize bearing to 0-360 degrees
    if (bearing < 0) bearing += 360;
    
    return bearing;
  }

  /**
   * Clean up old cached positions to prevent memory leaks
   */
  cleanupCache(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];
    
    for (const [key, value] of this.positionCache.entries()) {
      if (now - value.timestamp > this.POSITION_CACHE_TTL * 2) {
        keysToDelete.push(key);
      }
    }
    
    for (const key of keysToDelete) {
      this.positionCache.delete(key);
    }
  }

  /**
   * Convert batch results to SatellitePosition format for orbital interpolator
   */
  static toSatellitePositions(results: BatchPositionResult[]): Map<string, SatellitePosition> {
    const positions = new Map<string, SatellitePosition>();
    
    for (const result of results) {
      positions.set(result.satelliteId, {
        longitude: result.position.longitude,
        latitude: result.position.latitude,
        altitude: result.position.altitude,
        velocity: result.position.velocity,
        timestamp: result.timestamp
      });
    }
    
    return positions;
  }

  /**
   * Get cache statistics for monitoring
   */
  getCacheStats() {
    return {
      positionCacheSize: this.positionCache.size,
      satelliteRecordsSize: this.satelliteRecords.size,
      cacheHitRatio: this.getCacheHitRatio()
    };
  }

  private cacheHits = 0;
  private cacheRequests = 0;

  private getCacheHitRatio(): number {
    return this.cacheRequests > 0 ? this.cacheHits / this.cacheRequests : 0;
  }
}