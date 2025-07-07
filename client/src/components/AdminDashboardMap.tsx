import { useEffect, useRef, useState, memo } from 'react';
import { useGoogleMaps } from '../hooks/useGoogleMaps';

interface CustomerLocation {
  id: number;
  name: string;
  address: string;
  latitude: string;
  longitude: string;
  teamColor?: string;
  status: 'active' | 'completed';
}

interface AdminDashboardMapProps {
  customers: CustomerLocation[];
  className?: string;
}

export const AdminDashboardMap = memo(function AdminDashboardMap({ customers, className = "" }: AdminDashboardMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<any>(null);
  const markers = useRef<any[]>([]);
  const [mapError, setMapError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const { isLoaded: isGoogleLoaded, error: googleError } = useGoogleMaps();

  useEffect(() => {
    if (!mapRef.current || !isGoogleLoaded || customers.length === 0) {
      return;
    }

    // Only recreate map if customer count actually changed
    if (markers.current.length === customers.length) {
      return;
    }

    const initializeMap = () => {
      // Wait a bit more for Google Maps to be fully loaded
      if (!window.google?.maps?.Map) {
        // Don't set error immediately, just return and let the effect retry
        return;
      }

      try {
        // Calculate bounds to fit all customers
        const bounds = new window.google.maps.LatLngBounds();
        const validCustomers = customers.filter(c => c.latitude && c.longitude);

        if (validCustomers.length === 0) {
          setMapError(true);
          return;
        }

        // Add each customer to bounds
        validCustomers.forEach(customer => {
          const lat = parseFloat(customer.latitude);
          const lng = parseFloat(customer.longitude);
          if (!isNaN(lat) && !isNaN(lng)) {
            bounds.extend({ lat, lng });
          }
        });

        // Create map centered on bounds
        mapInstance.current = new window.google.maps.Map(mapRef.current, {
          center: bounds.getCenter(),
          zoom: 10,
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

        // Fit map to bounds with padding
        mapInstance.current.fitBounds(bounds);
        window.google.maps.event.addListenerOnce(mapInstance.current, 'bounds_changed', () => {
          if (mapInstance.current.getZoom() > 15) {
            mapInstance.current.setZoom(15);
          }
        });

        // Clear existing markers
        markers.current.forEach(marker => marker.setMap(null));
        markers.current = [];

        // Add markers for each customer
        validCustomers.forEach(customer => {
          const lat = parseFloat(customer.latitude);
          const lng = parseFloat(customer.longitude);
          
          if (!isNaN(lat) && !isNaN(lng)) {
            const marker = new window.google.maps.Marker({
              position: { lat, lng },
              map: mapInstance.current,
              title: customer.name,
              icon: {
                path: window.google.maps.SymbolPath.CIRCLE,
                scale: 8,
                fillColor: customer.status === 'active' ? '#10B981' : '#6B7280',
                fillOpacity: 1,
                strokeColor: customer.teamColor || '#374151',
                strokeWeight: 2
              }
            });

            // Add info window
            const infoWindow = new window.google.maps.InfoWindow({
              content: `
                <div style="padding: 8px; max-width: 200px;">
                  <div style="font-weight: bold; margin-bottom: 4px;">${customer.name}</div>
                  <div style="font-size: 12px; color: #666;">${customer.address}</div>
                  <div style="font-size: 11px; color: #999; margin-top: 4px;">
                    Status: ${customer.status === 'active' ? '🟢 Active' : '✅ Completed'}
                  </div>
                </div>
              `
            });

            marker.addListener('click', () => {
              infoWindow.open(mapInstance.current, marker);
            });

            markers.current.push(marker);
          }
        });


      } catch (error) {
        console.error('AdminDashboardMap: Error creating map:', error);
        setMapError(true);
      }
    };

    // Try to initialize map, with retry if Google Maps isn't ready yet
    const tryInitialize = () => {
      if (!window.google?.maps?.Map) {
        // Retry up to 50 times (5 seconds total)
        if (retryCount < 50) {
          setRetryCount(prev => prev + 1);
          setTimeout(tryInitialize, 100);
          return;
        } else {
          // After 5 seconds, show error
          console.error('AdminDashboardMap: Google Maps not available after retries - may be blocked by ad blocker');
          setMapError(true);
          return;
        }
      }
      initializeMap();
    };

    tryInitialize();

    return () => {
      markers.current.forEach(marker => marker.setMap(null));
      markers.current = [];
    };
  }, [customers.length, isGoogleLoaded]); // Only depend on customer count, not the full array

  if (mapError || googleError) {
    return (
      <div className={className}>
        <div className="w-full rounded border bg-gray-50 p-4">
          <div className="text-center mb-4">
            <div className="text-gray-500 text-sm mb-2">Map Unavailable</div>
            <div className="text-xs text-gray-400 mb-2">
              {googleError || 'Google Maps may be blocked by ad blocker'}
            </div>
            <div className="text-xs text-gray-400">Try disabling ad blocker for this site</div>
          </div>
          
          {/* Fallback: Show customer locations in a list */}
          <div className="space-y-2">
            <div className="text-sm font-medium text-gray-700 mb-2">
              Customer Locations ({customers.length}):
            </div>
            {customers.map((customer) => (
              <div key={customer.id} className="flex items-center justify-between p-2 bg-white rounded border">
                <div>
                  <div className="font-medium text-sm">{customer.name}</div>
                  <div className="text-xs text-gray-500">{customer.address}</div>
                </div>
                <div className="flex items-center space-x-2">
                  <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                    customer.status === 'active' 
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-gray-100 text-gray-800'
                  }`}>
                    {customer.status === 'active' ? '🟢 Active' : '✅ Completed'}
                  </span>
                  <span className="text-xs text-gray-400">
                    {customer.latitude && customer.longitude ? '📍 Located' : '📍 Unknown'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (customers.length === 0) {
    return (
      <div className={className}>
        <div className="w-full h-64 rounded border bg-gray-50 flex items-center justify-center">
          <div className="text-center">
            <div className="text-gray-500 text-sm">No customer locations to display</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      <div 
        ref={mapRef} 
        className="w-full h-64 rounded border"
        style={{ minHeight: '256px' }}
      />
    </div>
  );
}, (prevProps, nextProps) => {
  // Custom comparison: only re-render if customer count or className changes
  return prevProps.customers.length === nextProps.customers.length && 
         prevProps.className === nextProps.className;
});