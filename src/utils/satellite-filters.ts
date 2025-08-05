import { MapBounds } from '../types/rendering';

/**
 * Utility functions for filtering satellites based on various criteria
 * This centralizes the duplicate filtering logic found throughout the codebase
 */
export class SatelliteFilters {
  
  /**
   * Filter satellites by enabled types
   */
  static byEnabledTypes<T extends { type: string }>(
    satellites: T[], 
    enabledTypes: Set<string>
  ): T[] {
    return satellites.filter(sat => enabledTypes.has(sat.type));
  }

  /**
   * Filter satellites to show only tracked satellite when following
   */
  static byTrackingStatus<T extends { id: string }>(
    satellites: T[], 
    followingSatellite: string | null,
    showTrackedOnly: boolean = false
  ): T[] {
    if (!followingSatellite || !showTrackedOnly) {
      return satellites;
    }
    return satellites.filter(sat => sat.id === followingSatellite);
  }

  /**
   * Filter satellites by viewport bounds for performance optimization
   */
  static byViewportBounds<T extends { position: { lng: number; lat: number } }>(
    satellites: T[], 
    bounds: MapBounds,
    margin: number = 0
  ): T[] {
    const west = bounds.getWest() - margin;
    const east = bounds.getEast() + margin;
    const south = bounds.getSouth() - margin / 2;
    const north = bounds.getNorth() + margin / 2;

    return satellites.filter(sat => {
      const lng = sat.position.lng;
      const lat = sat.position.lat;
      return lng >= west && lng <= east && lat >= south && lat <= north;
    });
  }

  /**
   * Combined filter for rendering optimization - includes type, tracking, and viewport filtering
   */
  static forRendering<T extends { id: string; type: string; position: { lng: number; lat: number } }>(
    satellites: T[],
    enabledTypes: Set<string>,
    followingSatellite: string | null,
    showTrackedOnly: boolean,
    bounds?: MapBounds,
    viewportMargin?: number
  ): T[] {
    let filtered = satellites;

    // Apply tracking filter first (most restrictive)
    if (followingSatellite && showTrackedOnly) {
      return filtered.filter(sat => sat.id === followingSatellite);
    }

    // Apply type filter
    filtered = this.byEnabledTypes(filtered, enabledTypes);

    // Apply viewport bounds filter if provided
    if (bounds && viewportMargin !== undefined) {
      filtered = this.byViewportBounds(filtered, bounds, viewportMargin);
    }

    return filtered;
  }

  /**
   * Filter for search results - matches name, shortname, or alternate name
   */
  static bySearchQuery<T extends { 
    name: string; 
    shortname?: string; 
    alternateName?: string; 
  }>(
    satellites: T[], 
    query: string
  ): T[] {
    if (!query.trim()) {
      return satellites;
    }

    const searchTerm = query.toLowerCase().trim();
    
    return satellites.filter(sat => {
      const name = sat.name.toLowerCase();
      const shortname = sat.shortname?.toLowerCase() || '';
      const alternateName = sat.alternateName?.toLowerCase() || '';
      
      return name.includes(searchTerm) || 
             shortname.includes(searchTerm) || 
             alternateName.includes(searchTerm);
    });
  }

  /**
   * Filter satellites by priority for loading optimization
   */
  static byLoadingPriority<T extends { id: string; name: string; type: string }>(
    satellites: T[]
  ): T[] {
    return satellites.sort((a, b) => {
      const getScore = (sat: T) => {
        const name = sat.name.toUpperCase();
        
        // ISS and major space stations - highest priority
        if (name.includes('ISS') || name.includes('ZARYA')) return 1000;
        
        // Major scientific satellites
        else if (name.includes('HUBBLE') || name.includes('JWST') || name.includes('KEPLER')) return 950;
        
        // Earth observation and weather satellites
        else if (name.includes('LANDSAT') || name.includes('SENTINEL') || name.includes('MODIS')) return 900;
        
        // Communication satellites
        else if (sat.type === 'communication') return 600;
        
        // Navigation satellites  
        else if (sat.type === 'navigation' || name.includes('GPS') || name.includes('GALILEO')) return 700;
        
        // Scientific satellites
        else if (sat.type === 'scientific') return 800;
        
        // CubeSats and small satellites
        else if (name.includes('CUBESAT') || name.includes('YAM')) return 400;
        
        // Starlink - lowest priority due to large numbers
        else if (name.includes('STARLINK')) return 100;
        
        // Default priority
        return 200;
      };

      return getScore(b) - getScore(a); // Higher score first
    });
  }

  /**
   * Performance-aware filter that respects satellite limits and LOD
   */
  static forPerformance<T extends { id: string; type: string }>(
    satellites: T[],
    maxSatellites: number,
    followingSatellite: string | null = null
  ): T[] {
    let filtered = satellites;

    // Always include followed satellite if it exists
    const followedSat = followingSatellite ? 
      satellites.find(sat => sat.id === followingSatellite) : null;

    if (followedSat) {
      // Remove followed satellite from the list temporarily
      filtered = satellites.filter(sat => sat.id !== followingSatellite);
      
      // Apply limit to remaining satellites
      filtered = filtered.slice(0, maxSatellites - 1);
      
      // Add followed satellite back at the beginning
      filtered.unshift(followedSat);
    } else {
      // No followed satellite, just apply limit
      filtered = filtered.slice(0, maxSatellites);
    }

    return filtered;
  }

  /**
   * Utility function to check if a satellite should be rendered as an icon vs circle
   */
  static shouldRenderAsIcon<T extends { id: string; image?: string }>(
    satellite: T,
    loadedIcons: Set<string>,
    zoom: number,
    followingSatellite: string | null = null
  ): boolean {
    // Must have an image and the icon must be loaded
    if (!satellite.image || !loadedIcons.has(satellite.id)) {
      return false;
    }

    // Always show followed satellite as icon if available
    if (followingSatellite === satellite.id) {
      return true;
    }

    // ISS always shows as icon if loaded
    if (satellite.id === 'iss' || satellite.id.includes('iss')) {
      return true;
    }

    // At high zoom, show all loaded icons
    if (zoom >= 5) {
      return true;
    }

    // At medium zoom, show every 2nd icon for performance
    if (zoom >= 4) {
      return Math.random() < 0.5; // Randomize to avoid patterns
    }

    // At low zoom, show every 4th icon for performance
    if (zoom >= 3) {
      return Math.random() < 0.25;
    }

    return false;
  }
}