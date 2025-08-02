import { Map as MapLibreMap, NavigationControl, AttributionControl } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { DeckSatelliteTracker } from './deck-satellite-tracker';
import { URLState } from './url-state';

class SatelliteTracker3D {
  private map!: MapLibreMap;
  private satelliteTracker!: DeckSatelliteTracker;
  private isDayMode = true;
  private urlState = new URLState();
  private initialZoom!: number;

  constructor() {
    this.initializeMap();
    this.satelliteTracker = new DeckSatelliteTracker(this.map);
    this.satelliteTracker.setOnTrackingChangeCallback(() => this.updateURL());
    this.setupEventListeners();
    this.setupURLSharing();
    this.startTracking();
  }

  private initializeMap() {
    // Get initial view from URL parameters (zoom, pitch, bearing, and satellite tracking)
    this.initialZoom = this.urlState.getInitialZoom();
    const initialPitch = this.urlState.getInitialPitch();
    const initialBearing = this.urlState.getInitialBearing();
    console.log(`🔍 Initial view from URL: zoom=${this.initialZoom}, pitch=${initialPitch}, bearing=${initialBearing}`);
    
    this.map = new MapLibreMap({
      container: 'map',
      style: {
        version: 8,
        sources: {},
        layers: []
      },
      center: [0, 0], // Always start at global view
      zoom: this.initialZoom,
      pitch: initialPitch, // Use pitch from URL
      bearing: initialBearing, // Use bearing from URL
      attributionControl: false, // Disable default attribution control to avoid duplicates
      maxPitch: 85 // Allow up to 85 degrees tilt for 3D terrain viewing
    });

    this.map.addControl(new NavigationControl(), 'top-right');
    
    // Add attribution control and ensure it's collapsed by default
    const attributionControl = new AttributionControl({ compact: true });
    this.map.addControl(attributionControl, 'bottom-right');
    
    // Force collapse the attribution after it's added with a slight delay
    setTimeout(() => {
      const attributionContainer = document.querySelector('.maplibregl-ctrl-attrib');
      if (attributionContainer) {
        attributionContainer.classList.remove('maplibregl-compact-show');
        attributionContainer.classList.add('maplibregl-compact');
      }
    }, 100);
    
    // Initialize with day basemap
    this.map.on('load', () => {
      console.log(`📍 Map loaded with zoom: ${this.map.getZoom()}`);
      this.addDayBasemap();
      this.add3DTerrain();
    });
    
    // Debug zoom changes
    this.map.on('zoom', () => {
      console.log(`🔍 Zoom changed to: ${this.map.getZoom()}`);
    });
  }

  private addDayBasemap() {
    // Remove night basemap if it exists
    this.removeNightBasemap();
    
    // Add Esri World Imagery as day basemap source and layer
    if (!this.map.getSource('esri-world-imagery')) {
      this.map.addSource('esri-world-imagery', {
        type: 'raster',
        tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
        tileSize: 256,
        minzoom: 1,
        maxzoom: 19,
        attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
      });
    }
    
    if (!this.map.getLayer('esri-world-imagery')) {
      this.map.addLayer({
        id: 'esri-world-imagery',
        type: 'raster',
        source: 'esri-world-imagery'
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
    if (this.map.getLayer('esri-world-imagery')) {
      this.map.removeLayer('esri-world-imagery');
    }
    if (this.map.getSource('esri-world-imagery')) {
      this.map.removeSource('esri-world-imagery');
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

  private add3DTerrain() {
    // Add terrain source using Terrarium terrain data (free)
    this.map.addSource('terrain', {
      type: 'raster-dem',
      tiles: [
        'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'
      ],
      minzoom: 0,
      maxzoom: 15,
      tileSize: 256,
      encoding: 'terrarium' // Terrarium encoding format
    });

    // Add terrain layer with exaggerated elevation for better visibility from space
    this.map.setTerrain({
      source: 'terrain',
      exaggeration: 3 // Exaggerate elevation by 3x for dramatic effect from satellite view
    });

    console.log('🏔️ 3D terrain enabled with 3x exaggeration using Terrarium data');
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
    this.satelliteTracker.toggleOrbits();
  }

  private startTracking() {
    this.map.on('load', () => {
      // Wait a bit for the basemap to be added, then initialize satellites
      setTimeout(() => {
        this.satelliteTracker.initialize();
        
        // Restore satellite tracking from URL if specified
        const satelliteToTrack = this.urlState.getInitialSatellite();
        if (satelliteToTrack) {
          // Give a bit more time for satellites to be loaded
          setTimeout(() => {
            console.log(`🔄 Attempting to follow satellite from URL: ${satelliteToTrack}`);
            
            // Check if satellite exists before trying to follow it
            const satellites = this.satelliteTracker.getSatellites();
            if (satellites.has(satelliteToTrack)) {
              // Preserve the zoom level from URL when following satellite
              this.satelliteTracker.followSatellite(satelliteToTrack, false, this.initialZoom);
              console.log(`✅ Successfully started following: ${satelliteToTrack} with zoom ${this.initialZoom}`);
            } else {
              console.warn(`⚠️ Satellite not found: ${satelliteToTrack}. Available satellites:`, Array.from(satellites.keys()));
              // Remove invalid satellite from URL
              this.urlState.removeInvalidSatellite();
            }
            
            // End initialization phase after satellite tracking is set up
            setTimeout(() => {
              this.urlState.setInitializing(false);
              console.log('✅ Initialization complete, URL updates enabled');
            }, 500);
          }, 1000);
        } else {
          // No satellite to track, end initialization immediately
          this.urlState.setInitializing(false);
        }
        
        this.updateUI();
        setInterval(() => this.updateUI(), 5000);
      }, 500); // Increased delay to ensure proper initialization
    });
  }

  private updateURL() {
    const zoom = this.map.getZoom();
    const pitch = this.map.getPitch();
    const bearing = this.map.getBearing();
    const followingSatellite = this.satelliteTracker.getFollowingSatellite();
    this.urlState.updateURL(zoom, followingSatellite, pitch, bearing);
  }

  private setupURLSharing() {
    this.urlState.setupURLSharing(this.map, () => this.updateURL());
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