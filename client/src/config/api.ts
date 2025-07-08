// API Configuration
// This handles different environments (development vs production)

// In development, use Vite's proxy (localhost:4000)
// In production, use the Railway URL
export const API_BASE_URL = 'https://myhome-cleanteam-app-production.up.railway.app';

// Helper function to build API URLs
export const buildApiUrl = (endpoint: string): string => {
  // Check if we're in development (localhost)
  if (window.location.hostname === 'localhost') {
    return endpoint; // Use relative URL for Vite proxy
  }
  return `${API_BASE_URL}${endpoint}`;
}; 