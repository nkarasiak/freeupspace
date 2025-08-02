import { Map as MapLibreMap, LngLat } from 'maplibre-gl';
import * as satellite from 'satellite.js';

export interface SatelliteData {
  id: string;
  name: string;
  type: 'scientific' | 'communication' | 'navigation' | 'earth-observation' | 'weather';
  position: LngLat;
  altitude: number;
  velocity: number;
  tle1: string;
  tle2: string;
}

export class SatelliteTracker {
  private map: MapLibreMap;
  private satellites: Map<string, SatelliteData> = new Map();
  private satelliteTrails: Map<string, LngLat[]> = new Map();
  private animationId: number | null = null;
  private showTrails = false;
  private followingSatellite: string | null = null;

  constructor(map: MapLibreMap) {
    this.map = map;
  }

  initialize() {
    this.loadSampleSatellites();
    this.loadSatelliteImages();
    this.setupMapLayers();
    this.setupMapInteractions();
    this.startTracking();
  }

  private loadSampleSatellites() {
    const sampleSatellites = [
      {
        id: 'iss',
        name: 'International Space Station',
        type: 'scientific' as const,
        tle1: '1 25544U 98067A   25214.09653981  .00010888  00000+0  19653-3 0  9996',
        tle2: '2 25544  51.6345  79.5266 0001736 142.9190 217.1919 15.50282964522285'
      },
      {
        id: 'hubble',
        name: 'Hubble Space Telescope',
        type: 'scientific' as const,
        tle1: '1 20580U 90037B   25214.12345678  .00001234  00000-0  56789-4 0  9991',
        tle2: '2 20580  28.4690 123.4567 0002345  78.9012 281.2345 15.09876543123456'
      },
      {
        id: 'noaa-20',
        name: 'NOAA-20 Weather Satellite',
        type: 'weather' as const,
        tle1: '1 43013U 17073A   25214.23456789  .00000987  00000-0  45678-4 0  9998',
        tle2: '2 43013  98.7890 234.5678 0001987  89.0123 271.1234 14.19876543234567'
      },
      // Starlink constellation - Shell 1
      {
        id: 'starlink-1007',
        name: 'Starlink-1007',
        type: 'communication' as const,
        tle1: '1 44713U 19074A   25214.12345678  .00002182  00000-0  15494-3 0  9999',
        tle2: '2 44713  53.0534 123.4567 0001234  92.4356 267.7077 15.05000000270000'
      },
      {
        id: 'starlink-1019',
        name: 'Starlink-1019',
        type: 'communication' as const,
        tle1: '1 44714U 19074B   25214.13456789  .00002089  00000-0  14876-3 0  9998',
        tle2: '2 44714  53.0535 124.5678 0001345  93.5467 268.8188 15.05000000271111'
      },
      {
        id: 'starlink-1021',
        name: 'Starlink-1021',
        type: 'communication' as const,
        tle1: '1 44715U 19074C   25214.14567890  .00001996  00000-0  14258-3 0  9997',
        tle2: '2 44715  53.0536 125.6789 0001456  94.6578 269.9299 15.05000000272222'
      },
      {
        id: 'starlink-1024',
        name: 'Starlink-1024',
        type: 'communication' as const,
        tle1: '1 44716U 19074D   25214.15678901  .00001903  00000-0  13640-3 0  9996',
        tle2: '2 44716  53.0537 126.7890 0001567  95.7689 271.0410 15.05000000273333'
      },
      {
        id: 'starlink-1030',
        name: 'Starlink-1030',
        type: 'communication' as const,
        tle1: '1 44717U 19074E   25214.16789012  .00001810  00000-0  13022-3 0  9995',
        tle2: '2 44717  53.0538 127.8901 0001678  96.8790 272.1521 15.05000000274444'
      },
      // Starlink Shell 2 - Different inclination
      {
        id: 'starlink-2256',
        name: 'Starlink-2256',
        type: 'communication' as const,
        tle1: '1 47129U 20088A   25214.17890123  .00003456  00000-0  23456-3 0  9994',
        tle2: '2 47129  53.2000 234.5678 0002345  78.9012 281.2345 15.06000000180000'
      },
      {
        id: 'starlink-2272',
        name: 'Starlink-2272',
        type: 'communication' as const,
        tle1: '1 47130U 20088B   25214.18901234  .00003363  00000-0  22838-3 0  9993',
        tle2: '2 47130  53.2001 235.6789 0002456  79.0123 282.3456 15.06000000181111'
      },
      {
        id: 'starlink-2285',
        name: 'Starlink-2285',
        type: 'communication' as const,
        tle1: '1 47131U 20088C   25214.19012345  .00003270  00000-0  22220-3 0  9992',
        tle2: '2 47131  53.2002 236.7890 0002567  80.1234 283.4567 15.06000000182222'
      },
      {
        id: 'starlink-2313',
        name: 'Starlink-2313',
        type: 'communication' as const,
        tle1: '1 47132U 20088D   25214.20123456  .00003177  00000-0  21602-3 0  9991',
        tle2: '2 47132  53.2003 237.8901 0002678  81.2345 284.5678 15.06000000183333'
      },
      // Starlink Shell 3 - Polar orbit
      {
        id: 'starlink-4682',
        name: 'Starlink-4682',
        type: 'communication' as const,
        tle1: '1 53755U 22107A   25214.21234567  .00001674  00000-0  12284-3 0  9990',
        tle2: '2 53755  97.6000 345.6789 0001234  92.4356 267.7077 15.17000000140000'
      },
      {
        id: 'starlink-4683',
        name: 'Starlink-4683',
        type: 'communication' as const,
        tle1: '1 53756U 22107B   25214.22345678  .00001580  00000-0  11890-3 0  9989',
        tle2: '2 53756  97.6001 346.7890 0001456  95.2100 264.9300 15.17000000141111'
      },
      {
        id: 'starlink-4684',
        name: 'Starlink-4684',
        type: 'communication' as const,
        tle1: '1 53757U 22107C   25214.23456789  .00001486  00000-0  11496-3 0  9988',
        tle2: '2 53757  97.6002 347.8901 0001567  96.3211 263.8189 15.17000000142222'
      },
      {
        id: 'starlink-4685',
        name: 'Starlink-4685',
        type: 'communication' as const,
        tle1: '1 53758U 22107D   25214.24567890  .00001392  00000-0  11102-3 0  9987',
        tle2: '2 53758  97.6003 348.9012 0001678  97.4322 262.7078 15.17000000143333'
      },
      // Starlink Generation 2 - Different altitude
      {
        id: 'starlink-gen2-7001',
        name: 'Starlink Gen2-7001',
        type: 'communication' as const,
        tle1: '1 58001U 23001A   25214.25678901  .00004567  00000-0  28901-3 0  9986',
        tle2: '2 58001  53.0000 456.7890 0003456  89.0123 271.1234 15.25000000100000'
      },
      {
        id: 'starlink-gen2-7002',
        name: 'Starlink Gen2-7002',
        type: 'communication' as const,
        tle1: '1 58002U 23001B   25214.26789012  .00004474  00000-0  28283-3 0  9985',
        tle2: '2 58002  53.0001 457.8901 0003567  90.1234 272.2345 15.25000000101111'
      },
      {
        id: 'starlink-gen2-7003',
        name: 'Starlink Gen2-7003',
        type: 'communication' as const,
        tle1: '1 58003U 23001C   25214.27890123  .00004381  00000-0  27665-3 0  9984',
        tle2: '2 58003  53.0002 458.9012 0003678  91.2345 273.3456 15.25000000102222'
      },
      {
        id: 'starlink-gen2-7004',
        name: 'Starlink Gen2-7004',
        type: 'communication' as const,
        tle1: '1 58004U 23001D   25214.28901234  .00004288  00000-0  27047-3 0  9983',
        tle2: '2 58004  53.0003 459.0123 0003789  92.3456 274.4567 15.25000000103333'
      },
      // Starlink Direct-to-Cell satellites
      {
        id: 'starlink-dtc-8001',
        name: 'Starlink DTC-8001',
        type: 'communication' as const,
        tle1: '1 59001U 24001A   25214.29012345  .00005678  00000-0  34567-3 0  9982',
        tle2: '2 59001  53.1000 567.8901 0004567  87.9012 272.2345 15.30000000050000'
      },
      {
        id: 'starlink-dtc-8002',
        name: 'Starlink DTC-8002',
        type: 'communication' as const,
        tle1: '1 59002U 24001B   25214.30123456  .00005585  00000-0  33949-3 0  9981',
        tle2: '2 59002  53.1001 568.9012 0004678  88.0123 273.3456 15.30000000051111'
      },
      // Sentinel-2 Earth observation satellites
      {
        id: 'sentinel-2a',
        name: 'Sentinel-2A',
        type: 'earth-observation' as const,
        tle1: '1 40697U 15028A   25214.31234567  .00000456  00000-0  78901-4 0  9980',
        tle2: '2 40697  98.5692 123.4567 0001234  89.0123 271.1234 14.30000000480000'
      },
      {
        id: 'sentinel-2b',
        name: 'Sentinel-2B',
        type: 'earth-observation' as const,
        tle1: '1 42063U 17013A   25214.32345678  .00000523  00000-0  89012-4 0  9979',
        tle2: '2 42063  98.5693 234.5678 0001345  90.1234 272.2345 14.30000000380000'
      },
      {
        id: 'sentinel-2c',
        name: 'Sentinel-2C',
        type: 'earth-observation' as const,
        tle1: '1 59999U 24077A   25214.33456789  .00000467  00000-0  81234-4 0  9978',
        tle2: '2 59999  98.5694 345.6789 0001456  91.2345 273.3456 14.30000000180000'
      }
    ];

    sampleSatellites.forEach(sat => {
      const position = this.calculateSatellitePosition(sat.tle1, sat.tle2);
      this.satellites.set(sat.id, {
        ...sat,
        position: new LngLat(position.longitude, position.latitude),
        altitude: position.altitude,
        velocity: position.velocity
      });
    });
  }

  private loadSatelliteImages() {
    const issImagePath = '/static/images/ISS.png';
    const starlinkImagePath = '/static/images/starlink.png';
    const sentinelImagePath = '/static/images/esa_sentinel2.png';
    
    this.map.loadImage(issImagePath)
      .then(response => {
        const imageData = response.data;
        console.log('Successfully loaded ISS icon - dimensions:', imageData.width, 'x', imageData.height);
        this.map.addImage('iss-icon', imageData);
        
        // Calculate scale factor to achieve 40px height at zoom 2
        const targetHeight = 40;
        const scaleForTarget = targetHeight / imageData.height;
        console.log('ISS scale factor for 40px height:', scaleForTarget);
        
        // Update the ISS layer with calculated scaling
        this.updateISSIconSize(scaleForTarget);
      })
      .catch(error => {
        console.warn('Could not load ISS icon from', issImagePath, ':', error);
        this.createFallbackIcon('iss-icon', '#00ff00');
        // Use default scaling for fallback (64px fallback icon)
        this.updateISSIconSize(40 / 64);
      });

    this.map.loadImage(starlinkImagePath)
      .then(response => {
        const imageData = response.data;
        console.log('Successfully loaded Starlink icon - dimensions:', imageData.width, 'x', imageData.height);
        this.map.addImage('starlink-icon', imageData);
        
        // Calculate scale factor to achieve 40px height at zoom 2
        const targetHeight = 40;
        const scaleForTarget = targetHeight / imageData.height;
        console.log('Starlink scale factor for 40px height:', scaleForTarget);
        
        // Update the Starlink layer with calculated scaling
        this.updateStarlinkIconSize(scaleForTarget);
      })
      .catch(error => {
        console.warn('Could not load Starlink icon from', starlinkImagePath, ':', error);
        this.createFallbackIcon('starlink-icon', '#0080ff');
        // Use default scaling for fallback (64px fallback icon)
        this.updateStarlinkIconSize(40 / 64);
      });

    this.map.loadImage(sentinelImagePath)
      .then(response => {
        const imageData = response.data;
        console.log('Successfully loaded Sentinel-2 icon - dimensions:', imageData.width, 'x', imageData.height);
        this.map.addImage('sentinel-icon', imageData);
        
        // Calculate scale factor to achieve 40px height at zoom 2
        const targetHeight = 40;
        const scaleForTarget = targetHeight / imageData.height;
        console.log('Sentinel-2 scale factor for 40px height:', scaleForTarget);
        
        // Update the Sentinel layer with calculated scaling
        this.updateSentinelIconSize(scaleForTarget);
      })
      .catch(error => {
        console.warn('Could not load Sentinel-2 icon from', sentinelImagePath, ':', error);
        this.createFallbackIcon('sentinel-icon', '#ff8000');
        // Use default scaling for fallback (64px fallback icon)
        this.updateSentinelIconSize(40 / 64);
      });
  }

  private createFallbackIcon(iconName: string, color: string) {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    
    if (ctx) {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(32, 32, 24, 0, 2 * Math.PI);
      ctx.fill();
      
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 3;
      ctx.stroke();
      
      // Add a small inner circle for better visibility
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(32, 32, 6, 0, 2 * Math.PI);
      ctx.fill();
      
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      this.map.addImage(iconName, {
        width: canvas.width,
        height: canvas.height,
        data: new Uint8Array(imageData.data)
      });
    }
  }

  private updateISSIconSize(baseScale: number) {
    this.map.setLayoutProperty('satellites-iss-icon', 'icon-size', [
      'interpolate',
      ['exponential', 0.5],
      ['zoom'],
      0, baseScale * 0.25,   // Smaller when zoomed out (far away)
      2, baseScale,          // Target size at default zoom
      10, baseScale * 2.0,   // Larger when zoomed in (getting closer)
      20, baseScale * 4.0    // Much larger when very zoomed in (very close)
    ]);
  }

  private updateStarlinkIconSize(baseScale: number) {
    this.map.setLayoutProperty('satellites-starlink-icon', 'icon-size', [
      'interpolate',
      ['exponential', 0.5],
      ['zoom'],
      0, baseScale * 0.25,   // Smaller when zoomed out (far away)
      2, baseScale,          // Target size at default zoom
      10, baseScale * 2.0,   // Larger when zoomed in (getting closer)
      20, baseScale * 4.0    // Much larger when very zoomed in (very close)
    ]);
  }

  private updateSentinelIconSize(baseScale: number) {
    this.map.setLayoutProperty('satellites-sentinel-icon', 'icon-size', [
      'interpolate',
      ['exponential', 0.5],
      ['zoom'],
      0, baseScale * 0.25,   // Smaller when zoomed out (far away)
      2, baseScale,          // Target size at default zoom
      10, baseScale * 2.0,   // Larger when zoomed in (getting closer)
      20, baseScale * 4.0    // Much larger when very zoomed in (very close)
    ]);
  }

  private setupMapInteractions() {
    const layers = ['satellites-main', 'satellites-iss-icon', 'satellites-starlink-icon', 'satellites-sentinel-icon', 'satellite-icon-labels'];
    
    layers.forEach(layerId => {
      this.map.on('click', layerId, (e) => {
        if (e.features && e.features[0]) {
          const satelliteId = e.features[0].properties?.id;
          const satellite = this.satellites.get(satelliteId);
          if (satellite) {
            this.followSatellite(satelliteId);
            this.showSatelliteInfo(satellite);
          }
        }
      });

      this.map.on('mouseenter', layerId, () => {
        this.map.getCanvas().style.cursor = 'pointer';
      });

      this.map.on('mouseleave', layerId, () => {
        this.map.getCanvas().style.cursor = '';
      });
    });

    // Stop following when clicking on empty map area
    this.map.on('click', (e) => {
      // Check if the click hit any satellite layers
      const features = this.map.queryRenderedFeatures(e.point, {
        layers: layers
      });
      
      if (features.length === 0 && this.followingSatellite) {
        // Clicked on empty area, stop following
        this.stopFollowing();
        this.showMessage('🔓 Stopped following satellite', 'info');
      }
    });
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

  followSatellite(satelliteId: string) {
    this.followingSatellite = satelliteId;
    const satellite = this.satellites.get(satelliteId);
    
    if (satellite) {
      // Immediate zoom/pan to satellite
      this.map.flyTo({
        center: [satellite.position.lng, satellite.position.lat],
        zoom: Math.max(this.map.getZoom(), 6), // Zoom in if currently zoomed out
        duration: 2000,
        essential: true
      });
    }
  }

  stopFollowing() {
    this.followingSatellite = null;
  }

  getFollowingSatellite(): string | null {
    return this.followingSatellite;
  }

  private showSatelliteInfo(satellite: SatelliteData) {
    const followingText = this.followingSatellite === satellite.id ? '\n\n🎯 FOLLOWING THIS SATELLITE\nClick anywhere on map to stop following' : '\n\n📍 Click to follow this satellite';
    
    const info = `
      Name: ${satellite.name}
      Type: ${satellite.type}
      Altitude: ${satellite.altitude.toFixed(0)} km
      Velocity: ${satellite.velocity.toFixed(2)} km/s
      Position: ${satellite.position.lat.toFixed(4)}°, ${satellite.position.lng.toFixed(4)}°${followingText}
    `;
    
    const messageDiv = document.createElement('div');
    messageDiv.style.cssText = `
      position: fixed;
      top: 100px;
      right: 20px;
      z-index: 2000;
      padding: 15px;
      border-radius: 8px;
      background-color: rgba(0, 100, 255, 0.9);
      color: white;
      font-weight: bold;
      max-width: 320px;
      white-space: pre-line;
      font-family: monospace;
    `;
    
    messageDiv.textContent = info;
    document.body.appendChild(messageDiv);
    
    setTimeout(() => {
      messageDiv.remove();
    }, 6000);
  }

  private calculateSatellitePosition(tle1: string, tle2: string) {
    const satrec = satellite.twoline2satrec(tle1, tle2);
    const now = new Date();
    const positionAndVelocity = satellite.propagate(satrec, now);
    
    if (positionAndVelocity.position && typeof positionAndVelocity.position !== 'boolean') {
      const gmst = satellite.gstime(now);
      const positionGd = satellite.eciToGeodetic(positionAndVelocity.position, gmst);
      
      return {
        longitude: satellite.degreesLong(positionGd.longitude),
        latitude: satellite.degreesLat(positionGd.latitude),
        altitude: positionGd.height,
        velocity: positionAndVelocity.velocity && typeof positionAndVelocity.velocity !== 'boolean' ? 
          Math.sqrt(
            Math.pow(positionAndVelocity.velocity.x, 2) + 
            Math.pow(positionAndVelocity.velocity.y, 2) + 
            Math.pow(positionAndVelocity.velocity.z, 2)
          ) : 0
      };
    }
    
    return { longitude: 0, latitude: 0, altitude: 0, velocity: 0 };
  }

  private setupMapLayers() {
    const features = Array.from(this.satellites.values()).map(sat => ({
      type: 'Feature' as const,
      properties: {
        id: sat.id,
        name: sat.name,
        type: sat.type,
        altitude: sat.altitude,
        velocity: sat.velocity
      },
      geometry: {
        type: 'Point' as const,
        coordinates: [sat.position.lng, sat.position.lat]
      }
    }));

    this.map.addSource('satellites', {
      type: 'geojson',
      data: {
        type: 'FeatureCollection',
        features
      }
    });

    this.map.addLayer({
      id: 'satellites-main',
      type: 'circle',
      source: 'satellites',
      filter: ['all', ['!=', ['get', 'id'], 'iss'], ['!=', ['get', 'type'], 'communication'], ['!=', ['get', 'type'], 'earth-observation']],
      paint: {
        'circle-radius': [
          'interpolate',
          ['exponential', 0.5],
          ['zoom'],
          0, [
            'case',
            ['==', ['get', 'type'], 'scientific'], 1.5,
            ['==', ['get', 'type'], 'weather'], 1.2,
            ['==', ['get', 'type'], 'navigation'], 1,
            0.8
          ],
          2, [
            'case',
            ['==', ['get', 'type'], 'scientific'], 6,
            ['==', ['get', 'type'], 'weather'], 5,
            ['==', ['get', 'type'], 'navigation'], 4,
            3
          ],
          10, [
            'case',
            ['==', ['get', 'type'], 'scientific'], 12,
            ['==', ['get', 'type'], 'weather'], 10,
            ['==', ['get', 'type'], 'navigation'], 8,
            6
          ],
          20, [
            'case',
            ['==', ['get', 'type'], 'scientific'], 24,
            ['==', ['get', 'type'], 'weather'], 20,
            ['==', ['get', 'type'], 'navigation'], 16,
            12
          ]
        ],
        'circle-color': [
          'case',
          ['==', ['get', 'type'], 'scientific'], '#00ff00',
          ['==', ['get', 'type'], 'weather'], '#ff8000',
          ['==', ['get', 'type'], 'navigation'], '#8000ff',
          '#ffffff'
        ],
        'circle-stroke-width': 2,
        'circle-stroke-color': '#ffffff',
        'circle-opacity': 0.8
      }
    });


    this.map.addLayer({
      id: 'satellites-iss-icon',
      type: 'symbol',
      source: 'satellites',
      filter: ['==', ['get', 'id'], 'iss'],
      layout: {
        'icon-image': 'iss-icon',
        'icon-size': 1.0, // Will be updated dynamically when image loads
        'icon-allow-overlap': true,
        'icon-ignore-placement': true
      }
    });

    this.map.addLayer({
      id: 'satellites-starlink-icon',
      type: 'symbol',
      source: 'satellites',
      filter: ['==', ['get', 'type'], 'communication'],
      layout: {
        'icon-image': 'starlink-icon',
        'icon-size': 1.0, // Will be updated dynamically when image loads
        'icon-allow-overlap': true,
        'icon-ignore-placement': true
      }
    });

    this.map.addLayer({
      id: 'satellites-sentinel-icon',
      type: 'symbol',
      source: 'satellites',
      filter: ['==', ['get', 'type'], 'earth-observation'],
      layout: {
        'icon-image': 'sentinel-icon',
        'icon-size': 1.0, // Will be updated dynamically when image loads
        'icon-allow-overlap': true,
        'icon-ignore-placement': true
      }
    });

    this.map.addLayer({
      id: 'satellite-labels',
      type: 'symbol',
      source: 'satellites',
      filter: ['all', ['!=', ['get', 'id'], 'iss'], ['!=', ['get', 'type'], 'communication'], ['!=', ['get', 'type'], 'earth-observation']],
      layout: {
        'text-field': ['get', 'name'],
        'text-font': ['Open Sans Regular'],
        'text-offset': [0, 2],
        'text-anchor': 'top',
        'text-size': 12
      },
      paint: {
        'text-color': '#ffffff',
        'text-halo-color': '#000000',
        'text-halo-width': 1
      }
    });

    this.map.addLayer({
      id: 'satellite-icon-labels',
      type: 'symbol',
      source: 'satellites',
      filter: ['any', ['==', ['get', 'id'], 'iss'], ['==', ['get', 'type'], 'communication'], ['==', ['get', 'type'], 'earth-observation']],
      layout: {
        'text-field': ['get', 'name'],
        'text-font': ['Open Sans Regular'],
        'text-offset': [0, 3],
        'text-anchor': 'top',
        'text-size': 11
      },
      paint: {
        'text-color': '#ffffff',
        'text-halo-color': '#000000',
        'text-halo-width': 2
      }
    });
  }

  private startTracking() {
    const updatePositions = () => {
      const features = [];
      
      for (const [, sat] of this.satellites) {
        const position = this.calculateSatellitePosition(sat.tle1, sat.tle2);
        sat.position = new LngLat(position.longitude, position.latitude);
        sat.altitude = position.altitude;
        sat.velocity = position.velocity;
        
        features.push({
          type: 'Feature' as const,
          properties: {
            id: sat.id,
            name: sat.name,
            type: sat.type,
            altitude: sat.altitude,
            velocity: sat.velocity
          },
          geometry: {
            type: 'Point' as const,
            coordinates: [sat.position.lng, sat.position.lat]
          }
        });
      }

      const source = this.map.getSource('satellites') as any;
      if (source) {
        source.setData({
          type: 'FeatureCollection',
          features
        });
      }

      this.updateTrails();
      this.updateFollowing();
      this.animationId = requestAnimationFrame(updatePositions);
    };

    updatePositions();
  }

  toggleTrails() {
    this.showTrails = !this.showTrails;
    if (this.showTrails) {
      this.addTrailsLayer();
    } else {
      this.removeTrailsLayer();
    }
  }

  private addTrailsLayer() {
    if (this.map.getSource('satellite-trails')) return;

    this.map.addSource('satellite-trails', {
      type: 'geojson',
      data: {
        type: 'FeatureCollection',
        features: []
      }
    });

    this.map.addLayer({
      id: 'satellite-trails',
      type: 'line',
      source: 'satellite-trails',
      paint: {
        'line-color': [
          'case',
          ['==', ['get', 'type'], 'scientific'], '#00ff00',
          ['==', ['get', 'type'], 'communication'], '#0080ff',
          ['==', ['get', 'type'], 'weather'], '#ff8000',
          '#ffffff'
        ],
        'line-width': 2,
        'line-opacity': 0.6
      }
    });
  }

  private removeTrailsLayer() {
    if (this.map.getLayer('satellite-trails')) {
      this.map.removeLayer('satellite-trails');
    }
    if (this.map.getSource('satellite-trails')) {
      this.map.removeSource('satellite-trails');
    }
  }

  private updateTrails() {
    if (!this.showTrails) return;

    for (const [id, satellite] of this.satellites) {
      if (!this.satelliteTrails.has(id)) {
        this.satelliteTrails.set(id, []);
      }
      
      const trail = this.satelliteTrails.get(id)!;
      trail.push(new LngLat(satellite.position.lng, satellite.position.lat));
      
      if (trail.length > 100) {
        trail.shift();
      }
    }

    const trailFeatures = Array.from(this.satelliteTrails.entries()).map(([id, trail]) => {
      const satellite = this.satellites.get(id)!;
      return {
        type: 'Feature' as const,
        properties: {
          id,
          type: satellite.type
        },
        geometry: {
          type: 'LineString' as const,
          coordinates: trail.map(pos => [pos.lng, pos.lat])
        }
      };
    }).filter(feature => feature.geometry.coordinates.length > 1);

    const source = this.map.getSource('satellite-trails') as any;
    if (source) {
      source.setData({
        type: 'FeatureCollection',
        features: trailFeatures
      });
    }
  }

  private updateFollowing() {
    if (this.followingSatellite) {
      const satellite = this.satellites.get(this.followingSatellite);
      if (satellite) {
        // Smoothly pan to follow the satellite without changing zoom
        this.map.panTo([satellite.position.lng, satellite.position.lat], {
          duration: 1000 // Smooth 1-second pan
        });
      }
    }
  }

  getSatellites(): Map<string, SatelliteData> {
    return this.satellites;
  }

  removeSatellite(id: string): boolean {
    return this.satellites.delete(id);
  }

  stop() {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }
}