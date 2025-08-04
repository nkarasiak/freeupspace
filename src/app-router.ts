import { BrowserComponent } from './domain/browser';
import { SatelliteDataService } from './services/satellite-data.service';

export type AppView = '3d' | 'browser';

export class AppRouter {
  private currentView: AppView = '3d';
  private browserComponent: BrowserComponent | null = null;
  private satelliteDataService: SatelliteDataService | null = null;
  
  private mapContainer: HTMLElement;
  private browserContainer: HTMLElement;
  private cockpitPanel: HTMLElement;

  constructor() {
    this.mapContainer = document.getElementById('map') as HTMLElement;
    this.cockpitPanel = document.getElementById('cockpit-panel') as HTMLElement;
    
    // Create browser container
    this.browserContainer = document.createElement('div');
    this.browserContainer.id = 'browser-container';
    this.browserContainer.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      background: white;
      z-index: 10000;
      overflow-y: auto;
      padding: 2rem;
      box-sizing: border-box;
      display: none;
    `;
    document.body.appendChild(this.browserContainer);
    
    this.setupNavigation();
  }

  private setupNavigation(): void {
    // Add browser navigation button to cockpit
    const browserButton = document.createElement('button');
    browserButton.innerHTML = '🔍 Browse Satellites';
    browserButton.className = 'cockpit-btn browser-nav-btn';
    browserButton.style.cssText = `
      position: fixed;
      top: 50px;
      right: 20px;
      z-index: 1001;
      padding: 10px 16px;
      font-size: 12px;
      font-weight: 600;
    `;
    browserButton.addEventListener('click', () => this.showBrowser());
    document.body.appendChild(browserButton);

    // Handle browser back navigation
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.currentView === 'browser') {
        this.show3D();
      }
    });
  }

  async showBrowser(): Promise<void> {
    if (!this.browserComponent) {
      await this.initializeBrowser();
    }
    
    this.currentView = 'browser';
    this.mapContainer.style.display = 'none';
    this.cockpitPanel.style.display = 'none';
    this.browserContainer.style.display = 'block';
    
    // Add back button to browser
    this.addBackButton();
    
    // Show categories by default
    this.browserComponent?.showCategories();
  }

  show3D(): void {
    this.currentView = '3d';
    this.mapContainer.style.display = 'block';
    this.cockpitPanel.style.display = 'flex';
    this.browserContainer.style.display = 'none';
  }

  private async initializeBrowser(): Promise<void> {
    try {
      // Initialize satellite data service if not already done
      if (!this.satelliteDataService) {
        this.satelliteDataService = new SatelliteDataService();
        await this.satelliteDataService.initialize();
      }
      
      // Create browser component
      this.browserComponent = new BrowserComponent(this.browserContainer, this.satelliteDataService);
      
    } catch (error) {
      alert('Failed to initialize satellite browser. Please try again.');
    }
  }

  private addBackButton(): void {
    // Check if back button already exists
    if (this.browserContainer.querySelector('.back-to-3d-btn')) {
      return;
    }

    const backButton = document.createElement('button');
    backButton.innerHTML = '← Back to 3D View';
    backButton.className = 'back-to-3d-btn';
    backButton.style.cssText = `
      position: fixed;
      top: 20px;
      left: 20px;
      z-index: 10001;
      background: #667eea;
      color: white;
      border: none;
      padding: 10px 20px;
      border-radius: 6px;
      cursor: pointer;
      font-size: 14px;
      font-weight: 600;
      transition: all 0.2s ease;
      font-family: 'Inter', sans-serif;
    `;
    
    backButton.addEventListener('click', () => this.show3D());
    backButton.addEventListener('mouseover', () => {
      backButton.style.background = '#5a6fd8';
      backButton.style.transform = 'translateY(-1px)';
    });
    backButton.addEventListener('mouseout', () => {
      backButton.style.background = '#667eea';
      backButton.style.transform = 'translateY(0)';
    });
    
    this.browserContainer.appendChild(backButton);
  }

  getCurrentView(): AppView {
    return this.currentView;
  }

  getBrowserComponent(): BrowserComponent | null {
    return this.browserComponent;
  }
}