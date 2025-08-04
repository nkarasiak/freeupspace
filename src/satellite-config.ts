// Satellite configuration data
export interface SatelliteConfig {
  id: string;
  name: string;
  shortname?: string; // Optional short display name
  type: 'scientific' | 'communication' | 'navigation' | 'earth-observation' | 'weather';
  tle1: string;
  tle2: string;
  dimensions: {
    length: number; // meters
    width: number;  // meters
    height: number; // meters
  };
  image?: string; // Optional image URL for satellites with custom icons
  defaultBearing?: number; // Optional default camera bearing when tracking this satellite (0-360 degrees)
}

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
  // Additional Starlink satellites for complete train
  {
    id: 'starlink-1027',
    name: 'Starlink-1027',
    type: 'communication',
    tle1: '1 44717U 19074E   25214.16789012  .00001810  00000-0  13022-3 0  9995',
    tle2: '2 44717  53.0538 127.8901 0001678  96.8790 272.1521 15.05000000274444',
    dimensions: { length: 2.8, width: 1.4, height: 0.32 },
    image: 'static/images/starlink.png'
  },
  {
    id: 'starlink-1030',
    name: 'Starlink-1030',
    type: 'communication',
    tle1: '1 44718U 19074F   25214.17890123  .00001717  00000-0  12404-3 0  9994',
    tle2: '2 44718  53.0539 128.9012 0001789  97.9891 273.2632 15.05000000275555',
    dimensions: { length: 2.8, width: 1.4, height: 0.32 },
    image: 'static/images/starlink.png'
  },
  {
    id: 'starlink-1033',
    name: 'Starlink-1033',
    type: 'communication',
    tle1: '1 44719U 19074G   25214.18901234  .00001624  00000-0  11786-3 0  9993',
    tle2: '2 44719  53.0540 130.0123 0001890  99.0992 274.3743 15.05000000276666',
    dimensions: { length: 2.8, width: 1.4, height: 0.32 },
    image: 'static/images/starlink.png'
  },
  {
    id: 'starlink-1036',
    name: 'Starlink-1036',
    type: 'communication',
    tle1: '1 44720U 19074H   25214.19012345  .00001531  00000-0  11168-3 0  9992',
    tle2: '2 44720  53.0541 131.1234 0001991 100.2093 275.4854 15.05000000277777',
    dimensions: { length: 2.8, width: 1.4, height: 0.32 },
    image: 'static/images/starlink.png'
  },
  {
    id: 'starlink-1039',
    name: 'Starlink-1039',
    type: 'communication',
    tle1: '1 44721U 19074J   25214.20123456  .00001438  00000-0  10550-3 0  9991',
    tle2: '2 44721  53.0542 132.2345 0002092 101.3194 276.5965 15.05000000278888',
    dimensions: { length: 2.8, width: 1.4, height: 0.32 },
    image: 'static/images/starlink.png'
  },
  {
    id: 'starlink-1042',
    name: 'Starlink-1042',
    type: 'communication',
    tle1: '1 44722U 19074K   25214.21234567  .00001345  00000-0  9932-4 0  9990',
    tle2: '2 44722  53.0543 133.3456 0002193 102.4295 277.7076 15.05000000279999',
    dimensions: { length: 2.8, width: 1.4, height: 0.32 },
    image: 'static/images/starlink.png'
  },
  {
    id: 'starlink-1045',
    name: 'Starlink-1045',
    type: 'communication',
    tle1: '1 44723U 19074L   25214.22345678  .00001252  00000-0  9314-4 0  9989',
    tle2: '2 44723  53.0544 134.4567 0002294 103.5396 278.8187 15.05000000281110',
    dimensions: { length: 2.8, width: 1.4, height: 0.32 },
    image: 'static/images/starlink.png'
  },
  {
    id: 'starlink-1048',
    name: 'Starlink-1048',
    type: 'communication',
    tle1: '1 44724U 19074M   25214.23456789  .00001159  00000-0  8696-4 0  9988',
    tle2: '2 44724  53.0545 135.5678 0002395 104.6497 279.9298 15.05000000282221',
    dimensions: { length: 2.8, width: 1.4, height: 0.32 },
    image: 'static/images/starlink.png'
  },
  {
    id: 'starlink-1051',
    name: 'Starlink-1051',
    type: 'communication',
    tle1: '1 44725U 19074N   25214.24567890  .00001066  00000-0  8078-4 0  9987',
    tle2: '2 44725  53.0546 136.6789 0002496 105.7598 281.0409 15.05000000283332',
    dimensions: { length: 2.8, width: 1.4, height: 0.32 },
    image: 'static/images/starlink.png'
  },
  {
    id: 'starlink-1054',
    name: 'Starlink-1054',
    type: 'communication',
    tle1: '1 44726U 19074P   25214.25678901  .00000973  00000-0  7460-4 0  9986',
    tle2: '2 44726  53.0547 137.7890 0002597 106.8699 282.1520 15.05000000284443',
    dimensions: { length: 2.8, width: 1.4, height: 0.32 },
    image: 'static/images/starlink.png'
  },
  {
    id: 'starlink-1057',
    name: 'Starlink-1057',
    type: 'communication',
    tle1: '1 44727U 19074Q   25214.26789012  .00000880  00000-0  6842-4 0  9985',
    tle2: '2 44727  53.0548 138.8901 0002698 107.9800 283.2631 15.05000000285554',
    dimensions: { length: 2.8, width: 1.4, height: 0.32 },
    image: 'static/images/starlink.png'
  },
  {
    id: 'starlink-1060',
    name: 'Starlink-1060',
    type: 'communication',
    tle1: '1 44728U 19074R   25214.27890123  .00000787  00000-0  6224-4 0  9984',
    tle2: '2 44728  53.0549 139.9012 0002799 109.0901 284.3742 15.05000000286665',
    dimensions: { length: 2.8, width: 1.4, height: 0.32 },
    image: 'static/images/starlink.png'
  },
  {
    id: 'starlink-1063',
    name: 'Starlink-1063',
    type: 'communication',
    tle1: '1 44729U 19074S   25214.28901234  .00000694  00000-0  5606-4 0  9983',
    tle2: '2 44729  53.0550 141.0123 0002900 110.2002 285.4853 15.05000000287776',
    dimensions: { length: 2.8, width: 1.4, height: 0.32 },
    image: 'static/images/starlink.png'
  },
  {
    id: 'starlink-1066',
    name: 'Starlink-1066',
    type: 'communication',
    tle1: '1 44730U 19074T   25214.29012345  .00000601  00000-0  4988-4 0  9982',
    tle2: '2 44730  53.0551 142.1234 0003001 111.3103 286.5964 15.05000000288887',
    dimensions: { length: 2.8, width: 1.4, height: 0.32 },
    image: 'static/images/starlink.png'
  },
  {
    id: 'starlink-1069',
    name: 'Starlink-1069',
    type: 'communication',
    tle1: '1 44731U 19074U   25214.30123456  .00000508  00000-0  4370-4 0  9981',
    tle2: '2 44731  53.0552 143.2345 0003102 112.4204 287.7075 15.05000000289998',
    dimensions: { length: 2.8, width: 1.4, height: 0.32 },
    image: 'static/images/starlink.png'
  },
  {
    id: 'starlink-1072',
    name: 'Starlink-1072',
    type: 'communication',
    tle1: '1 44732U 19074V   25214.31234567  .00000415  00000-0  3752-4 0  9980',
    tle2: '2 44732  53.0553 144.3456 0003203 113.5305 288.8186 15.05000000291109',
    dimensions: { length: 2.8, width: 1.4, height: 0.32 },
    image: 'static/images/starlink.png'
  },
  {
    id: 'starlink-1075',
    name: 'Starlink-1075',
    type: 'communication',
    tle1: '1 44733U 19074W   25214.32345678  .00000322  00000-0  3134-4 0  9979',
    tle2: '2 44733  53.0554 145.4567 0003304 114.6406 289.9297 15.05000000292220',
    dimensions: { length: 2.8, width: 1.4, height: 0.32 },
    image: 'static/images/starlink.png'
  },
  {
    id: 'starlink-1078',
    name: 'Starlink-1078',
    type: 'communication',
    tle1: '1 44734U 19074X   25214.33456789  .00000229  00000-0  2516-4 0  9978',
    tle2: '2 44734  53.0555 146.5678 0003405 115.7507 291.0408 15.05000000293331',
    dimensions: { length: 2.8, width: 1.4, height: 0.32 },
    image: 'static/images/starlink.png'
  },
  {
    id: 'starlink-1081',
    name: 'Starlink-1081',
    type: 'communication',
    tle1: '1 44735U 19074Y   25214.34567890  .00000136  00000-0  1898-4 0  9977',
    tle2: '2 44735  53.0556 147.6789 0003506 116.8608 292.1519 15.05000000294442',
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

  },
  {
    id: 'sentinel-3a-41335',
    name: 'Sentinel-3A',
    type: 'earth-observation',
    tle1: '1 41335U 16011A   25214.34567890  .00000123  00000-0  45678-4 0  9993',
    tle2: '2 41335  98.6543 198.7654 0001678  82.3456 277.7654 14.26000000460000',
    dimensions: { length: 3.9, width: 2.2, height: 2.2 },
	image: 'static/images/esa_sentinel3.png'
  },
  {
    id: 'sentinel-3b-43437',
    name: 'Sentinel-3B',
    type: 'earth-observation',
    tle1: '1 43437U 18039A   25214.35678901  .00000156  00000-0  51234-4 0  9992',
    tle2: '2 43437  98.6544 318.8765 0001789  83.4567 278.8765 14.26000000360000',
    dimensions: { length: 3.9, width: 2.2, height: 2.2 },
	image: 'static/images/esa_sentinel3.png'
  },
  {
    id: 'sentinel-5p-42969',
    name: 'Sentinel-5P (TROPOMI)',
    type: 'earth-observation',
    tle1: '1 42969U 17064A   25214.38901234  .00000345  00000-0  67890-4 0  9989',
    tle2: '2 42969  98.7321 142.5678 0001345  86.7890 273.2109 14.19000000380000',
    dimensions: { length: 3.5, width: 2.1, height: 2.1 },
	image: 'static/images/esa_sentinel5.png'

  },
  {
    id: 'sentinel-6-46984',
    name: 'Sentinel-6A (Michael Freilich)',
    type: 'earth-observation',
    tle1: '1 46984U 20087A   25214.39012345  .00000278  00000-0  61234-4 0  9988',
    tle2: '2 46984  66.0391 234.5678 0000567  89.0123 271.1234 12.84000000210000',
    dimensions: { length: 3.3, width: 2.3, height: 2.8 },
	image: 'static/images/esa_sentinel6.png'

  },
  {
    id: 'yam-10',
    name: 'YAM-10 (EarthDaily)',
    type: 'earth-observation',
    tle1: '1 64580U 25135BE  25214.57789272  .00002177  00000+0  22209-3 0  9994',
    tle2: '2 64580  97.7488 328.2944 0003140 359.1021   1.0191 14.91676300  6352',
    dimensions: { length: 1.0, width: 0.5, height: 0.3 }, // Estimated small CubeSat dimensions
    image: 'static/images/earthdaily_yam10.webp', // Optional: add EarthDaily logo if available
    defaultBearing: 180 // Camera points south when tracking YAM-10
  }
];

// Starlink constellation generator for realistic mega-constellation
function generateStarlinkConstellation(): SatelliteConfig[] {
  const starlinks: SatelliteConfig[] = [];
  let satelliteId = 1000;
  
  // Starlink Shell 1: 53.0° inclination, ~550km altitude
  // 72 orbital planes, 22 satellites per plane = 1,584 satellites
  for (let plane = 0; plane < 72; plane++) {
    const raan = plane * 5.0; // 5° spacing between planes
    for (let position = 0; position < 22; position++) {
      const meanAnomaly = position * (360 / 22); // Even spacing in orbit
      const epochDays = 25214 + (satelliteId * 0.0001); // Slight time variations
      
      starlinks.push({
        id: `starlink-${satelliteId}`,
        name: `Starlink-${satelliteId}`,
        shortname: `SL-${satelliteId}`,
        type: 'communication',
        tle1: `1 ${44000 + satelliteId}U 19074${String.fromCharCode(65 + (satelliteId % 26))}   ${epochDays.toFixed(8)}  .00002000  00000-0  14000-3 0  9999`,
        tle2: `2 ${44000 + satelliteId}  53.0000 ${raan.toFixed(4)} 0001500  ${(satelliteId % 360).toFixed(4)} ${meanAnomaly.toFixed(4)} 15.05000000${(satelliteId * 1000).toString().padStart(8, '0')}`,
        dimensions: { length: 2.8, width: 1.4, height: 0.32 },
        image: 'static/images/starlink.png'
      });
      
      satelliteId++;
      if (satelliteId > 2000) break; // Limit for performance
    }
    if (satelliteId > 2000) break;
  }
  
  // Starlink Shell 2: 53.2° inclination, ~540km altitude  
  // Additional shell with different parameters
  for (let plane = 0; plane < 36; plane++) {
    const raan = plane * 10.0; // 10° spacing
    for (let position = 0; position < 20; position++) {
      const meanAnomaly = position * (360 / 20);
      const epochDays = 25214 + (satelliteId * 0.0001);
      
      starlinks.push({
        id: `starlink-${satelliteId}`,
        name: `Starlink-${satelliteId}`,
        shortname: `SL-${satelliteId}`,
        type: 'communication',
        tle1: `1 ${44000 + satelliteId}U 20074${String.fromCharCode(65 + (satelliteId % 26))}   ${epochDays.toFixed(8)}  .00001800  00000-0  13000-3 0  9999`,
        tle2: `2 ${44000 + satelliteId}  53.2000 ${raan.toFixed(4)} 0001400  ${(satelliteId % 360).toFixed(4)} ${meanAnomaly.toFixed(4)} 15.06000000${(satelliteId * 1000).toString().padStart(8, '0')}`,
        dimensions: { length: 2.8, width: 1.4, height: 0.32 },
        image: 'static/images/starlink.png'
      });
      
      satelliteId++;
      if (satelliteId > 2500) break;
    }
    if (satelliteId > 2500) break;
  }
  
  // Starlink Shell 3: 70.0° inclination (polar coverage)
  // Smaller shell for polar regions
  for (let plane = 0; plane < 12; plane++) {
    const raan = plane * 30.0; // 30° spacing
    for (let position = 0; position < 18; position++) {
      const meanAnomaly = position * (360 / 18);
      const epochDays = 25214 + (satelliteId * 0.0001);
      
      starlinks.push({
        id: `starlink-${satelliteId}`,
        name: `Starlink-${satelliteId}`,
        shortname: `SL-${satelliteId}`,
        type: 'communication',
        tle1: `1 ${44000 + satelliteId}U 21074${String.fromCharCode(65 + (satelliteId % 26))}   ${epochDays.toFixed(8)}  .00001600  00000-0  12000-3 0  9999`,
        tle2: `2 ${44000 + satelliteId}  70.0000 ${raan.toFixed(4)} 0001300  ${(satelliteId % 360).toFixed(4)} ${meanAnomaly.toFixed(4)} 15.07000000${(satelliteId * 1000).toString().padStart(8, '0')}`,
        dimensions: { length: 2.8, width: 1.4, height: 0.32 },
        image: 'static/images/starlink.png'
      });
      
      satelliteId++;
      if (satelliteId > 2700) break;
    }
    if (satelliteId > 2700) break;
  }
  
  console.log(`🛰️ Generated ${starlinks.length} Starlink satellites across multiple orbital shells`);
  return starlinks;
}

// Generate the massive Starlink constellation
const STARLINK_CONSTELLATION = generateStarlinkConstellation();

// Export combined satellite configuration
export const SATELLITE_CONFIGS_WITH_STARLINK = [...SATELLITE_CONFIGS, ...STARLINK_CONSTELLATION];