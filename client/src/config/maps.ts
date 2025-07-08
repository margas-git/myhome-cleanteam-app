// Google Maps API Configuration
// TODO: Replace with your actual Google Maps API key

// Use the environment variable with VITE_ prefix for client-side access
export const VITE_GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

// Debug: Log the API key (remove in production)
console.log('Google Maps API Key loaded:', VITE_GOOGLE_MAPS_API_KEY ? 'Present' : 'Missing');

declare global {
  interface ImportMeta {
    env: {
      VITE_GOOGLE_MAPS_API_KEY: string;
      [key: string]: any;
    };
  }
}

// Instructions for setup:
// 1. Get a Google Maps API key from Google Cloud Console
// 2. Enable Places API and Maps JavaScript API
// 3. Replace the test key above with your actual API key
// 4. For production, use environment variables
// 
// Test key limitations:
// - Limited requests per day
// - May show deprecation warnings
// - For development/testing only 