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
    this.startTracking();
  }

  private initializeMap() {
    this.map = new MapLibreMap({
      container: 'map',
      style: this.getDayStyle(),
      center: [0, 0],
      zoom: 2
    });

    this.map.addControl(new NavigationControl(), 'top-right');
    this.map.addControl(new AttributionControl({ compact: true }), 'bottom-right');
  }

  private getDayStyle() {
    return {
      version: 8 as const,
      sources: {
        'osm': {
          type: 'raster' as const,
          tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
          tileSize: 256,
          attribution: '© OpenStreetMap contributors'
        }
      },
      layers: [
        {
          id: 'osm',
          type: 'raster' as const,
          source: 'osm'
        }
      ]
    };
  }

  private getNightStyle() {
    return {
      version: 8 as const,
      sources: {
        'dark': {
          type: 'raster' as const,
          tiles: ['https://cartodb-basemaps-{s}.global.ssl.fastly.net/dark_all/{z}/{x}/{y}.png'],
          tileSize: 256,
          attribution: '© CARTO'
        }
      },
      layers: [
        {
          id: 'dark',
          type: 'raster' as const,
          source: 'dark'
        }
      ]
    };
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
    const style = this.isDayMode ? this.getDayStyle() : this.getNightStyle();
    this.map.setStyle(style);
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
      this.satelliteTracker.initialize();
      this.updateUI();
      setInterval(() => this.updateUI(), 5000);
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