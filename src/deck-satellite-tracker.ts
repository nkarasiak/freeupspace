import { Deck } from '@deck.gl/core';
import { ScatterplotLayer, IconLayer } from '@deck.gl/layers';
import { Map as MapLibreMap, LngLat } from 'maplibre-gl';
import * as satellite from 'satellite.js';
import { SATELLITE_CONFIGS_WITH_STARLINK } from './satellite-config';
import { PerformanceManager } from './performance-manager';
import { LODManager, ViewportInfo, SatelliteForLOD } from './lod-manager';

export interface SatelliteData {
  id: string;
  name: string;
  type: 'scientific' | 'communication' | 'navigation' | 'earth-observation' | 'weather';
  position: LngLat;
  altitude: number;
  velocity: number;
  tle1: string;
  tle2: string;
  dimensions: {
    length: number; // meters
    width: number;  // meters
    height: number; // meters
  };
}

export interface SatellitePointData {
  position: [number, number, number];
  id: string;
  name: string;
  type: string;
  altitude: number;
  velocity: number;
  length: number;
  color: [number, number, number, number];
  size: number;
}

export interface OrbitCircleData {
  center: [number, number];
  radius: number; // in meters
  color: [number, number, number, number];
  satelliteId: string;
}

export class DeckSatelliteTracker {
  private map: MapLibreMap;
  private deck!: Deck;
  private satellites: Map<string, SatelliteData> = new Map();
  private animationId: number | null = null;
  private followingSatellite: string | null = null;
  private showOrbits = false;
  private isPaused = false;
  private satelliteIcons: Map<string, any> = new Map();
  private onTrackingChangeCallback?: () => void;
  
  // Simple real-time tracking
  private trackingInterval: number | null = null;
  
  // Performance optimization: cache satellite records and positions
  private satelliteRecords: Map<string, any> = new Map();
  private positionCache: Map<string, {position: any, timestamp: number}> = new Map();
  private readonly POSITION_CACHE_TTL = 5000; // Cache positions for 5 seconds
  
  // Layer update optimization
  private lastLayerUpdateZoom = -1;
  private lastLayerUpdateBounds: any = null;
  private layerUpdateThrottle = 0;
  private readonly LAYER_UPDATE_THROTTLE = 33; // ~30fps layer updates for smooth panning
  
  // Performance optimizers
  private performanceManager = new PerformanceManager();
  private lodManager = new LODManager();
  private satelliteWorker: Worker | null = null;

  constructor(map: MapLibreMap) {
    this.map = map;
    this.initializeDeck();
    this.initializeWorker();
  }

  setOnTrackingChangeCallback(callback: () => void) {
    this.onTrackingChangeCallback = callback;
  }

  private setupAggressivePitchOverride() {
    // Simplified approach: Let MapLibre handle pitch completely
    // Deck.gl should only handle satellite rendering, not pitch control
    
    this.deck.setProps({
      onViewStateChange: (params) => {
        const { viewState } = params;
        
        // Only sync non-pitch properties with MapLibre
        // Let the custom Ctrl+drag handler control pitch directly
        this.map.jumpTo({
          center: [viewState.longitude, viewState.latitude],
          zoom: viewState.zoom,
          bearing: viewState.bearing
          // Deliberately omit pitch - let MapLibre handle it
        });
      }
    });
    
    console.log('🔧 Simplified pitch control: MapLibre handles pitch, Deck.gl handles rendering');
  }

  private initializeDeck() {
    // Create canvas element for deck.gl first
    const canvas = document.createElement('canvas');
    canvas.id = 'deck-canvas';
    canvas.style.position = 'absolute';
    canvas.style.left = '0';
    canvas.style.top = '0';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.pointerEvents = 'auto';
    canvas.style.zIndex = '1';
    
    const mapContainer = this.map.getContainer();
    mapContainer.appendChild(canvas);

    // Initialize deck.gl with the created canvas
    // Get the current map's view state to sync with URL parameters
    const mapCenter = this.map.getCenter();
    const mapZoom = this.map.getZoom();
    
    this.deck = new Deck({
      canvas: canvas,
      width: window.innerWidth,
      height: window.innerHeight,
      initialViewState: {
        longitude: mapCenter.lng,
        latitude: mapCenter.lat,
        zoom: mapZoom,
        pitch: 0,
        bearing: 0,
        maxPitch: 85,
        minPitch: 0
      },
      controller: {
        dragPan: true,
        dragRotate: true,
        scrollZoom: true,
        doubleClickZoom: true,
        touchRotate: false,
        keyboard: true
      },
      onViewStateChange: ({ viewState }) => {
        // Sync with MapLibre view but don't set pitch
        // Let MapLibre handle pitch control entirely
        this.map.jumpTo({
          center: [viewState.longitude, viewState.latitude],
          zoom: viewState.zoom,
          bearing: viewState.bearing
          // Deliberately omit pitch - let MapLibre control it
        });
      },
      onClick: this.handleClick.bind(this)
    });

    // Add aggressive pitch override after initialization
    setTimeout(() => {
      this.setupAggressivePitchOverride();
    }, 500);

    // Sync deck.gl view with MapLibre
    const syncView = () => {
      const center = this.map.getCenter();
      const zoom = this.map.getZoom();
      const bearing = this.map.getBearing();
      const pitch = this.map.getPitch();

      this.deck.setProps({
        viewState: {
          longitude: center.lng,
          latitude: center.lat,
          zoom,
          bearing,
          pitch
        }
      });
    };

    this.map.on('move', syncView);
    this.map.on('zoom', syncView);
    this.map.on('rotate', syncView);
    this.map.on('pitch', syncView);
    
    // Update satellites on map move for smooth panning
    this.map.on('move', () => {
      // Update layers during map movement for smooth satellite panning
      this.updateLayers(true);
    });
    
    // Initial sync
    setTimeout(syncView, 100);
  }

  initialize() {
    this.loadSampleSatellites();
    this.loadSatelliteIcons();
    this.updateLayers();
    this.startTracking();
    
    // Setup search after satellites are loaded
    setTimeout(() => {
      this.setupSearchFunctionality();
    }, 100);
  }

  private initializeWorker() {
    try {
      // Create satellite calculation worker
      const workerBlob = new Blob([`
        // Web Worker for satellite position calculations
        import * as satellite from 'satellite.js';

        const satelliteRecords = new Map();
        let calculationQueue = [];
        let isProcessing = false;

        self.onmessage = function(e) {
          const { type, data } = e.data;

          switch (type) {
            case 'CALCULATE_POSITIONS':
              calculationQueue.push(...data);
              processBatch();
              break;
            
            case 'CALCULATE_SINGLE':
              const result = calculateSatellitePosition(data);
              self.postMessage({ type: 'POSITION_RESULT', data: result });
              break;
          }
        };

        async function processBatch() {
          if (isProcessing || calculationQueue.length === 0) return;
          
          isProcessing = true;
          const batch = calculationQueue.splice(0, 100);
          const results = [];

          for (const request of batch) {
            const result = calculateSatellitePosition(request);
            if (result) {
              results.push(result);
            }
          }

          self.postMessage({ type: 'BATCH_RESULTS', data: results });
          isProcessing = false;

          if (calculationQueue.length > 0) {
            setTimeout(processBatch, 0);
          }
        }

        function calculateSatellitePosition(request) {
          try {
            const { id, tle1, tle2, timestamp } = request;
            
            const cacheKey = \`\${tle1}-\${tle2}\`;
            let satrec = satelliteRecords.get(cacheKey);
            if (!satrec) {
              satrec = satellite.twoline2satrec(tle1, tle2);
              satelliteRecords.set(cacheKey, satrec);
            }
            
            const currentTime = new Date(timestamp);
            const positionAndVelocity = satellite.propagate(satrec, currentTime);
            
            if (positionAndVelocity.position && typeof positionAndVelocity.position !== 'boolean') {
              const gmst = satellite.gstime(currentTime);
              const positionGd = satellite.eciToGeodetic(positionAndVelocity.position, gmst);
              
              const velocity = positionAndVelocity.velocity && typeof positionAndVelocity.velocity !== 'boolean' ? 
                Math.sqrt(
                  Math.pow(positionAndVelocity.velocity.x, 2) + 
                  Math.pow(positionAndVelocity.velocity.y, 2) + 
                  Math.pow(positionAndVelocity.velocity.z, 2)
                ) : 0;
              
              return {
                id,
                longitude: satellite.degreesLong(positionGd.longitude),
                latitude: satellite.degreesLat(positionGd.latitude),
                altitude: positionGd.height,
                velocity,
                timestamp
              };
            }
          } catch (error) {
            console.error(\`Error calculating position for satellite \${request.id}:\`, error);
          }
          
          return null;
        }
      `], { type: 'application/javascript' });

      this.satelliteWorker = new Worker(URL.createObjectURL(workerBlob), { type: 'module' });
      
      this.satelliteWorker.onmessage = (e) => {
        const { type, data } = e.data;
        
        switch (type) {
          case 'BATCH_RESULTS':
            this.handleWorkerBatchResults(data);
            break;
          case 'POSITION_RESULT':
            this.handleWorkerSingleResult(data);
            break;
        }
      };

      console.log('🔧 Satellite calculation worker initialized');
    } catch (error) {
      console.warn('⚠️ Failed to initialize worker, falling back to main thread:', error);
    }
  }

  private loadSampleSatellites() {
    SATELLITE_CONFIGS_WITH_STARLINK.forEach(sat => {
      try {
        const position = this.calculateSatellitePosition(sat.tle1, sat.tle2, sat.id);
        
        if (isNaN(position.longitude) || isNaN(position.latitude) || isNaN(position.altitude)) {
          console.error(`❌ Invalid position for satellite ${sat.id}`);
          return;
        }
        
        this.satellites.set(sat.id, {
          ...sat,
          position: new LngLat(position.longitude, position.latitude),
          altitude: position.altitude,
          velocity: position.velocity
        });
        
      } catch (error) {
        console.error(`❌ Error loading satellite ${sat.id}:`, error);
      }
    });
      }

  private loadSatelliteIcons() {
    // Find all satellites with images
    const satellitesWithImages = SATELLITE_CONFIGS_WITH_STARLINK.filter(sat => sat.image);
    
    satellitesWithImages.forEach(satConfig => {
      this.loadSatelliteIcon(satConfig.id, satConfig.image!);
    });
  }

  private loadSatelliteIcon(satelliteId: string, imageUrl: string) {
    
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0);
        
        // Use actual image dimensions instead of forcing square
        const ICON_MAPPING = {
          [satelliteId]: { x: 0, y: 0, width: img.width, height: img.height, mask: false }
        };
        
        this.satelliteIcons.set(satelliteId, {
          atlas: canvas,
          mapping: ICON_MAPPING,
          width: canvas.width,
          height: canvas.height
        });
        
        this.updateLayers(); // Refresh layers with icon
      }
    };
    img.onerror = (error) => {
      console.error(`❌ Failed to load ${satelliteId} icon from ${imageUrl}:`, error);
      // Fall back to circle for this satellite
    };
    img.src = imageUrl;
  }

  private calculateSatellitePosition(tle1: string, tle2: string, satelliteId?: string) {
    const now = Date.now();
    
    // Check cache first if satellite ID is provided
    if (satelliteId) {
      const cached = this.positionCache.get(satelliteId);
      if (cached && now - cached.timestamp < this.POSITION_CACHE_TTL) {
        return cached.position;
      }
    }
    
    // Get or create satellite record (expensive operation)
    const cacheKey = `${tle1}-${tle2}`;
    let satrec = this.satelliteRecords.get(cacheKey);
    if (!satrec) {
      satrec = satellite.twoline2satrec(tle1, tle2);
      this.satelliteRecords.set(cacheKey, satrec);
    }
    
    const currentTime = new Date();
    const positionAndVelocity = satellite.propagate(satrec, currentTime);
    
    if (positionAndVelocity.position && typeof positionAndVelocity.position !== 'boolean') {
      const gmst = satellite.gstime(currentTime);
      const positionGd = satellite.eciToGeodetic(positionAndVelocity.position, gmst);
      
      const result = {
        longitude: satellite.degreesLong(positionGd.longitude),
        latitude: satellite.degreesLat(positionGd.latitude),
        altitude: positionGd.height,
        velocity: positionAndVelocity.velocity && typeof positionAndVelocity.velocity !== 'boolean' ? 
          Math.sqrt(
            Math.pow(positionAndVelocity.velocity.x, 2) + 
            Math.pow(positionAndVelocity.velocity.y, 2) + 
            Math.pow(positionAndVelocity.velocity.z, 2)
          ) : 0
      };
      
      // Cache the result if satellite ID is provided
      if (satelliteId) {
        this.positionCache.set(satelliteId, { position: result, timestamp: now });
      }
      
      return result;
    }
    
    return { longitude: 0, latitude: 0, altitude: 0, velocity: 0 };
  }

  private getColorForType(type: string): [number, number, number, number] {
    switch (type) {
      case 'scientific': return [0, 255, 0, 255]; // Green
      case 'communication': return [0, 128, 255, 255]; // Blue
      case 'weather': return [255, 128, 0, 255]; // Orange
      case 'earth-observation': return [255, 128, 0, 255]; // Orange
      case 'navigation': return [128, 0, 255, 255]; // Purple
      default: return [255, 255, 255, 255]; // White
    }
  }


  private generateSatellitePoints(): SatellitePointData[] {
    const zoom = this.map.getZoom();
    const bounds = this.map.getBounds();
    
    // Use performance manager and LOD manager for adaptive rendering
    const maxSatellites = this.performanceManager.getMaxSatellites();
    const performanceSkip = this.performanceManager.getLODSkip(zoom);
    
    // Convert satellites to LOD format
    const satellitesForLOD: SatelliteForLOD[] = Array.from(this.satellites.values()).map(sat => ({
      id: sat.id,
      position: sat.position,
      type: sat.type,
      dimensions: sat.dimensions,
      isFollowed: this.followingSatellite === sat.id,
      hasImage: SATELLITE_CONFIGS_WITH_STARLINK.find(s => s.id === sat.id)?.image !== undefined
    }));
    
    // Apply LOD filtering
    const viewport: ViewportInfo = { zoom, bounds };
    const filteredSatellites = this.lodManager.filterSatellitesForLOD(
      satellitesForLOD,
      viewport,
      performanceSkip,
      maxSatellites
    );
    
    // Filter out satellites that should show as icons instead of circles
    const pointSatellites = filteredSatellites.filter(lodSat => {
      return !this.lodManager.shouldShowIcon(lodSat, zoom) || lodSat.id === 'iss'; // ISS handled separately
    });
    
    const points = pointSatellites
      .map(lodSat => {
        const sat = this.satellites.get(lodSat.id)!;
        const size = this.lodManager.getCircleSize(lodSat, zoom, 2); // Use small base size for circles
        return {
          position: [sat.position.lng, sat.position.lat, 0] as [number, number, number],
          id: sat.id,
          name: sat.name,
          type: sat.type,
          altitude: sat.altitude,
          velocity: sat.velocity,
          length: sat.dimensions.length,
          color: this.getColorForType(sat.type),
          size
        };
      });
    
    // Update performance metrics
    this.performanceManager.setSatelliteCount(points.length);
    
    console.log(`🎯 Rendering ${points.length} satellites (quality: ${this.performanceManager.getCurrentQuality()}, zoom: ${zoom.toFixed(1)})`);
    return points;
  }

  private generateSatelliteIconData(): any[] {
    const zoom = this.map.getZoom();
    const bounds = this.map.getBounds();
    const iconData: any[] = [];

    // Performance optimization: viewport culling for images
    const getViewportMargin = (zoom: number): number => {
      // Smaller margin at higher zoom for better performance
      if (zoom <= 4) return 45; // Wide margin at zoom 4
      if (zoom <= 6) return 30; // Medium margin
      return 15; // Tight margin at high zoom
    };

    const margin = getViewportMargin(zoom);
    const expandedBounds = {
      getWest: () => bounds.getWest() - margin,
      getEast: () => bounds.getEast() + margin,
      getSouth: () => bounds.getSouth() - margin/2,
      getNorth: () => bounds.getNorth() + margin/2
    };

    // Generate icon data for satellites with loaded icons
    this.satelliteIcons.forEach((_, satelliteId) => {
      const satellite = this.satellites.get(satelliteId);
      if (satellite) {
        // Level-of-Detail (LOD) for images:
        // ISS: Always show as image (iconic satellite)
        // Others: Progressive appearance based on zoom
        let shouldShowIcon = false;
        if (satelliteId === 'iss') {
          shouldShowIcon = true; // Always show ISS
        } else if (zoom >= 5) {
          shouldShowIcon = true; // Show all satellite images at zoom 5+
        } else if (zoom >= 4) {
          // At zoom 4, only show every 3rd satellite image to reduce load
          const satelliteIndex = Array.from(this.satelliteIcons.keys()).indexOf(satelliteId);
          shouldShowIcon = satelliteIndex % 3 === 0;
        }
        
        // Viewport culling: skip satellites outside visible area (except followed satellite)
        const isInView = this.followingSatellite === satelliteId || 
                        satelliteId === 'iss' || 
                        this.isInBounds(satellite.position, expandedBounds);
        
        if (shouldShowIcon && isInView) {
          const iconSize = this.getSatelliteImageSize(zoom, satellite.dimensions.width, satelliteId);
            
          const data = {
            position: [satellite.position.lng, satellite.position.lat],
            icon: satelliteId,
            size: iconSize,
            id: satellite.id,
            name: satellite.name,
            type: satellite.type,
            altitude: satellite.altitude,
            velocity: satellite.velocity
          };
          iconData.push(data);
        }
      } else {
        console.warn(`⚠️ Satellite ${satelliteId} has loaded icon but no satellite data`);
      }
    });
    
    console.log(`🖼️ Rendering ${iconData.length} satellite images (zoom: ${zoom.toFixed(1)})`);
    return iconData;
  }


  private getSatelliteImageSize(zoom: number, satelliteWidth: number, satelliteId: string): number {
    // Smart size scaling with performance caps
    const effectiveZoom = Math.max(zoom, 0.5);
    
    let size: number;
    if (satelliteId === 'iss') {
      // ISS: More conservative scaling
      size = Math.min((effectiveZoom * satelliteWidth) / 3, 80); // Cap at 80px
    } else {
      // Others: Aggressive scaling but with performance caps
      if (zoom <= 6) {
        size = Math.min(effectiveZoom * satelliteWidth * 2, 120); // Reduced multiplier, cap at 120px
      } else {
        size = Math.min(effectiveZoom * satelliteWidth * 3, 200); // Higher zoom gets bigger, cap at 200px
      }
    }
    
    // Minimum size to ensure visibility
    return Math.max(size, 8);
  }

  // private generateOrbitCircles(): OrbitCircleData[] {
  //   if (!this.showOrbits) return [];
  //   
  //   return Array.from(this.satellites.values())
  //     .filter(sat => sat.type === 'scientific' || this.followingSatellite === sat.id)
  //     .map(sat => {
  //       // Calculate orbit radius based on altitude (simplified circular orbit)
  //       const earthRadius = 6371000; // meters
  //       const orbitRadius = (earthRadius + sat.altitude * 1000);
  //       
  //       return {
  //         center: [sat.position.lng, sat.position.lat] as [number, number],
  //         radius: orbitRadius,
  //         color: this.getColorForType(sat.type),
  //         satelliteId: sat.id
  //       };
  //     });
  // }


  private updateLayers(forceUpdate: boolean = false) {
    const now = Date.now();
    const zoom = this.map.getZoom();
    const bounds = this.map.getBounds();
    
    // Light throttling for force updates to prevent excessive rendering during map panning
    if (!forceUpdate) {
      // Throttle background updates more aggressively
      const zoomChanged = Math.abs(zoom - this.lastLayerUpdateZoom) > 0.3;
      const boundsChanged = !this.lastLayerUpdateBounds || 
        Math.abs(bounds.getCenter().lng - this.lastLayerUpdateBounds.getCenter().lng) > 0.1 ||
        Math.abs(bounds.getCenter().lat - this.lastLayerUpdateBounds.getCenter().lat) > 0.1;
      
      const shouldUpdate = now - this.layerUpdateThrottle > this.LAYER_UPDATE_THROTTLE || 
                          zoomChanged || boundsChanged;
      
      if (!shouldUpdate) return;
    } else {
      // Light throttling for force updates (30fps max)
      if (now - this.layerUpdateThrottle < 33) return;
    }
    
    this.layerUpdateThrottle = now;
    
    // Always update tracking variables for force updates
    this.lastLayerUpdateZoom = zoom;
    this.lastLayerUpdateBounds = bounds;

    const satellitePoints = this.generateSatellitePoints();
    const satelliteIconData = this.generateSatelliteIconData();
    // const orbitCircles = this.generateOrbitCircles();

    const layers: any[] = [
      // Satellite points layer (excluding satellites with images)
      new ScatterplotLayer({
        id: 'satellites',
        data: satellitePoints,
        getPosition: (d: SatellitePointData) => d.position,
        getRadius: (d: SatellitePointData) => d.size,
        getFillColor: (d: SatellitePointData) => d.color,
        getLineColor: [255, 255, 255, 255],
        getLineWidth: 2,
        stroked: true,
        filled: true,
        radiusUnits: 'pixels',
        pickable: true,
        onClick: (info) => {
          this.handleSatelliteClick(info);
        }
      })
    ];

    // Add icon layers for satellites with images (only for visible satellites)
    const visibleSatelliteIds = new Set(satelliteIconData.map(d => d.id));
    this.satelliteIcons.forEach((iconMapping, satelliteId) => {
      if (visibleSatelliteIds.has(satelliteId)) {
        const satelliteData = satelliteIconData.filter(d => d.id === satelliteId);
        if (satelliteData.length > 0) {
          layers.push(
            new IconLayer({
              id: `${satelliteId}-icon`,
              data: satelliteData,
              pickable: true,
              iconAtlas: iconMapping.atlas,
              iconMapping: iconMapping.mapping,
              getIcon: (d: any) => d.icon,
              sizeScale: 1,
              getPosition: (d: any) => d.position,
              getSize: (d: any) => d.size,
              getColor: [255, 255, 255, 255],
              onClick: (info) => {
                this.handleSatelliteClick(info);
              }
            })
          );
        }
      }
    });

    // Orbit paths removed for simplicity

    this.deck.setProps({ layers });
  }

  private handleClick(info: any) {
    if (!info.object && this.followingSatellite) {
      // Clicked on empty area, stop following
      this.stopFollowing();
      this.showMessage('🔓 Stopped following satellite', 'info');
    }
  }

  private handleSatelliteClick(info: any) {
    if (info.object) {
      const satelliteId = info.object.id;
      const satellite = this.satellites.get(satelliteId);
      if (satellite) {
        this.followSatellite(satelliteId);
        this.showSatelliteInfo(satellite);
      }
    }
  }

  followSatellite(satelliteId: string, preserveZoom: boolean = false, explicitZoom?: number) {
    this.followingSatellite = satelliteId;
    const satellite = this.satellites.get(satelliteId);
    
    if (satellite) {
      let targetZoom: number;
      if (explicitZoom !== undefined) {
        targetZoom = explicitZoom;
      } else {
        targetZoom = preserveZoom ? this.map.getZoom() : 5; // Always zoom to level 5 when selecting a satellite
      }
      
      this.map.flyTo({
        center: [satellite.position.lng, satellite.position.lat],
        zoom: targetZoom,
        duration: 2000,
        essential: true
      });
      
      // Start simple tracking
      this.startSimpleTracking();
      
      this.showMessage(`🎯 Following ${satellite.name}`, 'success');
      this.updateLayers(); // Update layers to show orbit path if enabled
      
      // Notify about tracking change
      if (this.onTrackingChangeCallback) {
        this.onTrackingChangeCallback();
      }
    }
  }

  followSatelliteWithAnimation(satelliteId: string, targetZoom: number, targetPitch: number, targetBearing: number) {
    this.followingSatellite = satelliteId;
    const satellite = this.satellites.get(satelliteId);
    
    if (satellite) {
      console.log(`🛰️ Flying to ${satellite.name} with animation - zoom: ${targetZoom}, pitch: ${targetPitch}°, bearing: ${targetBearing}°`);
      
      this.map.flyTo({
        center: [satellite.position.lng, satellite.position.lat],
        zoom: targetZoom,
        pitch: targetPitch,
        bearing: targetBearing,
        duration: 3000, // Slightly longer for URL loads to show the smooth animation
        essential: true
      });
      
      // Start simple tracking
      this.startSimpleTracking();
      
      this.showMessage(`🎯 Following ${satellite.name}`, 'success');
      this.updateLayers(); // Update layers to show orbit path if enabled
      
      // Notify about tracking change
      if (this.onTrackingChangeCallback) {
        this.onTrackingChangeCallback();
      }
    }
  }

  stopFollowing() {
    this.followingSatellite = null;
    this.stopSimpleTracking();
    this.updateLayers();
    
    // Notify about tracking change
    if (this.onTrackingChangeCallback) {
      this.onTrackingChangeCallback();
    }
  }

  private startSimpleTracking() {
    this.stopSimpleTracking();
    this.trackingInterval = window.setInterval(() => {
      this.updateCameraToFollowedSatellite();
    }, 1000); // Update every second
  }

  private stopSimpleTracking() {
    if (this.trackingInterval) {
      clearInterval(this.trackingInterval);
      this.trackingInterval = null;
    }
  }

  private updateCameraToFollowedSatellite() {
    if (!this.followingSatellite) return;
    
    const satellite = this.satellites.get(this.followingSatellite);
    if (!satellite) return;
    
    // Move camera to current satellite position
    this.map.jumpTo({
      center: [satellite.position.lng, satellite.position.lat]
    });
  }


  toggleOrbits() {
    this.showOrbits = !this.showOrbits;
    this.updateLayers();
    this.showMessage(this.showOrbits ? '🛰️ Orbits shown' : '🛰️ Orbits hidden', 'info');
  }

  togglePause() {
    this.isPaused = !this.isPaused;
    this.showMessage(this.isPaused ? '⏸️ Satellite updates paused' : '▶️ Satellite updates resumed', 'info');
    return this.isPaused;
  }

  getFollowingSatellite(): string | null {
    return this.followingSatellite;
  }

  private showSatelliteInfo(satellite: SatelliteData) {
    const followingText = this.followingSatellite === satellite.id ? 
      '\n\n🎯 FOLLOWING THIS SATELLITE\nClick anywhere on map to stop following' : 
      '\n\n📍 Click to follow this satellite';
    
    const info = `
      Name: ${satellite.name}
      Type: ${satellite.type}
      Dimensions: ${satellite.dimensions.length}×${satellite.dimensions.width}×${satellite.dimensions.height}m
      Altitude: ${satellite.altitude.toFixed(0)} km
      Velocity: ${satellite.velocity.toFixed(2)} km/s
      Position: ${satellite.position.lat.toFixed(4)}°, ${satellite.position.lng.toFixed(4)}°${followingText}
    `;
    
    const messageDiv = document.createElement('div');
    messageDiv.style.cssText = `
      position: fixed;
      top: 100px;
      right: 20px;
      z-index: 2000;
      padding: 15px;
      border-radius: 8px;
      background-color: rgba(0, 100, 255, 0.9);
      color: white;
      font-weight: bold;
      max-width: 320px;
      white-space: pre-line;
      font-family: monospace;
    `;
    
    messageDiv.textContent = info;
    document.body.appendChild(messageDiv);
    
    setTimeout(() => {
      messageDiv.remove();
    }, 6000);
  }

  private showMessage(message: string, type: 'success' | 'error' | 'warning' | 'info') {
    const messageDiv = document.createElement('div');
    messageDiv.style.cssText = `
      position: fixed;
      top: 200px;
      right: 20px;
      z-index: 2000;
      padding: 10px 15px;
      border-radius: 6px;
      color: white;
      font-weight: bold;
      font-size: 14px;
      font-family: Arial, sans-serif;
    `;
    
    switch (type) {
      case 'success':
        messageDiv.style.backgroundColor = 'rgba(0, 255, 0, 0.8)';
        break;
      case 'error':
        messageDiv.style.backgroundColor = 'rgba(255, 0, 0, 0.8)';
        break;
      case 'warning':
        messageDiv.style.backgroundColor = 'rgba(255, 165, 0, 0.8)';
        break;
      case 'info':
        messageDiv.style.backgroundColor = 'rgba(0, 150, 255, 0.8)';
        break;
    }
    
    messageDiv.textContent = message;
    document.body.appendChild(messageDiv);
    
    setTimeout(() => {
      messageDiv.remove();
    }, 3000);
  }

  private handleWorkerBatchResults(results: any[]) {
    for (const result of results) {
      const satellite = this.satellites.get(result.id);
      if (satellite) {
        satellite.position = new LngLat(result.longitude, result.latitude);
        satellite.altitude = result.altitude;
        satellite.velocity = result.velocity;
      }
    }
    this.updateLayers();
  }

  private handleWorkerSingleResult(result: any) {
    const satellite = this.satellites.get(result.id);
    if (satellite) {
      satellite.position = new LngLat(result.longitude, result.latitude);
      satellite.altitude = result.altitude;
      satellite.velocity = result.velocity;
    }
  }

  private processSatelliteUpdates(bounds: any, zoom: number, now: number, lastFullUpdate: number, FULL_UPDATE_INTERVAL: number, UPDATE_INTERVAL: number) {
    if (!this.satelliteWorker) {
      // Fallback to main thread calculations
      this.processSatelliteUpdatesMainThread(bounds, zoom, now, lastFullUpdate, FULL_UPDATE_INTERVAL, UPDATE_INTERVAL);
      return;
    }

    const isFullUpdate = now - lastFullUpdate >= FULL_UPDATE_INTERVAL;
    const updateRequests: any[] = [];
    
    let satelliteIndex = 0;
    for (const [id, sat] of this.satellites) {
      const shouldUpdate = this.followingSatellite === id || 
                          isFullUpdate ||
                          (zoom > 3 && this.isInBounds(sat.position, bounds));
      
      // For full updates, only update a subset each frame to spread load
      if (isFullUpdate && this.followingSatellite !== id) {
        const frameOffset = Math.floor(now / UPDATE_INTERVAL) % 30; // Spread over 30 frames
        if (satelliteIndex % 30 !== frameOffset) {
          satelliteIndex++;
          continue;
        }
      }
      
      if (shouldUpdate) {
        updateRequests.push({
          id: sat.id,
          tle1: sat.tle1,
          tle2: sat.tle2,
          timestamp: now
        });
      }
      satelliteIndex++;
    }

    if (updateRequests.length > 0) {
      this.satelliteWorker.postMessage({
        type: 'CALCULATE_POSITIONS',
        data: updateRequests
      });
    }
  }

  private processSatelliteUpdatesMainThread(bounds: any, zoom: number, now: number, lastFullUpdate: number, FULL_UPDATE_INTERVAL: number, UPDATE_INTERVAL: number) {
    // Fallback method using main thread
    let updatedCount = 0;
    let satelliteIndex = 0;
    const isFullUpdate = now - lastFullUpdate >= FULL_UPDATE_INTERVAL;
    
    for (const [id, sat] of this.satellites) {
      const shouldUpdate = this.followingSatellite === id || 
                          isFullUpdate ||
                          (zoom > 3 && this.isInBounds(sat.position, bounds));
      
      if (isFullUpdate && this.followingSatellite !== id) {
        const frameOffset = Math.floor(now / UPDATE_INTERVAL) % 30;
        if (satelliteIndex % 30 !== frameOffset) {
          satelliteIndex++;
          continue;
        }
      }
      
      if (shouldUpdate) {
        const position = this.calculateSatellitePosition(sat.tle1, sat.tle2, sat.id);
        sat.position = new LngLat(position.longitude, position.latitude);
        sat.altitude = position.altitude;
        sat.velocity = position.velocity;
        updatedCount++;
      }
      satelliteIndex++;
    }
    
    this.updateLayers();
    console.log(`🛰️ Updated ${updatedCount} satellites (main thread fallback)`);
  }

  private startTracking() {
    let lastUpdate = 0;
    let lastFullUpdate = 0;
    
    const FULL_UPDATE_INTERVAL = 3000; // Reduced to 0.33fps for background updates
    
    const updatePositions = () => {
      const now = Date.now();
      
      // Update performance monitoring
      this.performanceManager.updateFrameRate();
      
      // Skip position updates if paused, but continue the animation loop
      const UPDATE_INTERVAL = this.performanceManager.getUpdateInterval();
      if (!this.isPaused && now - lastUpdate >= UPDATE_INTERVAL) {
        // Get current map view bounds for performance optimization
        const bounds = this.map.getBounds();
        const zoom = this.map.getZoom();
        
        // Use worker-based batch updating for performance
        this.processSatelliteUpdates(bounds, zoom, now, lastFullUpdate, FULL_UPDATE_INTERVAL, UPDATE_INTERVAL);

        if (now - lastFullUpdate >= FULL_UPDATE_INTERVAL) {
          lastFullUpdate = now;
        }

        lastUpdate = now;
      }
      
      // Continue following satellite even when paused
      if (!this.isPaused) {
        this.updateFollowing();
      }
      
      // Performance monitoring handled by PerformanceManager
      
      this.animationId = requestAnimationFrame(updatePositions);
    };

    updatePositions();
  }

  private isInBounds(position: LngLat, bounds: any): boolean {
    return position.lng >= bounds.getWest() && 
           position.lng <= bounds.getEast() && 
           position.lat >= bounds.getSouth() && 
           position.lat <= bounds.getNorth();
  }


  private updateFollowing() {
    // Tracking is now handled by simple interval in startSimpleTracking()
  }

  private setupSearchFunctionality() {
    const searchInput = document.getElementById('satellite-search') as HTMLInputElement;
    const searchResults = document.getElementById('search-results') as HTMLDivElement;
    
    if (!searchInput || !searchResults) {
      console.warn('⚠️ Search elements not found');
      return;
    }
        
    searchInput.addEventListener('input', (e) => {
      const query = (e.target as HTMLInputElement).value.toLowerCase().trim();
      this.performSearch(query, searchResults);
    });
    
    document.addEventListener('click', (e) => {
      if (!searchInput.contains(e.target as Node) && !searchResults.contains(e.target as Node)) {
        searchResults.innerHTML = '';
      }
    });
  }
  
  private performSearch(query: string, resultsContainer: HTMLDivElement) {
    resultsContainer.innerHTML = '';
    
    if (query.length < 2) return;
        
    const matches = Array.from(this.satellites.values())
      .filter(satellite => 
        satellite.name.toLowerCase().includes(query) ||
        satellite.id.toLowerCase().includes(query) ||
        satellite.type.toLowerCase().includes(query)
      )
      .sort((a, b) => a.name.localeCompare(b.name))
      .slice(0, 10);
    
    matches.forEach(satellite => {
      const resultDiv = document.createElement('div');
      resultDiv.className = 'search-result';
      if (this.followingSatellite === satellite.id) {
        resultDiv.className += ' following';
      }
      
      resultDiv.innerHTML = `
        <div><strong>${satellite.name}</strong></div>
        <div style="font-size: 11px; color: #ccc;">
          ${satellite.type} | ${satellite.dimensions.length}×${satellite.dimensions.width}×${satellite.dimensions.height}m | Alt: ${satellite.altitude.toFixed(0)}km
        </div>
        <div style="font-size: 10px; color: #aaa;">
          ${satellite.position.lat.toFixed(2)}°, ${satellite.position.lng.toFixed(2)}°
        </div>
      `;
      
      resultDiv.addEventListener('click', () => {
        this.selectSatelliteFromSearch(satellite.id);
        resultsContainer.innerHTML = '';
        (document.getElementById('satellite-search') as HTMLInputElement).value = satellite.name;
      });
      
      resultsContainer.appendChild(resultDiv);
    });
    
    if (matches.length === 0 && query.length >= 2) {
      resultsContainer.innerHTML = '<div style="padding: 8px; color: #999;">No satellites found</div>';
    }
  }
  
  private selectSatelliteFromSearch(satelliteId: string) {
    const satellite = this.satellites.get(satelliteId);
    if (satellite) {
      this.followingSatellite = satelliteId;
      this.map.flyTo({
        center: [satellite.position.lng, satellite.position.lat],
        zoom: 5, // Zoom to level 5 when selecting from search
        duration: 2000,
        essential: true
      });
      
      this.showMessage(`🎯 Following ${satellite.name}`, 'success');
      this.showSatelliteInfo(satellite);
    }
  }

  getSatellites(): Map<string, SatelliteData> {
    return this.satellites;
  }

  stop() {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
    if (this.satelliteWorker) {
      this.satelliteWorker.terminate();
      this.satelliteWorker = null;
    }
    if (this.deck) {
      this.deck.finalize();
    }
  }
}