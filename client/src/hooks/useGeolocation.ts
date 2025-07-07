import { useState, useEffect } from 'react';

interface GeolocationState {
  location: { latitude: number; longitude: number } | null;
  error: string | null;
  isLoading: boolean;
}

export function useGeolocation(): GeolocationState {
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!navigator.geolocation) {
      setError('Geolocation not supported');
      setIsLoading(false);
      return;
    }

    const success = (position: GeolocationPosition) => {
      console.log('Geolocation success:', {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy + ' meters',
        timestamp: new Date(position.timestamp).toLocaleString()
      });
      
      setLocation({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude
      });
      setIsLoading(false);
    };

    const errorHandler = (error: GeolocationPositionError) => {
      console.error('Geolocation error:', error);
      setError(error.message);
      setIsLoading(false);
    };

    navigator.geolocation.getCurrentPosition(success, errorHandler, {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 300000 // 5 minutes cache
    });
  }, []);

  return { location, error, isLoading };
} 