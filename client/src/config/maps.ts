// Google Maps API Configuration
// Use environment variable directly for instant loading

let cachedApiKey: string | null = null;

export async function getGoogleMapsApiKey(): Promise<string> {
  if (cachedApiKey) {
    return cachedApiKey;
  }

  // Use the new initialization endpoint for better reliability
  console.log('🗺️ Initializing Google Maps from server... (v4 - RAILWAY REBUILD)');
  
  try {
    const response = await fetch('/api/google-maps-init', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(10000) // Longer timeout for initialization
    });
    
    if (!response.ok) {
      throw new Error(`Failed to initialize Google Maps: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    
    if (!data.success) {
      throw new Error(data.error || 'Failed to initialize Google Maps');
    }
    
    cachedApiKey = data.apiKey;
    
    if (cachedApiKey) {
      console.log('✅ Google Maps initialized successfully with API key');
    }
    
    return cachedApiKey || '';
  } catch (error) {
    console.error('❌ Failed to initialize Google Maps:', error);
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