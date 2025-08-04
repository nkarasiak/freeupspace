import { SatelliteBrowserService } from './satellite-browser.service';
import { BrowserFilters, CategoryInfo, SatelliteBrowserResult } from './types';
import { SatelliteData } from '../../types/satellite';

export interface BrowserRoute {
  type: 'category' | 'satellite' | 'search';
  category?: string;
  satelliteId?: string;
  filters?: BrowserFilters;
}

export type RouteResult = 
  | { type: 'categories'; data: CategoryInfo[] }
  | { type: 'category-results'; data: SatelliteBrowserResult }
  | { type: 'search-results'; data: SatelliteBrowserResult }
  | { type: 'satellite-detail'; data: SatelliteData }
  | { type: 'error'; message: string };

export class BrowserRouter {
  private browserService: SatelliteBrowserService;

  constructor(browserService: SatelliteBrowserService) {
    this.browserService = browserService;
  }

  /**
   * Parse a browser path and return the appropriate route
   * Examples:
   * - /browser/category/earth-observation
   * - /browser/satellite/iss-zarya-25544
   * - /browser/search?name=starlink&type=communication
   */
  parseRoute(path: string, params?: URLSearchParams): BrowserRoute | null {
    // Remove leading/trailing slashes and split
    const segments = path.replace(/^\/+|\/+$/g, '').split('/');
    
    // Expect: ['browser', ...]
    if (segments.length < 2 || segments[0] !== 'browser') {
      return null;
    }

    const routeType = segments[1];

    switch (routeType) {
      case 'category':
        if (segments.length >= 3) {
          const category = segments[2];
          const filters = this.parseSearchParams(params);
          return {
            type: 'category',
            category,
            filters
          };
        }
        return {
          type: 'category'
        };

      case 'satellite':
        if (segments.length >= 3) {
          return {
            type: 'satellite',
            satelliteId: segments[2]
          };
        }
        return null;

      case 'search':
        const filters = this.parseSearchParams(params);
        return {
          type: 'search',
          filters
        };

      default:
        return null;
    }
  }

  /**
   * Handle a browser route and return the results
   */
  handleRoute(route: BrowserRoute): RouteResult {
    switch (route.type) {
      case 'category':
        if (!route.category) {
          // Return all categories
          return {
            type: 'categories',
            data: this.browserService.getCategories()
          };
        }
        return {
          type: 'category-results',
          data: this.browserService.browseByCategory(route.category, route.filters)
        };

      case 'satellite':
        if (!route.satelliteId) {
          return { type: 'error', message: 'Satellite ID required' };
        }
        const satellite = this.browserService.getSatelliteById(route.satelliteId);
        if (!satellite) {
          return { type: 'error', message: `Satellite '${route.satelliteId}' not found` };
        }
        return {
          type: 'satellite-detail',
          data: satellite
        };

      case 'search':
        return {
          type: 'search-results',
          data: this.browserService.searchSatellites(route.filters || {})
        };

      default:
        return { type: 'error', message: 'Invalid route type' };
    }
  }

  /**
   * Generate a URL for a specific route
   */
  generateUrl(route: BrowserRoute): string {
    let path = '/browser';

    switch (route.type) {
      case 'category':
        path += '/category';
        if (route.category) {
          path += `/${route.category}`;
        }
        break;

      case 'satellite':
        if (route.satelliteId) {
          path += `/satellite/${route.satelliteId}`;
        }
        break;

      case 'search':
        path += '/search';
        break;
    }

    // Add query parameters if filters exist
    if (route.filters) {
      const params = new URLSearchParams();
      
      if (route.filters.name) params.set('name', route.filters.name);
      if (route.filters.type) params.set('type', route.filters.type);
      if (route.filters.sortBy) params.set('sortBy', route.filters.sortBy);
      if (route.filters.sortOrder) params.set('sortOrder', route.filters.sortOrder);
      
      const queryString = params.toString();
      if (queryString) {
        path += `?${queryString}`;
      }
    }

    return path;
  }

  private parseSearchParams(params?: URLSearchParams): BrowserFilters {
    if (!params) return {};

    const filters: BrowserFilters = {};

    const name = params.get('name');
    if (name) filters.name = name;

    const type = params.get('type');
    if (type) filters.type = type;

    const sortBy = params.get('sortBy') as 'name' | 'launchDate' | 'type' | null;
    if (sortBy && ['name', 'launchDate', 'type'].includes(sortBy)) {
      filters.sortBy = sortBy;
    }

    const sortOrder = params.get('sortOrder') as 'asc' | 'desc' | null;
    if (sortOrder && ['asc', 'desc'].includes(sortOrder)) {
      filters.sortOrder = sortOrder;
    }

    return filters;
  }
}