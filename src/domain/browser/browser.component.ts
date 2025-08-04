import { SatelliteDataService } from '../../services/satellite-data.service';
import { SatelliteBrowserService } from './satellite-browser.service';
import { BrowserRouter, BrowserRoute, RouteResult } from './browser-router';
import { CategoryBrowserComponent } from './components/category-browser.component';
import { SatelliteListComponent } from './components/satellite-list.component';
import { SatelliteDetailComponent } from './components/satellite-detail.component';
import { BrowserFilters } from './types';

export class BrowserComponent {
  private container: HTMLElement;
  private browserService: SatelliteBrowserService;
  private router: BrowserRouter;
  
  private categoryBrowser: CategoryBrowserComponent;
  private satelliteList: SatelliteListComponent;
  private satelliteDetail: SatelliteDetailComponent;

  private currentRoute: BrowserRoute | null = null;

  constructor(container: HTMLElement, satelliteDataService: SatelliteDataService) {
    this.container = container;
    this.browserService = new SatelliteBrowserService(satelliteDataService);
    this.router = new BrowserRouter(this.browserService);

    // Initialize components
    this.categoryBrowser = new CategoryBrowserComponent(this.browserService, container);
    this.satelliteList = new SatelliteListComponent(container);
    this.satelliteDetail = new SatelliteDetailComponent(container);

    this.setupEventHandlers();
  }

  /**
   * Navigate to a specific route
   */
  navigate(path: string, params?: URLSearchParams): void {
    const route = this.router.parseRoute(path, params);
    if (route) {
      this.currentRoute = route;
      this.renderCurrentRoute();
    } else {
      this.showError('Invalid route');
    }
  }

  /**
   * Navigate to a route object directly
   */
  navigateToRoute(route: BrowserRoute): void {
    this.currentRoute = route;
    this.renderCurrentRoute();
  }

  /**
   * Show the category browser (default view)
   */
  showCategories(): void {
    this.navigateToRoute({ type: 'category' });
    this.updateBrowserURL();
  }

  /**
   * Show satellites in a specific category
   */
  showCategory(categoryId: string, filters?: BrowserFilters): void {
    this.navigateToRoute({
      type: 'category',
      category: categoryId,
      filters
    });
    this.updateBrowserURL();
  }

  /**
   * Show a specific satellite's details
   */
  showSatellite(satelliteId: string): void {
    this.navigateToRoute({
      type: 'satellite',
      satelliteId
    });
    this.updateBrowserURL();
  }

  /**
   * Perform a search with filters
   */
  search(filters: BrowserFilters): void {
    this.navigateToRoute({
      type: 'search',
      filters
    });
    this.updateBrowserURL();
  }

  private renderCurrentRoute(): void {
    if (!this.currentRoute) {
      this.showCategories();
      return;
    }

    const result: RouteResult = this.router.handleRoute(this.currentRoute);

    switch (result.type) {
      case 'categories':
        this.categoryBrowser.render();
        break;

      case 'category-results':
        this.satelliteList.render(result.data, this.currentRoute.filters);
        break;

      case 'search-results':
        this.satelliteList.render(result.data, this.currentRoute.filters);
        break;

      case 'satellite-detail':
        this.satelliteDetail.render(result.data);
        break;

      case 'error':
        this.showError(result.message);
        break;

      default:
        this.showError('Unknown route result');
        break;
    }
  }

  private setupEventHandlers(): void {
    // Category browser events
    this.container.addEventListener('category-selected', (e: Event) => {
      const customEvent = e as CustomEvent;
      const { categoryId } = customEvent.detail;
      this.showCategory(categoryId);
    });

    // Satellite list events
    this.satelliteList.setEventHandlers({
      onSatelliteSelected: (satelliteId: string) => {
        this.showSatellite(satelliteId);
      },
      onFiltersChanged: (filters: BrowserFilters) => {
        if (this.currentRoute) {
          // Update current route with new filters
          this.currentRoute.filters = filters;
          this.renderCurrentRoute();
        }
      }
    });

    // Satellite detail events
    this.satelliteDetail.setEventHandlers({
      onBackRequested: () => {
        // Go back to previous view
        if (this.currentRoute?.category) {
          this.showCategory(this.currentRoute.category, this.currentRoute.filters);
        } else {
          this.showCategories();
        }
      }
    });
  }

  private showError(message: string): void {
    this.container.innerHTML = `
      <div class="browser-error">
        <h2>Error</h2>
        <p>${message}</p>
        <button id="back-to-categories">Back to Categories</button>
      </div>
    `;

    const backButton = this.container.querySelector('#back-to-categories');
    backButton?.addEventListener('click', () => {
      this.showCategories();
    });
  }

  /**
   * Get the current route URL for linking/bookmarking
   */
  getCurrentUrl(): string {
    if (!this.currentRoute) {
      return '/browser/category';
    }
    return this.router.generateUrl(this.currentRoute);
  }

  /**
   * Update the browser URL to match the current route
   */
  private updateBrowserURL(): void {
    const url = this.getCurrentUrl();
    const currentUrl = window.location.pathname + window.location.search;
    
    // Only update URL if it's different to avoid unnecessary history entries
    if (url !== currentUrl) {
      window.history.pushState({}, '', url);
    }
  }
}