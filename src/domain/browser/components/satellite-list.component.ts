import { SatelliteData } from '../../../types/satellite';
import { SatelliteBrowserResult, BrowserFilters } from '../types';

export class SatelliteListComponent {
  private container: HTMLElement;
  private onSatelliteSelected?: (satelliteId: string) => void;
  private onFiltersChanged?: (filters: BrowserFilters) => void;

  constructor(container: HTMLElement) {
    this.container = container;
  }

  setEventHandlers(handlers: {
    onSatelliteSelected?: (satelliteId: string) => void;
    onFiltersChanged?: (filters: BrowserFilters) => void;
  }): void {
    this.onSatelliteSelected = handlers.onSatelliteSelected;
    this.onFiltersChanged = handlers.onFiltersChanged;
  }

  render(result: SatelliteBrowserResult, filters?: BrowserFilters): void {
    const { satellites, totalCount, category } = result;
    
    this.container.innerHTML = `
      <div class="satellite-list-header">
        ${category ? `<h2>${this.formatCategoryName(category)} Satellites</h2>` : '<h2>Search Results</h2>'}
        <div class="results-info">
          <span>${totalCount} satellite${totalCount !== 1 ? 's' : ''} found</span>
        </div>
      </div>

      <div class="satellite-filters">
        ${this.renderFilters(filters)}
      </div>

      <div class="satellite-grid">
        ${satellites.map(satellite => this.renderSatelliteCard(satellite)).join('')}
      </div>

      ${satellites.length === 0 ? '<div class="no-results">No satellites found matching your criteria.</div>' : ''}
    `;

    this.attachEventListeners();
  }

  private renderFilters(filters?: BrowserFilters): string {
    return `
      <div class="filter-row">
        <div class="filter-group">
          <label for="name-filter">Name:</label>
          <input type="text" id="name-filter" placeholder="Search by name..." value="${filters?.name || ''}" />
        </div>
        
        <div class="filter-group">
          <label for="sort-by">Sort by:</label>
          <select id="sort-by">
            <option value="name" ${filters?.sortBy === 'name' ? 'selected' : ''}>Name</option>
            <option value="type" ${filters?.sortBy === 'type' ? 'selected' : ''}>Type</option>
          </select>
        </div>
        
        <div class="filter-group">
          <label for="sort-order">Order:</label>
          <select id="sort-order">
            <option value="asc" ${filters?.sortOrder === 'asc' ? 'selected' : ''}>Ascending</option>
            <option value="desc" ${filters?.sortOrder === 'desc' ? 'selected' : ''}>Descending</option>
          </select>
        </div>
      </div>
    `;
  }

  private renderSatelliteCard(satellite: SatelliteData): string {
    return `
      <div class="satellite-card" data-satellite-id="${satellite.id}">
        <div class="satellite-image">
          ${satellite.image ? `<img src="${satellite.image}" alt="${satellite.name}" />` : '<div class="placeholder-image">🛰️</div>'}
        </div>
        <div class="satellite-info">
          <h3>${satellite.name}</h3>
          ${satellite.shortname ? `<div class="satellite-shortname">${satellite.shortname}</div>` : ''}
          <div class="satellite-type">${this.formatCategoryName(satellite.type)}</div>
          <div class="satellite-stats">
            <div class="stat">
              <span class="label">Altitude:</span>
              <span class="value">${Math.round(satellite.altitude)} km</span>
            </div>
            <div class="stat">
              <span class="label">Velocity:</span>
              <span class="value">${Math.round(satellite.velocity)} km/h</span>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  private attachEventListeners(): void {
    // Satellite card click handlers
    const satelliteCards = this.container.querySelectorAll('.satellite-card');
    satelliteCards.forEach(card => {
      card.addEventListener('click', (e) => {
        const satelliteId = (e.currentTarget as HTMLElement).dataset.satelliteId;
        if (satelliteId && this.onSatelliteSelected) {
          this.onSatelliteSelected(satelliteId);
        }
      });
    });

    // Filter change handlers
    const nameFilter = this.container.querySelector('#name-filter') as HTMLInputElement;
    const sortBySelect = this.container.querySelector('#sort-by') as HTMLSelectElement;
    const sortOrderSelect = this.container.querySelector('#sort-order') as HTMLSelectElement;

    const updateFilters = () => {
      if (this.onFiltersChanged) {
        const filters: BrowserFilters = {
          name: nameFilter?.value || undefined,
          sortBy: (sortBySelect?.value as 'name' | 'type') || undefined,
          sortOrder: (sortOrderSelect?.value as 'asc' | 'desc') || undefined
        };
        this.onFiltersChanged(filters);
      }
    };

    nameFilter?.addEventListener('input', updateFilters);
    sortBySelect?.addEventListener('change', updateFilters);
    sortOrderSelect?.addEventListener('change', updateFilters);
  }

  private formatCategoryName(category: string): string {
    return category
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }
}