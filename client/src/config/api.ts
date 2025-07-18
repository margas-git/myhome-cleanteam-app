// API Configuration
// This handles different environments (development vs production)

// Use relative URLs for both development and production
// This ensures the app works on any domain (localhost, custom domain, etc.)
export const API_BASE_URL = '';

// Helper function to build API URLs
export const buildApiUrl = (endpoint: string): string => {
  // Always use relative URLs
  // This works with:
  // - localhost (Vite proxy handles /api -> localhost:4000)
  // - custom domain (same-origin requests)
  // - Railway domain (same-origin requests)
  return endpoint;
}; 