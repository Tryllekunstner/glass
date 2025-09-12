/**
 * Utilities for safe client-side operations that prevent SSR/CSR mismatches.
 * These functions provide safe ways to access browser APIs without causing hydration errors.
 */

/**
 * Safely get URL parameters without causing hydration mismatches.
 * Returns null during server-side rendering and proper URLSearchParams on client.
 * 
 * @returns URLSearchParams object or null if not on client side
 */
export function getUrlParams(): URLSearchParams | null {
  if (typeof window === 'undefined') {
    return null;
  }
  
  try {
    return new URLSearchParams(window.location.search);
  } catch (error) {
    console.warn('Failed to parse URL parameters:', error);
    return null;
  }
}

/**
 * Safely detect if running in Electron environment.
 * Returns false during server-side rendering and proper detection on client.
 * 
 * @returns boolean indicating if running in Electron
 */
export function isElectronEnvironment(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }
  
  try {
    // Check for Electron-specific properties
    return !!(window as any).require || 
           !!(window as any).electronAPI || 
           navigator.userAgent.toLowerCase().includes('electron');
  } catch (error) {
    return false;
  }
}

/**
 * Safely get current URL without causing hydration issues.
 * Returns empty string during server-side rendering.
 * 
 * @returns Current URL string or empty string if not on client side
 */
export function getCurrentUrl(): string {
  if (typeof window === 'undefined') {
    return '';
  }
  
  try {
    return window.location.href;
  } catch (error) {
    console.warn('Failed to get current URL:', error);
    return '';
  }
}

/**
 * Safely navigate to a URL using window.location.
 * Does nothing during server-side rendering.
 * 
 * @param url - URL to navigate to
 */
export function navigateToUrl(url: string): void {
  if (typeof window === 'undefined') {
    return;
  }
  
  try {
    window.location.href = url;
  } catch (error) {
    console.warn('Failed to navigate to URL:', error);
  }
}

/**
 * Check if code is running on the client side.
 * 
 * @returns boolean indicating if running on client side
 */
export function isClientSide(): boolean {
  return typeof window !== 'undefined';
}
