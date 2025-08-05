# Satellite Browser Module

A comprehensive browser module for exploring satellite catalogs by category, name, type, and other criteria. The module provides an intuitive interface for browsing satellites organized by their mission types and viewing detailed information about individual satellites.

## Features

- **Category Browsing**: Browse satellites by type (Earth Observation, Communication, Scientific, Navigation, Weather)
- **Individual Satellite Pages**: Detailed view of specific satellites with orbital data and specifications
- **Advanced Filtering**: Filter by name, type, and sort by various criteria
- **Responsive Design**: Mobile-friendly interface with modern CSS styling
- **URL Routing**: Support for bookmarkable URLs and browser navigation

## API Routes

The browser module supports the following URL patterns:

### Category Browsing
```
/browser/category/earth-observation
/browser/category/communication
/browser/category/scientific
/browser/category/navigation
/browser/category/weather
```

### Individual Satellite Pages
```
/browser/satellite/iss-zarya
/browser/satellite/hubble
/browser/satellite/landsat-8
```

### Search with Filters
```
/browser/search?name=starlink&sortBy=name&sortOrder=asc
/browser/search?type=earth-observation&sortBy=type
```

## Usage

### Basic Integration

```typescript
import { BrowserComponent } from './src/domain/browser';
import { SatelliteDataService } from './src/services/satellite-data.service';

// Initialize the browser
const container = document.getElementById('browser-container');
const satelliteDataService = new SatelliteDataService();
await satelliteDataService.initialize();

const browser = new BrowserComponent(container, satelliteDataService);

// Show categories (default view)
browser.showCategories();
```

### Navigation Examples

```typescript
// Navigate to specific category
browser.showCategory('earth-observation');

// Show specific satellite
browser.showSatellite('iss-zarya-25544');

// Search with filters
browser.search({
  name: 'landsat',
  sortBy: 'name',
  sortOrder: 'asc'
});

// URL-based navigation
browser.navigate('/browser/category/communication');
browser.navigate('/browser/satellite/hubble-20580');
```

### Event Handling

The browser components emit custom events that you can listen for:

```typescript
// Listen for category selection
container.addEventListener('category-selected', (e) => {
  console.log('Category selected:', e.detail.categoryId);
});
```

## Components

### BrowserComponent
Main orchestrating component that handles routing and component coordination.

### CategoryBrowserComponent
Displays available satellite categories with counts and descriptions.

### SatelliteListComponent
Shows filtered lists of satellites with sorting and filtering controls.

### SatelliteDetailComponent
Displays detailed information about a specific satellite including:
- Basic information (name, type, ID)
- Current orbital position and velocity
- Physical specifications
- TLE orbital elements
- Camera settings (if available)

## Services

### SatelliteBrowserService
Core service providing:
- Category enumeration with counts
- Satellite filtering and searching
- Individual satellite retrieval

### BrowserRouter
Handles URL parsing and route generation for:
- Category browsing
- Individual satellite pages
- Search functionality

## Styling

The module includes comprehensive CSS styling in `styles/browser.css` with:
- Responsive grid layouts
- Modern card-based design
- Interactive hover effects
- Mobile-friendly breakpoints
- Dark theme support (planned)

## Types

### BrowserFilters
```typescript
interface BrowserFilters {
  name?: string;
  type?: string;
  launchDateFrom?: Date;
  launchDateTo?: Date;
  sortBy?: 'name' | 'launchDate' | 'type';
  sortOrder?: 'asc' | 'desc';
}
```

### CategoryInfo
```typescript
interface CategoryInfo {
  id: string;
  name: string;
  description: string;
  count: number;
}
```

### SatelliteBrowserResult
```typescript
interface SatelliteBrowserResult {
  satellites: SatelliteData[];
  totalCount: number;
  category?: string;
}
```

## File Structure

```
src/domain/browser/
├── README.md                     # This documentation
├── index.ts                      # Module exports
├── browser.component.ts          # Main browser component
├── satellite-browser.service.ts  # Core browser service
├── browser-router.ts             # URL routing logic
├── types.ts                      # Type definitions
├── example.ts                    # Usage examples
├── components/
│   ├── category-browser.component.ts    # Category grid view
│   ├── satellite-list.component.ts      # Satellite list view
│   └── satellite-detail.component.ts    # Individual satellite view
└── styles/
    └── browser.css               # Complete styling
```

## Future Enhancements

- Launch date filtering (requires additional satellite data)
- Advanced search with orbital parameters
- Export functionality (CSV, JSON)
- Satellite comparison features
- Historical orbital data visualization
- Integration with real-time tracking
- Bookmark/favorites system
- Dark theme toggle

## Browser Support

- Modern browsers with ES2020+ support
- CSS Grid and Flexbox support required
- Custom Elements support recommended for future enhancements