// Object pooling for satellite position calculations to reduce garbage collection
export interface PositionData {
  longitude: number;
  latitude: number;
  altitude: number;
  velocity: number;
  timestamp: number;
}

export class PositionDataPool {
  private pool: PositionData[] = [];
  private poolSize = 0;
  private readonly maxPoolSize: number;

  constructor(maxPoolSize = 1000) {
    this.maxPoolSize = maxPoolSize;
    // Pre-allocate some objects
    this.preallocate(Math.min(100, maxPoolSize));
  }

  private preallocate(count: number) {
    for (let i = 0; i < count; i++) {
      this.pool.push({
        longitude: 0,
        latitude: 0,
        altitude: 0,
        velocity: 0,
        timestamp: 0
      });
    }
    this.poolSize = count;
  }

  acquire(): PositionData {
    if (this.poolSize > 0) {
      const obj = this.pool[--this.poolSize];
      // Reset object state
      obj.longitude = 0;
      obj.latitude = 0;
      obj.altitude = 0;
      obj.velocity = 0;
      obj.timestamp = 0;
      return obj;
    }
    
    // Pool is empty, create new object
    return {
      longitude: 0,
      latitude: 0,
      altitude: 0,
      velocity: 0,
      timestamp: 0
    };
  }

  release(obj: PositionData) {
    if (this.poolSize < this.maxPoolSize) {
      this.pool[this.poolSize++] = obj;
    }
    // If pool is full, let GC handle the object
  }

  getPoolStats(): { size: number; maxSize: number; utilization: number } {
    return {
      size: this.poolSize,
      maxSize: this.maxPoolSize,
      utilization: (this.maxPoolSize - this.poolSize) / this.maxPoolSize
    };
  }

  clear() {
    this.pool.length = 0;
    this.poolSize = 0;
  }
}

// Singleton instance for global use
export const positionDataPool = new PositionDataPool(1000);