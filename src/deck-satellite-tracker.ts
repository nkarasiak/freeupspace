import { Deck } from '@deck.gl/core';
import { ScatterplotLayer, PathLayer, IconLayer } from '@deck.gl/layers';
import { Map as MapLibreMap, LngLat } from 'maplibre-gl';
import * as satellite from 'satellite.js';
import { SATELLITE_CONFIGS_WITH_STARLINK } from './satellite-config';

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
  private isZooming = false;
  private showOrbits = false;
  private satelliteIcons: Map<string, any> = new Map();
  private onTrackingChangeCallback?: () => void;
  
  // Performance optimization: cache satellite records and positions
  private satelliteRecords: Map<string, any> = new Map();
  private positionCache: Map<string, {position: any, timestamp: number}> = new Map();
  private readonly POSITION_CACHE_TTL = 5000; // Cache positions for 5 seconds
  
  // Performance monitoring
  private frameCount = 0;
  private lastFPSUpdate = 0;

  constructor(map: MapLibreMap) {
    this.map = map;
    this.initializeDeck();
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

  private getSizeForZoom(zoom: number, baseSize: number): number {
    // Circle sizing for satellites without images
    if (zoom <= 5) {
      // Small dot until zoom 5
      return 2; // Very small dot
    } else if (zoom === 6) {
      // Zoom 6: width * zoom * 2
      return baseSize * zoom * 2;
    } else if (zoom >= 8) {
      // Zoom 8+: width * zoom * 4
      return baseSize * zoom * 4;
    } else {
      // Zoom 7: interpolate between zoom 6 and 8 formulas
      const zoom6Size = baseSize * 6 * 2; // 12 * baseSize
      const zoom8Size = baseSize * 8 * 4; // 32 * baseSize
      const progress = (zoom - 6) / (8 - 6); // 0 to 1 for zoom 6 to 8
      return zoom6Size + (progress * (zoom8Size - zoom6Size));
    }
  }

  private generateSatellitePoints(): SatellitePointData[] {
    const zoom = this.map.getZoom();
    const bounds = this.map.getBounds();
    
    // Level of Detail (LOD) rendering for performance - More aggressive
    const getLODSkip = (zoom: number): number => {
      if (zoom <= 1) return 50; // Show every 50th satellite at very low zoom
      if (zoom <= 2) return 25; // Show every 25th satellite at low zoom
      if (zoom <= 3) return 10; // Show every 10th satellite at medium zoom
      if (zoom <= 4) return 5;  // Show every 5th satellite
      if (zoom <= 5) return 3;  // Show every 3rd satellite
      if (zoom <= 6) return 2;  // Show every 2nd satellite
      return 1; // Show all satellites only at very high zoom
    };
    
    const lodSkip = getLODSkip(zoom);
    
    // Exclude satellites that have custom images from circle rendering
    const satellitesWithImages = SATELLITE_CONFIGS_WITH_STARLINK.filter(sat => sat.image).map(sat => sat.id);
    
    const points = Array.from(this.satellites.values())
      .filter((sat, index) => {
        // Always show followed satellite and ISS
        if (this.followingSatellite === sat.id || sat.id === 'iss') return false; // ISS handled separately
        
        // LOD filtering: skip satellites based on zoom level
        if (sat.type === 'communication' && lodSkip > 1 && index % lodSkip !== 0) {
          return false;
        }
        
        // Viewport culling: only show satellites in or near the current view
        if (zoom < 4) {
          const margin = zoom < 2 ? 60 : 30; // Larger margin at very low zoom
          const expandedBounds = {
            getWest: () => bounds.getWest() - margin,
            getEast: () => bounds.getEast() + margin,
            getSouth: () => bounds.getSouth() - margin/2,
            getNorth: () => bounds.getNorth() + margin/2
          };
          if (!this.isInBounds(sat.position, expandedBounds)) {
            return false;
          }
        }
        
        // Image satellite filtering
        if (satellitesWithImages.includes(sat.id)) {
          return zoom < 4; // Show as circles only at low zoom
        }
        
        return true; // Show non-image satellites
      })
      .map(sat => ({
        position: [sat.position.lng, sat.position.lat, 0] as [number, number, number],
        id: sat.id,
        name: sat.name,
        type: sat.type,
        altitude: sat.altitude,
        velocity: sat.velocity,
        length: sat.dimensions.length,
        color: this.getColorForType(sat.type),
        size: this.getSizeForZoom(zoom, sat.dimensions.length * 2)
      }));
    
    console.log(`🎯 Rendering ${points.length} satellites (LOD skip: ${lodSkip}, zoom: ${zoom.toFixed(1)})`);
    return points;
  }

  private generateSatelliteIconData(): any[] {
    const zoom = this.map.getZoom();
    const iconData: any[] = [];

    // Generate icon data for satellites with loaded icons
    this.satelliteIcons.forEach((_, satelliteId) => {
      const satellite = this.satellites.get(satelliteId);
      if (satellite) {
        // ISS shows as image from zoom 0
        // Other satellites with images only show as image at zoom >= 4
        const shouldShowIcon = satelliteId === 'iss' || zoom >= 4;
        
        if (shouldShowIcon) {
          // Different formulas: ISS uses zoom*width/3, others use zoom*width
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
    return iconData;
  }


  private getSatelliteImageSize(zoom: number, satelliteWidth: number, satelliteId: string): number {
    // ISS: zoom*width/3 (keeps ISS manageable size)
    // All others: zoom*width*4 (very large, highly visible)
    const effectiveZoom = Math.max(zoom, 0.5);
    
    let size: number;
    if (satelliteId === 'iss') {
      size = (effectiveZoom * satelliteWidth) / 3;
    } else {
      size = effectiveZoom * satelliteWidth * 4;
    }
        // Minimum size to ensure visibility
    return Math.max(size, 4);
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

  private generateOrbitPath(satelliteId: string): [number, number][] {
    const sat = this.satellites.get(satelliteId);
    if (!sat) return [];

    const satrec = sat.tle1 && sat.tle2 ? 
      satellite.twoline2satrec(sat.tle1, sat.tle2) : null;
    if (!satrec) return [];

    const points: [number, number][] = [];
    const now = new Date();
    const orbitPeriod = 90 * 60 * 1000; // 90 minutes in milliseconds
    const steps = 100;

    for (let i = 0; i < steps; i++) {
      const time = new Date(now.getTime() + (i * orbitPeriod / steps));
      const positionAndVelocity = satellite.propagate(satrec, time);
      
      if (positionAndVelocity.position && typeof positionAndVelocity.position !== 'boolean') {
        const gmst = satellite.gstime(time);
        const positionGd = satellite.eciToGeodetic(positionAndVelocity.position, gmst);
        points.push([
          satellite.degreesLong(positionGd.longitude),
          satellite.degreesLat(positionGd.latitude)
        ]);
      }
    }

    return points;
  }

  private updateLayers() {
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

    // Add icon layers for satellites with images
    this.satelliteIcons.forEach((iconMapping, satelliteId) => {
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
    });

    // Add orbit paths for followed satellite
    if (this.followingSatellite && this.showOrbits) {
      const orbitPath = this.generateOrbitPath(this.followingSatellite);
      if (orbitPath.length > 0) {
        layers.push(
          new PathLayer({
            id: 'orbit-path',
            data: [{ path: orbitPath, color: [255, 255, 0, 128] }],
            getPath: (d: any) => d.path,
            getColor: (d: any) => d.color,
            getWidth: 3,
            widthUnits: 'pixels',
            pickable: false
          })
        );
      }
    }

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
    this.updateLayers(); // Update layers to hide orbit path
    
    // Notify about tracking change
    if (this.onTrackingChangeCallback) {
      this.onTrackingChangeCallback();
    }
  }

  toggleOrbits() {
    this.showOrbits = !this.showOrbits;
    this.updateLayers();
    this.showMessage(this.showOrbits ? '🛰️ Orbits shown' : '🛰️ Orbits hidden', 'info');
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

  private startTracking() {
    let lastUpdate = 0;
    let lastFullUpdate = 0;
    const UPDATE_INTERVAL = 200; // Reduced to 5fps for better performance
    const FULL_UPDATE_INTERVAL = 2000; // Reduced to 0.5fps for background updates
    
    const updatePositions = () => {
      const now = Date.now();
      
      if (now - lastUpdate >= UPDATE_INTERVAL) {
        // Get current map view bounds for performance optimization
        const bounds = this.map.getBounds();
        const zoom = this.map.getZoom();
        
        // Only update satellites that are likely visible or being followed
        let updatedCount = 0;
        let satelliteIndex = 0;
        for (const [id, sat] of this.satellites) {
          // Staggered updates: spread computation over multiple frames
          const isFullUpdate = now - lastFullUpdate >= FULL_UPDATE_INTERVAL;
          const shouldUpdate = this.followingSatellite === id || 
                             isFullUpdate ||
                             (zoom > 3 && this.isInBounds(sat.position, bounds));
          
          // For full updates, only update a subset each frame to spread load
          if (isFullUpdate && this.followingSatellite !== id) {
            const frameOffset = Math.floor(now / UPDATE_INTERVAL) % 20; // Spread over 20 frames instead of 10
            if (satelliteIndex % 20 !== frameOffset) {
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

        if (now - lastFullUpdate >= FULL_UPDATE_INTERVAL) {
          lastFullUpdate = now;
          console.log(`🛰️ Updated ${updatedCount} satellites (full update)`);
        }

        this.updateLayers();
        lastUpdate = now;
      }
      
      this.updateFollowing();
      
      // Performance monitoring
      this.frameCount++;
      if (now - this.lastFPSUpdate > 5000) { // Every 5 seconds
        const fps = (this.frameCount * 1000) / (now - this.lastFPSUpdate);
        console.log(`⚡ Performance: ${fps.toFixed(1)} FPS, ${this.satellites.size} satellites`);
        this.frameCount = 0;
        this.lastFPSUpdate = now;
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
    if (this.followingSatellite && !this.isZooming) {
      const satellite = this.satellites.get(this.followingSatellite);
      if (satellite) {
        const currentCenter = this.map.getCenter();
        const threshold = 0.01; // Small threshold for smooth updates
        const deltaLng = Math.abs(currentCenter.lng - satellite.position.lng);
        const deltaLat = Math.abs(currentCenter.lat - satellite.position.lat);
        
        if (deltaLng > threshold || deltaLat > threshold) {
          // Use easeTo for smooth camera movement at 25fps
          this.map.easeTo({
            center: [satellite.position.lng, satellite.position.lat],
            duration: 40, // 40ms for 25fps
            easing: (t) => t // Linear easing for smooth continuous movement
          });
        }
      }
    }
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
      this.isZooming = true;
      
      this.map.flyTo({
        center: [satellite.position.lng, satellite.position.lat],
        zoom: 5, // Zoom to level 5 when selecting from search
        duration: 2000,
        essential: true
      });
      
      setTimeout(() => {
        this.isZooming = false;
      }, 2500);
      
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
    if (this.deck) {
      this.deck.finalize();
    }
  }
}