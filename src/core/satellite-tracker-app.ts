import { Map as MapLibreMap, AttributionControl } from 'maplibre-gl';
import { DeckSatelliteTracker } from '../deck-satellite-tracker';
import { URLState } from '../url-state';
import { CommandPalette } from '../command-palette';
import { CockpitComponent } from '../components/cockpit.component';
import { SearchComponent } from '../components/search.component';
import { SatelliteDataService } from '../services/satellite-data.service';

export class SatelliteTrackerApp {
  private map!: MapLibreMap;
  private satelliteTracker!: DeckSatelliteTracker;
  private satelliteDataService!: SatelliteDataService;
  private isDayMode = true;
  private isGlobeMode = true;
  private urlState = new URLState();
  private commandPalette!: CommandPalette;
  private cockpitComponent!: CockpitComponent;
  private searchComponent!: SearchComponent;
  private initialZoom!: number;
  private isInitializing = true;
  private lastURLState = { zoom: 0, pitch: 0, bearing: 0, satellite: '' };

  constructor() {
    this.initialize();
  }

  private async initialize(): Promise<void> {
    // Initialize services
    this.satelliteDataService = new SatelliteDataService();
    await this.satelliteDataService.initialize();

    // Initialize UI components
    this.cockpitComponent = new CockpitComponent();
    this.searchComponent = new SearchComponent();
    this.searchComponent.setCallbacks({
      onSatelliteSelect: (satelliteId: string) => this.handleSatelliteSelection(satelliteId)
    });

    // Initialize map and tracking - make this async
    await this.initializeMapAsync();
    this.satelliteTracker = new DeckSatelliteTracker(this.map);
    
    // Pass satellite data to the tracker and initialize it
    await this.satelliteTracker.setSatelliteDataService(this.satelliteDataService);
    await this.satelliteTracker.initialize();
    
    this.setupSatelliteTrackerCallbacks();
    this.setupEventListeners();
    this.setupURLSharing();
    this.setupCommandPalette();
    this.startTracking();
  }

  private async initializeMapAsync(): Promise<void> {
    // Get initial view from URL parameters
    const urlZoom = this.urlState.getInitialZoom();
    const initialPitch = this.urlState.getInitialPitch();
    const initialBearing = this.urlState.getInitialBearing();
    const initialCoordinates = this.urlState.getInitialCoordinates();
    const initialSatellite = this.urlState.getInitialSatellite();
    
    // If no satellite specified and no zoom in URL, we'll default to ISS at zoom 4.0
    if (!initialSatellite && urlZoom === 3.0) {
      this.initialZoom = 4.0; // Always use 4.0 for ISS on homepage
      console.log(`🎯 Homepage: Using ISS zoom 4.0`);
    } else {
      this.initialZoom = urlZoom;
    }
    
    // Always start at global view for smooth flyTo animation to satellites
    const initialCenter: [number, number] = (!initialSatellite && initialCoordinates) ? initialCoordinates : [0, 0];
    
    // Validate container dimensions before initializing map
    const container = document.getElementById('map');
    if (!container) {
      throw new Error('Map container not found');
    }
    
    // Ensure container has proper dimensions
    const containerRect = container.getBoundingClientRect();
    if (containerRect.width === 0 || containerRect.height === 0) {
      console.warn('⚠️ Map container has zero dimensions, setting fallback size');
      container.style.width = '100vw';
      container.style.height = '100vh';
      
      // Force a reflow to ensure dimensions are applied
      container.offsetHeight;
    }
    
    // Wait for container to be properly sized
    const finalRect = container.getBoundingClientRect();
    if (finalRect.width === 0 || finalRect.height === 0) {
      throw new Error('Map container still has invalid dimensions after fallback sizing');
    }
    
    return new Promise<void>((resolve, reject) => {
      // Wait multiple frames to ensure container is properly sized and stable
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          try {
            // Double-check container dimensions right before map creation
            const preInitRect = container.getBoundingClientRect();
            if (preInitRect.width === 0 || preInitRect.height === 0) {
              throw new Error('Container lost dimensions before map initialization');
            }
            
            // Set fixed dimensions during initialization to prevent matrix calculation errors
            const originalStyles = {
              width: container.style.width,
              height: container.style.height,
              position: container.style.position
            };
            
            container.style.width = '800px';
            container.style.height = '600px';
            container.style.position = 'absolute';
            
            // Force a reflow with fixed dimensions
            container.offsetHeight;
            
            this.map = new MapLibreMap({
              container: 'map',
              style: {
                version: 8,
                sources: {},
                layers: []
              },
              center: initialCenter,
              zoom: Math.max(2, this.initialZoom), // Ensure minimum zoom of 2 to prevent tile errors
              pitch: initialPitch,
              bearing: initialBearing,
              attributionControl: false,
              maxPitch: 85,
              pitchWithRotate: false,
              dragRotate: false,
              touchPitch: false,
              maxBounds: [[-180, -85.051128779807], [180, 85.051128779807]], // Prevent invalid coordinates
              minZoom: 2, // Prevent zoom levels that cause tile errors
              maxZoom: 19
            });
            
            // Verify map was created successfully before proceeding
            if (!this.map || !this.map.getContainer()) {
              // Restore original styles on failure
              container.style.width = originalStyles.width;
              container.style.height = originalStyles.height;
              container.style.position = originalStyles.position;
              throw new Error('Map instance creation failed');
            }
            
            // Wait for map to be ready before restoring original dimensions
            this.map.once('load', () => {
              // Restore original container styles
              container.style.width = originalStyles.width;
              container.style.height = originalStyles.height;
              container.style.position = originalStyles.position;
              
              // Force a resize after restoring dimensions
              setTimeout(() => {
                if (this.map && this.map.loaded()) {
                  this.map.resize();
                }
              }, 100);
            });
            
            this.finishMapInitialization();
            resolve();
          } catch (error) {
            console.error('❌ Map initialization failed:', error);
            // Retry with minimal configuration
            try {
              this.initializeMapFallback();
              resolve();
            } catch (fallbackError) {
              reject(fallbackError);
            }
          }
        });
      });
    });
  }
  
  private finishMapInitialization(): void {
    // Add attribution control
    const attributionControl = new AttributionControl({ compact: true });
    this.map.addControl(attributionControl, 'bottom-right');
    
    // Force collapse the attribution after it's added
    setTimeout(() => {
      const attributionContainer = document.querySelector('.maplibregl-ctrl-attrib');
      if (attributionContainer) {
        attributionContainer.classList.remove('maplibregl-compact-show');
        attributionContainer.classList.add('maplibregl-compact');
      }
    }, 100);
    
    // Add error handling for map operations
    this.map.on('error', (e) => {
      console.warn('⚠️ MapLibre error:', e);
    });
    
    // Initialize with day basemap
    this.map.on('load', () => {
      try {
        this.addDayBasemap();
        this.add3DTerrain();
        
        setTimeout(() => {
          this.applyPitchOverride();
        }, 500);
      } catch (error) {
        console.error('❌ Map load error:', error);
      }
    });
    
    // Set up globe projection after style loads
    this.map.on('style.load', () => {
      try {
        this.setGlobeProjection();
      } catch (error) {
        console.error('❌ Style load error:', error);
      }
    });
    
    // Add safer resize handling with debouncing - only after map is fully loaded
    let resizeTimeout: number;
    this.map.on('load', () => {
      window.addEventListener('resize', () => {
        clearTimeout(resizeTimeout);
        resizeTimeout = window.setTimeout(() => {
          try {
            if (this.map && this.map.loaded() && this.map.getContainer()) {
              const container = this.map.getContainer();
              const rect = container.getBoundingClientRect();
              
              // Only resize if container has valid dimensions and map is loaded
              if (rect.width > 0 && rect.height > 0) {
                this.map.resize();
              }
            }
          } catch (error) {
            console.warn('⚠️ Map resize error:', error);
          }
        }, 250); // Debounce resize events
      });
    });
  }
  
  private initializeMapFallback(): void {
    console.warn('⚠️ Using fallback map initialization');
    try {
      const container = document.getElementById('map');
      if (!container) {
        throw new Error('Map container not found in fallback');
      }
      
      // Set fixed dimensions during initialization to prevent matrix calculation errors
      const originalStyles = {
        width: container.style.width,
        height: container.style.height,
        position: container.style.position
      };
      
      container.style.width = '800px';
      container.style.height = '600px';
      container.style.position = 'absolute';
      
      // Force a reflow with fixed dimensions
      container.offsetHeight;
      
      this.map = new MapLibreMap({
        container: 'map',
        style: {
          version: 8,
          sources: {},
          layers: []
        },
        center: [0, 0],
        zoom: 2,
        pitch: 0,
        bearing: 0,
        attributionControl: false,
        maxPitch: 60, // Lower max pitch for fallback
        minZoom: 1,
        maxZoom: 18
      });
      
      // Wait for map to be ready before restoring original dimensions
      this.map.once('load', () => {
        // Restore original container styles
        container.style.width = originalStyles.width;
        container.style.height = originalStyles.height;
        container.style.position = originalStyles.position;
        
        // Force a resize after restoring dimensions
        setTimeout(() => {
          if (this.map && this.map.loaded()) {
            this.map.resize();
          }
        }, 100);
      });
      
      this.finishMapInitialization();
    } catch (error) {
      console.error('❌ Fallback map initialization also failed:', error);
      throw error;
    }
  }

  private setupSatelliteTrackerCallbacks(): void {
    this.satelliteTracker.setOnTrackingChangeCallback(() => this.updateURL());
    this.satelliteTracker.setOnSatelliteClickCallback((satelliteId: string) => {
      this.urlState.navigateToSatellite(satelliteId);
    });
    this.satelliteTracker.setOnStopFollowingCallback(() => {
      this.urlState.navigateToHome();
    });
  }

  private handleSatelliteSelection(satelliteId: string): void {
    this.urlState.navigateToSatellite(satelliteId);
    this.satelliteTracker.followSatellite(satelliteId);
    this.cockpitComponent.showMessage(`🎯 Following ${satelliteId}`, 'success');
  }

  private setupEventListeners(): void {
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

    // Handle night mode toggle
    document.addEventListener('nightModeToggle', () => {
      this.toggleBasemap();
    });
    
    // Add keyboard shortcut for projection toggle
    document.addEventListener('keydown', (e) => {
      if (document.activeElement?.tagName === 'INPUT') {
        return;
      }
      
      if (e.key === 'g' || e.key === 'G') {
        if (!e.ctrlKey && !e.metaKey) {
          e.preventDefault();
          this.toggleProjection();
        }
      }
    });
    
    // Direct pitch control
    pitchSlider?.addEventListener('input', (e) => {
      const pitch = parseInt((e.target as HTMLInputElement).value);
      pitchValue.textContent = pitch.toString();
      this.map.setPitch(pitch);
    });
    
    // Update slider when map pitch changes
    this.map.on('pitch', () => {
      const currentPitch = Math.round(this.map.getPitch());
      if (pitchSlider) pitchSlider.value = currentPitch.toString();
      if (pitchValue) pitchValue.textContent = currentPitch.toString();
    });
    
    this.setupCustomPitchControl();
  }

  private addDayBasemap(): void {
    this.removeNightBasemap();
    
    if (!this.map.getSource('esri-world-imagery')) {
      this.map.addSource('esri-world-imagery', {
        type: 'raster',
        tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
        tileSize: 256,
        minzoom: 2,
        maxzoom: 19,
        bounds: [-180, -85.051128779807, 180, 85.051128779807],
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

  private addNightBasemap(): void {
    this.removeDayBasemap();
    
    if (!this.map.getSource('nasa-night')) {
      this.map.addSource('nasa-night', {
        type: 'raster',
        tiles: ['https://map1.vis.earthdata.nasa.gov/wmts-webmerc/VIIRS_CityLights_2012/default/{time}/GoogleMapsCompatible_Level8/{z}/{y}/{x}.jpg'],
        tileSize: 256,
        minzoom: 2,
        maxzoom: 8,
        bounds: [-180, -85.051128779807, 180, 85.051128779807],
        attribution: 'Imagery provided by services from the Global Imagery Browse Services (GIBS), operated by the NASA/GSFC/Earth Science Data and Information System'
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

  private removeDayBasemap(): void {
    if (this.map.getLayer('esri-world-imagery')) {
      this.map.removeLayer('esri-world-imagery');
    }
    if (this.map.getSource('esri-world-imagery')) {
      this.map.removeSource('esri-world-imagery');
    }
  }

  private removeNightBasemap(): void {
    if (this.map.getLayer('nasa-night')) {
      this.map.removeLayer('nasa-night');
    }
    if (this.map.getSource('nasa-night')) {
      this.map.removeSource('nasa-night');
    }
  }

  private add3DTerrain(): void {
    this.map.addSource('terrain', {
      type: 'raster-dem',
      tiles: [
        'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'
      ],
      minzoom: 0,
      maxzoom: 15,
      tileSize: 256,
      encoding: 'terrarium'
    });

    this.map.setTerrain({
      source: 'terrain',
      exaggeration: 3
    });

    setTimeout(() => {
      this.applyPitchOverride();
    }, 100);
  }

  private setGlobeProjection(): void {
    try {
      this.map.setProjection({ type: 'globe' });
    } catch (error) {
      console.warn('⚠️ Globe projection not supported, falling back to mercator:', error);
      this.isGlobeMode = false;
    }
  }

  private toggleProjection(): void {
    try {
      if (this.isGlobeMode) {
        this.map.setProjection({ type: 'mercator' });
        this.isGlobeMode = false;
        this.cockpitComponent.showMessage('🗺️ Mercator projection enabled', 'info');
      } else {
        this.map.setProjection({ type: 'globe' });
        this.isGlobeMode = true;
        this.cockpitComponent.showMessage('🌍 Globe projection enabled', 'info');
      }
    } catch (error) {
      console.warn('⚠️ Projection switch failed:', error);
      this.cockpitComponent.showMessage('⚠️ Projection switch failed', 'error');
    }
  }

  private getFirstSatelliteLayerId(): string | undefined {
    const satelliteLayers = ['satellites-main', 'satellites-iss-icon', 'satellites-starlink-icon', 'satellites-sentinel-icon'];
    for (const layerId of satelliteLayers) {
      if (this.map.getLayer(layerId)) {
        return layerId;
      }
    }
    return undefined;
  }

  private toggleBasemap(): void {
    this.isDayMode = !this.isDayMode;
    if (this.isDayMode) {
      this.addDayBasemap();
    } else {
      this.addNightBasemap();
    }
  }

  private focusOnISS(): void {
    const satellites = this.satelliteDataService.getSatellites();
    const iss = satellites.get('iss-zarya-25544');
    if (iss) {
      this.urlState.navigateToSatellite('iss-zarya-25544');
      this.satelliteTracker.followSatellite('iss-zarya-25544');
    }
  }

  private toggleStarlinkVisibility(): void {
    this.satelliteTracker.toggleOrbits();
  }

  private togglePauseUpdates(): void {
    const isPaused = this.satelliteTracker.togglePause();
    const pauseBtn = document.getElementById('pause-updates');
    if (pauseBtn) {
      pauseBtn.textContent = isPaused ? 'Resume Updates' : 'Pause Updates';
    }
  }

  private toggleSatelliteTrackedOnly(): void {
    const isTracking = this.satelliteTracker.getFollowingSatellite() !== null;
    
    if (!isTracking) {
      return;
    }
    
    const currentState = this.satelliteTracker.getShowTrackedSatelliteOnly();
    const newState = !currentState;
    this.satelliteTracker.setShowTrackedSatelliteOnly(newState);
  }

  private startTracking(): void {
    this.map.on('load', async () => {
      const satelliteToTrack = this.urlState.getInitialSatellite() || 'iss-zarya-25544';
      
      
      // Check if satellite is in config for instant loading
      const configSatellite = this.satelliteDataService.getSatelliteConfigs().find(sat => sat.id === satelliteToTrack);
      
      if (configSatellite) {
        
        const satelliteLoaded = this.satelliteDataService.loadConfigSatelliteById(satelliteToTrack);
        
        if (satelliteLoaded) {
          // Pass satellite data to the tracker
          await this.satelliteTracker.setSatelliteDataService(this.satelliteDataService);
          this.satelliteTracker.updateLayers();
          this.satelliteTracker.startBackgroundUpdates();
          
          setTimeout(() => {
            const satellites = this.satelliteDataService.getSatellites();
            const satellite = satellites.get(satelliteToTrack);
            
            const zoomToUse = satellite?.defaultZoom ?? this.initialZoom;
            const pitchToUse = satellite?.defaultPitch ?? this.urlState.getInitialPitch();
            const bearingToUse = satellite?.defaultBearing ?? this.urlState.getInitialBearing();
            
            
            this.satelliteTracker.followSatelliteWithAnimation(
              satelliteToTrack, 
              zoomToUse,
              pitchToUse,
              bearingToUse
            );
            
            setTimeout(() => {
              // Additional satellites are already loaded in the service
            }, 1000);
            
          }, 100);
          
          setTimeout(() => {
            this.urlState.setInitializing(false);
            this.isInitializing = false;
          }, 2000);
        }
      }
      
      this.updateUI();
      setInterval(() => this.updateUI(), 5000);
    });
  }

  private updateURL(): void {
    if (this.isInitializing) {
      return;
    }
    
    const zoom = Math.round(this.map.getZoom() * 10) / 10;
    const pitch = Math.round(this.map.getPitch());
    const bearing = Math.round(this.map.getBearing());
    const followingSatellite = this.satelliteTracker.getFollowingSatellite() || '';
    
    const hasChanged = 
      Math.abs(zoom - this.lastURLState.zoom) > 0.1 ||
      Math.abs(pitch - this.lastURLState.pitch) > 1 ||
      Math.abs(bearing - this.lastURLState.bearing) > 1 ||
      followingSatellite !== this.lastURLState.satellite;
    
    if (!hasChanged) {
      return;
    }
    
    this.lastURLState = { zoom, pitch, bearing, satellite: followingSatellite };
    this.urlState.updateURL(zoom, followingSatellite, pitch, bearing);
  }

  private setupURLSharing(): void {
    this.urlState.setupURLSharing(this.map, () => this.updateURL());
  }

  private setupCommandPalette(): void {
    this.commandPalette = new CommandPalette();
    
    this.commandPalette.setCallbacks({
      onTrackSatellite: (satelliteId: string) => {
        this.urlState.navigateToSatellite(satelliteId);
        this.satelliteTracker.followSatellite(satelliteId);
      },
      onToggleNight: () => {
        if (this.isDayMode) {
          this.toggleBasemap();
        }
      },
      onToggleDay: () => {
        if (!this.isDayMode) {
          this.toggleBasemap();
        }
      },
      getSatellites: () => {
        return this.satelliteDataService.getSatellites();
      }
    });
  }

  private applyPitchOverride(): void {
    const map = this.map as any;
    
    try {
      // Try the standard API first
      if (typeof map.setMaxPitch === 'function') {
        map.setMaxPitch(85);
      }
      
      // Try transform properties with error handling
      if (map.transform && typeof map.transform === 'object') {
        try {
          if ('maxPitch' in map.transform) {
            map.transform.maxPitch = 85;
          }
          if ('_maxPitch' in map.transform) {
            map.transform._maxPitch = 85;
          }
        } catch (transformError) {
          // Expected behavior when properties are read-only
        }
      }
      
      // Try private properties with error handling
      try {
        if ('_maxPitch' in map) {
          map._maxPitch = 85;
        }
      } catch (privateError) {
        // Expected behavior when properties are read-only
      }
      
      // Try update function
      if (typeof map._update === 'function') {
        try {
          map._update();
        } catch (updateError) {
          // Expected behavior when _update is not available
        }
      }
      
    } catch (error) {
      console.error('❌ Error during maxPitch override:', error);
      // Continue anyway, the map might still work with default maxPitch
    }
  }

  private setupCustomPitchControl(): void {
    let isDragging = false;
    let lastY = 0;
    
    document.addEventListener('mousedown', (e) => {
      if (e.ctrlKey || e.metaKey) {
        isDragging = true;
        lastY = e.clientY;
        e.preventDefault();
      }
    });
    
    document.addEventListener('mousemove', (e) => {
      if (isDragging && (e.ctrlKey || e.metaKey)) {
        const deltaY = lastY - e.clientY;
        const currentPitch = this.map.getPitch();
        const newPitch = Math.min(85, Math.max(0, currentPitch + deltaY * 0.3));
        
        this.map.setPitch(newPitch);
        
        lastY = e.clientY;
        e.preventDefault();
      }
    });
    
    document.addEventListener('mouseup', () => {
      if (isDragging) {
        isDragging = false;
      }
    });
  }

  private updateUI(): void {
    const satellites = this.satelliteDataService.getSatellites();
    const followingSatellite = this.satelliteTracker.getFollowingSatellite();

    // Update cockpit status
    this.cockpitComponent.updateStatus(satellites, followingSatellite);

    // Update search with current satellites
    const satelliteArray = Array.from(satellites.values());
    this.searchComponent.setSatellites(satelliteArray, followingSatellite);
  }
}