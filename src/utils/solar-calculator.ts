/**
 * Solar position calculator for determining day/night at satellite locations
 */
export class SolarCalculator {
  /**
   * Calculate if it's nighttime at the given coordinates and time
   * @param latitude Latitude in degrees
   * @param longitude Longitude in degrees  
   * @param date Date/time to check (defaults to now)
   * @returns true if it's night (sun below horizon), false if day
   */
  static isNightTime(latitude: number, longitude: number, date: Date = new Date()): boolean {
    const solarElevation = this.calculateSolarElevation(latitude, longitude, date);
    return solarElevation < 0;
  }

  /**
   * Calculate local time at the given longitude
   * @param longitude Longitude in degrees
   * @param date UTC date/time (defaults to now)
   * @returns Local time in 24-hour format (HH:MM:SS)
   */
  static getLocalTime(longitude: number, date: Date = new Date()): string {
    // Calculate timezone offset in minutes based on longitude
    // Each 15 degrees of longitude = 1 hour time difference
    const timezoneOffsetMinutes = Math.round(longitude * 4); // 4 minutes per degree
    
    // Create new date with the offset applied
    const localTime = new Date(date.getTime() + (timezoneOffsetMinutes * 60 * 1000));
    
    // Format as HH:MM:SS in 24-hour format
    const hours = localTime.getUTCHours().toString().padStart(2, '0');
    const minutes = localTime.getUTCMinutes().toString().padStart(2, '0');
    const seconds = localTime.getUTCSeconds().toString().padStart(2, '0');
    
    return `${hours}:${minutes}:${seconds}`;
  }

  /**
   * Calculate solar elevation angle for given position and time
   * @param latitude Latitude in degrees
   * @param longitude Longitude in degrees
   * @param date Date/time to calculate for
   * @returns Solar elevation angle in degrees (negative = below horizon)
   */
  static calculateSolarElevation(latitude: number, longitude: number, date: Date): number {
    const dayOfYear = this.getDayOfYear(date);
    const solarDeclination = this.calculateSolarDeclination(dayOfYear);
    const hourAngle = this.calculateHourAngle(longitude, date);
    
    const latRad = this.toRadians(latitude);
    const decRad = this.toRadians(solarDeclination);
    const hourRad = this.toRadians(hourAngle);
    
    const elevation = Math.asin(
      Math.sin(decRad) * Math.sin(latRad) +
      Math.cos(decRad) * Math.cos(latRad) * Math.cos(hourRad)
    );
    
    return this.toDegrees(elevation);
  }

  /**
   * Calculate solar declination for given day of year
   * @param dayOfYear Day of year (1-365/366)
   * @returns Solar declination in degrees
   */
  private static calculateSolarDeclination(dayOfYear: number): number {
    return 23.45 * Math.sin(this.toRadians((360 / 365) * (dayOfYear - 81)));
  }

  /**
   * Calculate hour angle for given longitude and time
   * @param longitude Longitude in degrees
   * @param date Date/time
   * @returns Hour angle in degrees
   */
  private static calculateHourAngle(longitude: number, date: Date): number {
    const utcHours = date.getUTCHours();
    const utcMinutes = date.getUTCMinutes();
    const utcSeconds = date.getUTCSeconds();
    
    const solarTime = utcHours + utcMinutes / 60 + utcSeconds / 3600 + longitude / 15;
    return (solarTime - 12) * 15;
  }

  /**
   * Get day of year (1-365/366)
   */
  private static getDayOfYear(date: Date): number {
    const start = new Date(date.getFullYear(), 0, 0);
    const diff = date.getTime() - start.getTime();
    return Math.floor(diff / (1000 * 60 * 60 * 24));
  }

  /**
   * Convert degrees to radians
   */
  private static toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  /**
   * Convert radians to degrees
   */
  private static toDegrees(radians: number): number {
    return radians * (180 / Math.PI);
  }
}