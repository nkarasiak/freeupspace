import { SatelliteData } from '../types/satellite';

export interface SearchCallbacks {
  onSatelliteSelect: (satelliteId: string) => void;
}

export class SearchComponent {
  private callbacks?: SearchCallbacks;
  private selectedIndex = -1;
  private searchResults: HTMLDivElement | null = null;
  private satellites: SatelliteData[] = [];
  private followingSatellite: string | null = null;

  constructor() {
    this.setupSearchFunctionality();
  }

  setCallbacks(callbacks: SearchCallbacks): void {
    this.callbacks = callbacks;
  }

  private setupSearchFunctionality(): void {
    const searchInput = document.getElementById('satellite-search') as HTMLInputElement;
    this.searchResults = document.getElementById('search-results') as HTMLDivElement;
    
    if (!searchInput || !this.searchResults) return;
    
    searchInput.addEventListener('input', () => {
      this.selectedIndex = -1;
      this.performSearch();
    });

    // Handle keyboard navigation
    searchInput.addEventListener('keydown', (e) => {
      this.handleKeydown(e);
    });
    
    // Clear search when clicking outside
    document.addEventListener('click', (e) => {
      if (!searchInput.contains(e.target as Node) && !this.searchResults?.contains(e.target as Node)) {
        this.clearResults();
      }
    });
  }

  setSatellites(satellites: SatelliteData[], followingSatellite: string | null): void {
    this.satellites = satellites;
    this.followingSatellite = followingSatellite;
  }

  performSearch(): void {
    const searchInput = document.getElementById('satellite-search') as HTMLInputElement;
    const searchResults = document.getElementById('search-results') as HTMLDivElement;
    
    if (!searchInput || !searchResults) return;
    
    const query = searchInput.value.toLowerCase().trim();
    
    if (query.length < 2) {
      this.clearResults();
      return;
    }
    
    const matches = this.satellites
      .filter(satellite => 
        (satellite.name && satellite.name.toLowerCase().includes(query)) ||
        satellite.id.toLowerCase().includes(query) ||
        satellite.type.toLowerCase().includes(query) ||
        (satellite.shortname && satellite.shortname.toLowerCase().includes(query)) ||
        (satellite.alternateName && satellite.alternateName.toLowerCase().includes(query))
      )
.sort((a, b) => (a.alternateName || a.name || a.id).localeCompare(b.alternateName || b.name || b.id))
      .slice(0, 10);
    
    this.displayResults(matches, this.followingSatellite);
  }

  private handleKeydown(e: KeyboardEvent): void {
    
    if (!this.searchResults) return;
    
    const results = this.searchResults.querySelectorAll('.search-result');
    if (results.length === 0 && e.key !== 'Escape') return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        e.stopPropagation();
        this.selectedIndex = Math.min(this.selectedIndex + 1, results.length - 1);
        this.updateSelection();
        break;
      case 'ArrowUp':
        e.preventDefault();
        e.stopPropagation();
        this.selectedIndex = Math.max(this.selectedIndex - 1, -1);
        this.updateSelection();
        break;
      case 'Tab':
        if (results.length > 0) {
          e.preventDefault();
          e.stopPropagation();
          if (e.shiftKey) {
            this.selectedIndex = Math.max(this.selectedIndex - 1, -1);
          } else {
            this.selectedIndex = Math.min(this.selectedIndex + 1, results.length - 1);
          }
          this.updateSelection();
        }
        break;
      case 'Enter':
        if (this.selectedIndex >= 0 && this.selectedIndex < results.length) {
          e.preventDefault();
          e.stopPropagation();
          const selectedResult = results[this.selectedIndex] as HTMLElement;
          const satelliteId = selectedResult.dataset.satelliteId;
          const satelliteName = selectedResult.dataset.satelliteName;
          if (satelliteId && satelliteName) {
            this.selectSatelliteById(satelliteId, satelliteName);
          }
        }
        break;
      case 'Escape':
        e.preventDefault();
        e.stopPropagation();
        this.closeSearchDropdown();
        break;
    }
  }

  private updateSelection(): void {
    if (!this.searchResults) return;
    
    const results = this.searchResults.querySelectorAll('.search-result');
    results.forEach((result, index) => {
      if (index === this.selectedIndex) {
        result.classList.add('selected');
        result.scrollIntoView({ block: 'nearest' });
      } else {
        result.classList.remove('selected');
      }
    });
  }

  private displayResults(matches: SatelliteData[], followingSatellite: string | null): void {
    const searchResults = document.getElementById('search-results') as HTMLDivElement;
    if (!searchResults) return;

    searchResults.innerHTML = '';
    this.selectedIndex = -1;
    
    matches.forEach((satellite, index) => {
      const resultDiv = document.createElement('div');
      resultDiv.className = `search-result command-item ${index === 0 ? 'selected' : ''}`;
      if (followingSatellite === satellite.id) {
        resultDiv.className += ' following';
      }
      
      // Store satellite data for keyboard selection
      const displayName = satellite.alternateName || satellite.name || satellite.id;
      resultDiv.dataset.satelliteId = satellite.id;
      resultDiv.dataset.satelliteName = displayName;
      
      resultDiv.innerHTML = `
        <div class="command-icon">🛰️</div>
        <div class="command-text">
          <div class="command-title">${displayName}</div>
          <div class="command-description">Track ${displayName} • Alt: ${satellite.altitude.toFixed(0)}km</div>
          <div style="font-size: 10px; color: #aaa; margin-top: 2px;">
            ${satellite.type} | ${satellite.dimensions.length}×${satellite.dimensions.width}×${satellite.dimensions.height}m | ${satellite.position.lat.toFixed(2)}°, ${satellite.position.lng.toFixed(2)}°
          </div>
        </div>
      `;
      
      resultDiv.addEventListener('click', () => {
        this.selectSatellite(satellite);
      });
      
      searchResults.appendChild(resultDiv);
    });
    
    if (matches.length === 0) {
      const noResults = document.createElement('div');
      noResults.className = 'command-item';
      noResults.innerHTML = `
        <div class="command-icon">❌</div>
        <div class="command-text">
          <div class="command-title">No satellites found</div>
          <div class="command-description">Try a different search term</div>
        </div>
      `;
      searchResults.appendChild(noResults);
    }
  }

  private selectSatellite(satellite: SatelliteData): void {
    const displayName = satellite.alternateName || satellite.name || satellite.id;
    this.selectSatelliteById(satellite.id, displayName);
  }

  private selectSatelliteById(satelliteId: string, satelliteName: string): void {
    const searchInput = document.getElementById('satellite-search') as HTMLInputElement;
    if (searchInput) {
      searchInput.value = satelliteName;
    }

    this.clearResults();
    this.selectedIndex = -1;
    
    // Immediately close the dropdown
    this.closeSearchDropdown();
    
    // Also force close with multiple approaches
    setTimeout(() => {
      this.forceCloseDropdown();
    }, 10);
    
    if (this.callbacks?.onSatelliteSelect) {
      this.callbacks.onSatelliteSelect(satelliteId);
    }
  }

  private clearResults(): void {
    const searchResults = document.getElementById('search-results');
    if (searchResults) {
      searchResults.innerHTML = '';
    }
    this.selectedIndex = -1;
  }

  private closeSearchDropdown(): void {
    const searchContent = document.getElementById('search-content');
    const trackingItem = document.querySelector('.banner-item.tracking[data-section="search"]');
    
    
    if (searchContent && trackingItem) {
      searchContent.classList.remove('active');
      trackingItem.classList.remove('active');
    }
    
    // Also trigger the cockpit component's close mechanism
    const closeEvent = new CustomEvent('closeSearchDropdown');
    document.dispatchEvent(closeEvent);
  }

  private forceCloseDropdown(): void {
    
    // Force remove active class from all possible elements
    const searchContent = document.getElementById('search-content');
    if (searchContent) {
      searchContent.classList.remove('active');
      searchContent.style.display = 'none';
      setTimeout(() => {
        searchContent.style.display = '';
      }, 100);
    }
    
    // Force remove active class from tracking button
    const trackingItems = document.querySelectorAll('.banner-item.tracking[data-section="search"]');
    trackingItems.forEach(item => {
      item.classList.remove('active');
    });
    
    // Click outside to trigger any other close handlers
    const outsideElement = document.body;
    outsideElement.click();
  }

  updateSearchInput(satelliteName: string): void {
    const searchInput = document.getElementById('satellite-search') as HTMLInputElement;
    if (searchInput) {
      searchInput.value = satelliteName;
    }
  }
}