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

  updateURL(zoom: number, followingSatellite: string | null, pitch?: number, bearing?: number) {
    if (this.isInitializing) {
      console.log(`🚫 Skipping URL update during initialization`);
      return;
    }
    
    const url = new URL(window.location.href);
    url.searchParams.delete('x');
    url.searchParams.delete('y');
    
    const currentUrlZoomStr = url.searchParams.get('zoom');
    const currentUrlZoom = currentUrlZoomStr ? parseFloat(currentUrlZoomStr) : zoom;
    if (Math.abs(zoom - currentUrlZoom) > 0.01) {
      console.log(`🔄 Updating URL zoom from ${currentUrlZoom} to ${zoom.toFixed(2)}`);
      url.searchParams.set('zoom', zoom.toFixed(2));
    } else if (!currentUrlZoomStr) {
      // Always set zoom if it doesn't exist in URL
      console.log(`🔄 Setting initial URL zoom to ${zoom.toFixed(2)}`);
      url.searchParams.set('zoom', zoom.toFixed(2));
    }
    
    // Update pitch if provided and significantly different
    if (pitch !== undefined) {
      const currentUrlPitchStr = url.searchParams.get('pitch');
      const currentUrlPitch = currentUrlPitchStr ? parseFloat(currentUrlPitchStr) : 0;
      if (Math.abs(pitch - currentUrlPitch) > 0.1) {
        console.log(`🔄 Updating URL pitch from ${currentUrlPitch} to ${pitch.toFixed(1)}`);
        url.searchParams.set('pitch', pitch.toFixed(1));
      } else if (!currentUrlPitchStr && pitch > 0.1) {
        // Set pitch in URL if it doesn't exist and pitch is not near zero
        url.searchParams.set('pitch', pitch.toFixed(1));
      }
      // Remove pitch parameter if it's close to zero
      if (pitch < 0.1) {
        url.searchParams.delete('pitch');
      }
    }
    
    // Update bearing if provided and significantly different
    if (bearing !== undefined) {
      const currentUrlBearingStr = url.searchParams.get('bearing');
      const currentUrlBearing = currentUrlBearingStr ? parseFloat(currentUrlBearingStr) : 0;
      // Normalize bearing to 0-360 range
      const normalizedBearing = ((bearing % 360) + 360) % 360;
      const normalizedCurrentBearing = ((currentUrlBearing % 360) + 360) % 360;
      
      if (Math.abs(normalizedBearing - normalizedCurrentBearing) > 0.1) {
        console.log(`🔄 Updating URL bearing from ${normalizedCurrentBearing.toFixed(1)} to ${normalizedBearing.toFixed(1)}`);
        url.searchParams.set('bearing', normalizedBearing.toFixed(1));
      } else if (!currentUrlBearingStr && Math.abs(normalizedBearing) > 0.1) {
        // Set bearing in URL if it doesn't exist and bearing is not near zero
        url.searchParams.set('bearing', normalizedBearing.toFixed(1));
      }
      // Remove bearing parameter if it's close to zero
      if (Math.abs(normalizedBearing) < 0.1) {
        url.searchParams.delete('bearing');
      }
    }
    
    if (followingSatellite) {
      url.searchParams.set('satellite', followingSatellite);
    } else {
      url.searchParams.delete('satellite');
    }
    
    window.history.replaceState({}, '', url.toString());
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
    
    map.on('move', () => {
      clearTimeout((map as any).urlUpdateTimeout);
      (map as any).urlUpdateTimeout = setTimeout(() => updateCallback(), 500);
    });
    
    map.on('pitch', () => {
      clearTimeout((map as any).urlUpdateTimeout);
      (map as any).urlUpdateTimeout = setTimeout(() => updateCallback(), 500);
    });
    
    map.on('rotate', () => {
      clearTimeout((map as any).urlUpdateTimeout);
      (map as any).urlUpdateTimeout = setTimeout(() => updateCallback(), 500);
    });
  }
}