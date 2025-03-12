/**
 * Collection of utility functions shared between client and server
 */

// Debounce function for rate-limiting function calls
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  
  return function(...args: Parameters<T>): void {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

// Linear interpolation between two values
export function lerp(start: number, end: number, t: number): number {
  return start * (1 - t) + end * t;
}

// Clamp a value between min and max
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

// Normalize a value between min and max to a 0-1 range
export function normalize(value: number, min: number, max: number): number {
  return clamp((value - min) / (max - min), 0, 1);
}

// Get distance between two points
export function distance(x1: number, y1: number, x2: number, y2: number): number {
  return Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
}

// Generate a random string ID
export function generateId(length: number = 8): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// Deep clone an object
export function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

// Check if an object is empty
export function isEmpty(obj: Record<string, any>): boolean {
  return Object.keys(obj).length === 0;
}

export default {
  debounce,
  lerp,
  clamp,
  normalize,
  distance,
  generateId,
  deepClone,
  isEmpty
};