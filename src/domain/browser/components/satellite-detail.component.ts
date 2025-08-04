import { SatelliteData } from '../../../types/satellite';

export class SatelliteDetailComponent {
  private container: HTMLElement;
  private onBackRequested?: () => void;

  constructor(container: HTMLElement) {
    this.container = container;
  }

  setEventHandlers(handlers: {
    onBackRequested?: () => void;
  }): void {
    this.onBackRequested = handlers.onBackRequested;
  }

  render(satellite: SatelliteData): void {
    this.container.innerHTML = `
      <div class="satellite-detail">
        <div class="detail-header">
          <button class="back-button" id="back-button">← Back to Browse</button>
          <div class="satellite-title">
            <h1>${satellite.name}</h1>
            ${satellite.shortname ? `<div class="shortname">${satellite.shortname}</div>` : ''}
            <div class="satellite-id">ID: ${satellite.id}</div>
          </div>
        </div>

        <div class="detail-content">
          <div class="detail-image">
            ${satellite.image ? 
              `<img src="${satellite.image}" alt="${satellite.name}" />` : 
              '<div class="placeholder-image">🛰️</div>'
            }
          </div>

          <div class="detail-info">
            <div class="info-section">
              <h3>Classification</h3>
              <div class="info-item">
                <span class="label">Type:</span>
                <span class="value">${this.formatCategoryName(satellite.type)}</span>
              </div>
            </div>

            <div class="info-section">
              <h3>Current Status</h3>
              <div class="info-item">
                <span class="label">Position:</span>
                <span class="value">${satellite.position.lat.toFixed(4)}°, ${satellite.position.lng.toFixed(4)}°</span>
              </div>
              <div class="info-item">
                <span class="label">Altitude:</span>
                <span class="value">${Math.round(satellite.altitude)} km</span>
              </div>
              <div class="info-item">
                <span class="label">Velocity:</span>
                <span class="value">${Math.round(satellite.velocity)} km/h</span>
              </div>
            </div>

            <div class="info-section">
              <h3>Physical Specifications</h3>
              <div class="info-item">
                <span class="label">Length:</span>
                <span class="value">${satellite.dimensions.length} m</span>
              </div>
              <div class="info-item">
                <span class="label">Width:</span>
                <span class="value">${satellite.dimensions.width} m</span>
              </div>
              <div class="info-item">
                <span class="label">Height:</span>
                <span class="value">${satellite.dimensions.height} m</span>
              </div>
            </div>

            <div class="info-section">
              <h3>Orbital Elements (TLE)</h3>
              <div class="tle-data">
                <div class="tle-line">
                  <span class="tle-label">Line 1:</span>
                  <code>${satellite.tle1}</code>
                </div>
                <div class="tle-line">
                  <span class="tle-label">Line 2:</span>
                  <code>${satellite.tle2}</code>
                </div>
              </div>
            </div>

            ${this.renderCameraSettings(satellite)}
          </div>
        </div>
      </div>
    `;

    this.attachEventListeners();
  }

  private renderCameraSettings(satellite: SatelliteData): string {
    if (!satellite.defaultBearing && !satellite.defaultZoom && !satellite.defaultPitch) {
      return '';
    }

    return `
      <div class="info-section">
        <h3>Camera Settings</h3>
        ${satellite.defaultBearing !== undefined ? `
          <div class="info-item">
            <span class="label">Default Bearing:</span>
            <span class="value">${satellite.defaultBearing}°</span>
          </div>
        ` : ''}
        ${satellite.defaultZoom !== undefined ? `
          <div class="info-item">
            <span class="label">Default Zoom:</span>
            <span class="value">${satellite.defaultZoom}</span>
          </div>
        ` : ''}
        ${satellite.defaultPitch !== undefined ? `
          <div class="info-item">
            <span class="label">Default Pitch:</span>
            <span class="value">${satellite.defaultPitch}°</span>
          </div>
        ` : ''}
        ${satellite.scaleFactor !== undefined ? `
          <div class="info-item">
            <span class="label">Scale Factor:</span>
            <span class="value">${satellite.scaleFactor}x</span>
          </div>
        ` : ''}
      </div>
    `;
  }

  private attachEventListeners(): void {
    const backButton = this.container.querySelector('#back-button');
    backButton?.addEventListener('click', () => {
      if (this.onBackRequested) {
        this.onBackRequested();
      }
    });
  }

  private formatCategoryName(category: string): string {
    return category
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }
}