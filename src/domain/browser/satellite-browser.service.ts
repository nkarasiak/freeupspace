import { SatelliteData } from '../../types/satellite';
import { SatelliteDataService } from '../../services/satellite-data.service';
import { CategoryInfo, BrowserFilters, SatelliteBrowserResult } from './types';

export class SatelliteBrowserService {
  private satelliteDataService: SatelliteDataService;

  constructor(satelliteDataService: SatelliteDataService) {
    this.satelliteDataService = satelliteDataService;
  }

  /**
   * Get the underlying satellite data service (for access to stats, etc.)
   */
  getSatelliteDataService(): SatelliteDataService {
    return this.satelliteDataService;
  }

  /**
   * Get all available categories with satellite counts
   */
  getCategories(): CategoryInfo[] {
    const satellites = Array.from(this.satelliteDataService.getSatellites().values());
    const categoryMap = new Map<string, { name: string; description: string; count: number }>();

    // Initialize category info
    const categoryDescriptions = {
      'earth-observation': 'Satellites monitoring Earth\'s surface, climate, and environment',
      'communication': 'Satellites providing telecommunications and internet services',
      'scientific': 'Research satellites for space exploration and scientific studies',
      'navigation': 'Satellites providing positioning and navigation services',
      'weather': 'Satellites monitoring weather patterns and atmospheric conditions'
    };

    satellites.forEach(satellite => {
      const type = satellite.type;
      if (!categoryMap.has(type)) {
        categoryMap.set(type, {
          name: this.formatCategoryName(type),
          description: categoryDescriptions[type] || `${this.formatCategoryName(type)} satellites`,
          count: 0
        });
      }
      categoryMap.get(type)!.count++;
    });

    return Array.from(categoryMap.entries()).map(([id, info]) => ({
      id,
      ...info
    })).sort((a, b) => a.name.localeCompare(b.name));
  }

  /**
   * Browse satellites by category
   */
  browseByCategory(category: string, filters?: BrowserFilters): SatelliteBrowserResult {
    const allSatellites = Array.from(this.satelliteDataService.getSatellites().values());
    let filteredSatellites = allSatellites.filter(satellite => satellite.type === category);

    // Apply additional filters
    if (filters) {
      filteredSatellites = this.applyFilters(filteredSatellites, filters);
    }

    return {
      satellites: filteredSatellites,
      totalCount: filteredSatellites.length,
      category
    };
  }

  /**
   * Get a specific satellite by ID
   */
  getSatelliteById(satelliteId: string): SatelliteData | undefined {
    return this.satelliteDataService.getSatellite(satelliteId);
  }

  /**
   * Search satellites with filters
   */
  searchSatellites(filters: BrowserFilters): SatelliteBrowserResult {
    const allSatellites = Array.from(this.satelliteDataService.getSatellites().values());
    const filteredSatellites = this.applyFilters(allSatellites, filters);

    return {
      satellites: filteredSatellites,
      totalCount: filteredSatellites.length
    };
  }

  /**
   * Get satellites by name (partial match)
   */
  getSatellitesByName(name: string): SatelliteData[] {
    return this.satelliteDataService.searchSatellites(name);
  }

  private applyFilters(satellites: SatelliteData[], filters: BrowserFilters): SatelliteData[] {
    let filtered = [...satellites];

    // Filter by name
    if (filters.name) {
      const nameFilter = filters.name.toLowerCase();
      filtered = filtered.filter(satellite => 
        satellite.name.toLowerCase().includes(nameFilter) ||
        (satellite.shortname && satellite.shortname.toLowerCase().includes(nameFilter)) ||
        satellite.id.toLowerCase().includes(nameFilter)
      );
    }

    // Filter by type
    if (filters.type) {
      filtered = filtered.filter(satellite => satellite.type === filters.type);
    }

    // Note: Launch date filtering would require additional data in the satellite config
    // For now, we'll leave this as a placeholder for future enhancement

    // Sort results
    if (filters.sortBy) {
      filtered.sort((a, b) => {
        let comparison = 0;
        
        switch (filters.sortBy) {
          case 'name':
            comparison = a.name.localeCompare(b.name);
            break;
          case 'type':
            comparison = a.type.localeCompare(b.type);
            break;
          case 'launchDate':
            // Placeholder for when launch date data is available
            comparison = 0;
            break;
        }
        
        return filters.sortOrder === 'desc' ? -comparison : comparison;
      });
    }

    return filtered;
  }

  private formatCategoryName(category: string): string {
    return category
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }
}