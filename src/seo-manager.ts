/**
 * SEO Manager for dynamic meta tag updates based on tracked satellites
 */
export class SEOManager {
  private static readonly DEFAULT_TITLE = 'From Up There - Real-Time 3D Satellite Tracker';
  private static readonly DEFAULT_DESCRIPTION = 'Track 12,000+ satellites in real-time with stunning 3D visualization. Monitor the International Space Station, Starlink constellation, and scientific satellites orbiting Earth.';
  private static readonly DEFAULT_IMAGE = '/static/images/og-preview.png';
  private static readonly BASE_URL = 'https://www.fromupthe.re';

  /**
   * Update page meta tags when tracking a specific satellite
   */
  static updateMetaForSatellite(satelliteData: {
    id: string;
    name?: string;
    alternateName?: string;
    type?: string;
    altitude?: number;
    image?: string;
  }) {
    const satelliteName = satelliteData.name || satelliteData.alternateName || satelliteData.id;
    const title = `${satelliteName} - Live Satellite Tracker | From Up There`;
    const description = `Track ${satelliteName} in real-time with precise orbital position${satelliteData.altitude ? ` at ${Math.round(satelliteData.altitude)}km altitude` : ''}. Live 3D visualization and satellite tracking data.`;
    const url = `${this.BASE_URL}/${encodeURIComponent(satelliteData.id)}`;
    const image = satelliteData.image ? `${this.BASE_URL}/${satelliteData.image}` : `${this.BASE_URL}${this.DEFAULT_IMAGE}`;

    // Update document title
    document.title = title;

    // Update meta tags
    this.updateMetaTag('name', 'title', title);
    this.updateMetaTag('name', 'description', description);
    this.updateMetaTag('property', 'og:title', title);
    this.updateMetaTag('property', 'og:description', description);
    this.updateMetaTag('property', 'og:url', url);
    this.updateMetaTag('property', 'og:image', image);
    this.updateMetaTag('property', 'twitter:title', title);
    this.updateMetaTag('property', 'twitter:description', description);
    this.updateMetaTag('property', 'twitter:url', url);
    this.updateMetaTag('property', 'twitter:image', image);

    // Update canonical URL
    this.updateCanonicalUrl(url);

    // Update structured data
    this.updateStructuredData(satelliteName, description, url, image);
  }

  /**
   * Reset meta tags to default values
   */
  static resetToDefault() {
    document.title = this.DEFAULT_TITLE;
    
    this.updateMetaTag('name', 'title', this.DEFAULT_TITLE);
    this.updateMetaTag('name', 'description', this.DEFAULT_DESCRIPTION);
    this.updateMetaTag('property', 'og:title', this.DEFAULT_TITLE);
    this.updateMetaTag('property', 'og:description', this.DEFAULT_DESCRIPTION);
    this.updateMetaTag('property', 'og:url', this.BASE_URL + '/');
    this.updateMetaTag('property', 'og:image', this.BASE_URL + this.DEFAULT_IMAGE);
    this.updateMetaTag('property', 'twitter:title', this.DEFAULT_TITLE);
    this.updateMetaTag('property', 'twitter:description', this.DEFAULT_DESCRIPTION);
    this.updateMetaTag('property', 'twitter:url', this.BASE_URL + '/');
    this.updateMetaTag('property', 'twitter:image', this.BASE_URL + this.DEFAULT_IMAGE);

    this.updateCanonicalUrl(this.BASE_URL + '/');
  }

  /**
   * Update or create a meta tag
   */
  private static updateMetaTag(attribute: string, value: string, content: string) {
    let element = document.querySelector(`meta[${attribute}="${value}"]`) as HTMLMetaElement;
    
    if (!element) {
      element = document.createElement('meta');
      element.setAttribute(attribute, value);
      document.head.appendChild(element);
    }
    
    element.setAttribute('content', content);
  }

  /**
   * Update canonical URL
   */
  private static updateCanonicalUrl(url: string) {
    let canonical = document.querySelector('link[rel="canonical"]') as HTMLLinkElement;
    
    if (!canonical) {
      canonical = document.createElement('link');
      canonical.setAttribute('rel', 'canonical');
      document.head.appendChild(canonical);
    }
    
    canonical.setAttribute('href', url);
  }

  /**
   * Update structured data for the current page
   */
  private static updateStructuredData(name: string, description: string, url: string, image: string) {
    // Remove existing structured data
    const existingScript = document.querySelector('script[type="application/ld+json"]');
    if (existingScript) {
      existingScript.remove();
    }

    // Create new structured data
    const structuredData = {
      "@context": "https://schema.org",
      "@type": "WebApplication",
      "name": `${name} Tracker - From Up There`,
      "alternateName": "Real-Time Satellite Tracker",
      "description": description,
      "url": url,
      "applicationCategory": "EducationalApplication",
      "operatingSystem": "Web Browser",
      "image": image,
      "offers": {
        "@type": "Offer",
        "price": "0",
        "priceCurrency": "USD"
      },
      "creator": {
        "@type": "Organization",
        "name": "From Up There"
      },
      "keywords": `${name.toLowerCase()} tracker, satellite tracker, real-time tracking, 3D visualization`
    };

    const script = document.createElement('script');
    script.setAttribute('type', 'application/ld+json');
    script.textContent = JSON.stringify(structuredData, null, 2);
    document.head.appendChild(script);
  }

  /**
   * Generate satellite-specific keywords for SEO
   */
  static generateKeywords(satelliteData: {
    id: string;
    name?: string;
    alternateName?: string;
    type?: string;
  }): string[] {
    const satelliteName = satelliteData.name || satelliteData.alternateName || satelliteData.id;
    const baseKeywords = [
      `${satelliteName.toLowerCase()} tracker`,
      `${satelliteName.toLowerCase()} position`,
      `${satelliteName.toLowerCase()} real-time`,
      'satellite tracker',
      'real-time satellites',
      '3D satellite visualization',
      'orbital tracking',
      'satellite positions'
    ];

    // Add type-specific keywords
    if (satelliteData.type) {
      switch (satelliteData.type.toLowerCase()) {
        case 'scientific':
          baseKeywords.push('space telescope', 'scientific satellite', 'space research');
          break;
        case 'communication':
          baseKeywords.push('communication satellite', 'satellite internet', 'telecom satellite');
          break;
        case 'navigation':
          baseKeywords.push('GPS satellite', 'navigation satellite', 'positioning satellite');
          break;
        case 'earth-observation':
          baseKeywords.push('earth observation', 'remote sensing', 'environmental monitoring');
          break;
      }
    }

    // Add special keywords for popular satellites
    const lowerName = satelliteName.toLowerCase();
    if (lowerName.includes('iss') || lowerName.includes('space station')) {
      baseKeywords.push('international space station', 'ISS tracker', 'space station position');
    }
    if (lowerName.includes('starlink')) {
      baseKeywords.push('starlink constellation', 'spacex satellites', 'starlink tracker');
    }
    if (lowerName.includes('hubble')) {
      baseKeywords.push('hubble space telescope', 'space telescope tracker');
    }

    return baseKeywords;
  }
}