export interface Command {
  id: string;
  title: string;
  description: string;
  icon: string;
  shortcut?: string;
  execute: () => void | Promise<void>;
  keywords?: string[];
}

export class CommandPalette {
  private palette: HTMLElement;
  private input: HTMLInputElement;
  private results: HTMLElement;
  private commands: Command[] = [];
  private filteredCommands: Command[] = [];
  private selectedIndex = 0;
  private isOpen = false;
  private hint: HTMLElement;
  
  // Callbacks
  private onTrackSatellite?: (satelliteId: string) => void;
  private onToggleNight?: () => void;
  private onToggleDay?: () => void;
  private getSatellites?: () => Map<string, any>;

  constructor() {
    this.palette = document.getElementById('command-palette')!;
    this.input = document.getElementById('command-input') as HTMLInputElement;
    this.results = document.getElementById('command-results')!;
    this.hint = document.getElementById('command-hint')!;
    
    
    this.setupEventListeners();
    this.showHint();
    
    // Hide hint after 5 seconds
    setTimeout(() => this.hideHint(), 5000);
  }

  setCallbacks(callbacks: {
    onTrackSatellite?: (satelliteId: string) => void;
    onToggleNight?: () => void;
    onToggleDay?: () => void;
    getSatellites?: () => Map<string, any>;
  }) {
    this.onTrackSatellite = callbacks.onTrackSatellite;
    this.onToggleNight = callbacks.onToggleNight;
    this.onToggleDay = callbacks.onToggleDay;
    this.getSatellites = callbacks.getSatellites;
    
    this.initializeCommands();
  }

  private initializeCommands() {
    this.commands = [
      {
        id: 'track',
        title: 'Track Satellite',
        description: 'Search and track a satellite',
        icon: '🎯',
        shortcut: 'track',
        keywords: ['track', 'satellite', 'follow', 'find'],
        execute: () => this.startTrackCommand()
      },
      {
        id: 'night',
        title: 'Night Mode',
        description: 'Switch to night/dark basemap',
        icon: '🌙',
        shortcut: 'night',
        keywords: ['night', 'dark', 'mode', 'basemap'],
        execute: () => {
          this.onToggleNight?.();
          this.close();
        }
      },
      {
        id: 'day',
        title: 'Day Mode',
        description: 'Switch to day/satellite basemap',
        icon: '☀️',
        shortcut: 'day',
        keywords: ['day', 'light', 'mode', 'basemap', 'satellite'],
        execute: () => {
          this.onToggleDay?.();
          this.close();
        }
      }
    ];
    
    this.filteredCommands = [...this.commands];
  }

  private setupEventListeners() {
    // Global keyboard shortcut to open command palette
    document.addEventListener('keydown', (e) => {
      // "/" key to open command palette (only if not typing in an input)
      if (e.key === '/' && !this.isOpen && document.activeElement?.tagName !== 'INPUT') {
        e.preventDefault();
        this.open();
        return;
      }
      
      // Handle Escape to close palette from anywhere
      if (e.key === 'Escape' && this.isOpen) {
        e.preventDefault();
        this.close();
        return;
      }
    });

    // Input handling
    this.input.addEventListener('input', () => {
      this.handleInput();
    });


    // Handle navigation keys directly on the input
    this.input.addEventListener('keydown', (e) => {
      
      // Only handle navigation keys, let everything else pass through normally
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        this.selectPrevious();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        this.selectNext();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        this.executeSelected();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        this.close();
      }
      // For all other keys - do nothing, let them pass through naturally
    });

    // Click outside to close
    this.palette.addEventListener('click', (e) => {
      if (e.target === this.palette) {
        this.close();
      }
    });

    // Prevent closing when clicking inside the content
    this.palette.querySelector('.command-palette-content')?.addEventListener('click', (e) => {
      e.stopPropagation();
    });
  }

  private handleInput() {
    const query = this.input.value.trim();
    const lowerQuery = query.toLowerCase();
    
    // Check if this looks like a track command with satellite search
    if (lowerQuery.startsWith('track ') && lowerQuery.length > 6) {
      const satelliteName = query.slice(6); // Remove "track "
      this.showSatelliteSearchResults(satelliteName);
      return;
    }
    
    // If query is empty, show all commands
    if (query === '') {
      this.filteredCommands = [...this.commands];
    } else {
      // Search commands without requiring "/" prefix
      this.filteredCommands = this.commands.filter(command => {
        const matchesTitle = command.title.toLowerCase().includes(lowerQuery);
        const matchesDescription = command.description.toLowerCase().includes(lowerQuery);
        const matchesShortcut = command.shortcut?.toLowerCase().includes(lowerQuery);
        const matchesKeywords = command.keywords?.some(keyword => 
          keyword.toLowerCase().includes(lowerQuery)
        );
        
        return matchesTitle || matchesDescription || matchesShortcut || matchesKeywords;
      });
    }
    
    this.selectedIndex = 0;
    this.renderResults();
  }

  private startTrackCommand() {
    // Set input to "track " and position cursor for typing
    this.input.value = 'track ';
    this.input.setSelectionRange(6, 6); // Position cursor after "track "
    
    // Show initial satellite suggestions
    this.showSatelliteSearchResults('');
  }

  private showSatelliteSearchResults(searchTerm: string) {
    if (!this.getSatellites) {
      this.results.innerHTML = '<div class="command-item">No satellites available</div>';
      return;
    }
    
    const satellites = this.getSatellites();
    const matchingSatellites: Array<{id: string, name: string}> = [];
    
    const lowerSearchTerm = searchTerm.toLowerCase().trim();
    
    // If search term is empty, show popular satellites
    if (!lowerSearchTerm) {
      const popularSatellites = ['iss-zarya-25544', 'hubble', 'yam-10', 'noaa-20'];
      popularSatellites.forEach(id => {
        const satellite = satellites.get(id);
        if (satellite) {
          matchingSatellites.push({
            id,
            name: satellite.shortname || satellite.alternateName || satellite.name || id
          });
        }
      });
      
      // Add a few more satellites to show more options
      let count = 0;
      satellites.forEach((satellite, id) => {
        if (count >= 10) return;
        if (!popularSatellites.includes(id)) {
          matchingSatellites.push({
            id,
            name: satellite.shortname || satellite.alternateName || satellite.name || id
          });
          count++;
        }
      });
    } else {
      // Search with the provided term
      satellites.forEach((satellite, id) => {
        const matchesName = satellite.name && satellite.name.toLowerCase().includes(lowerSearchTerm);
        const matchesShortname = satellite.shortname?.toLowerCase().includes(lowerSearchTerm);
        const matchesAlternateName = satellite.alternateName?.toLowerCase().includes(lowerSearchTerm);
        const matchesId = id.toLowerCase().includes(lowerSearchTerm);
        
        if (matchesName || matchesShortname || matchesAlternateName || matchesId) {
          matchingSatellites.push({
            id, 
            name: satellite.shortname || satellite.alternateName || satellite.name || id
          });
        }
      });
      
      // Sort by relevance (exact matches first, then alphabetical)
      matchingSatellites.sort((a, b) => {
        const aExact = a.name.toLowerCase() === lowerSearchTerm || a.id.toLowerCase() === lowerSearchTerm;
        const bExact = b.name.toLowerCase() === lowerSearchTerm || b.id.toLowerCase() === lowerSearchTerm;
        
        if (aExact && !bExact) return -1;
        if (!aExact && bExact) return 1;
        
        return a.name.localeCompare(b.name);
      });
    }
    
    // Limit results to prevent UI slowdown
    const limitedResults = matchingSatellites.slice(0, 15);
    
    this.showSatelliteResults(limitedResults);
  }

  private showSatelliteResults(satellites: Array<{id: string, name: string}>) {
    this.results.innerHTML = '';
    
    if (satellites.length === 0) {
      const noResults = document.createElement('div');
      noResults.className = 'command-item';
      noResults.innerHTML = `
        <div class="command-icon">❌</div>
        <div class="command-text">
          <div class="command-title">No satellites found</div>
          <div class="command-description">Try a different search term</div>
        </div>
      `;
      this.results.appendChild(noResults);
      return;
    }
    
    satellites.forEach((satellite, index) => {
      const item = document.createElement('div');
      item.className = `command-item ${index === 0 ? 'selected' : ''}`;
      
      // Get satellite data for altitude info
      const satelliteData = this.getSatellites?.()?.get(satellite.id);
      const altitudeInfo = satelliteData ? ` • Alt: ${satelliteData.altitude.toFixed(0)}km` : '';
      
      item.innerHTML = `
        <div class="command-icon">🛰️</div>
        <div class="command-text">
          <div class="command-title">${satellite.name}</div>
          <div class="command-description">Track ${satellite.name}${altitudeInfo}</div>
        </div>
      `;
      
      item.addEventListener('click', () => {
        this.onTrackSatellite?.(satellite.id);
        this.close();
      });
      
      this.results.appendChild(item);
    });
    
    this.selectedIndex = 0;
  }

  private renderResults() {
    this.results.innerHTML = '';
    
    this.filteredCommands.forEach((command, index) => {
      const item = document.createElement('div');
      item.className = `command-item ${index === this.selectedIndex ? 'selected' : ''}`;
      
      const shortcutHtml = command.shortcut ? 
        `<div class="command-shortcut">${command.shortcut}</div>` : '';
      
      item.innerHTML = `
        <div class="command-icon">${command.icon}</div>
        <div class="command-text">
          <div class="command-title">${command.title}</div>
          <div class="command-description">${command.description}</div>
        </div>
        ${shortcutHtml}
      `;
      
      item.addEventListener('click', () => {
        this.selectedIndex = index;
        this.executeSelected();
      });
      
      this.results.appendChild(item);
    });
  }

  private selectNext() {
    const maxIndex = this.results.children.length - 1;
    this.selectedIndex = Math.min(this.selectedIndex + 1, maxIndex);
    this.updateSelection();
  }

  private selectPrevious() {
    this.selectedIndex = Math.max(this.selectedIndex - 1, 0);
    this.updateSelection();
  }

  private updateSelection() {
    const items = this.results.querySelectorAll('.command-item');
    items.forEach((item, index) => {
      item.classList.toggle('selected', index === this.selectedIndex);
    });
  }

  private executeSelected() {
    const hasResults = this.results.children.length > 0;
    if (!hasResults) return;
    
    // Check if we're showing satellite results vs command results
    const firstItem = this.results.children[0];
    if (firstItem.querySelector('.command-icon')?.textContent === '🛰️') {
      // This is a satellite result - trigger the click
      const selectedItem = this.results.children[this.selectedIndex] as HTMLElement;
      selectedItem.click();
    } else {
      // This is a command result
      const command = this.filteredCommands[this.selectedIndex];
      if (command) {
        command.execute();
      }
    }
  }

  private open() {
    this.isOpen = true;
    this.palette.classList.add('active');
    this.input.value = '';
    
    // Prevent canvas from stealing focus
    const canvas = document.getElementById('deck-canvas') as HTMLCanvasElement;
    if (canvas) {
      canvas.setAttribute('tabindex', '-1');
    }
    
    // Blur any currently active element first
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    
    // Focus the input
    this.input.focus();
    
    // Wait for CSS animation to complete and ensure focus
    setTimeout(() => {
      this.input.focus();
      if (document.activeElement !== this.input) {
        this.input.click();
      }
    }, 350);
    
    this.selectedIndex = 0;
    this.filteredCommands = [...this.commands];
    this.renderResults();
    this.hideHint();
  }

  private close() {
    this.isOpen = false;
    this.palette.classList.remove('active');
    this.input.value = '';
    this.input.blur();
    
    // Restore canvas focus capability
    const canvas = document.getElementById('deck-canvas') as HTMLCanvasElement;
    if (canvas) {
      canvas.setAttribute('tabindex', '0');
    }
  }


  private showHint() {
    this.hint.classList.add('show');
  }

  private hideHint() {
    this.hint.classList.remove('show');
  }
}