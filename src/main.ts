import { Map as MapLibreMap, NavigationControl, AttributionControl } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { SatelliteTracker } from './satellite-tracker';

class SatelliteTracker3D {
  private map!: MapLibreMap;
  private satelliteTracker!: SatelliteTracker;
  private isDayMode = true;

  constructor() {
    this.initializeMap();
    this.satelliteTracker = new SatelliteTracker(this.map);
    this.setupEventListeners();
    this.setupURLSharing();
    this.startTracking();
  }

  private initializeMap() {
    // Get initial view from URL parameters (only zoom)
    const urlParams = new URLSearchParams(window.location.search);
    const initialZoom = parseFloat(urlParams.get('zoom') || '2');
    
    this.map = new MapLibreMap({
      container: 'map',
      style: {
        version: 8,
        sources: {},
        layers: []
      },
      center: [0, 0], // Always start at global view
      zoom: initialZoom,
      attributionControl: false // Disable default attribution control to avoid duplicates
    });

    this.map.addControl(new NavigationControl(), 'top-right');
    this.map.addControl(new AttributionControl({ compact: true }), 'bottom-right');
    
    // Initialize with day basemap
    this.map.on('load', () => {
      this.addDayBasemap();
    });
  }

  private addDayBasemap() {
    // Remove night basemap if it exists
    this.removeNightBasemap();
    
    // Add Geoportail France orthophotos as day basemap source and layer
    if (!this.map.getSource('geoportail-orthos')) {
      this.map.addSource('geoportail-orthos', {
        type: 'raster',
        tiles: ['https://data.geopf.fr/wmts?REQUEST=GetTile&SERVICE=WMTS&VERSION=1.0.0&STYLE=normal&TILEMATRIXSET=PM&FORMAT=image/jpeg&LAYER=ORTHOIMAGERY.ORTHOPHOTOS&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}'],
        tileSize: 256,
        minzoom: 2,
        maxzoom: 19,
        attribution: '<a target="_blank" href="https://www.geoportail.gouv.fr/">Geoportail France</a>'
      });
    }
    
    if (!this.map.getLayer('geoportail-orthos')) {
      this.map.addLayer({
        id: 'geoportail-orthos',
        type: 'raster',
        source: 'geoportail-orthos'
      }, this.getFirstSatelliteLayerId());
    }
  }

  private addNightBasemap() {
    // Remove day basemap if it exists
    this.removeDayBasemap();
    
    // Add night basemap source and layer
    if (!this.map.getSource('nasa-night')) {
      this.map.addSource('nasa-night', {
        type: 'raster',
        tiles: ['https://map1.vis.earthdata.nasa.gov/wmts-webmerc/VIIRS_CityLights_2012/default/{time}/GoogleMapsCompatible_Level8/{z}/{y}/{x}.jpg'],
        tileSize: 256,
        minzoom: 1,
        maxzoom: 8,
        attribution: 'Imagery provided by services from the Global Imagery Browse Services (GIBS), operated by the NASA/GSFC/Earth Science Data and Information System (<a href="https://earthdata.nasa.gov">ESDIS</a>) with funding provided by NASA/HQ.'
      });
    }
    
    if (!this.map.getLayer('nasa-night')) {
      this.map.addLayer({
        id: 'nasa-night',
        type: 'raster',
        source: 'nasa-night'
      }, this.getFirstSatelliteLayerId());
    }
  }

  private removeDayBasemap() {
    if (this.map.getLayer('geoportail-orthos')) {
      this.map.removeLayer('geoportail-orthos');
    }
    if (this.map.getSource('geoportail-orthos')) {
      this.map.removeSource('geoportail-orthos');
    }
  }

  private removeNightBasemap() {
    if (this.map.getLayer('nasa-night')) {
      this.map.removeLayer('nasa-night');
    }
    if (this.map.getSource('nasa-night')) {
      this.map.removeSource('nasa-night');
    }
  }

  private getFirstSatelliteLayerId(): string | undefined {
    // Return the first satellite layer ID to ensure basemap layers are below satellites
    const satelliteLayers = ['satellites-main', 'satellites-iss-icon', 'satellites-starlink-icon', 'satellites-sentinel-icon'];
    for (const layerId of satelliteLayers) {
      if (this.map.getLayer(layerId)) {
        return layerId;
      }
    }
    return undefined;
  }

  private setupEventListeners() {
    const toggleBtn = document.getElementById('toggle-basemap');
    const trackIssBtn = document.getElementById('track-iss');
    const showStarlinkBtn = document.getElementById('show-starlink');

    toggleBtn?.addEventListener('click', () => this.toggleBasemap());
    trackIssBtn?.addEventListener('click', () => this.focusOnISS());
    showStarlinkBtn?.addEventListener('click', () => this.toggleStarlinkVisibility());
  }

  private toggleBasemap() {
    this.isDayMode = !this.isDayMode;
    if (this.isDayMode) {
      this.addDayBasemap();
    } else {
      this.addNightBasemap();
    }
  }

  private focusOnISS() {
    const iss = this.satelliteTracker.getSatellites().get('iss');
    if (iss) {
      // Use the follow functionality instead of just flying to it
      this.satelliteTracker.followSatellite('iss');
    }
  }

  private toggleStarlinkVisibility() {
    this.satelliteTracker.toggleTrails();
  }

  private startTracking() {
    this.map.on('load', () => {
      // Wait a bit for the basemap to be added, then initialize satellites
      setTimeout(() => {
        this.satelliteTracker.initialize();
        this.updateUI();
        setInterval(() => this.updateUI(), 5000);
      }, 100);
    });
  }

  private setupURLSharing() {
    // Update URL when map view changes (only zoom)
    const updateURL = () => {
      const zoom = this.map.getZoom();
      
      const url = new URL(window.location.href);
      // Remove x and y parameters if they exist
      url.searchParams.delete('x');
      url.searchParams.delete('y');
      url.searchParams.set('zoom', zoom.toFixed(2));
      
      // Update URL without triggering page reload
      window.history.replaceState({}, '', url.toString());
    };

    // Update URL when user moves or zooms the map
    this.map.on('moveend', updateURL);
    this.map.on('zoomend', updateURL);
    
    // Also update URL when satellite tracking moves the map
    this.map.on('move', () => {
      // Debounce URL updates during smooth animations
      clearTimeout((this as any).urlUpdateTimeout);
      (this as any).urlUpdateTimeout = setTimeout(updateURL, 500);
    });
  }

  private updateUI() {
    const satellites = this.satelliteTracker.getSatellites();
    const iss = satellites.get('iss');
    const starlinkCount = Array.from(satellites.values()).filter(sat => sat.type === 'communication').length;
    const sentinelCount = Array.from(satellites.values()).filter(sat => sat.type === 'earth-observation').length;
    const totalCount = satellites.size;

    const satelliteCountElement = document.getElementById('satellite-count');
    const issAltitudeElement = document.getElementById('iss-altitude');
    const starlinkCountElement = document.getElementById('starlink-count');
    const sentinelCountElement = document.getElementById('sentinel-count');

    if (satelliteCountElement) satelliteCountElement.textContent = totalCount.toString();
    if (issAltitudeElement && iss) issAltitudeElement.textContent = iss.altitude.toFixed(0);
    if (starlinkCountElement) starlinkCountElement.textContent = starlinkCount.toString();
    if (sentinelCountElement) sentinelCountElement.textContent = sentinelCount.toString();
  }
}

new SatelliteTracker3D();