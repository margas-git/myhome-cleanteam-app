// Google Maps API Configuration
// Use environment variable directly for instant loading

let cachedApiKey: string | null = null;

export async function getGoogleMapsApiKey(): Promise<string> {
  if (cachedApiKey) {
    return cachedApiKey;
  }

  // Try to get API key from environment variable first (for instant loading)
  const envApiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
  if (envApiKey) {
    console.log('✅ Google Maps API Key loaded from environment');
    cachedApiKey = envApiKey;
    return envApiKey;
  }

  // Fallback to server fetch if environment variable not available
  console.log('🔑 Fetching Google Maps API key from server...');
  
  try {
    const response = await fetch('/api/google-maps-api-key', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(5000)
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch API key: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    cachedApiKey = data.apiKey;
    
    if (cachedApiKey) {
      console.log('✅ Google Maps API Key loaded from server');
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
// 3. Set VITE_GOOGLE_MAPS_API_KEY environment variable on Railway
// 4. The API key will be available instantly from environment variable
// 
// Test key limitations:
// - Limited requests per day
// - May show deprecation warnings
// - For development/testing only 