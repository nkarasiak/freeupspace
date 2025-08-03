// Ultra-smooth camera controller for video-like satellite tracking
import { Map as MapLibreMap } from 'maplibre-gl';
import { PredictivePosition } from './smooth-tracker';

export interface CameraState {
  center: [number, number];
  zoom: number;
  pitch: number;
  bearing: number;
  timestamp: number;
}

export interface CameraTarget {
  center: [number, number];
  zoom?: number;
  pitch?: number;
  bearing?: number;
}

export class SmoothCamera {
  private map: MapLibreMap;
  private animationFrame: number | null = null;
  private isSmoothing = false;
  private lastCameraState: CameraState;
  private targetPosition: PredictivePosition | null = null;
  
  // Smoothing parameters for video-like tracking
  private readonly SMOOTHING_FACTOR = 0.08; // Lower = smoother (was 0.15)
  private readonly MIN_MOVEMENT_THRESHOLD = 0.00001; // Lower threshold for more updates
  private readonly PREDICTION_LEAD_TIME = 100; // Predict 100ms ahead for smoother tracking
  
  // Adaptive smoothing based on satellite speed
  private adaptiveSmoothingEnabled = true;
  private velocityBasedSmoothing = true;

  constructor(map: MapLibreMap) {
    this.map = map;
    this.lastCameraState = this.getCurrentCameraState();
    
    console.log('📹 Smooth camera controller initialized for video-like tracking');
  }

  // Start smooth tracking of a position
  startSmoothTracking(initialPosition: PredictivePosition): void {
    console.log('🎬 Starting ultra-smooth camera tracking');
    
    this.targetPosition = initialPosition;
    this.isSmoothing = true;
    
    // Start the smooth animation loop
    this.startSmoothLoop();
  }

  // Update target position (called 60fps by SmoothTracker)
  updateTargetPosition(position: PredictivePosition): void {
    this.targetPosition = position;
  }

  // Stop smooth tracking
  stopSmoothTracking(): void {
    console.log('🛑 Stopping smooth camera tracking');
    
    this.isSmoothing = false;
    this.targetPosition = null;
    
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
      this.animationFrame = null;
    }
  }

  // Start the smooth animation loop (60fps)
  private startSmoothLoop(): void {
    const smoothUpdate = () => {
      if (!this.isSmoothing || !this.targetPosition) {
        return;
      }

      // Apply smooth camera movement
      this.applySmoothMovement();
      
      // Continue the loop
      this.animationFrame = requestAnimationFrame(smoothUpdate);
    };

    // Start the loop
    this.animationFrame = requestAnimationFrame(smoothUpdate);
  }

  // Apply smooth camera movement toward target
  private applySmoothMovement(): void {
    if (!this.targetPosition) return;

    const currentState = this.getCurrentCameraState();
    const targetCenter: [number, number] = [
      this.targetPosition.longitude,
      this.targetPosition.latitude
    ];

    // Calculate distance for movement threshold
    const distance = this.calculateDistance(currentState.center, targetCenter);
    
    // Debug logging
    if (Math.random() < 0.01) { // 1% chance to avoid spam
      console.log('🎬 Smooth camera update:', {
        current: currentState.center,
        target: targetCenter,
        distance: distance.toFixed(6)
      });
    }
    
    // Skip update if movement is too small
    if (distance < this.MIN_MOVEMENT_THRESHOLD) {
      return;
    }

    // Calculate adaptive smoothing factor based on satellite velocity
    const smoothingFactor = this.calculateAdaptiveSmoothingFactor();
    
    // Apply predictive positioning (look ahead for smoother tracking)
    const predictiveTarget = this.calculatePredictiveTarget(targetCenter);
    
    // Smooth interpolation toward target
    const newCenter = this.interpolatePosition(
      currentState.center,
      predictiveTarget,
      smoothingFactor
    );

    // Apply the smooth movement
    this.map.jumpTo({
      center: newCenter,
      // Keep current zoom, pitch, bearing for stable tracking
      zoom: currentState.zoom,
      pitch: currentState.pitch,
      bearing: currentState.bearing
    });

    // Update last known state
    this.lastCameraState = {
      center: newCenter,
      zoom: currentState.zoom,
      pitch: currentState.pitch,
      bearing: currentState.bearing,
      timestamp: Date.now()
    };
  }

  // Calculate adaptive smoothing factor based on satellite velocity
  private calculateAdaptiveSmoothingFactor(): number {
    if (!this.adaptiveSmoothingEnabled || !this.targetPosition) {
      return this.SMOOTHING_FACTOR;
    }

    // Higher velocity = more responsive tracking
    const velocity = this.targetPosition.velocity;
    const velocityFactor = Math.min(velocity / 8, 1); // Normalize to satellite speeds (0-8 km/s)
    
    // Increase responsiveness for faster satellites
    const adaptiveFactor = this.SMOOTHING_FACTOR + (velocityFactor * 0.1);
    
    return Math.min(adaptiveFactor, 0.3); // Cap at 30% for stability
  }

  // Calculate predictive target position for lead compensation
  private calculatePredictiveTarget(currentTarget: [number, number]): [number, number] {
    if (!this.targetPosition || !this.velocityBasedSmoothing) {
      return currentTarget;
    }

    // Simple velocity-based prediction
    const leadTime = this.PREDICTION_LEAD_TIME / 1000; // Convert to seconds
    const velocity = this.targetPosition.velocity;
    
    // Estimate movement based on current velocity (simplified)
    const kmPerDegLat = 111; // Approximate km per degree latitude
    const kmPerDegLng = 111 * Math.cos(this.targetPosition.latitude * Math.PI / 180);
    
    // Very basic prediction - in real implementation, use orbital mechanics
    const deltaLat = (velocity * leadTime / kmPerDegLat) * 0.1; // Conservative prediction
    const deltaLng = (velocity * leadTime / kmPerDegLng) * 0.1;
    
    return [
      currentTarget[0] + deltaLng,
      currentTarget[1] + deltaLat
    ];
  }

  // Smooth interpolation between positions
  private interpolatePosition(
    current: [number, number],
    target: [number, number],
    factor: number
  ): [number, number] {
    
    // Handle longitude wrapping (crossing 180° meridian)
    let targetLng = target[0];
    const currentLng = current[0];
    
    if (Math.abs(targetLng - currentLng) > 180) {
      if (currentLng > targetLng) {
        targetLng += 360;
      } else {
        targetLng -= 360;
      }
    }

    // Linear interpolation with smoothing
    let newLng = currentLng + (targetLng - currentLng) * factor;
    const newLat = current[1] + (target[1] - current[1]) * factor;

    // Normalize longitude
    while (newLng > 180) newLng -= 360;
    while (newLng < -180) newLng += 360;

    return [newLng, newLat];
  }

  // Calculate distance between two geographic points
  private calculateDistance(pos1: [number, number], pos2: [number, number]): number {
    const deltaLng = Math.abs(pos2[0] - pos1[0]);
    const deltaLat = Math.abs(pos2[1] - pos1[1]);
    
    // Handle longitude wrapping
    const wrappedDeltaLng = Math.min(deltaLng, 360 - deltaLng);
    
    return Math.sqrt(wrappedDeltaLng * wrappedDeltaLng + deltaLat * deltaLat);
  }

  // Get current camera state
  private getCurrentCameraState(): CameraState {
    return {
      center: [this.map.getCenter().lng, this.map.getCenter().lat],
      zoom: this.map.getZoom(),
      pitch: this.map.getPitch(),
      bearing: this.map.getBearing(),
      timestamp: Date.now()
    };
  }

  // Animate to a specific camera target with easing
  flyToTarget(target: CameraTarget, duration: number = 2000): Promise<void> {
    return new Promise((resolve) => {
      this.map.flyTo({
        center: target.center,
        zoom: target.zoom || this.map.getZoom(),
        pitch: target.pitch || this.map.getPitch(),
        bearing: target.bearing || this.map.getBearing(),
        duration,
        essential: true
      });

      setTimeout(resolve, duration);
    });
  }

  // Enable/disable adaptive smoothing
  setAdaptiveSmoothing(enabled: boolean): void {
    this.adaptiveSmoothingEnabled = enabled;
    console.log(`🎛️ Adaptive smoothing ${enabled ? 'enabled' : 'disabled'}`);
  }

  // Enable/disable velocity-based prediction
  setVelocityBasedSmoothing(enabled: boolean): void {
    this.velocityBasedSmoothing = enabled;
    console.log(`🚀 Velocity-based smoothing ${enabled ? 'enabled' : 'disabled'}`);
  }

  // Get current tracking status
  isTracking(): boolean {
    return this.isSmoothing && this.targetPosition !== null;
  }

  // Get camera performance stats
  getPerformanceStats(): {
    tracking: boolean;
    smoothingFactor: number;
    targetPosition: PredictivePosition | null;
    cameraState: CameraState;
  } {
    return {
      tracking: this.isTracking(),
      smoothingFactor: this.calculateAdaptiveSmoothingFactor(),
      targetPosition: this.targetPosition,
      cameraState: this.lastCameraState
    };
  }
}