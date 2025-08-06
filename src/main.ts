import { Map as MapLibreMap, AttributionControl } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { DeckSatelliteTracker } from './deck-satellite-tracker';
import { URLState } from './url-state';
import { CommandPalette } from './command-palette';
import { SearchComponent } from './components/search.component';
import { CockpitComponent } from './components/cockpit.component';
import { SEOManager } from './seo-manager';
import { SolarCalculator } from './utils/solar-calculator';

class SatelliteTracker3D {
  private map!: MapLibreMap;
  private satelliteTracker!: DeckSatelliteTracker;
  private isDayMode = true;
  private autoNightMode = false; // Auto switch based on satellite position
  private isGlobeMode = true; // Start with globe projection
  private urlState = new URLState();
  private commandPalette!: CommandPalette;
  private searchComponent!: SearchComponent;
  private _cockpitComponent!: CockpitComponent;
  private initialZoom!: number;
  private isInitializing = true;
  private lastURLState = { zoom: 0, pitch: 0, bearing: 0, satellite: '' }; // Track URL-relevant changes
  private lastFollowingSatellite: string | null = null; // Track when satellite changes

  constructor() {
    this.initializeMap();
    this.satelliteTracker = new DeckSatelliteTracker(this.map);
    this.satelliteTracker.setOnTrackingChangeCallback(() => this.updateURL());
    this.satelliteTracker.setOnSatellitesLoadedCallback(() => {
      // Refresh command palette when satellites are loaded
      this.commandPalette?.refreshSatelliteList();
    });
    this.setupEventListeners();
    this.setupURLSharing();
    this.setupCommandPalette();
    this.setupSearchComponent();
    this.setupCockpitComponent();
    this.startTracking();
    
    // Temporary debugging - expose tracker to console
    (window as any).satelliteTracker = this.satelliteTracker;
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
    
    
    this.map = new MapLibreMap({
      container: 'map',
      style: {
        version: 8,
        sources: {},
        layers: []
      },
      center: initialCenter,
      zoom: initialSatellite ? 4 : this.initialZoom, // Start at safe zoom level to avoid terrain tile errors
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
    
    // Set up globe projection after style loads
    this.map.on('style.load', () => {
      this.setGlobeProjection();
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
    try {
      // Add terrain source using Terrarium terrain data (free)
      this.map.addSource('terrain', {
        type: 'raster-dem',
        tiles: [
          'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'
        ],
        minzoom: 4,
        maxzoom: 15,
        tileSize: 256,
        encoding: 'terrarium' // Terrarium encoding format
      });

      // Only enable terrain if we're at a safe zoom level
      const currentZoom = this.map.getZoom();
      if (currentZoom >= 4) {
        try {
          this.map.setTerrain({
            source: 'terrain',
            exaggeration: 3 // Exaggerate elevation by 3x for dramatic effect from satellite view
          });
        } catch (error) {
          console.warn('Failed to set terrain immediately, will retry on zoom:', error);
        }
      } else {
        // Wait for zoom to reach safe level before enabling terrain
        const onZoomEnd = () => {
          if (this.map.getZoom() >= 4) {
            this.map.off('zoomend', onZoomEnd);
            try {
              this.map.setTerrain({
                source: 'terrain',
                exaggeration: 3
              });
            } catch (error) {
              console.warn('Failed to set terrain on zoom end:', error);
            }
          }
        };
        this.map.on('zoomend', onZoomEnd);
      }

      // Apply pitch override after terrain is added
      setTimeout(() => {
        this.applyPitchOverride();
      }, 100);
    } catch (error) {
      console.warn('Failed to add 3D terrain:', error);
    }
  }

  private setGlobeProjection() {
    try {
      this.map.setProjection({ type: 'globe' });
    } catch (error) {
      this.isGlobeMode = false;
    }
  }

  private toggleProjection() {
    try {
      if (this.isGlobeMode) {
        this.map.setProjection({ type: 'mercator' });
        this.isGlobeMode = false;
        this.showMessage('🗺️ Mercator projection enabled', 'info');
      } else {
        this.map.setProjection({ type: 'globe' });
        this.isGlobeMode = true;
        this.showMessage('🌍 Globe projection enabled', 'info');
      }
    } catch (error) {
      this.showMessage('⚠️ Projection switch failed', 'error');
    }
  }

  private toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => {
        this.showMessage('🖥️ Fullscreen enabled', 'info');
      }).catch(() => {
        this.showMessage('⚠️ Fullscreen failed', 'error');
      });
    } else {
      document.exitFullscreen().then(() => {
        this.showMessage('🖥️ Fullscreen disabled', 'info');
      }).catch(() => {
        this.showMessage('⚠️ Exit fullscreen failed', 'error');
      });
    }
  }

  private resetBearingToAutomatic() {
    const followingSatellite = this.satelliteTracker.getFollowingSatellite();
    if (followingSatellite) {
      const smoothCamera = this.satelliteTracker.getSmoothCamera();
      smoothCamera.setUserControlledBearing(false);
      this.showMessage('🧭 Bearing reset to automatic', 'info');
    }
  }

  private showMessage(message: string, type: 'success' | 'error' | 'warning' | 'info') {
    const messageDiv = document.createElement('div');
    messageDiv.style.cssText = `
      position: fixed;
      top: 200px;
      right: 20px;
      z-index: 2000;
      padding: 10px 15px;
      border-radius: 6px;
      color: white;
      font-weight: bold;
      font-size: 14px;
      font-family: Arial, sans-serif;
    `;
    
    switch (type) {
      case 'success':
        messageDiv.style.backgroundColor = 'rgba(0, 255, 0, 0.8)';
        break;
      case 'error':
        messageDiv.style.backgroundColor = 'rgba(255, 0, 0, 0.8)';
        break;
      case 'warning':
        messageDiv.style.backgroundColor = 'rgba(255, 165, 0, 0.8)';
        break;
      case 'info':
        messageDiv.style.backgroundColor = 'rgba(0, 150, 255, 0.8)';
        break;
    }
    
    messageDiv.textContent = message;
    document.body.appendChild(messageDiv);
    
    setTimeout(() => {
      messageDiv.remove();
    }, 3000);
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

    // Handle night mode toggle from the new simplified cockpit
    document.addEventListener('nightModeToggle', () => {
      this.toggleBasemap();
    });
    
    // Handle auto night mode toggle
    document.addEventListener('autoNightModeToggle', () => {
      this.toggleAutoNightMode();
    });
    
    // Add keyboard shortcut for projection toggle
    document.addEventListener('keydown', (e) => {
      // Only respond to shortcuts if no input elements are focused
      if (document.activeElement?.tagName === 'INPUT') {
        return;
      }
      
      // Let deck-satellite-tracker handle Shift+Arrow keys for satellite resizing
      if (e.shiftKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
        console.log('Main.ts: Letting deck-satellite-tracker handle Shift+Arrow');
        return; // Don't handle here, let deck-satellite-tracker handle it
      }
      
      if (e.key === 'g' || e.key === 'G') {
        if (!e.ctrlKey && !e.metaKey) {
          e.preventDefault();
          this.toggleProjection();
        }
      }
      
      // F key to toggle fullscreen
      if (e.key === 'f' || e.key === 'F') {
        if (!e.ctrlKey && !e.metaKey) {
          e.preventDefault();
          this.toggleFullscreen();
        }
      }
      
      // Escape key to stop satellite tracking
      if (e.key === 'Escape') {
        e.preventDefault();
        this.satelliteTracker.stopFollowing();
      }
      
      // B key to reset bearing to automatic mode
      if (e.key === 'b' || e.key === 'B') {
        if (!e.ctrlKey && !e.metaKey) {
          e.preventDefault();
          this.resetBearingToAutomatic();
        }
      }
      
      // N key to toggle auto night mode
      if (e.key === 'n' || e.key === 'N') {
        if (!e.ctrlKey && !e.metaKey) {
          e.preventDefault();
          this.toggleAutoNightMode();
        }
      }
    });
    
    
    // Add custom Ctrl+drag pitch handling that uses MapLibre directly
    this.setupCustomPitchControl();
  }

  private toggleBasemap() {
    // Note: This manual toggle will be overridden by automatic switching
    this.isDayMode = !this.isDayMode;
    if (this.isDayMode) {
      this.addDayBasemap();
      this.showMessage('☀️ Day basemap enabled (will auto-switch based on satellite)', 'info');
    } else {
      this.addNightBasemap();
      this.showMessage('🌙 Night basemap enabled (will auto-switch based on satellite)', 'info');
    }
  }

  private toggleAutoNightMode() {
    this.autoNightMode = !this.autoNightMode;
    if (this.autoNightMode) {
      this.showMessage('🌍 Auto night mode enabled', 'info');
      this.updateBasemapForSatellite(); // Update immediately
    } else {
      this.showMessage('🌍 Auto night mode disabled', 'info');
    }
  }

  private updateBasemapForSatellite() {
    // Always update basemap based on satellite's local time (no flag needed)

    const followingSatellite = this.satelliteTracker.getFollowingSatellite();
    if (!followingSatellite) return;

    const satellites = this.satelliteTracker.getSatellites();
    const satellite = satellites.get(followingSatellite);
    
    if (satellite && satellite.position) {
      const currentTime = new Date();
      const localTime = SolarCalculator.getLocalTime(satellite.position.lng, currentTime);
      const solarElevation = SolarCalculator.calculateSolarElevation(
        satellite.position.lat,
        satellite.position.lng,
        currentTime
      );
      const isNight = solarElevation < 0;

      // Only change basemap if the day/night state has changed
      if (isNight !== !this.isDayMode) {
        this.isDayMode = !isNight;
        if (this.isDayMode) {
          this.addDayBasemap();
          console.log(`🌍 AUTO-SWITCHED to DAY basemap for ${satellite.name || followingSatellite} (local time: ${localTime}, solar elevation: ${solarElevation.toFixed(1)}°)`);
        } else {
          this.addNightBasemap();
          console.log(`🌙 AUTO-SWITCHED to NIGHT basemap for ${satellite.name || followingSatellite} (local time: ${localTime}, solar elevation: ${solarElevation.toFixed(1)}°)`);
        }
      }
    }
  }


  private startTracking() {
    this.map.on('load', () => {
      // Restore satellite tracking from URL if specified, otherwise default to ISS
      const satelliteToTrack = this.urlState.getInitialSatellite() || 'iss-zarya';
      const isDefaultISS = !this.urlState.getInitialSatellite(); // True if we're defaulting to ISS
      
      // Enable external satellite loading for search functionality
      this.satelliteTracker.enableExternalSatelliteLoading();
      // Keep showing only tracked satellite for performance
      this.satelliteTracker.setShowTrackedSatelliteOnly(true);
      
      // Check if satellite is in config and has TLE data for instant loading
      const configSatellite = this.satelliteTracker.getSatelliteConfigs().find(sat => sat.id === satelliteToTrack);
      
      if (configSatellite && configSatellite.tle1 && configSatellite.tle2) {
        
        // Load config satellite immediately (no API dependency)
        const satelliteLoaded = this.satelliteTracker.loadConfigSatelliteById(satelliteToTrack);
        
        if (satelliteLoaded) {
          // Start layers and background updates immediately
          this.satelliteTracker.updateLayers();
          this.satelliteTracker.startBackgroundUpdates();
          
          // Satellites will be loaded on-demand when searching
          
          // Start satellite tracking immediately
          setTimeout(() => {
            const zoomToUse = isDefaultISS ? 5 : this.initialZoom;
            const pitchToUse = isDefaultISS ? 60 : this.urlState.getInitialPitch();
            
            
            // Get satellite data to check for default bearing and other properties
            const satellite = this.satelliteTracker.getSatellites().get(satelliteToTrack);
            const bearingToUse = satellite?.defaultBearing ?? this.urlState.getInitialBearing();
            
            // Use satellite-specific zoom and pitch if available
            const finalZoomToUse = satellite?.defaultZoom ?? zoomToUse;
            const finalPitchToUse = satellite?.defaultPitch ?? pitchToUse;
            
            console.log(`🎯 Tracking satellite "${satelliteToTrack}" with:`, {
              zoom: finalZoomToUse,
              pitch: finalPitchToUse,
              bearing: bearingToUse,
              altitude: satellite?.altitude,
              position: satellite?.position ? `${satellite.position.lat.toFixed(2)}, ${satellite.position.lng.toFixed(2)}` : 'undefined'
            });
            
            if (satellite && satellite.position) {
              this.satelliteTracker.followSatelliteWithAnimation(
                satelliteToTrack, 
                finalZoomToUse,
                finalPitchToUse,
                bearingToUse
              );
            } else {
              console.warn(`⚠️ Satellite "${satelliteToTrack}" not found or has no position`);
            }
            
          }, 100); // Very short delay for satellite tracking
          
          setTimeout(() => {
            this.urlState.setInitializing(false);
            this.isInitializing = false;
          }, 2000); // Shorter timeout for instant tracking
        }
      } else {
        // For non-config satellites, load just the specific satellite first
        setTimeout(async () => {
          // Re-enable external satellite loading for specific satellite requests
          this.satelliteTracker.enableExternalSatelliteLoading();
          
          // Try to load just the specific satellite we need
          const targetSatellite = await this.satelliteTracker.loadSpecificSatellite(satelliteToTrack);
          
          if (targetSatellite) {
            // Start layers and updates with just this satellite
            this.satelliteTracker.updateLayers();
            this.satelliteTracker.startBackgroundUpdates();
            
            // Satellites will be loaded on-demand when searching
            
            const zoomToUse = this.initialZoom;
            const pitchToUse = this.urlState.getInitialPitch();
            
            // Track the satellite immediately
            setTimeout(() => {
              const satellite = this.satelliteTracker.getSatellites().get(satelliteToTrack);
              const bearingToUse = satellite?.defaultBearing ?? this.urlState.getInitialBearing();
              
              this.satelliteTracker.followSatelliteWithAnimation(
                satelliteToTrack, 
                zoomToUse,
                pitchToUse,
                bearingToUse
              );
            }, 100);
            
            setTimeout(() => {
              this.urlState.setInitializing(false);
              this.isInitializing = false;
            }, 2000);
          } else {
            // Fallback: if specific satellite not found, load ISS and all satellites
            const issLoaded = this.satelliteTracker.loadConfigSatelliteById('iss-zarya');
            if (issLoaded) {
              this.satelliteTracker.updateLayers();
              this.satelliteTracker.startBackgroundUpdates();
              this.satelliteTracker.followSatelliteWithAnimation('iss-zarya', 5, 60, 0);
              
              // Satellites will be loaded on-demand when searching
            } else {
              this.urlState.removeInvalidSatellite();
            }
            
            setTimeout(() => {
              this.urlState.setInitializing(false);
              this.isInitializing = false;
            }, 4000);
          }
        }, 500);
      }
      
      this.updateUI();
      setInterval(() => {
        this.updateUI();
        this.updateBasemapForSatellite(); // Check for day/night changes
      }, 5000);
    });
  }

  private updateURL() {
    // Skip URL updates during initialization to prevent premature updates
    if (this.isInitializing) {
      // Skipping URL update during initialization
      return;
    }
    
    const zoom = Math.round(this.map.getZoom() * 10) / 10; // Round to 1 decimal
    const pitch = Math.round(this.map.getPitch());
    const bearing = Math.round(this.map.getBearing());
    const followingSatellite = this.satelliteTracker.getFollowingSatellite() || '';
    
    // Only update URL if values that are actually stored in URL have changed
    const hasChanged = 
      Math.abs(zoom - this.lastURLState.zoom) > 0.1 ||
      Math.abs(pitch - this.lastURLState.pitch) > 1 ||
      Math.abs(bearing - this.lastURLState.bearing) > 1 ||
      followingSatellite !== this.lastURLState.satellite;
    
    if (!hasChanged) {
      return; // No URL-relevant changes
    }
    
    // Update stored state
    this.lastURLState = { zoom, pitch, bearing, satellite: followingSatellite };
    
    this.urlState.updateURL(zoom, followingSatellite, pitch, bearing);
  }

  private setupURLSharing() {
    this.urlState.setupURLSharing(this.map, () => this.updateURL());
  }

  private setupCommandPalette() {
    this.commandPalette = new CommandPalette();
    
    // Set up command palette callbacks
    this.commandPalette.setCallbacks({
      onTrackSatellite: async (satelliteId: string) => {
        // Load satellite from search database if not already active
        if (!this.satelliteTracker.getSatellites().has(satelliteId)) {
          this.satelliteTracker.loadSatelliteFromSearchDatabase(satelliteId);
        }
        this.satelliteTracker.followSatellite(satelliteId);
        
        // Update SEO meta tags for the tracked satellite
        this.updateSEOForSatellite(satelliteId);
      },
      getSatellites: () => {
        return this.satelliteTracker.getSatellites();
      },
      getSearchDatabase: () => {
        return this.satelliteTracker.getSearchDatabase();
      },
      loadSearchDatabase: async () => {
        await this.satelliteTracker.loadAllSatellitesForSearch();
      }
    });
  }

  private setupSearchComponent() {
    this.searchComponent = new SearchComponent();
    
    // Set up search component callbacks - same as command palette
    this.searchComponent.setCallbacks({
      onSatelliteSelect: (satelliteId: string) => {
        this.satelliteTracker.followSatellite(satelliteId);
        
        // Update SEO meta tags for the tracked satellite
        this.updateSEOForSatellite(satelliteId);
      },
      getSatellites: () => {
        return this.satelliteTracker.getSatellites();
      }
    });
  }

  private setupCockpitComponent() {
    this._cockpitComponent = new CockpitComponent();
    // Pass the command palette instance so it can open it
    this._cockpitComponent.setCommandPalette(this.commandPalette);
    // Reference it to satisfy TypeScript unused variable check
    void this._cockpitComponent;
  }

  /**
   * Update SEO meta tags when tracking a specific satellite
   */
  private updateSEOForSatellite(satelliteId: string) {
    // Get satellite data from active satellites or search database
    let satellite = this.satelliteTracker.getSatellites().get(satelliteId);
    if (!satellite) {
      satellite = this.satelliteTracker.getSearchDatabase().get(satelliteId);
    }

    if (satellite) {
      SEOManager.updateMetaForSatellite({
        id: satelliteId,
        name: satellite.name,
        alternateName: satellite.alternateName,
        type: satellite.type,
        altitude: satellite.altitude,
        image: satellite.image
      });

      // Update URL state to reflect the tracked satellite
      this.urlState.navigateToSatellite(satelliteId);
    } else {
      console.warn(`Could not find satellite data for SEO update: ${satelliteId}`);
    }
  }

  private applyPitchOverride() {
    const map = this.map as any;
    
    try {
      // Standard API - this is the correct way to set max pitch
      map.setMaxPitch(85);
      
    } catch (error) {
    }
  }

  private setupCustomPitchControl() {
    let isDragging = false;
    let lastY = 0;
    let lastX = 0;
    
    
    // Attach to document to catch all events
    document.addEventListener('mousedown', (e) => {
      const isTracking = this.satelliteTracker.getFollowingSatellite() !== null;
      
      // In tracking mode: any drag works, otherwise need Ctrl
      if (isTracking || e.ctrlKey || e.metaKey) {
        isDragging = true;
        lastY = e.clientY;
        lastX = e.clientX;
        e.preventDefault();
      }
    });
    
    document.addEventListener('mousemove', (e) => {
      const isTracking = this.satelliteTracker.getFollowingSatellite() !== null;
      
      // In tracking mode: any drag works, otherwise need Ctrl  
      if (isDragging && (isTracking || e.ctrlKey || e.metaKey)) {
        const deltaY = lastY - e.clientY;
        const deltaX = e.clientX - lastX;
        
        // Control pitch with vertical mouse movement
        const currentPitch = this.map.getPitch();
        const newPitch = Math.min(85, Math.max(0, currentPitch + deltaY * 0.3));
        this.map.setPitch(newPitch);
        
        // Control bearing with horizontal mouse movement (only in tracking mode)
        if (isTracking && Math.abs(deltaX) > 1) { // Only activate on significant horizontal movement
          const smoothCamera = this.satelliteTracker.getSmoothCamera();
          const currentBearing = this.map.getBearing();
          const newBearing = (currentBearing + deltaX * 0.5) % 360;
          
          // Enable user-controlled bearing mode and show feedback on first use
          if (!smoothCamera.isUserControlledBearing()) {
            smoothCamera.setUserControlledBearing(true, newBearing);
            this.showMessage('🧭 Manual bearing control active (Press B to reset)', 'info');
          } else {
            smoothCamera.updateUserBearing(newBearing);
          }
          
          this.map.setBearing(newBearing);
        }
        
        lastY = e.clientY;
        lastX = e.clientX;
        e.preventDefault();
      }
    });
    
    document.addEventListener('mouseup', () => {
      if (isDragging) {
        isDragging = false;
      }
    });
    
  }

  private updateUI() {
    const satellites = this.satelliteTracker.getSatellites();
    const followingSatellite = this.satelliteTracker.getFollowingSatellite();

    // Update status displays
    const trackedAltitudeElement = document.getElementById('tracked-altitude');
    const trackedNameElement = document.getElementById('tracked-name');
    const trackedSpeedElement = document.getElementById('tracked-speed');
    
    // Update search component with current following satellite
    this.searchComponent?.setFollowingSatellite(followingSatellite);
    
    // Only update search input when the satellite actually changes
    if (followingSatellite !== this.lastFollowingSatellite) {
      this.lastFollowingSatellite = followingSatellite;
      
      if (followingSatellite) {
        const trackedSatellite = satellites.get(followingSatellite);
        if (trackedSatellite) {
          // Update search input with current satellite name only when satellite changes
          this.searchComponent?.updateSearchInput(trackedSatellite.shortname || trackedSatellite.name);
        }
      } else {
        // Clear search input only when stopping tracking
        this.searchComponent?.updateSearchInput('');
      }
    }
    
    // Update tracked satellite information
    if (followingSatellite) {
      const trackedSatellite = satellites.get(followingSatellite);
      if (trackedSatellite) {
        if (trackedAltitudeElement) trackedAltitudeElement.textContent = trackedSatellite.altitude.toFixed(0);
        if (trackedNameElement) trackedNameElement.textContent = trackedSatellite.shortname || trackedSatellite.name;
        if (trackedSpeedElement) trackedSpeedElement.textContent = trackedSatellite.velocity.toFixed(2);
        
        // Log local time at satellite position
      }
    } else {
      // No satellite being tracked - show defaults
      if (trackedAltitudeElement) trackedAltitudeElement.textContent = '---';
      if (trackedNameElement) trackedNameElement.textContent = '---';
      if (trackedSpeedElement) trackedSpeedElement.textContent = '---';
    }
    
  }
}

new SatelliteTracker3D();