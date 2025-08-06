import { ScatterplotLayer, IconLayer, ArcLayer } from '@deck.gl/layers';
import { Map as MapLibreMap } from 'maplibre-gl';
import * as satellite from 'satellite.js';
import { SatelliteData } from '../types/satellite';
import { SatellitePointData } from '../deck-satellite-tracker';
import { LODManager, ViewportInfo, SatelliteForLOD } from '../lod-manager';
import { PerformanceManager } from '../performance-manager';
import { SmoothTracker } from '../smooth-tracker';
import { OrbitalInterpolator } from '../orbital-interpolator';
import { 
  MapBounds, 
  SatelliteIconMapping, 
  LayerIconData, 
  LayerOrbitData, 
  DeckGLLayer,
 
} from '../types/rendering';
import { SatelliteFilters } from '../utils/satellite-filters';

export interface LayerUpdateResult {
  layers: DeckGLLayer[];
  pointCount: number;
  iconCount: number;
}

export class SatelliteRenderer {
  private lodManager: LODManager;
  private performanceManager: PerformanceManager;
  private smoothTracker: SmoothTracker;
  private _orbitalInterpolator: OrbitalInterpolator;
  
  constructor(
    lodManager: LODManager,
    performanceManager: PerformanceManager,
    smoothTracker: SmoothTracker,
    orbitalInterpolator: OrbitalInterpolator
  ) {
    this.lodManager = lodManager;
    this.performanceManager = performanceManager;
    this.smoothTracker = smoothTracker;
    this._orbitalInterpolator = orbitalInterpolator;
    // OrbitalInterpolator reserved for future position prediction enhancements
    void this._orbitalInterpolator;
  }

  generateSatellitePoints(
    satellites: Map<string, SatelliteData>,
    map: MapLibreMap,
    followingSatellite: string | null,
    showTrackedSatelliteOnly: boolean,
    enabledSatelliteTypes: Set<string>,
    satelliteIcons: Map<string, any>,
    satelliteSizeMultiplier: number,
    trackedSatelliteSizeMultiplier: number,
    getSmoothSatellitePosition: (satelliteId: string) => any
  ): SatellitePointData[] {
    const zoom = map.getZoom();
    
    // Fast path for single satellite tracking
    if (followingSatellite && showTrackedSatelliteOnly) {
      const trackedSat = satellites.get(followingSatellite);
      if (trackedSat && trackedSat.position) {
        // Skip if this satellite has an image AND the icon is loaded
        if (trackedSat.image && satelliteIcons.has(followingSatellite)) {
          return [];
        }
        
        const baseSize = 2;
        const size = baseSize * trackedSatelliteSizeMultiplier;
        
        // Use smooth position if available
        let position = trackedSat.position;
        let altitude = trackedSat.altitude;
        let velocity = trackedSat.velocity;
        
        const smoothPos = this.smoothTracker.getPredictedPosition();
        if (smoothPos) {
          position = { lng: smoothPos.longitude, lat: smoothPos.latitude } as any;
          altitude = smoothPos.altitude;
          velocity = smoothPos.velocity;
        }
        
        return [{
          position: [position.lng, position.lat, altitude],
          size,
          color: [255, 255, 0, 255], // Yellow for tracked satellite
          id: trackedSat.id,
          name: trackedSat.name,
          type: trackedSat.type,
          altitude: altitude,
          velocity: velocity,
          length: 0
        }];
      }
      return [];
    }
    
    const bounds = map.getBounds();
    
    // Enhanced performance management
    const maxSatellites = this.performanceManager.getMaxSatellites();
    const performanceSkip = this.performanceManager.getLODSkip(zoom);
    
    // Viewport culling
    const margin = this.getViewportMargin(zoom);
    const expandedBounds: MapBounds = {
      getWest: () => bounds.getWest() - margin,
      getEast: () => bounds.getEast() + margin,
      getSouth: () => bounds.getSouth() - margin/2,
      getNorth: () => bounds.getNorth() + margin/2,
      getCenter: () => bounds.getCenter()
    };

    const filteredSatellites = SatelliteFilters.forRendering(
      Array.from(satellites.values()),
      enabledSatelliteTypes,
      followingSatellite,
      showTrackedSatelliteOnly,
      expandedBounds,
      0 // margin already applied to expandedBounds
    );

    const satellitesForLOD: SatelliteForLOD[] = filteredSatellites.map(sat => ({
      id: sat.id,
      position: sat.position,
      type: sat.type,
      dimensions: sat.dimensions,
      scaleFactor: sat.scaleFactor,
      isFollowed: followingSatellite === sat.id,
      hasImage: true
    }));
    
    // Apply LOD filtering
    const viewport: ViewportInfo = { zoom, bounds };
    const lodFilteredSatellites = this.lodManager.filterSatellitesForLOD(
      satellitesForLOD,
      viewport,
      performanceSkip,
      Math.min(maxSatellites, 1000)
    );
    
    // Filter out satellites that should show as icons
    const pointSatellites = lodFilteredSatellites.filter(lodSat => {
      return !this.lodManager.shouldShowIcon(lodSat, zoom);
    });
    
    const points = pointSatellites
      .map(lodSat => {
        const sat = satellites.get(lodSat.id)!;
        const baseSize = this.lodManager.getCircleSize(lodSat, zoom, 2);
        
        const sizeMultiplier = followingSatellite === lodSat.id ? 
          trackedSatelliteSizeMultiplier : satelliteSizeMultiplier;
        const size = baseSize * sizeMultiplier;
        
        // Use smooth position
        let smoothPos = null;
        if (followingSatellite === lodSat.id && this.smoothTracker.isTracking()) {
          smoothPos = this.smoothTracker.getPredictedPosition();
        } else {
          smoothPos = getSmoothSatellitePosition(lodSat.id);
        }
        
        const lng = smoothPos ? smoothPos.longitude : sat.position.lng;
        const lat = smoothPos ? smoothPos.latitude : sat.position.lat;
        const altitude = smoothPos ? smoothPos.altitude : sat.altitude;
        const velocity = smoothPos ? smoothPos.velocity : sat.velocity;
        
        const scaledAltitude = Math.sqrt(altitude) * 5000;
        
        return {
          position: [lng, lat, scaledAltitude] as [number, number, number],
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
    
    return points;
  }

  generateSatelliteIconData(
    satellites: Map<string, SatelliteData>,
    map: MapLibreMap,
    followingSatellite: string | null,
    showTrackedSatelliteOnly: boolean,
    enabledSatelliteTypes: Set<string>,
    satelliteIcons: Map<string, SatelliteIconMapping>,
    satelliteSizeMultiplier: number,
    trackedSatelliteSizeMultiplier: number,
    getSmoothSatellitePosition: (satelliteId: string) => any
  ): LayerIconData[] {
    // Fast path for single satellite tracking
    if (followingSatellite && showTrackedSatelliteOnly) {
      const trackedSat = satellites.get(followingSatellite);
      if (trackedSat && trackedSat.position && satelliteIcons.has(followingSatellite)) {
        // Use smooth position if available
        let position = trackedSat.position;
        let altitude = trackedSat.altitude;
        
        const smoothPos = this.smoothTracker.getPredictedPosition();
        if (smoothPos) {
          position = { lng: smoothPos.longitude, lat: smoothPos.latitude } as any;
          altitude = smoothPos.altitude;
        }
        
        // Calculate proper size
        const zoom = map.getZoom();
        const baseIconSize = this.getSatelliteImageSize(zoom, trackedSat.dimensions.width, followingSatellite, trackedSat.scaleFactor, followingSatellite);
        const iconSize = baseIconSize * trackedSatelliteSizeMultiplier;
        
        return [{
          position: [position.lng, position.lat, altitude],
          icon: followingSatellite,
          size: iconSize,
          id: trackedSat.id,
          name: trackedSat.name,
          type: trackedSat.type,
          altitude: altitude,
          velocity: trackedSat.velocity
        }];
      }
      return [];
    }

    const zoom = map.getZoom();
    const bounds = map.getBounds();
    const iconData: LayerIconData[] = [];

    // Performance optimization: viewport culling
    const margin = this.getViewportMargin(zoom);
    const expandedBounds: MapBounds = {
      getWest: () => bounds.getWest() - margin,
      getEast: () => bounds.getEast() + margin,
      getSouth: () => bounds.getSouth() - margin/2,
      getNorth: () => bounds.getNorth() + margin/2,
      getCenter: () => bounds.getCenter()
    };

    // Limit total icons rendered for performance
    const maxIconsToRender = zoom <= 4 ? 100 : 200;
    let iconCount = 0;

    // Generate icon data for satellites with loaded icons
    satelliteIcons.forEach((_, satelliteId) => {
      if (iconCount >= maxIconsToRender) {
        return;
      }
      
      const satellite = satellites.get(satelliteId);
      if (!satellite || !enabledSatelliteTypes.has(satellite.type)) {
        return;
      }

      // If tracking a satellite, show ONLY that satellite icon
      if (followingSatellite && satelliteId !== followingSatellite) {
        return;
      }
        
      // Use centralized icon rendering logic
      const shouldShowIcon = SatelliteFilters.shouldRenderAsIcon(
        satellite,
        new Set(satelliteIcons.keys()),
        zoom,
        followingSatellite
      );
        
      // Viewport culling
      const isInView = followingSatellite === satelliteId || 
                      satelliteId === 'iss' || 
                      this.isInBounds(satellite.position, expandedBounds);
      
      if (shouldShowIcon && isInView) {
        iconCount++;
        const baseIconSize = this.getSatelliteImageSize(zoom, satellite.dimensions.width, satelliteId, satellite.scaleFactor, followingSatellite);
        const sizeMultiplier = followingSatellite === satelliteId ? 
          trackedSatelliteSizeMultiplier : satelliteSizeMultiplier;
        const iconSize = baseIconSize * sizeMultiplier;
        
        // Use smooth position
        let smoothPos = null;
        if (followingSatellite === satelliteId && this.smoothTracker.isTracking()) {
          smoothPos = this.smoothTracker.getPredictedPosition();
        } else {
          smoothPos = getSmoothSatellitePosition(satelliteId);
        }
        
        const lng = smoothPos ? smoothPos.longitude : satellite.position.lng;
        const lat = smoothPos ? smoothPos.latitude : satellite.position.lat;
        const altitude = smoothPos ? smoothPos.altitude : satellite.altitude;
        const velocity = smoothPos ? smoothPos.velocity : satellite.velocity;
          
        const scaledAltitude = Math.sqrt(altitude) * 5000;
        
        iconData.push({
          position: [lng, lat, scaledAltitude],
          icon: satelliteId,
          size: iconSize,
          id: satellite.id,
          name: satellite.name,
          type: satellite.type,
          altitude: altitude,
          velocity: velocity
        });
      }
    });
    
    return iconData;
  }

  generateOrbitPaths(
    satellites: Map<string, SatelliteData>,
    showOrbits: boolean,
    followingSatellite: string | null,
    showTrackedSatelliteOnly: boolean
  ): LayerOrbitData[] {
    if (!showOrbits) return [];
    
    // Fast path for single satellite tracking
    if (followingSatellite && showTrackedSatelliteOnly) {
      const trackedSat = satellites.get(followingSatellite);
      if (trackedSat) {
        const orbitPoints = this.calculateOrbitPath(trackedSat);
        if (orbitPoints && orbitPoints.length > 0) {
          return [{
            path: orbitPoints,
            color: [255, 165, 0, 255], // Orange color for orbit path
            satelliteId: followingSatellite
          }];
        }
      }
      return [];
    }
    
    const orbitData: LayerOrbitData[] = [];
    
    Array.from(satellites.values())
      .filter(sat => sat.type === 'scientific' || followingSatellite === sat.id)
      .forEach(sat => {
        const orbitPoints = this.calculateOrbitPath(sat);
        
        for (let i = 0; i < orbitPoints.length - 1; i++) {
          orbitData.push({
            source: orbitPoints[i],
            target: orbitPoints[i + 1],
            color: this.getColorForType(sat.type),
            satelliteId: sat.id
          });
        }
      });
    
    return orbitData;
  }

  createLayers(
    satellitePoints: SatellitePointData[],
    satelliteIconData: LayerIconData[],
    orbitPaths: LayerOrbitData[],
    satelliteIcons: Map<string, SatelliteIconMapping>,
    followingSatellite: string | null,
    showTrackedSatelliteOnly: boolean
  ): DeckGLLayer[] {
    const layers: DeckGLLayer[] = [
      // Satellite points layer
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
        pickable: false
      })
    ];

    // Add icon layers
    const visibleSatelliteIds = new Set(satelliteIconData.map(d => d.id || d.icon));
    
    if (followingSatellite && showTrackedSatelliteOnly && satelliteIconData.length > 0) {
      const trackedIconMapping = satelliteIcons.get(followingSatellite);
      
      if (trackedIconMapping) {
        layers.push(
          new IconLayer({
            id: `${followingSatellite}-icon`,
            data: satelliteIconData,
            pickable: false,
            iconAtlas: trackedIconMapping.atlas,
            iconMapping: trackedIconMapping.mapping,
            getIcon: (d: any) => d.icon,
            sizeScale: 1,
            getPosition: (d: any) => d.position,
            getSize: (d: any) => d.size,
            getColor: [255, 255, 255, 255]
          })
        );
      }
    } else {
      // Normal handling for multiple satellites
      satelliteIcons.forEach((iconMapping, satelliteId) => {
        if (visibleSatelliteIds.has(satelliteId)) {
          const satelliteData = satelliteIconData.filter(d => (d.id || d.icon) === satelliteId);
          if (satelliteData.length > 0) {
            layers.push(
              new IconLayer({
                id: `${satelliteId}-icon`,
                data: satelliteData,
                pickable: false,
                iconAtlas: iconMapping.atlas,
                iconMapping: iconMapping.mapping,
                getIcon: (d: any) => d.icon,
                sizeScale: 1,
                getPosition: (d: any) => d.position,
                getSize: (d: any) => d.size,
                getColor: [255, 255, 255, 255]
              })
            );
          }
        }
      });
    }

    // Add orbit paths layer
    if (orbitPaths.length > 0) {
      layers.push(
        new ArcLayer({
          id: 'orbit-paths',
          data: orbitPaths,
          getSourcePosition: (d: any) => d.source,
          getTargetPosition: (d: any) => d.target,
          getSourceColor: (d: any) => d.color,
          getTargetColor: (d: any) => d.color,
          getWidth: 2,
          pickable: false
        })
      );
    }

    return layers;
  }

  private getViewportMargin(zoom: number): number {
    if (zoom <= 2) return 60;
    if (zoom <= 4) return 30;
    if (zoom <= 6) return 15;
    return 5;
  }

  private getColorForType(type: string): [number, number, number, number] {
    switch (type) {
      case 'scientific': return [0, 255, 136, 255]; // Green
      case 'communication': return [255, 165, 0, 255]; // Orange
      case 'earth-observation': return [30, 144, 255, 255]; // Dodger blue
      case 'weather': return [255, 20, 147, 255]; // Deep pink
      case 'navigation': return [138, 43, 226, 255]; // Blue violet
      default: return [255, 255, 255, 255]; // White
    }
  }

  private getSatelliteImageSize(zoom: number, satelliteWidth: number, satelliteId: string, scaleFactor?: number, followingSatellite?: string | null): number {
    const effectiveZoom = Math.max(zoom, 0.5);
    const isTracked = followingSatellite === satelliteId;
    
    let size: number;
    if (satelliteId === 'iss') {
      size = Math.min((effectiveZoom * satelliteWidth) / 3, 80);
    } else {
      if (zoom <= 6) {
        const multiplier = isTracked ? 10 : 2;
        size = Math.min(effectiveZoom * satelliteWidth * multiplier, 120);
      } else {
        const multiplier = isTracked ? 10 : 3;
        size = Math.min(effectiveZoom * satelliteWidth * multiplier, 200);
      }
    }
    
    const finalScaleFactor = scaleFactor || 1.0;
    size *= finalScaleFactor;
    
    return Math.max(size, 8);
  }

  private calculateOrbitPath(sat: SatelliteData): [number, number][] {
    const points: [number, number][] = [];
    const numPoints = 64;
    
    try {
      const satrec = satellite.twoline2satrec(sat.tle1, sat.tle2);
      const now = new Date();
      const orbitPeriod = 90 * 60 * 1000; // 90 minutes
      
      for (let i = 0; i < numPoints; i++) {
        const timeOffset = (i / numPoints) * orbitPeriod;
        const futureTime = new Date(now.getTime() + timeOffset);
        
        const positionAndVelocity = satellite.propagate(satrec, futureTime);
        if (positionAndVelocity.position && typeof positionAndVelocity.position !== 'boolean') {
          const gmst = satellite.gstime(futureTime);
          const gdLatLong = satellite.eciToGeodetic(positionAndVelocity.position, gmst);
          
          const longitude = satellite.degreesLong(gdLatLong.longitude);
          const latitude = satellite.degreesLat(gdLatLong.latitude);
          
          points.push([longitude, latitude]);
        }
      }
    } catch (error) {
      console.error('Error calculating orbit path:', error);
    }
    
    return points;
  }

  private isInBounds(position: { lng: number; lat: number }, bounds: MapBounds): boolean {
    const lng = position.lng;
    const lat = position.lat;
    return lng >= bounds.getWest() && lng <= bounds.getEast() &&
           lat >= bounds.getSouth() && lat <= bounds.getNorth();
  }
}