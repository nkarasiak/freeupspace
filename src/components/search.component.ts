
export interface SearchCallbacks {
  onSatelliteSelect: (satelliteId: string) => void;
  getSatellites?: () => Map<string, any>;
}

export class SearchComponent {
  private callbacks?: SearchCallbacks;
  private selectedIndex = -1;
  private searchResults: HTMLDivElement | null = null;
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

  setFollowingSatellite(followingSatellite: string | null): void {
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
    
    // Use the same logic as command palette - get satellites from callback
    if (!this.callbacks?.getSatellites) {
      this.clearResults();
      return;
    }
    
    const satellites = this.callbacks.getSatellites();
    const satelliteResults: Array<{id: string, name: string, altitude?: number, satellite: any}> = [];
    
    // Convert satellites map to array - same as command palette
    satellites.forEach((satellite, id) => {
      satelliteResults.push({
        id,
        name: satellite.shortname || satellite.alternateName || satellite.name || id,
        altitude: satellite.altitude,
        satellite
      });
    });
    
    // Filter satellites based on search query - same logic as command palette
    const filteredSatellites = satelliteResults.filter(sat => {
      const matchesName = sat.name.toLowerCase().includes(query);
      const matchesId = sat.id.toLowerCase().includes(query);
      
      return matchesName || matchesId;
    });
    
    // Sort alphabetically - same as command palette
    filteredSatellites.sort((a, b) => a.name.localeCompare(b.name));
    
    // Take first 10 results
    const matches = filteredSatellites.slice(0, 10);
    
    this.displaySearchResults(matches, this.followingSatellite);
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

  private displaySearchResults(matches: Array<{id: string, name: string, altitude?: number, satellite: any}>, followingSatellite: string | null): void {
    const searchResults = document.getElementById('search-results') as HTMLDivElement;
    if (!searchResults) return;

    searchResults.innerHTML = '';
    this.selectedIndex = -1;
    
    matches.forEach((match, index) => {
      const resultDiv = document.createElement('div');
      resultDiv.className = `search-result command-item ${index === 0 ? 'selected' : ''}`;
      if (followingSatellite === match.id) {
        resultDiv.className += ' following';
      }
      
      // Store satellite data for keyboard selection
      resultDiv.dataset.satelliteId = match.id;
      resultDiv.dataset.satelliteName = match.name;
      
      const altitudeInfo = match.altitude ? ` • Alt: ${match.altitude.toFixed(0)}km` : '';
      
      resultDiv.innerHTML = `
        <div class="command-icon">🛰️</div>
        <div class="command-text">
          <div class="command-title">${match.name}</div>
          <div class="command-description">Track ${match.name}${altitudeInfo}</div>
        </div>
      `;
      
      resultDiv.addEventListener('click', () => {
        this.selectSatelliteById(match.id, match.name);
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

  clearSearchInput(): void {
    const searchInput = document.getElementById('satellite-search') as HTMLInputElement;
    if (searchInput) {
      searchInput.value = '';
      this.clearResults();
    }
  }
}