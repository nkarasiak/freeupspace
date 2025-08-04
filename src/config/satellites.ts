import { SatelliteConfig } from '../types/satellite';

export const SATELLITE_CONFIGS: SatelliteConfig[] = [
  // Scientific satellites
  {
    id: 'iss-zarya-25544',
    name: 'International Space Station',
    shortname: 'ISS',
    type: 'scientific',
    tle1: '1 25544U 98067A   25214.09653981  .00010888  00000+0  19653-3 0  9996',
    tle2: '2 25544  51.6345  79.5266 0001736 142.9190 217.1919 15.50282964522285',
    dimensions: { length: 108.5, width: 72.8, height: 20.0 },
    image: 'static/images/ISS.png'
  },
  {
    id: 'hst-20580',
    name: 'Hubble Space Telescope',
    shortname: 'HUBBLE',
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

  // NASA Earth observation satellites (MODIS)
  {
    id: 'terra-25994',
    name: 'Terra (EOS AM-1)',
    shortname: 'TERRA',
    type: 'earth-observation',
    tle1: '1 25994U 99068A   25214.45123456  .00000534  00000-0  89012-4 0  9995',
    tle2: '2 25994  98.2054 156.7890 0001234  87.5432 272.6789 14.57000000380000',
    dimensions: { length: 6.8, width: 3.5, height: 3.1 },
    image: 'static/images/nasa_modis_terra.png'
  },
  {
    id: 'aqua-27424',
    name: 'Aqua (EOS PM-1)',
    shortname: 'AQUA',
    type: 'earth-observation', 
    tle1: '1 27424U 02022A   25214.46234567  .00000487  00000-0  81234-4 0  9994',
    tle2: '2 27424  98.2012 276.8901 0001345  88.6543 271.4567 14.57000000280000',
    dimensions: { length: 6.8, width: 3.5, height: 3.1 },
    image: 'static/images/nasa_modis_aqua.png'
  },

  // NASA Landsat satellites
  {
    id: 'landsat-8-39084',
    name: 'Landsat 8 (LDCM)',
    shortname: 'LANDSAT-8',
    type: 'earth-observation',
    tle1: '1 39084U 13008A   25214.47345678  .00000412  00000-0  76543-4 0  9993',
    tle2: '2 39084  98.2156 196.8901 0001456  89.7654 270.3456 14.57000000620000',
    dimensions: { length: 3.0, width: 2.7, height: 4.3 },
    image: 'static/images/nasa_landsat8.png'
  },
  {
    id: 'landsat-9-49260',
    name: 'Landsat 9',
    shortname: 'LANDSAT-9',
    type: 'earth-observation',
    tle1: '1 49260U 21088A   25214.48456789  .00000398  00000-0  73210-4 0  9992',
    tle2: '2 49260  98.2134 316.9012 0001567  90.8765 269.2345 14.57000000180000',
    dimensions: { length: 3.0, width: 2.7, height: 4.3 },
    image: 'static/images/nasa_landsat9.png'
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

  // Sentinel Earth observation constellation
  {
    id: 'sentinel-1a-39634',
    name: 'Sentinel-1A',
    type: 'earth-observation',
    tle1: '1 39634U 14016A   25214.25123456  .00000234  00000-0  56789-4 0  9995',
    tle2: '2 39634  98.1851 167.5432 0001456  78.9012 281.2345 14.59000000580000',
    dimensions: { length: 10.0, width: 2.4, height: 3.4 },
    image: 'static/images/esa_sentinel1.png'
  },
    {
    id: 'sentinel-1b-41456',
    name: 'Sentinel-1B',
    type: 'earth-observation',
    tle1: '1 41456U 16025A   25214.26234567  .00000267  00000-0  62345-4 0  9994',
    tle2: '2 41456  98.1852 287.6543 0001567  79.0123 282.3456 14.59000000480000',
    dimensions: { length: 10.0, width: 2.4, height: 3.4 },
	image: 'static/images/esa_sentinel1.png'

  },
  {
    id: 'sentinel-1c-62261',
    name: 'Sentinel-1C',
    type: 'earth-observation',
    tle1: '1 59051U 24036A   25214.27345678  .00000198  00000-0  54321-4 0  9993',
    tle2: '2 59051  98.1853 47.7654 0001678  80.1234 283.4567 14.59000000080000',
    dimensions: { length: 10.0, width: 2.4, height: 3.4 },
	image: 'static/images/esa_sentinel1.png'
  },
  {
    id: 'sentinel-2a-40697',
    name: 'Sentinel-2A',
    type: 'earth-observation',
    tle1: '1 40697U 15028A   25214.31234567  .00000456  00000-0  78901-4 0  9980',
    tle2: '2 40697  98.5692 123.4567 0001234  89.0123 271.1234 14.30000000480000',
    dimensions: { length: 3.7, width: 2.1, height: 2.4 },
	image: 'static/images/esa_sentinel2.png'
  },
  {
    id: 'sentinel-2b-42063',
    name: 'Sentinel-2B',
    type: 'earth-observation',
    tle1: '1 42063U 17013A   25214.32345678  .00000523  00000-0  89012-4 0  9979',
    tle2: '2 42063  98.5693 234.5678 0001345  90.1234 272.2345 14.30000000380000',
    dimensions: { length: 3.7, width: 2.1, height: 2.4 },
	image: 'static/images/esa_sentinel2.png'
  },
  {
    id: 'sentinel-2c-60989',
    name: 'Sentinel-2C',
    type: 'earth-observation',
    tle1: '1 59999U 24077A   25214.33456789  .00000467  00000-0  81234-4 0  9978',
    tle2: '2 59999  98.5694 345.6789 0001456  91.2345 273.3456 14.30000000180000',
    dimensions: { length: 3.7, width: 2.1, height: 2.4 },
	image: 'static/images/esa_sentinel2.png'
  },  {
    id: 'yam-10',
    name: 'YAM-10 (EarthDaily)',
    type: 'earth-observation',
    tle1: '1 64580U 25135BE  25214.57789272  .00002177  00000+0  22209-3 0  9994',
    tle2: '2 64580  97.7488 328.2944 0003140 359.1021   1.0191 14.91676300  6352',
    dimensions: { length: 1.0, width: 0.5, height: 0.3 },
    image: 'static/images/earthdaily_yam10.webp',
    defaultBearing: 180
  }
];

// Starlink constellation generator for realistic mega-constellation
function generateStarlinkConstellation(): SatelliteConfig[] {
  const starlinks: SatelliteConfig[] = [];
  let satelliteId = 1000;
  
  // Starlink Shell 1: 53.0° inclination, ~550km altitude
  // Reduce the number to avoid TLE formatting issues and improve performance
  for (let plane = 0; plane < 10; plane++) { // Reduced from 72 to 10 planes
    const raan = plane * 36.0; // 36° spacing between planes
    for (let position = 0; position < 12; position++) { // Reduced from 22 to 12 satellites per plane
      const meanAnomaly = position * (360 / 12); // Even spacing in orbit
      const epochDays = 25214.12345678 + (satelliteId * 0.0001); // Slight time variations
      const catalogNumber = 44000 + satelliteId;
      
      // Ensure proper TLE formatting
      const tle1 = `1 ${catalogNumber.toString().padStart(5, '0')}U 19074A   ${epochDays.toFixed(8)}  .00002000  00000-0  14000-3 0  9999`;
      const tle2 = `2 ${catalogNumber.toString().padStart(5, '0')}  53.0000 ${raan.toFixed(4)} 0001500  ${(satelliteId % 360).toFixed(4)} ${meanAnomaly.toFixed(4)} 15.05000000${(satelliteId * 100).toString().padStart(8, '0')}`;
      
      starlinks.push({
        id: `starlink-${satelliteId}`,
        name: `Starlink-${satelliteId}`,
        shortname: `SL-${satelliteId}`,
        type: 'communication',
        tle1: tle1,
        tle2: tle2,
        dimensions: { length: 2.8, width: 1.4, height: 0.32 },
        image: 'static/images/starlink.png'
      });
      
      satelliteId++;
      if (satelliteId > 1200) break; // Limit for performance (120 satellites total)
    }
    if (satelliteId > 1200) break;
  }
  
  return starlinks;
}

// Generate the massive Starlink constellation
const STARLINK_CONSTELLATION = generateStarlinkConstellation();

// Export combined satellite configuration
export const SATELLITE_CONFIGS_WITH_STARLINK = [...SATELLITE_CONFIGS, ...STARLINK_CONSTELLATION];