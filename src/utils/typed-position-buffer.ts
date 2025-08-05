// TypedArray-based position buffer for high-performance satellite position storage
export class TypedPositionBuffer {
  private positions: Float64Array;
  private timestamps: Uint32Array;
  private capacity: number;
  private size = 0;
  private satelliteIdMap = new Map<string, number>();

  // Each satellite takes 5 slots: [longitude, latitude, altitude, velocity, isValid]
  private readonly FIELDS_PER_SATELLITE = 5;
  private readonly LONGITUDE_OFFSET = 0;
  private readonly LATITUDE_OFFSET = 1;
  private readonly ALTITUDE_OFFSET = 2;
  private readonly VELOCITY_OFFSET = 3;
  private readonly IS_VALID_OFFSET = 4;

  constructor(maxSatellites = 2000) {
    this.capacity = maxSatellites;
    // Use Float64Array for precise coordinates
    this.positions = new Float64Array(maxSatellites * this.FIELDS_PER_SATELLITE);
    this.timestamps = new Uint32Array(maxSatellites);
  }

  addOrUpdateSatellite(
    satelliteId: string,
    longitude: number,
    latitude: number,
    altitude: number,
    velocity: number,
    timestamp = Date.now()
  ): boolean {
    let index = this.satelliteIdMap.get(satelliteId);
    
    if (index === undefined) {
      // Add new satellite
      if (this.size >= this.capacity) {
        console.warn('TypedPositionBuffer: Capacity exceeded, cannot add more satellites');
        return false;
      }
      
      index = this.size++;
      this.satelliteIdMap.set(satelliteId, index);
    }

    // Update position data
    const baseOffset = index * this.FIELDS_PER_SATELLITE;
    this.positions[baseOffset + this.LONGITUDE_OFFSET] = longitude;
    this.positions[baseOffset + this.LATITUDE_OFFSET] = latitude;
    this.positions[baseOffset + this.ALTITUDE_OFFSET] = altitude;
    this.positions[baseOffset + this.VELOCITY_OFFSET] = velocity;
    this.positions[baseOffset + this.IS_VALID_OFFSET] = 1; // Mark as valid
    
    this.timestamps[index] = Math.floor(timestamp / 1000); // Store as seconds to fit in Uint32
    
    return true;
  }

  getSatellitePosition(satelliteId: string): {
    longitude: number;
    latitude: number;
    altitude: number;
    velocity: number;
    timestamp: number;
    isValid: boolean;
  } | null {
    const index = this.satelliteIdMap.get(satelliteId);
    if (index === undefined) return null;

    const baseOffset = index * this.FIELDS_PER_SATELLITE;
    const isValid = this.positions[baseOffset + this.IS_VALID_OFFSET] === 1;
    
    if (!isValid) return null;

    return {
      longitude: this.positions[baseOffset + this.LONGITUDE_OFFSET],
      latitude: this.positions[baseOffset + this.LATITUDE_OFFSET],
      altitude: this.positions[baseOffset + this.ALTITUDE_OFFSET],
      velocity: this.positions[baseOffset + this.VELOCITY_OFFSET],
      timestamp: this.timestamps[index] * 1000, // Convert back to milliseconds
      isValid: true
    };
  }

  invalidateSatellite(satelliteId: string): boolean {
    const index = this.satelliteIdMap.get(satelliteId);
    if (index === undefined) return false;

    const baseOffset = index * this.FIELDS_PER_SATELLITE;
    this.positions[baseOffset + this.IS_VALID_OFFSET] = 0; // Mark as invalid
    return true;
  }

  removeSatellite(satelliteId: string): boolean {
    const index = this.satelliteIdMap.get(satelliteId);
    if (index === undefined) return false;

    // Mark as invalid
    this.invalidateSatellite(satelliteId);
    this.satelliteIdMap.delete(satelliteId);
    
    return true;
  }

  getAllValidPositions(): Array<{
    satelliteId: string;
    longitude: number;
    latitude: number;
    altitude: number;
    velocity: number;
    timestamp: number;
  }> {
    const results: Array<{
      satelliteId: string;
      longitude: number;
      latitude: number;
      altitude: number;
      velocity: number;
      timestamp: number;
    }> = [];

    for (const [satelliteId, index] of this.satelliteIdMap) {
      const baseOffset = index * this.FIELDS_PER_SATELLITE;
      const isValid = this.positions[baseOffset + this.IS_VALID_OFFSET] === 1;
      
      if (isValid) {
        results.push({
          satelliteId,
          longitude: this.positions[baseOffset + this.LONGITUDE_OFFSET],
          latitude: this.positions[baseOffset + this.LATITUDE_OFFSET],
          altitude: this.positions[baseOffset + this.ALTITUDE_OFFSET],
          velocity: this.positions[baseOffset + this.VELOCITY_OFFSET],
          timestamp: this.timestamps[index] * 1000
        });
      }
    }

    return results;
  }

  getPositionsInBounds(
    west: number,
    east: number,
    south: number,
    north: number,
    maxAge = 60000 // 1 minute max age
  ): Array<{
    satelliteId: string;
    longitude: number;
    latitude: number;
    altitude: number;
    velocity: number;
  }> {
    const results: Array<{
      satelliteId: string;
      longitude: number;
      latitude: number;
      altitude: number;
      velocity: number;
    }> = [];
    
    const now = Math.floor(Date.now() / 1000);
    const maxAgeSeconds = Math.floor(maxAge / 1000);

    for (const [satelliteId, index] of this.satelliteIdMap) {
      const baseOffset = index * this.FIELDS_PER_SATELLITE;
      const isValid = this.positions[baseOffset + this.IS_VALID_OFFSET] === 1;
      
      if (!isValid) continue;

      // Check if position is recent enough
      const timestamp = this.timestamps[index];
      if (now - timestamp > maxAgeSeconds) continue;

      const longitude = this.positions[baseOffset + this.LONGITUDE_OFFSET];
      const latitude = this.positions[baseOffset + this.LATITUDE_OFFSET];

      // Check if position is within bounds
      if (longitude >= west && longitude <= east && 
          latitude >= south && latitude <= north) {
        results.push({
          satelliteId,
          longitude,
          latitude,
          altitude: this.positions[baseOffset + this.ALTITUDE_OFFSET],
          velocity: this.positions[baseOffset + this.VELOCITY_OFFSET]
        });
      }
    }

    return results;
  }

  cleanup(maxAgeMs = 300000): number { // 5 minute default cleanup age
    const now = Math.floor(Date.now() / 1000);
    const maxAgeSeconds = Math.floor(maxAgeMs / 1000);
    let cleanedCount = 0;

    for (const [satelliteId, index] of this.satelliteIdMap) {
      const timestamp = this.timestamps[index];
      if (now - timestamp > maxAgeSeconds) {
        this.invalidateSatellite(satelliteId);
        cleanedCount++;
      }
    }

    return cleanedCount;
  }

  getStats(): {
    capacity: number;
    size: number;
    validCount: number;
    memoryUsage: number;
    utilization: number;
  } {
    let validCount = 0;
    
    for (const [, index] of this.satelliteIdMap) {
      const baseOffset = index * this.FIELDS_PER_SATELLITE;
      if (this.positions[baseOffset + this.IS_VALID_OFFSET] === 1) {
        validCount++;
      }
    }

    const memoryUsage = (
      this.positions.byteLength + 
      this.timestamps.byteLength
    ) / (1024 * 1024); // MB

    return {
      capacity: this.capacity,
      size: this.size,
      validCount,
      memoryUsage,
      utilization: this.size / this.capacity
    };
  }

  clear() {
    this.positions.fill(0);
    this.timestamps.fill(0);
    this.satelliteIdMap.clear();
    this.size = 0;
  }
}