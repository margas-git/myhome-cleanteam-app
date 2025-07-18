// API Configuration
// This handles different environments (development vs production)

// Use relative URLs for all environments to avoid CSP issues with custom domains
const getApiBaseUrl = (): string => {
  // Always use relative URLs to work with any domain setup
  return '';
};

export const API_BASE_URL = getApiBaseUrl();

// Helper function to build API URLs
export const buildApiUrl = (endpoint: string): string => {
  // Always use relative URLs to work with any domain setup
  return endpoint;
}; 