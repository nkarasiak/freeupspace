/**
 * Example usage of the Browser Module
 * This shows how to integrate the browser into your application
 */

import { BrowserComponent } from './browser.component';
import { SatelliteDataService } from '../../services/satellite-data.service';

// Example integration function
export async function initializeBrowser(containerId: string): Promise<BrowserComponent> {
  // Get the container element
  const container = document.getElementById(containerId);
  if (!container) {
    throw new Error(`Container with id '${containerId}' not found`);
  }

  // Initialize satellite data service
  const satelliteDataService = new SatelliteDataService();
  await satelliteDataService.initialize();

  // Create and return browser component
  const browser = new BrowserComponent(container, satelliteDataService);
  
  // Start with categories view
  browser.showCategories();
  
  return browser;
}

// Example usage patterns:

/*
// 1. Basic initialization
const browser = await initializeBrowser('browser-container');

// 2. Navigate to specific category
browser.showCategory('earth-observation');

// 3. Navigate to specific satellite
browser.showSatellite('iss-zarya-25544');

// 4. Search with filters
browser.search({
  name: 'landsat',
  sortBy: 'name',
  sortOrder: 'asc'
});

// 5. Use URL-based navigation
browser.navigate('/browser/category/communication');
browser.navigate('/browser/satellite/hubble-20580');
browser.navigate('/browser/search?name=starlink&sortBy=name');

// 6. Get current URL for bookmarking
const currentUrl = browser.getCurrentUrl();
*/

// Example HTML structure needed:
/*
<!DOCTYPE html>
<html>
<head>
  <link rel="stylesheet" href="src/domain/browser/styles/browser.css">
  <link rel="stylesheet" href="src/styles/global.css">
</head>
<body>
  <div id="browser-container"></div>
  
  <script type="module">
    import { initializeBrowser } from './src/domain/browser/example.js';
    
    // Initialize the browser
    initializeBrowser('browser-container').then(browser => {
      
      // Optional: Handle browser navigation events
      window.addEventListener('popstate', (e) => {
        const path = window.location.pathname;
        const params = new URLSearchParams(window.location.search);
        browser.navigate(path, params);
      });
    });
  </script>
</body>
</html>
*/