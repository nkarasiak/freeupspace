import { Layer } from '@deck.gl/core';

// Map bounds interface
export interface MapBounds {
  getWest(): number;
  getEast(): number;
  getSouth(): number;
  getNorth(): number;
  getCenter(): { lng: number; lat: number };
}

// Satellite icon mapping interface
export interface SatelliteIconMapping {
  atlas: any; // HTMLCanvasElement | HTMLImageElement but compatible with Deck.gl
  mapping: IconMapping;
  width: number;
  height: number;
}

// Icon mapping for Deck.gl IconLayer
export interface IconMapping {
  [iconName: string]: {
    x: number;
    y: number;
    width: number;
    height: number;
    anchorY?: number;
    anchorX?: number;
    mask?: boolean;
  };
}

// Deck.gl layer data interfaces
export interface LayerIconData {
  position: [number, number, number];
  icon: string;
  size: number;
  id: string;
  name: string;
  type: string;
  altitude: number;
  velocity: number;
}

export interface LayerOrbitData {
  source?: [number, number];
  target?: [number, number];
  path?: [number, number][];
  color: [number, number, number, number];
  satelliteId: string;
}

// Position cache interface
export interface CachedPosition {
  position: {
    longitude: number;
    latitude: number;
    altitude: number;
    velocity: number;
    bearing: number;
  };
  timestamp: number;
}

// Satellite search result interface
export interface SatelliteSearchResult {
  id: string;
  name: string;
  altitude?: number;
  satellite: {
    id: string;
    name: string;
    shortname?: string;
    alternateName?: string;
    type: string;
    position: { lng: number; lat: number };
    altitude: number;
    velocity: number;
  };
}

// Velocity vector interface for bearing calculations
export interface VelocityVector {
  x: number;
  y: number;
  z: number;
}

// Geodetic position interface
export interface GeodeticPosition {
  latitude: number;
  longitude: number;
  height: number;
}

// Layer configuration interface
export type DeckGLLayer = Layer;

// Update callback types
export type UpdateCallback = () => void;
export type SatelliteSelectCallback = (satelliteId: string) => void;

// Satellite prioritization interface
export interface SatellitePriority {
  id: string;
  name: string;
  score: number;
  priority: 'high' | 'medium' | 'low';
}