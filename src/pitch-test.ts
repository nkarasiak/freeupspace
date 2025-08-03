import { Map as MapLibreMap, NavigationControl } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

class PitchTest {
  private map!: MapLibreMap;
  private hasTerrainAdded = false;

  constructor() {
    this.initializeMap();
    this.setupControls();
    this.updateInfo();
  }

  private initializeMap() {
    console.log('🚀 Initializing MapLibre map for pitch testing');
    
    this.map = new MapLibreMap({
      container: 'map',
      style: {
        version: 8,
        sources: {
          'osm': {
            type: 'raster',
            tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
            tileSize: 256,
            attribution: '© OpenStreetMap contributors'
          }
        },
        layers: [{
          id: 'osm',
          type: 'raster',
          source: 'osm'
        }]
      },
      center: [0, 45],
      zoom: 2,
      pitch: 0,
      bearing: 0,
      maxPitch: 85,
      pitchWithRotate: false
    });

    this.map.addControl(new NavigationControl(), 'top-right');

    this.map.on('load', () => {
      console.log('✅ Map loaded');
      this.updateInfo();
      
      // Try aggressive maxPitch override after load
      setTimeout(() => this.overrideMaxPitch(), 500);
    });

    // Update info on map changes
    this.map.on('pitch', () => this.updateInfo());
    this.map.on('pitchend', () => this.updateInfo());
  }

  private setupControls() {
    const pitchSlider = document.getElementById('pitch-slider') as HTMLInputElement;
    const pitchValue = document.getElementById('pitch-value') as HTMLSpanElement;
    const zoomSlider = document.getElementById('zoom-slider') as HTMLInputElement;
    const zoomValue = document.getElementById('zoom-value') as HTMLSpanElement;

    // Pitch slider
    pitchSlider.addEventListener('input', (e) => {
      const pitch = parseInt((e.target as HTMLInputElement).value);
      pitchValue.textContent = pitch.toString();
      this.map.setPitch(pitch);
      console.log(`🎚️ Slider set pitch to: ${pitch}°`);
    });

    // Zoom slider
    zoomSlider.addEventListener('input', (e) => {
      const zoom = parseFloat((e.target as HTMLInputElement).value);
      zoomValue.textContent = zoom.toString();
      this.map.setZoom(zoom);
    });

    // Test buttons
    document.getElementById('test-pitch-60')?.addEventListener('click', () => {
      this.testPitch(60);
    });

    document.getElementById('test-pitch-70')?.addEventListener('click', () => {
      this.testPitch(70);
    });

    document.getElementById('test-pitch-85')?.addEventListener('click', () => {
      this.testPitch(85);
    });

    // Override button
    document.getElementById('override-maxpitch')?.addEventListener('click', () => {
      this.overrideMaxPitch();
    });

    // Terrain buttons
    document.getElementById('add-terrain')?.addEventListener('click', () => {
      this.addTerrain();
    });

    document.getElementById('remove-terrain')?.addEventListener('click', () => {
      this.removeTerrain();
    });
  }

  private testPitch(targetPitch: number) {
    console.log(`🎯 Testing pitch: ${targetPitch}°`);
    this.map.setPitch(targetPitch);
    
    setTimeout(() => {
      const actualPitch = this.map.getPitch();
      console.log(`📊 Requested: ${targetPitch}°, Actual: ${actualPitch}°`);
      
      if (Math.abs(actualPitch - targetPitch) > 0.1) {
        console.warn(`⚠️ Pitch clamped! Requested ${targetPitch}°, got ${actualPitch}°`);
      } else {
        console.log(`✅ Pitch set successfully to ${actualPitch}°`);
      }
      
      this.updateInfo();
    }, 100);
  }

  private overrideMaxPitch() {
    console.log('🔧 Attempting aggressive maxPitch override...');
    
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
      
      // Method 5: Navigation control override
      const navControls = map._controls;
      if (navControls) {
        navControls.forEach((control: any) => {
          if (control._pitchButton) {
            console.log('🎮 Found navigation control with pitch button');
          }
        });
      }
      
    } catch (error) {
      console.error('❌ Error during maxPitch override:', error);
    }
    
    this.updateInfo();
  }

  private addTerrain() {
    if (this.hasTerrainAdded) {
      console.log('⚠️ Terrain already added');
      return;
    }

    console.log('🏔️ Adding terrain...');
    
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
      exaggeration: 1.5
    });

    this.hasTerrainAdded = true;
    
    // Override maxPitch after terrain is added
    setTimeout(() => {
      this.overrideMaxPitch();
      this.updateInfo();
    }, 500);
  }

  private removeTerrain() {
    if (!this.hasTerrainAdded) {
      console.log('⚠️ No terrain to remove');
      return;
    }

    console.log('🗑️ Removing terrain...');
    
    this.map.setTerrain(null);
    this.map.removeSource('terrain');
    this.hasTerrainAdded = false;
    
    // Override maxPitch after terrain is removed
    setTimeout(() => {
      this.overrideMaxPitch();
      this.updateInfo();
    }, 500);
  }

  private updateInfo() {
    const currentPitch = this.map.getPitch();
    const maxPitch = this.map.getMaxPitch();
    const transformMaxPitch = (this.map as any).transform?.maxPitch || 'N/A';
    
    document.getElementById('current-pitch')!.textContent = currentPitch.toFixed(1);
    document.getElementById('max-pitch')!.textContent = maxPitch.toString();
    document.getElementById('transform-maxpitch')!.textContent = transformMaxPitch.toString();
    document.getElementById('terrain-status')!.textContent = this.hasTerrainAdded ? 'Yes' : 'No';
    document.getElementById('maplibre-version')!.textContent = '4.1.1';
    
    // Update slider to match current pitch
    const pitchSlider = document.getElementById('pitch-slider') as HTMLInputElement;
    const pitchValue = document.getElementById('pitch-value') as HTMLSpanElement;
    if (pitchSlider && pitchValue) {
      pitchSlider.value = currentPitch.toString();
      pitchValue.textContent = Math.round(currentPitch).toString();
    }
  }
}

// Initialize the test
new PitchTest();