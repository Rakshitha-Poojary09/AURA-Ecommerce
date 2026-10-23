/**
 * Neutral image placeholder and URL normalizer for customer frontend
 * Ensures MongoDB is the single source of truth and prevents
 * unrelated photos from being substituted on error or missing data.
 */

export const NEUTRAL_PLACEHOLDER_IMAGE = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 400 400' width='100%25' height='100%25'%3E%3Crect width='400' height='400' fill='%23f4f5f4'/%3E%3Cg fill='none' stroke='%239ca3af' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Crect x='110' y='110' width='180' height='180' rx='12' fill='%23ffffff' stroke='%23d1d5db' stroke-width='1.5'/%3E%3Ccircle cx='160' cy='165' r='16' fill='%23e5e7eb' stroke='none'/%3E%3Cpath d='M125 245 L175 195 L215 235 L245 205 L275 240' stroke='%239ca3af' stroke-width='2'/%3E%3Ctext x='200' y='325' font-family='-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif' font-size='13' font-weight='500' fill='%236b7280' text-anchor='middle' stroke='none'%3ENo image available%3C/text%3E%3C/g%3E%3C/svg%3E";

/**
 * Normalizes product image strings from MongoDB
 * - Valid URLs (http/https), data URIs, and local absolute paths (/) are preserved
 * - Relative filenames (e.g. "products/shirt.jpg") receive a leading slash
 * - Missing/empty values resolve to the neutral SVG placeholder
 */
export function normalizeProductImageUrl(imageUrl) {
  if (!imageUrl || typeof imageUrl !== 'string' || !imageUrl.trim()) {
    return NEUTRAL_PLACEHOLDER_IMAGE;
  }
  const trimmed = imageUrl.trim();
  if (
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('data:') ||
    trimmed.startsWith('blob:') ||
    trimmed.startsWith('/')
  ) {
    return trimmed;
  }
  return `/${trimmed}`;
}

/**
 * Reusable onError handler for <img> tags
 * Fallbacks exclusively to the neutral placeholder instead of unrelated photos.
 */
export function handleImageError(e) {
  if (e && e.target && e.target.src !== NEUTRAL_PLACEHOLDER_IMAGE) {
    e.target.dataset.failed = 'true';
    e.target.src = NEUTRAL_PLACEHOLDER_IMAGE;
  }
}
