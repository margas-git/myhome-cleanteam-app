import { useEffect, useRef, useState } from 'react';
import { useGoogleMaps } from '../hooks/useGoogleMaps';

interface GoogleMapPreviewProps {
  address: string;
  className?: string;
}

export function GoogleMapPreview({ address, className = "" }: GoogleMapPreviewProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<any>(null);
  const marker = useRef<any>(null);
  const [mapError, setMapError] = useState(false);
  const { isLoaded: isGoogleLoaded } = useGoogleMaps();

  useEffect(() => {
    if (!address || !mapRef.current || !isGoogleLoaded) {
      console.log('GoogleMapPreview: Missing requirements', { address, mapRef: !!mapRef.current, isGoogleLoaded });
      return;
    }

    console.log('GoogleMapPreview: Attempting to load map for address:', address);

    const geocodeAddress = () => {
      if (!window.google?.maps?.Geocoder) {
        console.error('GoogleMapPreview: Google Maps Geocoder not available');
        setMapError(true);
        return;
      }

      try {
        const geocoder = new window.google.maps.Geocoder();
        
        geocoder.geocode({ address: address + ', Australia' }, (results: any[], status: string) => {
          console.log('GoogleMapPreview: Geocoding result:', { status, resultsCount: results?.length });
          
          if (status === 'OK' && results[0]) {
            const location = results[0].geometry.location;
            console.log('GoogleMapPreview: Location found:', location);
            
            // Create map
            mapInstance.current = new window.google.maps.Map(mapRef.current, {
              center: location,
              zoom: 15,
              mapTypeId: window.google.maps.MapTypeId.ROADMAP,
              mapTypeControl: false,
              streetViewControl: false,
              fullscreenControl: false,
              zoomControl: true,
              styles: [
                {
                  featureType: 'poi',
                  elementType: 'labels',
                  stylers: [{ visibility: 'off' }]
                }
              ]
            });

            // Add marker
            marker.current = new window.google.maps.Marker({
              position: location,
              map: mapInstance.current,
              title: address
            });
            
            console.log('GoogleMapPreview: Map created successfully');
          } else {
            console.error('GoogleMapPreview: Geocoding failed:', status);
            setMapError(true);
          }
        });
      } catch (error) {
        console.error('GoogleMapPreview: Google Maps geocoding error:', error);
        setMapError(true);
      }
    };

    geocodeAddress();

    return () => {
      if (marker.current) {
        marker.current.setMap(null);
      }
    };
  }, [address, isGoogleLoaded]);

  if (mapError) {
    return (
      <div className={className}>
        <div className="w-full h-48 rounded border bg-gray-100 flex items-center justify-center">
          <div className="text-center">
            <div className="text-gray-500 text-sm mb-2">Map Preview Unavailable</div>
            <div className="text-xs text-gray-400">Check console for details</div>
            <div className="text-xs text-gray-400 mt-1">API key may need setup</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      {address ? (
        <div 
          ref={mapRef} 
          className="w-full h-48 rounded border"
          style={{ minHeight: '192px' }}
        />
      ) : (
        <div className="text-gray-500 text-sm text-center py-8">
          Enter an address to see map preview
        </div>
      )}
    </div>
  );
} 