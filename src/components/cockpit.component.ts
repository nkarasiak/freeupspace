import { SatelliteData } from '../types/satellite';

export class CockpitComponent {
  private isHidden = false;
  private commandPalette?: any; // Will hold reference to CommandPalette instance
  
  constructor() {
    this.setupEventListeners();
    this.setupDropdownFunctionality();
  }

  setCommandPalette(commandPalette: any): void {
    this.commandPalette = commandPalette;
  }

  private setupEventListeners(): void {
    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      if (document.activeElement?.tagName === 'INPUT') {
        return;
      }
      
      if (e.key === 'c' || e.key === 'C') {
        if (!e.ctrlKey && !e.metaKey) {
          e.preventDefault();
          this.toggleCockpit();
        }
      }
    });

    // Show cockpit button
    const showCockpitBtn = document.getElementById('show-cockpit-btn');
    showCockpitBtn?.addEventListener('click', () => this.showCockpit());
  }

  private setupDropdownFunctionality(): void {
    const sectionTitles = document.querySelectorAll('.section-title[data-section]');
    let activeDropdown: HTMLElement | null = null;
    
    // Close dropdown function
    const closeDropdown = (dropdown: HTMLElement | null, title: HTMLElement | null) => {
      if (dropdown && title) {
        dropdown.classList.remove('active');
        title.classList.remove('active');
      }
      activeDropdown = null;
    };
    
    // Close all dropdowns
    const closeAllDropdowns = () => {
      sectionTitles.forEach(title => {
        const sectionName = (title as HTMLElement).dataset.section;
        const content = document.getElementById(sectionName + '-content');
        closeDropdown(content, title as HTMLElement);
      });
    };
    
    // Handle banner tracking item click
    const trackingItem = document.querySelector('.banner-item.tracking[data-section="search"]');
    if (trackingItem) {
      trackingItem.addEventListener('click', (e) => {
        e.stopPropagation();
        
        // Close any other open dropdown first
        closeAllDropdowns();
        
        // Open command palette instead of cockpit dropdown
        if (this.commandPalette) {
          // Use the CommandPalette's open method which properly clears the input
          this.commandPalette.open();
        } else {
          console.warn('CommandPalette not available - falling back to manual open');
          // Fallback: manually open command palette
          const commandPalette = document.getElementById('command-palette');
          if (commandPalette) {
            commandPalette.classList.add('active');
            setTimeout(() => {
              const commandInput = document.getElementById('command-input') as HTMLInputElement;
              if (commandInput) {
                commandInput.value = '';
                commandInput.focus();
              }
            }, 100);
          }
        }
      });
    }
    
    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
      // Don't close if clicking inside an active dropdown
      if (activeDropdown && activeDropdown.contains(e.target as Node)) {
        return;
      }
      
      // Don't close if clicking on a banner item with data-section
      if ((e.target as HTMLElement).closest('.banner-item[data-section]')) {
        return;
      }
      
      // Close any open dropdown
      closeAllDropdowns();
    });
    
    // Close dropdown on Escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        // Check if search dropdown is active
        const searchContent = document.getElementById('search-content');
        if (searchContent?.classList.contains('active')) {
          const trackingItem = document.querySelector('.banner-item.tracking[data-section="search"]');
          closeDropdown(searchContent, trackingItem as HTMLElement);
        } else if (activeDropdown) {
          closeAllDropdowns();
        }
      }
    });
    
    // Prevent dropdown content clicks from bubbling up
    document.querySelectorAll('.section-content').forEach(content => {
      content.addEventListener('click', (e) => {
        e.stopPropagation();
      });
    });
    
    // Listen for search dropdown close events
    document.addEventListener('closeSearchDropdown', () => {
      const searchContent = document.getElementById('search-content');
      if (searchContent && activeDropdown === searchContent) {
        activeDropdown = null;
      }
    });
  }

  updateStatus(satellites: Map<string, SatelliteData>, followingSatellite: string | null): void {
    const trackedAltitudeElement = document.getElementById('tracked-altitude');
    const trackedNameElement = document.getElementById('tracked-name');
    const trackedSpeedElement = document.getElementById('tracked-speed');
    
    // Update tracked satellite information
    if (followingSatellite) {
      const trackedSatellite = satellites.get(followingSatellite);
      if (trackedSatellite) {
        if (trackedAltitudeElement) trackedAltitudeElement.textContent = trackedSatellite.altitude.toFixed(0);
        if (trackedNameElement) trackedNameElement.textContent = trackedSatellite.shortname || trackedSatellite.name;
        if (trackedSpeedElement) trackedSpeedElement.textContent = trackedSatellite.velocity.toFixed(2);
      }
    } else {
      // No satellite being tracked - show defaults
      if (trackedAltitudeElement) trackedAltitudeElement.textContent = '---';
      if (trackedNameElement) trackedNameElement.textContent = 'No satellite selected';
      if (trackedSpeedElement) trackedSpeedElement.textContent = '---';
    }
  }

  private toggleCockpit(): void {
    const cockpitPanel = document.getElementById('cockpit-panel');
    const showCockpitBtn = document.getElementById('show-cockpit-btn');
    
    if (cockpitPanel && showCockpitBtn) {
      this.isHidden = !this.isHidden;
      
      if (this.isHidden) {
        cockpitPanel.classList.add('hidden');
        showCockpitBtn.style.display = 'flex';
      } else {
        cockpitPanel.classList.remove('hidden');
        showCockpitBtn.style.display = 'none';
      }
    }
  }

  private showCockpit(): void {
    const cockpitPanel = document.getElementById('cockpit-panel');
    const showCockpitBtn = document.getElementById('show-cockpit-btn');
    
    if (cockpitPanel && showCockpitBtn) {
      this.isHidden = false;
      cockpitPanel.classList.remove('hidden');
      showCockpitBtn.style.display = 'none';
    }
  }

  showMessage(message: string, type: 'success' | 'error' | 'warning' | 'info'): void {
    const messageDiv = document.createElement('div');
    messageDiv.style.cssText = `
      position: fixed;
      top: 200px;
      right: 20px;
      z-index: 2000;
      padding: 10px 15px;
      border-radius: 6px;
      color: white;
      font-weight: bold;
      font-size: 14px;
      font-family: Arial, sans-serif;
    `;
    
    switch (type) {
      case 'success':
        messageDiv.style.backgroundColor = 'rgba(0, 255, 0, 0.8)';
        break;
      case 'error':
        messageDiv.style.backgroundColor = 'rgba(255, 0, 0, 0.8)';
        break;
      case 'warning':
        messageDiv.style.backgroundColor = 'rgba(255, 165, 0, 0.8)';
        break;
      case 'info':
        messageDiv.style.backgroundColor = 'rgba(0, 150, 255, 0.8)';
        break;
    }
    
    messageDiv.textContent = message;
    document.body.appendChild(messageDiv);
    
    setTimeout(() => {
      messageDiv.remove();
    }, 3000);
  }
}