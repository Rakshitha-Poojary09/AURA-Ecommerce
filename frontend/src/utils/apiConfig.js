/**
 * Centralized API configuration for AURA customer frontend.
 * Reads environment variables configured via Vite (VITE_API_URL or VITE_BACKEND_URL)
 * with a fallback to local backend (http://localhost:5000).
 */
export const API_BASE = (
  (typeof import.meta !== 'undefined' && import.meta.env && (import.meta.env.VITE_API_URL || import.meta.env.VITE_BACKEND_URL)) ||
  'http://localhost:5000'
).replace(/\/+$/, '');

export const API_URL = API_BASE;

/**
 * Helper to build an absolute URL for backend endpoints or uploaded media
 */
export function getApiUrl(path = '') {
  if (!path) return API_BASE;
  if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('data:') || path.startsWith('blob:')) {
    return path;
  }
  return `${API_BASE}${path.startsWith('/') ? '' : '/'}${path}`;
}

export default API_BASE;
