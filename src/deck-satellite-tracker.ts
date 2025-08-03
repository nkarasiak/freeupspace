import { Deck } from '@deck.gl/core';
import { ScatterplotLayer, IconLayer } from '@deck.gl/layers';
import { Map as MapLibreMap, LngLat } from 'maplibre-gl';
import * as satellite from 'satellite.js';
import { SATELLITE_CONFIGS_WITH_STARLINK } from './satellite-config';
import { PerformanceManager } from './performance-manager';
import { LODManager, ViewportInfo, SatelliteForLOD } from './lod-manager';
import { OrbitalInterpolator, SatellitePosition } from './orbital-interpolator';

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
  private readonly POSITION_CACHE_TTL = 2000; // Cache positions for 2 seconds (better responsiveness)
  
  // Layer update optimization
  private lastLayerUpdateZoom = -1;
  private lastLayerUpdateBounds: any = null;
  private layerUpdateThrottle = 0;
  private readonly LAYER_UPDATE_THROTTLE = 33; // ~30fps layer updates for smooth panning
  
  // Performance optimizers
  private performanceManager = new PerformanceManager();
  private lodManager = new LODManager();
  private satelliteWorker: Worker | null = null;
  private orbitalInterpolator = new OrbitalInterpolator();
  
  // Satellite type filters
  private enabledSatelliteTypes = new Set<string>([
    'scientific', 'communication', 'earth-observation', 'weather', 'navigation'
  ]);
  
  // Satellite size scaling
  private satelliteSizeMultiplier = 1.0; // Default size multiplier for all satellites
  private trackedSatelliteSizeMultiplier = 1.0; // Size multiplier for tracked satellite only
  private readonly MIN_SIZE_MULTIPLIER = 0.1; // 10% of original size
  private readonly MAX_SIZE_MULTIPLIER = 5.0; // 500% of original size
  
  // Cockpit visibility
  private isCockpitVisible = true;

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
    
    // Setup search and filters after satellites are loaded
    setTimeout(() => {
      this.setupSearchFunctionality();
      this.setupFilterFunctionality();
      this.setupKeyboardShortcuts();
      this.setupCockpitToggle();
    }, 100);
  }

  private initializeWorker() {
    try {
      // Create satellite calculation worker - using importScripts for browser compatibility
      const workerBlob = new Blob([`
        // Web Worker for satellite position calculations
        importScripts('https://unpkg.com/satellite.js@5.0.0/dist/satellite.min.js');

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
              satrec = self.satellite.twoline2satrec(tle1, tle2);
              satelliteRecords.set(cacheKey, satrec);
            }
            
            const currentTime = new Date(timestamp);
            const positionAndVelocity = self.satellite.propagate(satrec, currentTime);
            
            if (positionAndVelocity.position && typeof positionAndVelocity.position !== 'boolean') {
              const gmst = self.satellite.gstime(currentTime);
              const positionGd = self.satellite.eciToGeodetic(positionAndVelocity.position, gmst);
              
              const velocity = positionAndVelocity.velocity && typeof positionAndVelocity.velocity !== 'boolean' ? 
                Math.sqrt(
                  Math.pow(positionAndVelocity.velocity.x, 2) + 
                  Math.pow(positionAndVelocity.velocity.y, 2) + 
                  Math.pow(positionAndVelocity.velocity.z, 2)
                ) : 0;
              
              return {
                id,
                longitude: self.satellite.degreesLong(positionGd.longitude),
                latitude: self.satellite.degreesLat(positionGd.latitude),
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
    
    // Check cache first if satellite ID is provided, but SKIP cache for followed satellite
    if (satelliteId && this.followingSatellite !== satelliteId) {
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
        
        // Add to interpolator for smooth movement
        const satellitePos: SatellitePosition = {
          longitude: result.longitude,
          latitude: result.latitude,
          altitude: result.altitude,
          velocity: result.velocity,
          timestamp: now
        };
        this.orbitalInterpolator.addPosition(satelliteId, satellitePos);
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
    
    // Convert satellites to LOD format and apply type filters
    const satellitesForLOD: SatelliteForLOD[] = Array.from(this.satellites.values())
      .filter(sat => this.enabledSatelliteTypes.has(sat.type)) // Apply type filter
      .map(sat => ({
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
        const baseSize = this.lodManager.getCircleSize(lodSat, zoom, 2); // Use small base size for circles
        // Apply tracked satellite size multiplier if this is the followed satellite
        const sizeMultiplier = this.followingSatellite === lodSat.id ? 
          this.trackedSatelliteSizeMultiplier : this.satelliteSizeMultiplier;
        const size = baseSize * sizeMultiplier;
        
        // Use interpolated position for smoother movement if available
        const smoothPos = this.getSmoothSatellitePosition(lodSat.id);
        const lng = smoothPos ? smoothPos.longitude : sat.position.lng;
        const lat = smoothPos ? smoothPos.latitude : sat.position.lat;
        const altitude = smoothPos ? smoothPos.altitude : sat.altitude;
        const velocity = smoothPos ? smoothPos.velocity : sat.velocity;
        
        return {
          position: [lng, lat, 0] as [number, number, number],
          id: sat.id,
          name: sat.name,
          type: sat.type,
          altitude: altitude,
          velocity: velocity,
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
      if (satellite && this.enabledSatelliteTypes.has(satellite.type)) { // Apply type filter
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
          const baseIconSize = this.getSatelliteImageSize(zoom, satellite.dimensions.width, satelliteId);
          // Apply tracked satellite size multiplier if this is the followed satellite
          const sizeMultiplier = this.followingSatellite === satelliteId ? 
            this.trackedSatelliteSizeMultiplier : this.satelliteSizeMultiplier;
          const iconSize = baseIconSize * sizeMultiplier;
          
          // Use interpolated position for smoother icon movement
          const smoothPos = this.getSmoothSatellitePosition(satelliteId);
          const lng = smoothPos ? smoothPos.longitude : satellite.position.lng;
          const lat = smoothPos ? smoothPos.latitude : satellite.position.lat;
          const altitude = smoothPos ? smoothPos.altitude : satellite.altitude;
          const velocity = smoothPos ? smoothPos.velocity : satellite.velocity;
            
          const data = {
            position: [lng, lat],
            icon: satelliteId,
            size: iconSize,
            id: satellite.id,
            name: satellite.name,
            type: satellite.type,
            altitude: altitude,
            velocity: velocity
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
    // Reset tracked satellite size when following a new satellite
    this.trackedSatelliteSizeMultiplier = 1.0;
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
    // Reset tracked satellite size when following a new satellite
    this.trackedSatelliteSizeMultiplier = 1.0;
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
    // Use requestAnimationFrame for 60fps smooth camera tracking instead of intervals
    const smoothTrack = () => {
      if (this.followingSatellite) {
        this.updateCameraToFollowedSatellite();
        this.trackingInterval = requestAnimationFrame(smoothTrack);
      }
    };
    this.trackingInterval = requestAnimationFrame(smoothTrack);
  }

  private stopSimpleTracking() {
    if (this.trackingInterval) {
      cancelAnimationFrame(this.trackingInterval);
      this.trackingInterval = null;
    }
  }

  private updateCameraToFollowedSatellite() {
    if (!this.followingSatellite) return;
    
    const satellite = this.satellites.get(this.followingSatellite);
    if (!satellite) return;
    
    // Use interpolated position for smoother tracking
    const smoothPosition = this.getSmoothSatellitePosition(this.followingSatellite);
    if (smoothPosition) {
      // Use jumpTo at 60fps for ultra-smooth tracking - no animation conflicts
      this.map.jumpTo({
        center: [smoothPosition.longitude, smoothPosition.latitude]
      });
      
      // Only log occasionally to avoid spam
      if (Math.random() < 0.01) { // 1% chance per frame
        console.log(`📍 Tracking ${satellite.name} at ${smoothPosition.latitude.toFixed(4)}, ${smoothPosition.longitude.toFixed(4)} (60fps smooth)`);
      }
    } else {
      // Fallback to actual position
      this.map.jumpTo({
        center: [satellite.position.lng, satellite.position.lat]
      });
    }
  }

  // Get smooth interpolated position for a satellite
  private getSmoothSatellitePosition(satelliteId: string) {
    const now = Date.now();
    return this.orbitalInterpolator.getInterpolatedPosition(satelliteId, now);
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
    // Always update followed satellite in main thread for ultra-smooth tracking
    if (this.followingSatellite) {
      const followedSat = this.satellites.get(this.followingSatellite);
      if (followedSat) {
        // Calculate fresh position every frame for followed satellite
        const position = this.calculateSatellitePosition(followedSat.tle1, followedSat.tle2, followedSat.id);
        followedSat.position = new LngLat(position.longitude, position.latitude);
        followedSat.altitude = position.altitude;
        followedSat.velocity = position.velocity;
        
        // Force immediate layer update for followed satellite
        this.updateLayers();
      }
    }
    
    if (!this.satelliteWorker) {
      // Fallback to main thread calculations
      this.processSatelliteUpdatesMainThread(bounds, zoom, now, lastFullUpdate, FULL_UPDATE_INTERVAL, UPDATE_INTERVAL);
      return;
    }

    const isFullUpdate = now - lastFullUpdate >= FULL_UPDATE_INTERVAL;
    const updateRequests: any[] = [];
    
    let satelliteIndex = 0;
    for (const [id, sat] of this.satellites) {
      // Skip followed satellite since we updated it above
      const shouldUpdate = (this.followingSatellite !== id) && (
                          isFullUpdate ||
                          (zoom > 3 && this.isInBounds(sat.position, bounds)));
      
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
    
    // Always update layers after processing
    this.updateLayers();
  }

  private processSatelliteUpdatesMainThread(bounds: any, zoom: number, now: number, lastFullUpdate: number, FULL_UPDATE_INTERVAL: number, UPDATE_INTERVAL: number) {
    // Fallback method using main thread
    let updatedCount = 0;
    let satelliteIndex = 0;
    const isFullUpdate = now - lastFullUpdate >= FULL_UPDATE_INTERVAL;
    
    // First, always update followed satellite
    if (this.followingSatellite) {
      const followedSat = this.satellites.get(this.followingSatellite);
      if (followedSat) {
        const position = this.calculateSatellitePosition(followedSat.tle1, followedSat.tle2, followedSat.id);
        followedSat.position = new LngLat(position.longitude, position.latitude);
        followedSat.altitude = position.altitude;
        followedSat.velocity = position.velocity;
        updatedCount++;
      }
    }
    
    for (const [id, sat] of this.satellites) {
      // Skip followed satellite since we updated it above
      const shouldUpdate = (this.followingSatellite !== id) && (
                          isFullUpdate ||
                          (zoom > 3 && this.isInBounds(sat.position, bounds)));
      
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
    
    const FULL_UPDATE_INTERVAL = 1000; // 1fps for background updates (more frequent for better interpolation)
    
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
      
      // Cleanup interpolator data periodically (every 60 seconds)
      if (now % 60000 < UPDATE_INTERVAL) {
        this.orbitalInterpolator.cleanup();
      }
      
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
        // Apply type filter first
        this.enabledSatelliteTypes.has(satellite.type) &&
        // Then apply search filter
        (satellite.name.toLowerCase().includes(query) ||
        satellite.id.toLowerCase().includes(query) ||
        satellite.type.toLowerCase().includes(query))
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

  private setupFilterFunctionality() {
    const filterCheckboxes = {
      'scientific': document.getElementById('filter-scientific') as HTMLInputElement,
      'communication': document.getElementById('filter-communication') as HTMLInputElement,
      'earth-observation': document.getElementById('filter-earth-observation') as HTMLInputElement,
      'weather': document.getElementById('filter-weather') as HTMLInputElement,
      'navigation': document.getElementById('filter-navigation') as HTMLInputElement
    };

    const countElements = {
      'scientific': document.getElementById('count-scientific') as HTMLElement,
      'communication': document.getElementById('count-communication') as HTMLElement,
      'earth-observation': document.getElementById('count-earth-observation') as HTMLElement,
      'weather': document.getElementById('count-weather') as HTMLElement,
      'navigation': document.getElementById('count-navigation') as HTMLElement
    };

    // Setup event listeners for filter checkboxes
    Object.entries(filterCheckboxes).forEach(([type, checkbox]) => {
      if (checkbox) {
        checkbox.addEventListener('change', (e) => {
          const enabled = (e.target as HTMLInputElement).checked;
          this.setSatelliteTypeEnabled(type, enabled);
          console.log(`🔧 ${type} satellites ${enabled ? 'enabled' : 'disabled'}`);
        });
      }
    });

    // Update counts periodically
    const updateCounts = () => {
      const counts = this.getSatelliteCountsByType();
      Object.entries(countElements).forEach(([type, element]) => {
        if (element) {
          element.textContent = counts[type]?.toString() || '0';
        }
      });
    };

    // Update counts initially and every 5 seconds
    updateCounts();
    setInterval(updateCounts, 5000);
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

  // Satellite type filtering methods
  setSatelliteTypeEnabled(type: string, enabled: boolean) {
    if (enabled) {
      this.enabledSatelliteTypes.add(type);
    } else {
      this.enabledSatelliteTypes.delete(type);
    }
    this.updateLayers(); // Refresh display
  }

  isSatelliteTypeEnabled(type: string): boolean {
    return this.enabledSatelliteTypes.has(type);
  }

  getEnabledSatelliteTypes(): Set<string> {
    return new Set(this.enabledSatelliteTypes);
  }

  // Get satellite counts by type
  getSatelliteCountsByType(): Record<string, number> {
    const counts: Record<string, number> = {
      'scientific': 0,
      'communication': 0,
      'earth-observation': 0,
      'weather': 0,
      'navigation': 0
    };

    for (const satellite of this.satellites.values()) {
      if (counts.hasOwnProperty(satellite.type)) {
        counts[satellite.type]++;
      }
    }

    return counts;
  }

  // Satellite size control methods
  increaseSatelliteSize() {
    if (this.followingSatellite) {
      this.trackedSatelliteSizeMultiplier = Math.min(this.trackedSatelliteSizeMultiplier * 1.25, this.MAX_SIZE_MULTIPLIER);
      this.updateLayers();
      const satellite = this.satellites.get(this.followingSatellite);
      this.showMessage(`🔍 ${satellite?.name || 'Tracked satellite'} size: ${(this.trackedSatelliteSizeMultiplier * 100).toFixed(0)}%`, 'info');
    } else {
      this.showMessage(`🎯 Track a satellite first to resize it (search and click)`, 'warning');
    }
  }

  decreaseSatelliteSize() {
    if (this.followingSatellite) {
      this.trackedSatelliteSizeMultiplier = Math.max(this.trackedSatelliteSizeMultiplier / 1.25, this.MIN_SIZE_MULTIPLIER);
      this.updateLayers();
      const satellite = this.satellites.get(this.followingSatellite);
      this.showMessage(`🔍 ${satellite?.name || 'Tracked satellite'} size: ${(this.trackedSatelliteSizeMultiplier * 100).toFixed(0)}%`, 'info');
    } else {
      this.showMessage(`🎯 Track a satellite first to resize it (search and click)`, 'warning');
    }
  }

  resetSatelliteSize() {
    if (this.followingSatellite) {
      this.trackedSatelliteSizeMultiplier = 1.0;
      this.updateLayers();
      const satellite = this.satellites.get(this.followingSatellite);
      this.showMessage(`🔍 ${satellite?.name || 'Tracked satellite'} size reset to 100%`, 'info');
    } else {
      this.showMessage(`🎯 Track a satellite first to resize it (search and click)`, 'warning');
    }
  }

  getSatelliteSizeMultiplier(): number {
    return this.satelliteSizeMultiplier;
  }

  private setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
      // Only respond to shortcuts if no input elements are focused
      if (document.activeElement?.tagName === 'INPUT') {
        return;
      }

      switch (e.key) {
        case 'ArrowUp':
          if (e.shiftKey) {
            e.preventDefault();
            this.increaseSatelliteSize();
          }
          break;
        
        case 'ArrowDown':
          if (e.shiftKey) {
            e.preventDefault();
            this.decreaseSatelliteSize();
          }
          break;
        
        case 'r':
        case 'R':
          if (!e.ctrlKey && !e.metaKey) {
            e.preventDefault();
            this.resetSatelliteSize();
          }
          break;
        
        case 'c':
        case 'C':
          if (!e.ctrlKey && !e.metaKey) {
            e.preventDefault();
            this.toggleCockpit();
          }
          break;
        
        case 'h':
        case 'H':
          if (!e.ctrlKey && !e.metaKey) {
            e.preventDefault();
            this.showKeyboardHelp();
          }
          break;
      }
    });

    console.log('⌨️ Keyboard shortcuts enabled: Shift+↑/↓ to resize tracked satellite, R to reset, C to hide cockpit, H for help');
  }

  private showKeyboardHelp() {
    const helpText = `
🔧 TRACKED SATELLITE SIZE SHORTCUTS:

Shift+↑    Increase tracked satellite size
Shift+↓    Decrease tracked satellite size  
R          Reset tracked satellite to normal size

🎛️ INTERFACE CONTROLS:
C          Hide/show cockpit
H          Show this help

📍 CAMERA CONTROLS:
Ctrl+Drag  Adjust pitch angle
Click      Select/follow satellite
+/-        Zoom map (normal behavior)

📡 NOTE: First track a satellite (search & click) to resize it!
    `;

    const helpDiv = document.createElement('div');
    helpDiv.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      z-index: 3000;
      padding: 20px;
      border-radius: 12px;
      background: rgba(0, 0, 0, 0.95);
      color: white;
      font-family: 'Inter', monospace;
      font-size: 13px;
      white-space: pre-line;
      border: 2px solid #00d4ff;
      box-shadow: 0 10px 30px rgba(0, 212, 255, 0.3);
      max-width: 300px;
      text-align: left;
    `;

    helpDiv.textContent = helpText;
    document.body.appendChild(helpDiv);

    // Remove help after 5 seconds or on click
    const removeHelp = () => helpDiv.remove();
    setTimeout(removeHelp, 5000);
    helpDiv.addEventListener('click', removeHelp);
  }

  private setupCockpitToggle() {
    const toggleButton = document.getElementById('cockpit-toggle');
    const showButton = document.getElementById('show-cockpit-btn');
    
    if (toggleButton) {
      toggleButton.addEventListener('click', () => {
        this.toggleCockpit();
      });
    }
    
    if (showButton) {
      showButton.addEventListener('click', () => {
        this.toggleCockpit();
      });
    }
  }

  toggleCockpit() {
    this.isCockpitVisible = !this.isCockpitVisible;
    const cockpitPanel = document.getElementById('cockpit-panel');
    const showButton = document.getElementById('show-cockpit-btn');
    
    if (cockpitPanel && showButton) {
      if (this.isCockpitVisible) {
        cockpitPanel.classList.remove('hidden');
        showButton.style.display = 'none';
        this.showMessage('🎛️ Mission Control active', 'info');
      } else {
        cockpitPanel.classList.add('hidden');
        showButton.style.display = 'flex';
        this.showMessage('🎛️ Mission Control hidden - Press C to show', 'info');
      }
    }
  }

  isCockpitHidden(): boolean {
    return !this.isCockpitVisible;
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