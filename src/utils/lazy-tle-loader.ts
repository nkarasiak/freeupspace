// Lazy TLE loader that only loads satellite data when satellites become visible
import { SatelliteDataFetcher, TLEData } from '../satellite-data-fetcher';

export interface VisibilityBounds {
  west: number;
  east: number;
  south: number;
  north: number;
  zoom: number;
}

export interface LazyLoadedSatellite {
  id: string;
  name: string;
  type: string;
  isLoaded: boolean;
  loadPriority: number;
  lastVisible: number;
  tle1?: string;
  tle2?: string;
  catalogNumber?: string;
}

export class LazyTLELoader {
  private satelliteDataFetcher = new SatelliteDataFetcher();
  private satelliteRegistry = new Map<string, LazyLoadedSatellite>();
  private loadedTLEData = new Map<string, TLEData>();
  private loadingPromises = new Map<string, Promise<TLEData | null>>();
  private visibilityHistory = new Map<string, number[]>();
  
  // Visibility tracking
  private loadQueue: string[] = [];
  private isProcessingQueue = false;
  
  // Performance settings
  private readonly MAX_CONCURRENT_LOADS = 5;
  private readonly VISIBILITY_HISTORY_SIZE = 10;
  private readonly UNLOAD_AFTER_MS = 300000; // 5 minutes

  constructor() {
    // Cleanup old data every 30 seconds
    setInterval(() => this.cleanup(), 30000);
  }

  // Register satellites from metadata (without TLE data initially)
  registerSatellites(satellites: Array<{
    id: string;
    name: string;
    type: string;
    priority?: number;
  }>) {
    satellites.forEach(sat => {
      if (!this.satelliteRegistry.has(sat.id)) {
        this.satelliteRegistry.set(sat.id, {
          id: sat.id,
          name: sat.name,
          type: sat.type,
          isLoaded: false,
          loadPriority: sat.priority || this.getTypePriority(sat.type),
          lastVisible: 0
        });
      }
    });
  }

  private getTypePriority(type: string): number {
    switch (type) {
      case 'scientific': return 100;
      case 'navigation': return 90;
      case 'earth-observation': return 80;
      case 'weather': return 70;
      case 'communication': return 60;
      default: return 50;
    }
  }

  // Update visibility bounds and trigger lazy loading
  updateVisibility(bounds: VisibilityBounds) {
    
    // Find satellites that should be visible
    const visibleSatellites = this.findVisibleSatellites(bounds);
    
    // Update visibility history
    const now = Date.now();
    visibleSatellites.forEach(satelliteId => {
      const satellite = this.satelliteRegistry.get(satelliteId);
      if (satellite) {
        satellite.lastVisible = now;
        
        // Update visibility history for predictive loading
        if (!this.visibilityHistory.has(satelliteId)) {
          this.visibilityHistory.set(satelliteId, []);
        }
        const history = this.visibilityHistory.get(satelliteId)!;
        history.push(now);
        
        // Keep history size manageable
        if (history.length > this.VISIBILITY_HISTORY_SIZE) {
          history.shift();
        }
      }
    });

    // Queue loading for visible satellites
    this.queueSatellitesForLoading(visibleSatellites);
    this.processLoadQueue();
  }

  private findVisibleSatellites(bounds: VisibilityBounds): string[] {
    const visible: string[] = [];
    
    // Note: In a full implementation, you would use expandedBounds with position checking:
    // const margin = this.PRELOAD_MARGIN / (bounds.zoom + 1);
    // const expandedBounds = { west: bounds.west - margin, ... };
    // Then check if satellite positions are within expandedBounds
    
    // For now, we'll use a simple heuristic since we don't have positions yet
    // In a real implementation, you'd check against last known positions
    
    // Load high-priority satellites first (ISS, major scientific satellites)
    for (const [satelliteId, satellite] of this.satelliteRegistry) {
      if (!satellite.isLoaded && satellite.loadPriority >= 80) {
        visible.push(satelliteId);
      }
    }

    // Add satellites based on zoom level
    const maxSatellitesToLoad = this.getMaxSatellitesForZoom(bounds.zoom);
    let addedCount = visible.length;
    
    for (const [satelliteId, satellite] of this.satelliteRegistry) {
      if (addedCount >= maxSatellitesToLoad) break;
      
      if (!satellite.isLoaded && !visible.includes(satelliteId)) {
        visible.push(satelliteId);
        addedCount++;
      }
    }

    return visible;
  }

  private getMaxSatellitesForZoom(zoom: number): number {
    if (zoom <= 2) return 50;
    if (zoom <= 4) return 200;
    if (zoom <= 6) return 500;
    return 1000;
  }

  private queueSatellitesForLoading(satelliteIds: string[]) {
    // Sort by priority
    const prioritySorted = satelliteIds
      .map(id => ({ id, priority: this.satelliteRegistry.get(id)?.loadPriority || 0 }))
      .sort((a, b) => b.priority - a.priority)
      .map(item => item.id);

    // Add to load queue (avoid duplicates)
    prioritySorted.forEach(id => {
      if (!this.loadQueue.includes(id) && !this.loadingPromises.has(id)) {
        this.loadQueue.push(id);
      }
    });
  }

  private async processLoadQueue() {
    if (this.isProcessingQueue) return;
    this.isProcessingQueue = true;

    try {
      const concurrentLoads: Promise<void>[] = [];
      
      while (this.loadQueue.length > 0 && concurrentLoads.length < this.MAX_CONCURRENT_LOADS) {
        const satelliteId = this.loadQueue.shift()!;
        concurrentLoads.push(this.loadSatelliteTLE(satelliteId));
      }

      if (concurrentLoads.length > 0) {
        await Promise.all(concurrentLoads);
      }
    } finally {
      this.isProcessingQueue = false;
      
      // Continue processing if there are more items in queue
      if (this.loadQueue.length > 0) {
        setTimeout(() => this.processLoadQueue(), 100);
      }
    }
  }

  private async loadSatelliteTLE(satelliteId: string): Promise<void> {
    const satellite = this.satelliteRegistry.get(satelliteId);
    if (!satellite || satellite.isLoaded) return;

    try {
      // Check if already loading
      if (this.loadingPromises.has(satelliteId)) {
        await this.loadingPromises.get(satelliteId);
        return;
      }

      // Start loading
      const loadPromise = this.fetchTLEForSatellite(satelliteId);
      this.loadingPromises.set(satelliteId, loadPromise);

      const tleData = await loadPromise;
      this.loadingPromises.delete(satelliteId);

      if (tleData) {
        // Store TLE data
        this.loadedTLEData.set(satelliteId, tleData);
        
        // Update satellite registry
        satellite.isLoaded = true;
        satellite.tle1 = tleData.tle1;
        satellite.tle2 = tleData.tle2;
        satellite.catalogNumber = tleData.catalogNumber;
        
        console.log(`✅ Lazy loaded TLE for ${satellite.name}`);
      }
    } catch (error) {
      console.error(`❌ Failed to lazy load TLE for ${satelliteId}:`, error);
      this.loadingPromises.delete(satelliteId);
    }
  }

  private async fetchTLEForSatellite(satelliteId: string): Promise<TLEData | null> {
    try {
      // Load all satellites from the GP file (cached)
      const allTLEData = await this.satelliteDataFetcher.fetchTLEData('all');
      
      // Find matching TLE data by satellite ID or name
      const matchingTLE = allTLEData.find(tle => 
        tle.id === satelliteId || 
        tle.name.toLowerCase().includes(satelliteId.toLowerCase()) ||
        satelliteId.toLowerCase().includes(tle.name.toLowerCase().split(' ')[0])
      );

      return matchingTLE || null;
    } catch (error) {
      console.error(`Error fetching TLE for ${satelliteId}:`, error);
      return null;
    }
  }

  // Get loaded TLE data for a satellite
  getTLEData(satelliteId: string): TLEData | null {
    return this.loadedTLEData.get(satelliteId) || null;
  }

  // Check if satellite TLE is loaded
  isSatelliteLoaded(satelliteId: string): boolean {
    return this.satelliteRegistry.get(satelliteId)?.isLoaded || false;
  }

  // Get all loaded satellites
  getLoadedSatellites(): LazyLoadedSatellite[] {
    return Array.from(this.satelliteRegistry.values())
      .filter(sat => sat.isLoaded);
  }

  // Preload high-priority satellites
  async preloadHighPrioritySatellites(): Promise<void> {
    const highPriority = Array.from(this.satelliteRegistry.values())
      .filter(sat => !sat.isLoaded && sat.loadPriority >= 90)
      .sort((a, b) => b.loadPriority - a.loadPriority)
      .slice(0, 10); // Limit to top 10

    const loadPromises = highPriority.map(sat => this.loadSatelliteTLE(sat.id));
    await Promise.all(loadPromises);
  }

  // Cleanup old/unused satellite data
  private cleanup() {
    const now = Date.now();
    const toUnload: string[] = [];

    for (const [satelliteId, satellite] of this.satelliteRegistry) {
      if (satellite.isLoaded && (now - satellite.lastVisible) > this.UNLOAD_AFTER_MS) {
        toUnload.push(satelliteId);
      }
    }

    // Unload old satellites
    toUnload.forEach(satelliteId => {
      const satellite = this.satelliteRegistry.get(satelliteId);
      if (satellite) {
        satellite.isLoaded = false;
        satellite.tle1 = undefined;
        satellite.tle2 = undefined;
        this.loadedTLEData.delete(satelliteId);
        console.log(`🗑️ Unloaded old TLE data for ${satellite.name}`);
      }
    });

    // Clean visibility history
    for (const [satelliteId, history] of this.visibilityHistory) {
      const recentHistory = history.filter(timestamp => (now - timestamp) < this.UNLOAD_AFTER_MS);
      if (recentHistory.length === 0) {
        this.visibilityHistory.delete(satelliteId);
      } else {
        this.visibilityHistory.set(satelliteId, recentHistory);
      }
    }
  }

  // Get loading statistics
  getStats(): {
    registered: number;
    loaded: number;
    loading: number;
    queueLength: number;
    memoryUsage: string;
  } {
    const memoryUsage = (this.loadedTLEData.size * 0.5).toFixed(1) + 'KB'; // Rough estimate
    
    return {
      registered: this.satelliteRegistry.size,
      loaded: this.loadedTLEData.size,
      loading: this.loadingPromises.size,
      queueLength: this.loadQueue.length,
      memoryUsage
    };
  }

  // Force load a specific satellite
  async forceLoadSatellite(satelliteId: string): Promise<boolean> {
    try {
      await this.loadSatelliteTLE(satelliteId);
      return this.isSatelliteLoaded(satelliteId);
    } catch (error) {
      console.error(`Failed to force load ${satelliteId}:`, error);
      return false;
    }
  }

  // Clear all data
  clear() {
    this.satelliteRegistry.clear();
    this.loadedTLEData.clear();
    this.loadingPromises.clear();
    this.visibilityHistory.clear();
    this.loadQueue.length = 0;
  }
}