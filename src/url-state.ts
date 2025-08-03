export class URLState {
  private isInitializing = true;

  constructor() {
    // Default initialization state
  }

  setInitializing(state: boolean) {
    this.isInitializing = state;
  }

  getInitialZoom(): number {
    const urlParams = new URLSearchParams(window.location.search);
    return parseFloat(urlParams.get('zoom') || '2');
  }

  getInitialPitch(): number {
    const urlParams = new URLSearchParams(window.location.search);
    return parseFloat(urlParams.get('pitch') || '0');
  }

  getInitialBearing(): number {
    const urlParams = new URLSearchParams(window.location.search);
    return parseFloat(urlParams.get('bearing') || '0');
  }

  getInitialSatellite(): string | null {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('satellite');
  }

  getInitialCoordinates(): [number, number] | null {
    const urlParams = new URLSearchParams(window.location.search);
    const x = urlParams.get('x');
    const y = urlParams.get('y');
    
    if (x && y) {
      return [parseFloat(x), parseFloat(y)];
    }
    return null;
  }

  updateURL(zoom: number, followingSatellite: string | null, pitch?: number, bearing?: number) {
    if (this.isInitializing) {
      // Skipping URL update during initialization
      return;
    }
    
    const url = new URL(window.location.href);
    const originalUrl = url.toString();
    
    // Always remove x,y coordinates from URL (don't store them)
    url.searchParams.delete('x');
    url.searchParams.delete('y');
    
    let urlChanged = false;
    
    // Update zoom only if significantly different (increased threshold)
    const currentUrlZoomStr = url.searchParams.get('zoom');
    const currentUrlZoom = currentUrlZoomStr ? parseFloat(currentUrlZoomStr) : null;
    if (currentUrlZoom === null || Math.abs(zoom - currentUrlZoom) > 0.1) {
      url.searchParams.set('zoom', zoom.toFixed(1));
      urlChanged = true;
    }
    
    // Update pitch if provided and significantly different
    if (pitch !== undefined) {
      const currentUrlPitchStr = url.searchParams.get('pitch');
      const currentUrlPitch = currentUrlPitchStr ? parseFloat(currentUrlPitchStr) : 0;
      
      if (pitch < 1) {
        // Remove pitch parameter if it's very small
        if (currentUrlPitchStr) {
          url.searchParams.delete('pitch');
          urlChanged = true;
        }
      } else if (Math.abs(pitch - currentUrlPitch) > 1) {
        url.searchParams.set('pitch', pitch.toFixed(0));
        urlChanged = true;
      }
    }
    
    // Update bearing if provided and significantly different
    if (bearing !== undefined) {
      const currentUrlBearingStr = url.searchParams.get('bearing');
      const currentUrlBearing = currentUrlBearingStr ? parseFloat(currentUrlBearingStr) : 0;
      // Normalize bearing to 0-360 range
      const normalizedBearing = ((bearing % 360) + 360) % 360;
      const normalizedCurrentBearing = ((currentUrlBearing % 360) + 360) % 360;
      
      if (Math.abs(normalizedBearing) < 1) {
        // Remove bearing parameter if it's very small
        if (currentUrlBearingStr) {
          url.searchParams.delete('bearing');
          urlChanged = true;
        }
      } else if (Math.abs(normalizedBearing - normalizedCurrentBearing) > 1) {
        url.searchParams.set('bearing', normalizedBearing.toFixed(0));
        urlChanged = true;
      }
    }
    
    // Update satellite tracking
    const currentSatellite = url.searchParams.get('satellite');
    if (followingSatellite !== currentSatellite) {
      if (followingSatellite) {
        url.searchParams.set('satellite', followingSatellite);
      } else {
        url.searchParams.delete('satellite');
      }
      urlChanged = true;
    }
    
    // Only update URL if something actually changed
    if (urlChanged && url.toString() !== originalUrl) {
      console.log(`🔄 Updating URL: ${originalUrl} -> ${url.toString()}`);
      window.history.replaceState({}, '', url.toString());
    }
  }

  removeInvalidSatellite() {
    const url = new URL(window.location.href);
    url.searchParams.delete('satellite');
    window.history.replaceState({}, '', url.toString());
  }

  setupURLSharing(map: any, updateCallback: () => void) {
    map.on('moveend', () => updateCallback());
    map.on('zoomend', () => updateCallback());
    map.on('pitchend', () => updateCallback());
    map.on('rotateend', () => updateCallback());
  }
}