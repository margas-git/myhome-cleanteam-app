import { useEffect, useState } from 'react';
import { getGoogleMapsApiKey } from '../config/maps';

declare global {
  interface Window {
    google: any;
    _googleMapsScriptLoading?: boolean;
    _googleMapsScriptLoaded?: boolean;
  }
}

// Global reset function for page reloads
const resetGoogleMapsState = () => {
  window._googleMapsScriptLoading = false;
  window._googleMapsScriptLoaded = false;
};

// Reset on page load
if (typeof window !== 'undefined') {
  resetGoogleMapsState();
}

export function useGoogleMaps(apiKey?: string) {
  const [loaded, setLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resolvedApiKey, setResolvedApiKey] = useState<string | null>(null);

  useEffect(() => {
    // If Google Maps and Geocoder are already loaded, just set state and return
    if (window.google && window.google.maps && window.google.maps.Geocoder) {
      setLoaded(true);
      if (!resolvedApiKey) {
        // If no API key provided, get it from environment or server
        if (!apiKey) {
          getGoogleMapsApiKey().then(setResolvedApiKey);
        } else {
          setResolvedApiKey(apiKey);
        }
      }
      return;
    }

    // Check if already loading
    if (isLoading || window._googleMapsScriptLoading) return;

    const loadGoogleMaps = async () => {
      setIsLoading(true);
      window._googleMapsScriptLoading = true;
      setError(null);

      try {
        // Get API key - either from parameter, environment, or server
        let key = apiKey;
        if (!key) {
          key = await getGoogleMapsApiKey();
        }
        
        if (!key) {
          throw new Error('No Google Maps API key available');
        }
        
        setResolvedApiKey(key);

        // Check if script is already in the document
        const existingScript = document.querySelector(`script[src*="maps.googleapis.com"]`);
        if (existingScript) {
          // Script is loading, wait for it
          const checkLoaded = () => {
            if (window.google && window.google.maps && window.google.maps.Geocoder) {
              console.log('✅ Google Maps API is now available (existing script)');
              setLoaded(true);
              setIsLoading(false);
              window._googleMapsScriptLoaded = true;
              window._googleMapsScriptLoading = false;
            } else {
              setTimeout(checkLoaded, 100);
            }
          };
          checkLoaded();
          return;
        }

        // Remove any existing failed scripts
        const failedScripts = document.querySelectorAll(`script[src*="maps.googleapis.com"]`);
        failedScripts.forEach(script => script.remove());

        const script = document.createElement('script');
        script.src = `https://maps.googleapis.com/maps/api/js?key=${key}&libraries=places,geometry&loading=async`;
        script.async = true;
        script.defer = true;
        
        script.onload = () => {
          console.log('🌐 Google Maps API script loaded successfully');
          
          // Add a timeout to check if the API is actually available
          setTimeout(() => {
            if (window.google && window.google.maps && window.google.maps.Geocoder) {
              console.log('✅ Google Maps API is now available');
              setLoaded(true);
              setIsLoading(false);
              window._googleMapsScriptLoading = false;
              window._googleMapsScriptLoaded = true;
            } else {
              console.log('⏳ Google Maps API not ready yet, waiting 2 more seconds...');
              // Try again after another 2 seconds
              setTimeout(() => {
                if (window.google && window.google.maps && window.google.maps.Geocoder) {
                  console.log('✅ Google Maps API is now available (delayed)');
                  setLoaded(true);
                  setIsLoading(false);
                  window._googleMapsScriptLoading = false;
                  window._googleMapsScriptLoaded = true;
                } else {
                  console.error('❌ Google Maps script loaded but API not available after 3 seconds - may be blocked');
                  setError('Google Maps API blocked - try disabling ad blocker');
                  setIsLoading(false);
                  window._googleMapsScriptLoading = false;
                }
              }, 2000);
            }
          }, 1000);
        };
        
        script.onerror = () => {
          console.error('Google Maps API script failed to load - may be blocked by ad blocker');
          setError('Google Maps API blocked - try disabling ad blocker');
          setIsLoading(false);
          window._googleMapsScriptLoading = false;
        };

        document.head.appendChild(script);
      } catch (error) {
        console.error('Failed to load Google Maps:', error);
        setError('Failed to load Google Maps API key');
        setIsLoading(false);
        window._googleMapsScriptLoading = false;
      }
    };

    loadGoogleMaps();

    // Don't return a cleanup function that resets the loading flag
    // This prevents issues with page reloads
  }, [apiKey, isLoading]);

  return { 
    isLoaded: loaded, 
    isLoading, 
    error, 
    apiKey: resolvedApiKey 
  };
} 