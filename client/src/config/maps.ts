// Google Maps API Configuration
// Fetch API key from server to avoid build-time environment variable issues

let cachedApiKey: string | null = null;
let hasLoggedFetch = false;

export async function getGoogleMapsApiKey(): Promise<string> {
  if (cachedApiKey) {
    return cachedApiKey;
  }

  if (!hasLoggedFetch) {
    console.log('🔑 Fetching Google Maps API key...');
    hasLoggedFetch = true;
  }
  
  try {
    const response = await fetch('/api/google-maps-api-key', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      // Add timeout
      signal: AbortSignal.timeout(5000)
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch API key: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    cachedApiKey = data.apiKey;
    
    // Only log once when API key is first loaded
    if (cachedApiKey) {
      console.log('✅ Google Maps API Key loaded successfully');
    }
    
    return cachedApiKey || '';
  } catch (error) {
    console.error('❌ Failed to fetch Google Maps API key:', error);
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