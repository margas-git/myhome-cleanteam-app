// API Configuration
// This handles different environments (development vs production)

// Dynamic API base URL detection
const getApiBaseUrl = (): string => {
  // Check if we're in development (localhost)
  if (window.location.hostname === 'localhost') {
    return ''; // Use relative URL for Vite proxy
  }
  
  // In production, use the Railway URL
  return 'https://myhome-cleanteam-wip.up.railway.app';
};

export const API_BASE_URL = getApiBaseUrl();

// Helper function to build API URLs
export const buildApiUrl = (endpoint: string): string => {
  // Check if we're in development (localhost)
  if (window.location.hostname === 'localhost') {
    return endpoint; // Use relative URL for Vite proxy
  }
  return `${API_BASE_URL}${endpoint}`;
}; 