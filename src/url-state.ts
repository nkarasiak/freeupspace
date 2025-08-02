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

  getInitialSatellite(): string | null {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('satellite');
  }

  updateURL(zoom: number, followingSatellite: string | null) {
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
    
    map.on('move', () => {
      clearTimeout((map as any).urlUpdateTimeout);
      (map as any).urlUpdateTimeout = setTimeout(() => updateCallback(), 500);
    });
  }
}