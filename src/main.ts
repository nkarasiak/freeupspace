import { Map as MapLibreMap, AttributionControl } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { DeckSatelliteTracker } from './deck-satellite-tracker';
import { URLState } from './url-state';

class SatelliteTracker3D {
  private map!: MapLibreMap;
  private satelliteTracker!: DeckSatelliteTracker;
  private isDayMode = true;
  private urlState = new URLState();
  private initialZoom!: number;
  private isInitializing = true;

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
    const initialCoordinates = this.urlState.getInitialCoordinates();
    const initialSatellite = this.urlState.getInitialSatellite();
    
    // Always start at global view for smooth flyTo animation to satellites
    // If specific coordinates are provided AND no satellite is specified, use them
    const initialCenter: [number, number] = (!initialSatellite && initialCoordinates) ? initialCoordinates : [0, 0];
    
    console.log(`🗺️ Map initializing with center: ${initialCenter}, satellite: ${initialSatellite}`);
    
    this.map = new MapLibreMap({
      container: 'map',
      style: {
        version: 8,
        sources: {},
        layers: []
      },
      center: initialCenter,
      zoom: initialSatellite ? 2 : this.initialZoom, // Start at global zoom if satellite specified
      pitch: initialPitch, // Use pitch from URL
      bearing: initialBearing, // Use bearing from URL
      attributionControl: false, // Disable default attribution control to avoid duplicates
      maxPitch: 85, // Allow up to 85 degrees tilt for 3D terrain viewing
      pitchWithRotate: false, // Disable pitch-with-rotate to avoid conflicts
      dragRotate: false, // Disable default drag rotate
      touchPitch: false // Disable touch pitch
    });

    // Disable MapLibre navigation control to avoid conflicts with Deck.gl
    // We'll handle pitch separately through the custom slider
    // const navControl = new NavigationControl();
    // this.map.addControl(navControl, 'top-right');
    
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
      this.addDayBasemap();
      this.add3DTerrain();
      
      // Apply working pitch override from test page
      setTimeout(() => {
        this.applyPitchOverride();
      }, 500);
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

    // Apply pitch override after terrain is added
    setTimeout(() => {
      this.applyPitchOverride();
    }, 100);
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
    const pauseBtn = document.getElementById('pause-updates');
    const satelliteTrackedOnlyBtn = document.getElementById('satellite-tracked-only');
    const pitchSlider = document.getElementById('pitch-slider') as HTMLInputElement;
    const pitchValue = document.getElementById('pitch-value') as HTMLSpanElement;

    toggleBtn?.addEventListener('click', () => this.toggleBasemap());
    trackIssBtn?.addEventListener('click', () => this.focusOnISS());
    showStarlinkBtn?.addEventListener('click', () => this.toggleStarlinkVisibility());
    pauseBtn?.addEventListener('click', () => this.togglePauseUpdates());
    satelliteTrackedOnlyBtn?.addEventListener('click', () => this.toggleSatelliteTrackedOnly());
    
    // Direct pitch control that bypasses Deck.gl limitation
    pitchSlider?.addEventListener('input', (e) => {
      const pitch = parseInt((e.target as HTMLInputElement).value);
      pitchValue.textContent = pitch.toString();
      
      // Directly set MapLibre GL pitch (bypasses Deck.gl 60° limit)
      this.map.setPitch(pitch);
      console.log(`🎯 Direct MapLibre pitch set to: ${pitch}°`);
    });
    
    // Update slider when map pitch changes
    this.map.on('pitch', () => {
      const currentPitch = Math.round(this.map.getPitch());
      if (pitchSlider) pitchSlider.value = currentPitch.toString();
      if (pitchValue) pitchValue.textContent = currentPitch.toString();
    });
    
    // Add custom Ctrl+drag pitch handling that uses MapLibre directly
    this.setupCustomPitchControl();
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

  private togglePauseUpdates() {
    const isPaused = this.satelliteTracker.togglePause();
    const pauseBtn = document.getElementById('pause-updates');
    if (pauseBtn) {
      pauseBtn.textContent = isPaused ? 'Resume Updates' : 'Pause Updates';
    }
  }

  private toggleSatelliteTrackedOnly() {
    const isTracking = this.satelliteTracker.getFollowingSatellite() !== null;
    
    // Don't allow toggling if not tracking any satellite
    if (!isTracking) {
      console.log('🎯 No satellite being tracked - cannot toggle tracked only mode');
      return;
    }
    
    const currentState = this.satelliteTracker.getShowTrackedSatelliteOnly();
    const newState = !currentState;
    this.satelliteTracker.setShowTrackedSatelliteOnly(newState);
    
    // Update button appearance - this will be handled by updateSatelliteTrackedOnlyButton
    this.updateSatelliteTrackedOnlyButton();
  }

  private startTracking() {
    this.map.on('load', () => {
      // Wait a bit for the basemap to be added, then initialize satellites
      setTimeout(async () => {
        await this.satelliteTracker.initialize();
        
        // Restore satellite tracking from URL if specified, otherwise default to ISS
        const satelliteToTrack = this.urlState.getInitialSatellite() || 'iss';
        const isDefaultISS = !this.urlState.getInitialSatellite(); // True if we're defaulting to ISS
        
        if (satelliteToTrack) {
          // Give a bit more time for satellites to be loaded
          setTimeout(() => {
            
            // Check if satellite exists before trying to follow it
            const satellites = this.satelliteTracker.getSatellites();
            if (satellites.has(satelliteToTrack)) {
              // Use default zoom of 1.7 for ISS if not specified in URL
              const zoomToUse = isDefaultISS ? 1.7 : this.initialZoom;
              
              console.log(`🎯 Tracking ${satelliteToTrack} with zoom: ${zoomToUse} (isDefaultISS: ${isDefaultISS})`);
              
              // Use zoom, pitch, and bearing from URL for smooth flyTo animation
              this.satelliteTracker.followSatelliteWithAnimation(
                satelliteToTrack, 
                zoomToUse,
                this.urlState.getInitialPitch(),
                this.urlState.getInitialBearing()
              );
            } else {
              console.warn(`⚠️ Satellite not found: ${satelliteToTrack}. Available satellites:`, Array.from(satellites.keys()));
              // Remove invalid satellite from URL
              this.urlState.removeInvalidSatellite();
            }
            
            // End initialization phase after satellite tracking is set up (or attempted)
            setTimeout(() => {
              this.urlState.setInitializing(false);
              this.isInitializing = false; // Allow URL updates after animation completes
              console.log(`✅ Initialization complete - URL updates enabled`);
            }, 4000); // Wait longer for flyTo animation to complete (3s + buffer)
          }, 1000);
        }
        
        this.updateUI();
        setInterval(() => this.updateUI(), 5000);
      }, 500); // Increased delay to ensure proper initialization
    });
  }

  private updateURL() {
    // Skip URL updates during initialization to prevent premature updates
    if (this.isInitializing) {
      console.log(`📍 Skipping URL update during initialization`);
      return;
    }
    
    const zoom = this.map.getZoom();
    const pitch = this.map.getPitch();
    const bearing = this.map.getBearing();
    const followingSatellite = this.satelliteTracker.getFollowingSatellite();
    
    console.log(`📍 Updating URL - zoom: ${zoom.toFixed(2)}, satellite: ${followingSatellite}`);
    
    this.urlState.updateURL(zoom, followingSatellite, pitch, bearing);
  }

  private setupURLSharing() {
    this.urlState.setupURLSharing(this.map, () => this.updateURL());
  }

  private applyPitchOverride() {
    console.log('🔧 Applying pitch override to enable 85° pitch...');
    
    const map = this.map as any;
    
    try {
      // Method 1: Standard API
      map.setMaxPitch(85);
      console.log('✅ setMaxPitch(85) called');
      
      // Method 2: Transform override
      if (map.transform) {
        map.transform.maxPitch = 85;
        map.transform._maxPitch = 85;
        console.log('✅ transform.maxPitch set to 85');
      }
      
      // Method 3: Internal properties
      map._maxPitch = 85;
      console.log('✅ _maxPitch set to 85');
      
      // Method 4: Force update
      if (map._update) {
        map._update();
        console.log('✅ _update() called');
      }
      
      console.log('📐 Pitch override complete. MaxPitch:', map.getMaxPitch());
      
    } catch (error) {
      console.error('❌ Error during maxPitch override:', error);
    }
  }

  private setupCustomPitchControl() {
    let isDragging = false;
    let lastY = 0;
    
    console.log('🔧 Setting up simple pitch control on document...');
    
    // Attach to document to catch all events
    document.addEventListener('mousedown', (e) => {
      if (e.ctrlKey || e.metaKey) {
        isDragging = true;
        lastY = e.clientY;
        e.preventDefault();
        console.log('🖱️ Ctrl+mousedown: Starting pitch control');
      }
    });
    
    document.addEventListener('mousemove', (e) => {
      if (isDragging && (e.ctrlKey || e.metaKey)) {
        const deltaY = lastY - e.clientY;
        const currentPitch = this.map.getPitch();
        const newPitch = Math.min(85, Math.max(0, currentPitch + deltaY * 0.3));
        
        this.map.setPitch(newPitch);
        console.log(`🎯 Pitch: ${currentPitch.toFixed(1)}° → ${newPitch.toFixed(1)}°`);
        
        lastY = e.clientY;
        e.preventDefault();
      }
    });
    
    document.addEventListener('mouseup', () => {
      if (isDragging) {
        console.log('🖱️ Mouseup - ending pitch control');
        isDragging = false;
      }
    });
    
    console.log('🖱️ Document-level Ctrl+drag pitch control enabled');
  }

  private updateUI() {
    const satellites = this.satelliteTracker.getSatellites();
    const iss = satellites.get('iss');
    const starlinkCount = Array.from(satellites.values()).filter(sat => sat.type === 'communication').length;
    const sentinelCount = Array.from(satellites.values()).filter(sat => sat.type === 'earth-observation').length;
    const totalCount = satellites.size;
    const followingSatellite = this.satelliteTracker.getFollowingSatellite();

    // Update status displays
    const satelliteCountElement = document.getElementById('satellite-count');
    const issAltitudeElement = document.getElementById('iss-altitude');
    const starlinkCountElement = document.getElementById('starlink-count');
    const sentinelCountElement = document.getElementById('sentinel-count');
    const trackingStatusElement = document.getElementById('tracking-status');

    if (satelliteCountElement) satelliteCountElement.textContent = totalCount.toString();
    if (issAltitudeElement && iss) issAltitudeElement.textContent = iss.altitude.toFixed(0);
    if (starlinkCountElement) starlinkCountElement.textContent = starlinkCount.toString();
    if (sentinelCountElement) sentinelCountElement.textContent = sentinelCount.toString();
    
    // Update tracking status
    if (trackingStatusElement) {
      if (followingSatellite) {
        const satellite = satellites.get(followingSatellite);
        if (satellite) {
          const displayName = satellite.shortname || satellite.name.substring(0, 8).toUpperCase();
          trackingStatusElement.textContent = displayName;
          trackingStatusElement.style.color = '#00ff88'; // Always green when tracking
        } else {
          trackingStatusElement.textContent = 'UNKNOWN';
          trackingStatusElement.style.color = '#ffffff';
        }
      } else {
        trackingStatusElement.textContent = 'FREE VIEW';
        trackingStatusElement.style.color = '#ffffff';
      }
    }
    
    // Update satellite tracked only button state
    this.updateSatelliteTrackedOnlyButton();
  }

  private updateSatelliteTrackedOnlyButton() {
    const btn = document.getElementById('satellite-tracked-only');
    if (!btn) return;
    
    const isTrackedOnly = this.satelliteTracker.getShowTrackedSatelliteOnly();
    const isTracking = this.satelliteTracker.getFollowingSatellite() !== null;
    
    if (isTrackedOnly && isTracking) {
      btn.textContent = '🎯 Show all satellites';
      btn.style.background = 'rgba(0, 255, 136, 0.15)';
      btn.style.borderColor = 'rgba(0, 255, 136, 0.3)';
    } else {
      btn.textContent = '🎯 Satellite tracked only';
      btn.style.background = '';
      btn.style.borderColor = '';
    }
    
    // Disable button when not tracking any satellite
    if (!isTracking) {
      btn.style.opacity = '0.5';
      btn.style.cursor = 'not-allowed';
      btn.title = 'Track a satellite first to use this feature';
    } else {
      btn.style.opacity = '';
      btn.style.cursor = '';
      btn.title = isTrackedOnly ? 'Show all satellites' : 'Hide all satellites except tracked one';
    }
  }
}

new SatelliteTracker3D();