import { useState, useEffect } from 'react';
import { getGoogleMapsApiKey } from '../config/maps';

export function useGoogleMaps() {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [apiKey, setApiKey] = useState<string | null>(null);

  useEffect(() => {
    // Check if already loaded
    if (window.google && window.google.maps) {
      setIsLoaded(true);
      return;
    }

    // Check if already loading
    if (isLoading) return;

    // Check if script is already in the document
    const existingScript = document.querySelector(`script[src*="maps.googleapis.com"]`);
    if (existingScript) {
      // Script is loading, wait for it
      const checkLoaded = () => {
        if (window.google && window.google.maps) {
          setIsLoaded(true);
        } else {
          setTimeout(checkLoaded, 100);
        }
      };
      checkLoaded();
      return;
    }

    const loadGoogleMaps = async () => {
      setIsLoading(true);
      setError(null);

      try {
        // Get API key from server
        const key = await getGoogleMapsApiKey();
        if (!key) {
          throw new Error('No Google Maps API key available');
        }
        setApiKey(key);

        const script = document.createElement('script');
        script.src = `https://maps.googleapis.com/maps/api/js?key=${key}&libraries=places&loading=async`;
        script.async = true;
        script.defer = true;
        
        script.onload = () => {
          console.log('Google Maps API script loaded successfully');
          
          // Add a timeout to check if the API is actually available
          setTimeout(() => {
            if (window.google && window.google.maps) {
              setIsLoaded(true);
              setIsLoading(false);
            } else {
              console.error('Google Maps script loaded but API not available - may be blocked');
              setError('Google Maps API blocked - try disabling ad blocker');
              setIsLoading(false);
            }
          }, 1000);
        };
        
        script.onerror = () => {
          console.error('Google Maps API script failed to load - may be blocked by ad blocker');
          setError('Google Maps API blocked - try disabling ad blocker');
          setIsLoading(false);
        };

        document.head.appendChild(script);
      } catch (error) {
        console.error('Failed to load Google Maps:', error);
        setError('Failed to load Google Maps API key');
        setIsLoading(false);
      }
    };

    loadGoogleMaps();
  }, [isLoading]);

  return { isLoaded, isLoading, error, apiKey };
} 