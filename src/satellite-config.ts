// Satellite configuration data
export interface SatelliteConfig {
  id: string;
  name: string;
  type: 'scientific' | 'communication' | 'navigation' | 'earth-observation' | 'weather';
  tle1: string;
  tle2: string;
  dimensions: {
    length: number; // meters
    width: number;  // meters
    height: number; // meters
  };
  image?: string; // Optional image URL for satellites with custom icons
}

export const SATELLITE_CONFIGS: SatelliteConfig[] = [
  // Scientific satellites
  {
    id: 'iss',
    name: 'International Space Station',
    type: 'scientific',
    tle1: '1 25544U 98067A   25214.09653981  .00010888  00000+0  19653-3 0  9996',
    tle2: '2 25544  51.6345  79.5266 0001736 142.9190 217.1919 15.50282964522285',
    dimensions: { length: 108.5, width: 72.8, height: 20.0 },
    image: 'static/images/ISS.png'
  },
  {
    id: 'hubble',
    name: 'Hubble Space Telescope',
    type: 'scientific',
    tle1: '1 20580U 90037B   25214.12345678  .00001234  00000-0  56789-4 0  9991',
    tle2: '2 20580  28.4690 123.4567 0002345  78.9012 281.2345 15.09876543123456',
    dimensions: { length: 13.2, width: 4.2, height: 4.2 }
  },

  // Weather satellites
  {
    id: 'noaa-20',
    name: 'NOAA-20 Weather Satellite',
    type: 'weather',
    tle1: '1 43013U 17073A   25214.23456789  .00000987  00000-0  45678-4 0  9998',
    tle2: '2 43013  98.7890 234.5678 0001987  89.0123 271.1234 14.19876543234567',
    dimensions: { length: 4.2, width: 2.6, height: 2.6 }
  },

  // Starlink communication satellites
  {
    id: 'starlink-1007',
    name: 'Starlink-1007',
    type: 'communication',
    tle1: '1 44713U 19074A   25214.12345678  .00002182  00000-0  15494-3 0  9999',
    tle2: '2 44713  53.0534 123.4567 0001234  92.4356 267.7077 15.05000000270000',
    dimensions: { length: 2.8, width: 1.4, height: 0.32 },
    image: 'static/images/starlink.png'
  },
  {
    id: 'starlink-1019',
    name: 'Starlink-1019',
    type: 'communication',
    tle1: '1 44714U 19074B   25214.13456789  .00002089  00000-0  14876-3 0  9998',
    tle2: '2 44714  53.0535 124.5678 0001345  93.5467 268.8188 15.05000000271111',
    dimensions: { length: 2.8, width: 1.4, height: 0.32 },
    image: 'static/images/starlink.png'
  },
  {
    id: 'starlink-1021',
    name: 'Starlink-1021',
    type: 'communication',
    tle1: '1 44715U 19074C   25214.14567890  .00001996  00000-0  14258-3 0  9997',
    tle2: '2 44715  53.0536 125.6789 0001456  94.6578 269.9299 15.05000000272222',
    dimensions: { length: 2.8, width: 1.4, height: 0.32 },
    image: 'static/images/starlink.png'
  },
  {
    id: 'starlink-1024',
    name: 'Starlink-1024',
    type: 'communication',
    tle1: '1 44716U 19074D   25214.15678901  .00001903  00000-0  13640-3 0  9996',
    tle2: '2 44716  53.0537 126.7890 0001567  95.7689 271.0410 15.05000000273333',
    dimensions: { length: 2.8, width: 1.4, height: 0.32 },
    image: 'static/images/starlink.png'
  },

  // Sentinel Earth observation constellation
  {
    id: 'sentinel-1a',
    name: 'Sentinel-1A',
    type: 'earth-observation',
    tle1: '1 39634U 14016A   25214.25123456  .00000234  00000-0  56789-4 0  9995',
    tle2: '2 39634  98.1851 167.5432 0001456  78.9012 281.2345 14.59000000580000',
    dimensions: { length: 10.0, width: 2.4, height: 3.4 },
	image: 'static/images/esa_sentinel1.png'

  },
  {
    id: 'sentinel-1b',
    name: 'Sentinel-1B',
    type: 'earth-observation',
    tle1: '1 41456U 16025A   25214.26234567  .00000267  00000-0  62345-4 0  9994',
    tle2: '2 41456  98.1852 287.6543 0001567  79.0123 282.3456 14.59000000480000',
    dimensions: { length: 10.0, width: 2.4, height: 3.4 },
	image: 'static/images/esa_sentinel1.png'

  },
  {
    id: 'sentinel-1c',
    name: 'Sentinel-1C',
    type: 'earth-observation',
    tle1: '1 59051U 24036A   25214.27345678  .00000198  00000-0  54321-4 0  9993',
    tle2: '2 59051  98.1853 47.7654 0001678  80.1234 283.4567 14.59000000080000',
    dimensions: { length: 10.0, width: 2.4, height: 3.4 },
	image: 'static/images/esa_sentinel1.png'
  },
  {
    id: 'sentinel-2a',
    name: 'Sentinel-2A',
    type: 'earth-observation',
    tle1: '1 40697U 15028A   25214.31234567  .00000456  00000-0  78901-4 0  9980',
    tle2: '2 40697  98.5692 123.4567 0001234  89.0123 271.1234 14.30000000480000',
    dimensions: { length: 3.7, width: 2.1, height: 2.4 },
	image: 'static/images/esa_sentinel2.png'
  },
  {
    id: 'sentinel-2b',
    name: 'Sentinel-2B',
    type: 'earth-observation',
    tle1: '1 42063U 17013A   25214.32345678  .00000523  00000-0  89012-4 0  9979',
    tle2: '2 42063  98.5693 234.5678 0001345  90.1234 272.2345 14.30000000380000',
    dimensions: { length: 3.7, width: 2.1, height: 2.4 },
	image: 'static/images/esa_sentinel2.png'

  },
  {
    id: 'sentinel-2c',
    name: 'Sentinel-2C',
    type: 'earth-observation',
    tle1: '1 59999U 24077A   25214.33456789  .00000467  00000-0  81234-4 0  9978',
    tle2: '2 59999  98.5694 345.6789 0001456  91.2345 273.3456 14.30000000180000',
    dimensions: { length: 3.7, width: 2.1, height: 2.4 },
	image: 'static/images/esa_sentinel2.png'

  },
  {
    id: 'sentinel-3a',
    name: 'Sentinel-3A',
    type: 'earth-observation',
    tle1: '1 41335U 16011A   25214.34567890  .00000123  00000-0  45678-4 0  9993',
    tle2: '2 41335  98.6543 198.7654 0001678  82.3456 277.7654 14.26000000460000',
    dimensions: { length: 3.9, width: 2.2, height: 2.2 },
	image: 'static/images/esa_sentinel3.png'
  },
  {
    id: 'sentinel-3b',
    name: 'Sentinel-3B',
    type: 'earth-observation',
    tle1: '1 43437U 18039A   25214.35678901  .00000156  00000-0  51234-4 0  9992',
    tle2: '2 43437  98.6544 318.8765 0001789  83.4567 278.8765 14.26000000360000',
    dimensions: { length: 3.9, width: 2.2, height: 2.2 },
	image: 'static/images/esa_sentinel3.png'
  },
  {
    id: 'sentinel-5p',
    name: 'Sentinel-5P (TROPOMI)',
    type: 'earth-observation',
    tle1: '1 42969U 17064A   25214.38901234  .00000345  00000-0  67890-4 0  9989',
    tle2: '2 42969  98.7321 142.5678 0001345  86.7890 273.2109 14.19000000380000',
    dimensions: { length: 3.5, width: 2.1, height: 2.1 },
	image: 'static/images/esa_sentinel5.png'

  },
  {
    id: 'sentinel-6a',
    name: 'Sentinel-6A (Michael Freilich)',
    type: 'earth-observation',
    tle1: '1 46984U 20087A   25214.39012345  .00000278  00000-0  61234-4 0  9988',
    tle2: '2 46984  66.0391 234.5678 0000567  89.0123 271.1234 12.84000000210000',
    dimensions: { length: 3.3, width: 2.3, height: 2.8 },
	image: 'static/images/esa_sentinel6.png'

  }
];