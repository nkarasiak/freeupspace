# Changelog

All notable changes to the From Up There satellite tracking project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.2.4] - 2025-01-06

### 🧹 Code Cleanup
- **Removed Unreferenced UI Elements**: Cleaned up 151 lines of dead code referencing non-existent HTML elements
  - **Pitch Slider**: Removed pitch slider and related event listeners
  - **Unused Buttons**: Removed references to toggle-basemap, track-iss, show-starlink, pause-updates, satellite-tracked-only
  - **Filter System**: Removed filter functionality for non-existent filter checkboxes and count elements
  - **Dead Methods**: Removed updateSatelliteTrackedOnlyButton and related unused functionality

### ⚡ Performance Improvements
- **Bundle Size Reduction**: Main bundle reduced from 94.43 kB to 91.06 kB (-3.37 kB)
- **Cleaner Codebase**: Removed all references to non-existent HTML elements
- **Better Maintainability**: Simplified code structure with only functional elements

### 🛠️ Technical Improvements
- Cleaned up `main.ts`, `deck-satellite-tracker.ts`, and `cockpit.component.ts`
- Improved type safety by removing references to non-existent DOM elements
- Streamlined event listener setup and UI update logic

## [0.2.3] - 2025-01-06

### ✨ New Features
- **User-Controllable Camera Bearing**: Users can now override automatic satellite direction tracking
  - **Horizontal Drag Control**: Drag horizontally while tracking a satellite to manually control viewing angle
  - **Automatic Mode**: Bearing automatically follows satellite movement direction by default
  - **Manual Override**: First horizontal drag activates manual control with visual feedback
  - **Reset to Auto**: Press `B` key to return to automatic satellite direction following

### 🎮 User Experience
- **Intuitive Controls**: Natural mouse drag interaction for bearing control while tracking
- **Visual Feedback**: Clear messages when switching between automatic and manual bearing modes
- **Seamless Transition**: Automatic reset to auto mode when tracking new satellites
- **Responsive Design**: Only activates on significant horizontal movement to prevent accidental activation

### 🛠️ Technical Improvements
- Enhanced `SmoothCamera` class with user bearing control state management
- Improved mouse interaction logic with bearing override detection
- Better camera state synchronization between automatic and manual modes

## [0.2.2] - 2025-08-06

### ✨ New Features
- **Fullscreen Mode**: Press `F` key to toggle fullscreen mode for immersive satellite tracking experience
- **Enhanced Keyboard Controls**: Added fullscreen toggle with visual confirmation messages

### 🎮 User Experience
- **Seamless Fullscreen**: Quick keyboard access to fullscreen without UI buttons
- **Visual Feedback**: Clear confirmation messages when entering/exiting fullscreen mode

## [0.2.1] - 2025-08-06

### 🐛 Bug Fixes
- **Fixed Satellite URL Routing**: Resolved issue where `/yam-10` and other satellite URLs were incorrectly redirecting to `iss-zarya`
- **Improved GitHub Pages SPA Handling**: Updated URL state management to properly handle redirect parameters from GitHub Pages 404 fallback

### 🛠️ Technical Improvements
- Enhanced URL routing logic to prevent default ISS redirect when processing GitHub Pages redirects
- Better handling of Single Page Application (SPA) routing on static hosting platforms

## [0.2.0] - 2025-01-06

### 🚀 Major Features Added
- **Command Palette Search System**: Press `/` to search across 12,000+ satellites
- **On-Demand Satellite Loading**: Satellites loaded only when needed for optimal performance
- **Search Database**: Full Celestrak database cached for instant search results
- **Virtual Scrolling**: Handle large search results efficiently

### ✨ Enhanced Satellite Tracking
- **Smart Camera System**: Automatic bearing, zoom, and pitch adjustment per satellite
- **Satellite-Specific View Settings**: Configure default camera settings per satellite
- **Improved Search Matching**: Search by name, ID, type, and alternate names
- **Real-Time Position Updates**: More accurate orbital position calculations

### 🎨 User Experience Improvements
- **Modern Command Palette Interface**: Clean, keyboard-navigable satellite search
- **Performance Optimizations**: Faster rendering with Level-of-Detail (LOD) system
- **Enhanced Visual Feedback**: Better loading states and search result display
- **Responsive Design**: Improved mobile and desktop experience

### 🛠️ Technical Improvements
- **Modular Architecture**: Better separation of concerns with TypeScript interfaces
- **Search Database Management**: Efficient caching and loading of satellite data
- **Memory Optimization**: Reduced memory usage with smart data management
- **Error Handling**: Improved error handling for network and data issues

### 🐛 Bug Fixes
- Fixed command palette showing only tracked satellite instead of full database
- Resolved satellite image rendering and scaling issues
- Fixed orbital calculations for high-altitude satellites
- Improved TLE data parsing and validation

## [0.1.0] - 2025-01-05

### 🎉 Initial Release Features

#### Core Functionality
- **Real-Time Satellite Tracking**: Live orbital positions using TLE data from Celestrak
- **3D Visualization**: WebGL-powered rendering with Deck.gl
- **Interactive Controls**: Mouse-driven Earth rotation and zoom
- **Satellite Selection**: Basic search and tracking functionality

#### Supported Satellites
- **International Space Station (ISS)**: Featured with custom icon and TLE data
- **Earth Observation**: Landsat, MODIS, Sentinel constellation support
- **Navigation Systems**: GPS, Galileo, GLONASS satellites
- **Communication**: Starlink and commercial satellite tracking
- **Scientific**: Space telescopes and research satellites

#### Technical Foundation
- **TypeScript**: Full type safety and modern development practices
- **Vite Build System**: Fast development and optimized production builds
- **Satellite.js Integration**: Accurate orbital mechanics calculations
- **MapLibre GL**: Interactive base mapping system
- **Custom Satellite Icons**: Visual differentiation for major satellites

#### User Interface
- **Minimalist Cockpit**: Essential tracking information display
- **Real-Time Metrics**: Altitude, speed, and position updates
- **Responsive Design**: Desktop and mobile compatibility
- **Keyboard Shortcuts**: Power user accessibility

### Initial Data Sources
- Celestrak TLE data for orbital elements
- NORAD General Perturbations database
- Custom satellite imagery and metadata
- Real-time orbital propagation calculations

---

## Development Notes

### Version Numbering
- **Major** (X.0.0): Breaking changes, major feature releases
- **Minor** (0.X.0): New features, enhancements, significant improvements
- **Patch** (0.0.X): Bug fixes, minor improvements, documentation updates

### Recent Development Focus
The project has focused on performance optimization and user experience improvements, particularly around search functionality and satellite data management. The addition of the command palette and on-demand loading represents a major step forward in handling large datasets efficiently.

### Upcoming Roadmap
- Enhanced orbit visualization
- Real-time satellite pass predictions
- Advanced filtering and categorization
- Satellite constellation grouping
- Historical orbital data analysis
- Mobile app considerations

### Contributing
See README.md for contribution guidelines and development setup instructions.

---

**Changelog Format**: This changelog follows semantic versioning and focuses on user-facing changes. Technical implementation details are documented in commit messages and code comments.