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
  dimensions: {
    length: number; // meters
    width: number;  // meters
    height: number; // meters
  };
}

export class SatelliteTracker {
  private map: MapLibreMap;
  private satellites: Map<string, SatelliteData> = new Map();
  private satelliteTrails: Map<string, LngLat[]> = new Map();
  private animationId: number | null = null;
  private showTrails = false;
  private followingSatellite: string | null = null;
  private isZooming = false;

  constructor(map: MapLibreMap) {
    this.map = map;
  }

  initialize() {
    this.loadSampleSatellites();
    this.loadSatelliteImages();
    this.setupMapLayers();
    this.setupMapInteractions();
    this.setupSearchFunctionality();
    this.startTracking();
  }

  private loadSampleSatellites() {
    const sampleSatellites = [
      {
        id: 'iss',
        name: 'International Space Station',
        type: 'scientific' as const,
        tle1: '1 25544U 98067A   25214.09653981  .00010888  00000+0  19653-3 0  9996',
        tle2: '2 25544  51.6345  79.5266 0001736 142.9190 217.1919 15.50282964522285',
        dimensions: { length: 108.5, width: 72.8, height: 20.0 }
      },
      {
        id: 'hubble',
        name: 'Hubble Space Telescope',
        type: 'scientific' as const,
        tle1: '1 20580U 90037B   25214.12345678  .00001234  00000-0  56789-4 0  9991',
        tle2: '2 20580  28.4690 123.4567 0002345  78.9012 281.2345 15.09876543123456',
        dimensions: { length: 13.2, width: 4.2, height: 4.2 }
      },
      {
        id: 'noaa-20',
        name: 'NOAA-20 Weather Satellite',
        type: 'weather' as const,
        tle1: '1 43013U 17073A   25214.23456789  .00000987  00000-0  45678-4 0  9998',
        tle2: '2 43013  98.7890 234.5678 0001987  89.0123 271.1234 14.19876543234567',
        dimensions: { length: 4.2, width: 2.6, height: 2.6 }
      },
      // Starlink constellation - Shell 1
      {
        id: 'starlink-1007',
        name: 'Starlink-1007',
        type: 'communication' as const,
        tle1: '1 44713U 19074A   25214.12345678  .00002182  00000-0  15494-3 0  9999',
        tle2: '2 44713  53.0534 123.4567 0001234  92.4356 267.7077 15.05000000270000',
        dimensions: { length: 2.8, width: 1.4, height: 0.32 }
      },
      {
        id: 'starlink-1019',
        name: 'Starlink-1019',
        type: 'communication' as const,
        tle1: '1 44714U 19074B   25214.13456789  .00002089  00000-0  14876-3 0  9998',
        tle2: '2 44714  53.0535 124.5678 0001345  93.5467 268.8188 15.05000000271111',
        dimensions: { length: 2.8, width: 1.4, height: 0.32 }
      },
      {
        id: 'starlink-1021',
        name: 'Starlink-1021',
        type: 'communication' as const,
        tle1: '1 44715U 19074C   25214.14567890  .00001996  00000-0  14258-3 0  9997',
        tle2: '2 44715  53.0536 125.6789 0001456  94.6578 269.9299 15.05000000272222',
        dimensions: { length: 2.8, width: 1.4, height: 0.32 }
      },
      {
        id: 'starlink-1024',
        name: 'Starlink-1024',
        type: 'communication' as const,
        tle1: '1 44716U 19074D   25214.15678901  .00001903  00000-0  13640-3 0  9996',
        tle2: '2 44716  53.0537 126.7890 0001567  95.7689 271.0410 15.05000000273333',
        dimensions: { length: 2.8, width: 1.4, height: 0.32 }
      },
      {
        id: 'starlink-1030',
        name: 'Starlink-1030',
        type: 'communication' as const,
        tle1: '1 44717U 19074E   25214.16789012  .00001810  00000-0  13022-3 0  9995',
        tle2: '2 44717  53.0538 127.8901 0001678  96.8790 272.1521 15.05000000274444',
        dimensions: { length: 2.8, width: 1.4, height: 0.32 }
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
      // Sentinel-1 SAR satellites
      {
        id: 'sentinel-1a',
        name: 'Sentinel-1A',
        type: 'earth-observation' as const,
        tle1: '1 39634U 14016A   25214.25123456  .00000234  00000-0  56789-4 0  9995',
        tle2: '2 39634  98.1851 167.5432 0001456  78.9012 281.2345 14.59000000580000'
      },
      {
        id: 'sentinel-1b',
        name: 'Sentinel-1B',
        type: 'earth-observation' as const,
        tle1: '1 41456U 16025A   25214.26234567  .00000267  00000-0  62345-4 0  9994',
        tle2: '2 41456  98.1852 287.6543 0001567  79.0123 282.3456 14.59000000480000'
      },
      {
        id: 'sentinel-1c',
        name: 'Sentinel-1C',
        type: 'earth-observation' as const,
        tle1: '1 59051U 24036A   25214.27345678  .00000198  00000-0  54321-4 0  9993',
        tle2: '2 59051  98.1853 47.7654 0001678  80.1234 283.4567 14.59000000080000'
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
      },
      // Sentinel-3 oceanography and land monitoring satellites
      {
        id: 'sentinel-3a',
        name: 'Sentinel-3A',
        type: 'earth-observation' as const,
        tle1: '1 41335U 16011A   25214.34567890  .00000123  00000-0  45678-4 0  9993',
        tle2: '2 41335  98.6543 198.7654 0001678  82.3456 277.7654 14.26000000460000'
      },
      {
        id: 'sentinel-3b',
        name: 'Sentinel-3B',
        type: 'earth-observation' as const,
        tle1: '1 43437U 18039A   25214.35678901  .00000156  00000-0  51234-4 0  9992',
        tle2: '2 43437  98.6544 318.8765 0001789  83.4567 278.8765 14.26000000360000'
      },
      {
        id: 'sentinel-3c',
        name: 'Sentinel-3C',
        type: 'earth-observation' as const,
        tle1: '1 49832U 21104A   25214.36789012  .00000189  00000-0  56789-4 0  9991',
        tle2: '2 49832  98.6545 78.9876 0001890  84.5678 279.9876 14.26000000260000'
      },
      // Sentinel-4 geostationary atmospheric monitoring
      {
        id: 'sentinel-4a',
        name: 'Sentinel-4A (MTG-I1)',
        type: 'earth-observation' as const,
        tle1: '1 54866U 22167A   25214.37890123  .00000001  00000-0  10000-4 0  9990',
        tle2: '2 54866  0.0567  85.4321 0000234  45.6789 314.3210 1.00271000010000'
      },
      // Sentinel-5P atmospheric monitoring
      {
        id: 'sentinel-5p',
        name: 'Sentinel-5P (TROPOMI)',
        type: 'earth-observation' as const,
        tle1: '1 42969U 17064A   25214.38901234  .00000345  00000-0  67890-4 0  9989',
        tle2: '2 42969  98.7321 142.5678 0001345  86.7890 273.2109 14.19000000380000'
      },
      // Sentinel-6 oceanography satellites
      {
        id: 'sentinel-6a',
        name: 'Sentinel-6A (Michael Freilich)',
        type: 'earth-observation' as const,
        tle1: '1 46984U 20087A   25214.39012345  .00000278  00000-0  61234-4 0  9988',
        tle2: '2 46984  66.0391 234.5678 0000567  89.0123 271.1234 12.84000000210000'
      },
      {
        id: 'sentinel-6b',
        name: 'Sentinel-6B',
        type: 'earth-observation' as const,
        tle1: '1 52000U 23045A   25214.40123456  .00000312  00000-0  67890-4 0  9987',
        tle2: '2 52000  66.0392 354.6789 0000678  90.1234 272.2345 12.84000000110000'
      }
    ];

    sampleSatellites.forEach(sat => {
      const position = this.calculateSatellitePosition(sat.tle1, sat.tle2);
      
      // Add default dimensions if not specified
      let dimensions = sat.dimensions;
      if (!dimensions) {
        dimensions = this.getDefaultDimensionsForType(sat.type, sat.id);
      }
      
      this.satellites.set(sat.id, {
        ...sat,
        dimensions,
        position: new LngLat(position.longitude, position.latitude),
        altitude: position.altitude,
        velocity: position.velocity
      });
    });
  }

  private getDefaultDimensionsForType(type: string, satelliteId: string) {
    // Starlink satellites (all generations)
    if (satelliteId.includes('starlink')) {
      if (satelliteId.includes('gen2') || satelliteId.includes('dtc')) {
        return { length: 4.1, width: 1.2, height: 0.32 }; // Gen2 and DTC are larger
      }
      return { length: 2.8, width: 1.4, height: 0.32 }; // Standard Starlink
    }
    
    // Sentinel satellites by constellation
    if (satelliteId.includes('sentinel-1')) {
      return { length: 10.0, width: 2.4, height: 3.4 }; // Sentinel-1 SAR
    }
    if (satelliteId.includes('sentinel-2')) {
      return { length: 3.7, width: 2.1, height: 2.4 }; // Sentinel-2 optical
    }
    if (satelliteId.includes('sentinel-3')) {
      return { length: 3.9, width: 2.2, height: 2.2 }; // Sentinel-3 ocean/land
    }
    if (satelliteId.includes('sentinel-4')) {
      return { length: 3.2, width: 2.1, height: 1.8 }; // Sentinel-4 geostationary
    }
    if (satelliteId.includes('sentinel-5')) {
      return { length: 3.5, width: 2.1, height: 2.1 }; // Sentinel-5P
    }
    if (satelliteId.includes('sentinel-6')) {
      return { length: 3.3, width: 2.3, height: 2.8 }; // Sentinel-6 oceanography
    }
    
    // Default dimensions by type
    switch (type) {
      case 'scientific':
        return { length: 5.0, width: 3.0, height: 3.0 };
      case 'communication':
        return { length: 3.0, width: 2.0, height: 2.0 };
      case 'weather':
        return { length: 4.0, width: 2.5, height: 2.5 };
      case 'earth-observation':
        return { length: 4.0, width: 2.0, height: 2.5 };
      case 'navigation':
        return { length: 2.4, width: 1.8, height: 1.8 };
      default:
        return { length: 3.0, width: 2.0, height: 2.0 };
    }
  }

  private loadSatelliteImages() {
    const issImagePath = '/static/images/ISS.png';
    const starlinkImagePath = '/static/images/starlink.png';
    
    // Sentinel constellation images
    const sentinelImages = [
      { path: '/static/images/esa_sentinel1.png', iconName: 'sentinel-1-icon', constellation: 'sentinel-1' },
      { path: '/static/images/esa_sentinel2.png', iconName: 'sentinel-2-icon', constellation: 'sentinel-2' },
      { path: '/static/images/esa_sentinel3.png', iconName: 'sentinel-3-icon', constellation: 'sentinel-3' },
      { path: '/static/images/esa_sentinel4.png', iconName: 'sentinel-4-icon', constellation: 'sentinel-4' },
      { path: '/static/images/esa_sentinel5.png', iconName: 'sentinel-5-icon', constellation: 'sentinel-5' },
      { path: '/static/images/esa_sentinel6.png', iconName: 'sentinel-6-icon', constellation: 'sentinel-6' }
    ];
    
    this.map.loadImage(issImagePath)
      .then(response => {
        const imageData = response.data;
        console.log('Successfully loaded ISS icon - dimensions:', imageData.width, 'x', imageData.height);
        this.map.addImage('iss-icon', imageData);
        
        // Calculate scale factor to achieve 20px height at zoom 2 (half the original size)
        const targetHeight = 20;
        const scaleForTarget = targetHeight / imageData.height;
        console.log('ISS scale factor for 20px height:', scaleForTarget);
        
        // Update the ISS layer with calculated scaling (108.5m length)
        this.updateISSIconSize(scaleForTarget, 108.5);
      })
      .catch(error => {
        console.warn('Could not load ISS icon from', issImagePath, ':', error);
        this.createFallbackIcon('iss-icon', '#00ff00');
        // Use default scaling for fallback (64px fallback icon, half size)
        this.updateISSIconSize(20 / 64, 108.5);
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
        
        // Update the Starlink layer with calculated scaling (2.8m average length)
        this.updateStarlinkIconSize(scaleForTarget, 2.8);
      })
      .catch(error => {
        console.warn('Could not load Starlink icon from', starlinkImagePath, ':', error);
        this.createFallbackIcon('starlink-icon', '#0080ff');
        // Use default scaling for fallback (64px fallback icon)
        this.updateStarlinkIconSize(40 / 64, 2.8);
      });

    // Load all Sentinel constellation images
    sentinelImages.forEach(({ path, iconName, constellation }) => {
      this.map.loadImage(path)
        .then(response => {
          const imageData = response.data;
          console.log(`Successfully loaded ${constellation} icon - dimensions:`, imageData.width, 'x', imageData.height);
          this.map.addImage(iconName, imageData);
          
          // Calculate scale factor to achieve 40px height at zoom 2
          const targetHeight = 40;
          const scaleForTarget = targetHeight / imageData.height;
          console.log(`${constellation} scale factor for 40px height:`, scaleForTarget);
          
          // Get typical satellite length for this constellation
          const satelliteLength = this.getConstellationLength(constellation);
          
          // Update the layer with calculated scaling
          this.updateSentinelIconSize(scaleForTarget, iconName, satelliteLength);
        })
        .catch(error => {
          console.warn(`Could not load ${constellation} icon from`, path, ':', error);
          this.createFallbackIcon(iconName, '#ff8000');
          // Use default scaling for fallback (64px fallback icon)
          const satelliteLength = this.getConstellationLength(constellation);
          this.updateSentinelIconSize(40 / 64, iconName, satelliteLength);
        });
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

  private getUnifiedSizeExpression(baseSize: number, satelliteLength?: number) {
    // If satelliteLength is provided, scale proportionally to ISS (108.5m)
    let proportionalSize = baseSize;
    if (satelliteLength) {
      const ISS_LENGTH = 108.5; // meters
      const lengthRatio = satelliteLength / ISS_LENGTH;
      proportionalSize = baseSize * lengthRatio;
    }
    
    const scaledSize = proportionalSize * 1.33; // Reduced from 4.0 to 1.33 (4.0/3) for better sizing
    return [
      'interpolate',
      ['linear'],
      ['zoom'],
      0, scaledSize * 0.5,    // Small when zoomed out
      1, scaledSize * 1.0,    // 1x size at zoom 1
      2, scaledSize * 2.0,    // 2x size at zoom 2
      3, scaledSize * 3.0,    // 3x size at zoom 3
      4, scaledSize * 4.0,    // 4x size at zoom 4
      5, scaledSize * 10.0,   // 10x size at zoom 5 (twice the original size)
      6, scaledSize * 15.0,   // 15x size at zoom 6 (10 * 1.5)
      7, scaledSize * 22.5,   // 22.5x size at zoom 7 (15 * 1.5)
      8, scaledSize * 33.75,  // 33.75x size at zoom 8 (22.5 * 1.5)
      9, scaledSize * 50.625, // 50.625x size at zoom 9 (33.75 * 1.5)
      10, scaledSize * 75.9375, // 75.9375x size at zoom 10 (50.625 * 1.5)
      15, scaledSize * 574.453, // Continuing 1.5x progression
      20, scaledSize * 4339.84  // Continuing 1.5x progression
    ];
  }

  private getISSSizeExpression(baseSize: number) {
    const scaledSize = baseSize * 1.33;
    return [
      'interpolate',
      ['linear'],
      ['zoom'],
      0, scaledSize * 0.5,    // Small when zoomed out
      1, scaledSize * 1.0,    // 1x size at zoom 1
      2, scaledSize * 2.0,    // 2x size at zoom 2
      3, scaledSize * 3.0,    // 3x size at zoom 3
      4, scaledSize * 4.0,    // 4x size at zoom 4 - MAXIMUM SIZE
      5, scaledSize * 4.0,    // Stay at 4x size at zoom 5
      6, scaledSize * 5.0,    // Stay at 4x size at zoom 6
      7, scaledSize * 6.0,    // Stay at 4x size at zoom 7
      8, scaledSize * 7.0,    // Stay at 4x size at zoom 8
      9, scaledSize * 8.0,    // Stay at 4x size at zoom 9
      10, scaledSize * 9.0,   // Stay at 4x size at zoom 10
      15, scaledSize * 10.0,   // Stay at 4x size at zoom 15
      20, scaledSize * 11.0    // Stay at 4x size at zoom 20
    ];
  }

  private updateISSIconSize(baseScale: number, satelliteLength?: number) {
    this.map.setLayoutProperty('satellites-iss-icon', 'icon-size', this.getISSSizeExpression(baseScale));
  }

  private updateStarlinkIconSize(baseScale: number, satelliteLength?: number) {
    this.map.setLayoutProperty('satellites-starlink-icon', 'icon-size', this.getUnifiedSizeExpression(baseScale, satelliteLength));
  }


  private getConstellationLength(constellation: string): number {
    switch (constellation) {
      case 'sentinel-1': return 10.0;
      case 'sentinel-2': return 3.7;
      case 'sentinel-3': return 3.9;
      case 'sentinel-4': return 3.2;
      case 'sentinel-5': return 3.5;
      case 'sentinel-6': return 3.3;
      default: return 4.0;
    }
  }

  private updateSentinelIconSize(baseScale: number, iconName?: string, satelliteLength?: number) {
    // If iconName is provided, try to update the specific layer
    if (iconName) {
      const layerName = iconName.replace('-icon', '-layer');
      if (this.map.getLayer(layerName)) {
        this.map.setLayoutProperty(layerName, 'icon-size', this.getUnifiedSizeExpression(baseScale, satelliteLength));
      }
    } else {
      // Fallback to update all sentinel layers
      const sentinelLayers = [
        'sentinel-1-layer', 'sentinel-2-layer', 'sentinel-3-layer', 
        'sentinel-4-layer', 'sentinel-5-layer', 'sentinel-6-layer'
      ];
      sentinelLayers.forEach(layerName => {
        if (this.map.getLayer(layerName)) {
          this.map.setLayoutProperty(layerName, 'icon-size', this.getUnifiedSizeExpression(baseScale, satelliteLength));
        }
      });
    }
  }

  private setupMapInteractions() {
    const layers = [
      'satellites-main', 
      'satellites-small-dots',
      'satellites-iss-icon', 
      'satellites-starlink-icon', 
      'sentinel-1-layer',
      'sentinel-2-layer',
      'sentinel-3-layer',
      'sentinel-4-layer',
      'sentinel-5-layer',
      'sentinel-6-layer'
    ];
    
    layers.forEach(layerId => {
      // Check if layer exists before adding event listeners
      if (this.map.getLayer(layerId)) {
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
      }
    });

    // Stop following when clicking on empty map area
    this.map.on('click', (e) => {
      // Check if the click hit any satellite layers (only existing ones)
      const existingLayers = layers.filter(layerId => this.map.getLayer(layerId));
      const features = this.map.queryRenderedFeatures(e.point, {
        layers: existingLayers
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
      console.log(`🎯 Started following satellite: ${satellite.name}`);
      // Immediate zoom/pan to satellite
      this.map.flyTo({
        center: [satellite.position.lng, satellite.position.lat],
        zoom: Math.max(this.map.getZoom(), 4), // Zoom in if currently zoomed out
        duration: 2000,
        essential: true
      });
      
      // Show confirmation message
      this.showMessage(`🎯 Following ${satellite.name}`, 'success');
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
      Dimensions: ${satellite.dimensions.length}×${satellite.dimensions.width}×${satellite.dimensions.height}m
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
        velocity: sat.velocity,
        length: sat.dimensions.length
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

    // Setup layers without text labels to avoid font issues
    this.map.addLayer({
      id: 'satellites-main',
      type: 'circle',
      source: 'satellites',
      filter: ['all', ['!=', ['get', 'id'], 'iss'], ['!=', ['get', 'type'], 'communication'], ['!=', ['get', 'type'], 'earth-observation']],
      paint: {
        'circle-radius': [
          'interpolate',
          ['linear'],
          ['zoom'],
          0, 1.0,    // Small when zoomed out
          1, 2.0,    // 1x size at zoom 1
          2, 3.0,    // 2x size at zoom 2
          3, 4.0,    // 3x size at zoom 3
          4, 5.0,    // 4x size at zoom 4
          5, 12.0,   // 10x size at zoom 5 (twice the original size)
          6, 18.0,   // 15x size at zoom 6 (12 * 1.5)
          7, 27.0,   // 22.5x size at zoom 7 (18 * 1.5)
          8, 40.5,   // 33.75x size at zoom 8 (27 * 1.5)
          9, 60.75,  // 50.625x size at zoom 9 (40.5 * 1.5)
          10, 91.125, // 75.9375x size at zoom 10 (60.75 * 1.5)
          15, 689.34, // Continuing 1.5x progression
          20, 5207.8  // Continuing 1.5x progression
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

    // Add small satellite dots layer for satellites with length < 11m
    this.map.addLayer({
      id: 'satellites-small-dots',
      type: 'circle',
      source: 'satellites',
      filter: [
        'all',
        ['<', ['get', 'length'], 11],
        ['<', ['zoom'], 5]
      ],
      paint: {
        'circle-radius': [
          'interpolate',
          ['linear'],
          ['zoom'],
          0, 1.0,    // Small when zoomed out
          1, 2.0,    // 1x size at zoom 1
          2, 3.0,    // 2x size at zoom 2
          3, 4.0,    // 3x size at zoom 3
          4, 5.0,    // 4x size at zoom 4
          5, 12.0    // 10x size at zoom 5 (twice the original, only shown until zoom 5)
        ],
        'circle-color': [
          'case',
          ['==', ['get', 'type'], 'communication'], '#0080ff',
          ['==', ['get', 'type'], 'earth-observation'], '#ff8000',
          '#ffffff'
        ],
        'circle-stroke-width': 1,
        'circle-stroke-color': '#ffffff',
        'circle-opacity': 0.9
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
      filter: [
        'all',
        ['==', ['get', 'type'], 'communication'],
        [
          'any',
          ['>=', ['get', 'length'], 11],
          ['>=', ['zoom'], 5]
        ]
      ],
      layout: {
        'icon-image': 'starlink-icon',
        'icon-size': 1.0, // Will be updated dynamically when image loads
        'icon-allow-overlap': true,
        'icon-ignore-placement': true
      }
    });

    // Create separate layers for each Sentinel constellation
    const sentinelConstellations = [
      { number: '1', satellites: ['sentinel-1a', 'sentinel-1b', 'sentinel-1c'] },
      { number: '2', satellites: ['sentinel-2a', 'sentinel-2b', 'sentinel-2c'] },
      { number: '3', satellites: ['sentinel-3a', 'sentinel-3b', 'sentinel-3c'] },
      { number: '4', satellites: ['sentinel-4a'] },
      { number: '5', satellites: ['sentinel-5p'] },
      { number: '6', satellites: ['sentinel-6a', 'sentinel-6b'] }
    ];
    
    sentinelConstellations.forEach(({ number, satellites }) => {
      this.map.addLayer({
        id: `sentinel-${number}-layer`,
        type: 'symbol',
        source: 'satellites',
        filter: [
          'all',
          ['==', ['get', 'type'], 'earth-observation'],
          ['in', ['get', 'id'], ['literal', satellites]],
          [
            'any',
            ['>=', ['get', 'length'], 11],
            ['>=', ['zoom'], 5]
          ]
        ],
        layout: {
          'icon-image': `sentinel-${number}-icon`,
          'icon-size': 1.0, // Will be updated dynamically when image loads
          'icon-allow-overlap': true,
          'icon-ignore-placement': true
        }
      });
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
            velocity: sat.velocity,
            length: sat.dimensions.length
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
    if (this.followingSatellite && !this.isZooming) {
      const satellite = this.satellites.get(this.followingSatellite);
      if (satellite) {
        // Get current map center to check if we need to update
        const currentCenter = this.map.getCenter();
        const newLng = satellite.position.lng;
        const newLat = satellite.position.lat;
        
        // Only update if the satellite has moved significantly (to avoid unnecessary updates)
        const threshold = 0.001; // About 100 meters
        const deltaLng = Math.abs(currentCenter.lng - newLng);
        const deltaLat = Math.abs(currentCenter.lat - newLat);
        
        if (deltaLng > threshold || deltaLat > threshold) {
          // Use jumpTo for immediate response without animation delays
          this.map.jumpTo({
            center: [newLng, newLat]
          });
        }
      }
    }
  }

  getSatellites(): Map<string, SatelliteData> {
    return this.satellites;
  }

  removeSatellite(id: string): boolean {
    return this.satellites.delete(id);
  }

  private setupSearchFunctionality() {
    const searchInput = document.getElementById('satellite-search') as HTMLInputElement;
    const searchResults = document.getElementById('search-results') as HTMLDivElement;
    
    if (!searchInput || !searchResults) return;
    
    searchInput.addEventListener('input', (e) => {
      const query = (e.target as HTMLInputElement).value.toLowerCase().trim();
      this.performSearch(query, searchResults);
    });
    
    // Clear search when clicking outside
    document.addEventListener('click', (e) => {
      if (!searchInput.contains(e.target as Node) && !searchResults.contains(e.target as Node)) {
        searchResults.innerHTML = '';
      }
    });
  }
  
  private performSearch(query: string, resultsContainer: HTMLDivElement) {
    resultsContainer.innerHTML = '';
    
    if (query.length < 2) return;
    
    const matches = Array.from(this.satellites.values())
      .filter(satellite => 
        satellite.name.toLowerCase().includes(query) ||
        satellite.id.toLowerCase().includes(query) ||
        satellite.type.toLowerCase().includes(query)
      )
      .sort((a, b) => a.name.localeCompare(b.name))
      .slice(0, 10); // Limit to 10 results
    
    matches.forEach(satellite => {
      const resultDiv = document.createElement('div');
      resultDiv.className = 'search-result';
      if (this.followingSatellite === satellite.id) {
        resultDiv.className += ' following';
      }
      
      resultDiv.innerHTML = `
        <div><strong>${satellite.name}</strong></div>
        <div style="font-size: 11px; color: #ccc;">
          ${satellite.type} | ${satellite.dimensions.length}×${satellite.dimensions.width}×${satellite.dimensions.height}m | Alt: ${satellite.altitude.toFixed(0)}km
        </div>
        <div style="font-size: 10px; color: #aaa;">
          ${satellite.position.lat.toFixed(2)}°, ${satellite.position.lng.toFixed(2)}°
        </div>
      `;
      
      resultDiv.addEventListener('click', () => {
        this.selectSatelliteFromSearch(satellite.id);
        resultsContainer.innerHTML = '';
        (document.getElementById('satellite-search') as HTMLInputElement).value = satellite.name;
      });
      
      resultsContainer.appendChild(resultDiv);
    });
    
    if (matches.length === 0 && query.length >= 2) {
      resultsContainer.innerHTML = '<div style="padding: 8px; color: #999;">No satellites found</div>';
    }
  }
  
  private selectSatelliteFromSearch(satelliteId: string) {
    console.log(`🔍 selectSatelliteFromSearch called with ID: ${satelliteId}`);
    const satellite = this.satellites.get(satelliteId);
    if (satellite) {
      console.log(`📡 Found satellite: ${satellite.name} at position:`, satellite.position);
      this.followingSatellite = satelliteId;
      this.isZooming = true;
      console.log(`🎯 Started following satellite: ${satellite.name}`);
      
      // Zoom to level 6 and center on satellite
      console.log(`🔍 Calling flyTo with zoom 6 to position: [${satellite.position.lng}, ${satellite.position.lat}]`);
      this.map.flyTo({
        center: [satellite.position.lng, satellite.position.lat],
        zoom: 6,
        duration: 2000,
        essential: true
      });
      
      // Reset zoom flag after animation completes
      setTimeout(() => {
        this.isZooming = false;
        console.log(`✅ Zoom animation completed, tracking resumed`);
      }, 2500);
      
      this.showMessage(`🎯 Following ${satellite.name}`, 'success');
      this.showSatelliteInfo(satellite);
    } else {
      console.error(`❌ Satellite not found with ID: ${satelliteId}`);
    }
  }

  stop() {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }
}