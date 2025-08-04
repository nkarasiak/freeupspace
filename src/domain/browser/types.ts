export interface CategoryInfo {
  id: string;
  name: string;
  description: string;
  count: number;
}

export interface BrowserFilters {
  name?: string;
  type?: string;
  launchDateFrom?: Date;
  launchDateTo?: Date;
  sortBy?: 'name' | 'launchDate' | 'type';
  sortOrder?: 'asc' | 'desc';
}

export interface SatelliteBrowserResult {
  satellites: import('../../types/satellite').SatelliteData[];
  totalCount: number;
  category?: string;
}