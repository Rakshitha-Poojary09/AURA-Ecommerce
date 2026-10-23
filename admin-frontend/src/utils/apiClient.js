export const API_BASE = (
  (typeof import.meta !== 'undefined' && import.meta.env && (import.meta.env.VITE_API_URL || import.meta.env.VITE_BACKEND_URL)) ||
  'http://localhost:5000'
).replace(/\/+$/, '');

export function getAdminToken() {
  return localStorage.getItem('aura_admin_token') || '';
}

export function setAdminToken(token) {
  if (token) {
    localStorage.setItem('aura_admin_token', token);
  } else {
    localStorage.removeItem('aura_admin_token');
  }
}

export function getStoredAdminUser() {
  try {
    const raw = localStorage.getItem('aura_admin_user');
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

export function setStoredAdminUser(user) {
  if (user) {
    localStorage.setItem('aura_admin_user', JSON.stringify(user));
  } else {
    localStorage.removeItem('aura_admin_user');
  }
}

export function clearAdminAuth() {
  localStorage.removeItem('aura_admin_token');
  localStorage.removeItem('aura_admin_user');
}

/**
 * Standardized authenticated fetch helper for Admin requests
 */
export async function adminFetch(endpoint, options = {}) {
  let url;
  if (endpoint.startsWith('http://') || endpoint.startsWith('https://')) {
    url = endpoint;
  } else {
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    url = `${API_BASE}${cleanEndpoint}`;
  }
  
  const token = getAdminToken();
  
  const headers = {
    ...(options.body && typeof options.body === 'string' ? { 'Content-Type': 'application/json' } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {}),
  };

  const response = await fetch(url, {
    ...options,
    headers,
    credentials: 'include', // sends HTTP-only session cookies
  });

  // If a protected admin request receives 401 Unauthorized or 403 Forbidden
  // (and it's not the initial login credential submission), clear credentials and notify App
  const isLoginEndpoint = url.includes('/api/auth/admin-login') || url.includes('/api/auth/admin/login');
  if (!isLoginEndpoint && (response.status === 401 || response.status === 403)) {
    clearAdminAuth();
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('aura:admin:unauthorized', {
          detail: { status: response.status, url }
        })
      );
    }
  }

  return response;
}

/**
 * Health check helper for backend connectivity
 */
export async function checkBackendHealth() {
  try {
    const res = await fetch(`${API_BASE}/health`, { credentials: 'include' });
    if (res.ok) {
      return await res.json();
    }
    const rootRes = await fetch(`${API_BASE}/`, { credentials: 'include' });
    return await rootRes.json();
  } catch (err) {
    console.error('Backend health check error:', err);
    return null;
  }
}
