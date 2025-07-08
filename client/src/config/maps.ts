// Google Maps API Configuration
// Fetch API key from server to avoid build-time environment variable issues

let cachedApiKey: string | null = null;

export async function getGoogleMapsApiKey(): Promise<string> {
  if (cachedApiKey) {
    return cachedApiKey;
  }

  try {
    const response = await fetch('/api/admin/google-maps-api-key');
    if (!response.ok) {
      throw new Error('Failed to fetch API key');
    }
    const data = await response.json();
    cachedApiKey = data.apiKey;
    
    // Debug: Log the API key status
    console.log('Google Maps API Key loaded:', cachedApiKey ? 'Present' : 'Missing');
    
    return cachedApiKey || '';
  } catch (error) {
    console.error('Failed to fetch Google Maps API key:', error);
    return '';
  }
}

// For backward compatibility, export a function that returns the cached key
export const VITE_GOOGLE_MAPS_API_KEY = async (): Promise<string> => {
  return getGoogleMapsApiKey();
};

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
// 3. Set GOOGLE_MAPS_API_KEY environment variable on Railway
// 4. The API key will be fetched from the server at runtime
// 
// Test key limitations:
// - Limited requests per day
// - May show deprecation warnings
// - For development/testing only 