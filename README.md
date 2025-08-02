# Real-Time Satellite Tracker

A real-time satellite tracking application built with TypeScript, Vite, and MapLibre GL JS. Track satellites including the ISS, Starlink constellation, and ESA Sentinel satellites with linear zoom scaling.

## Features

- 🛰️ Real-time satellite tracking using TLE data
- 🔍 Linear zoom scaling (zoom 5 = 5x magnification, zoom 7 = 7x magnification)
- 🎯 Click to follow satellites
- 🔍 Search satellites by name
- 🌍 Toggle between day and night basemaps
- 📡 Multiple satellite types: ISS, Starlink, Sentinel constellation

## Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## Deployment

This project is automatically deployed to GitHub Pages when changes are pushed to the main branch.

### Manual Deployment Setup

1. Go to your GitHub repository settings
2. Navigate to Pages section
3. Set Source to "GitHub Actions"
4. The workflow will automatically deploy on every push to main

The site will be available at: `https://[username].github.io/freeupspace/`

## Satellite Data

The application tracks various satellites including:
- International Space Station (ISS)
- Starlink constellation (multiple generations)
- ESA Sentinel satellites (1A-6B)
- Weather satellites (NOAA-20)
- Scientific satellites (Hubble)

## Technologies Used

- TypeScript
- Vite
- MapLibre GL JS
- satellite.js for orbital calculations
- GitHub Actions for CI/CD