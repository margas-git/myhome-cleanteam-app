import { useState, useEffect, useRef, useMemo } from "react";
import { useLocation } from "wouter";
import { useAuth } from "../../hooks/useAuth";
import { useGeolocation } from "../../hooks/useGeolocation";
import { useGoogleMaps } from "../../hooks/useGoogleMaps";
import { ClockInModal } from "../../components/ClockInModal";
import { ClockOutModal } from "../../components/ClockOutModal";
import { formatAddress } from '../../utils/addressFormatter';
import { formatPhoneNumber } from '../../utils/phoneFormatter';
import { buildApiUrl } from "../../config/api";

interface Customer {
  id: number;
  name: string;
  address: string;
  latitude: string;
  longitude: string;
  phone?: string;
  price: string;
}

interface ActiveJob {
  id: number;
  jobId: number;
  clockInTime: string;
  customerName: string;
  customerAddress: string;
  customerPrice: number;
  teamName: string;
  teamColor: string;
  allottedMinutes: number;
  teamSize: number;
  members: {
    id: number;
    userId: number;
    name: string;
    clockInTime: string;
  }[];
}

interface CompletedJob {
  id: number;
  jobId: number;
  clockInTime: string;
  clockOutTime: string;
  customerName: string;
  customerAddress: string;
  lunchBreak: boolean;
  autoLunchDeducted: boolean;
}

// Sequential StreetViewImage loader
function StreetViewImage({ address, className = "", isBackground = false, loadNext }: { address: string; className?: string; isBackground?: boolean; loadNext?: () => void }) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);
  const { isLoaded: isGoogleLoaded, apiKey } = useGoogleMaps();
  const hasStarted = useRef(false);

  useEffect(() => {
    setImageUrl(null);
    setError(false);
    setIsLoading(true);
    hasStarted.current = false;
  }, [address]);

  useEffect(() => {
    if (!address || !isGoogleLoaded || !apiKey || hasStarted.current) return;
    hasStarted.current = true;
    const geocoder = new window.google.maps.Geocoder();
    geocoder.geocode({ address: address + ', Australia' }, (results: any[], status: string) => {
      if (status === 'OK' && results[0]) {
        const location = results[0].geometry.location;
        const lat = location.lat();
        const lng = location.lng();
        const streetViewUrl = `https://maps.googleapis.com/maps/api/streetview?size=400x240&location=${lat},${lng}&key=${apiKey}&pitch=0&fov=90`;
        const img = new window.Image();
        const timeoutId = setTimeout(() => {
          img.onload = null;
          img.onerror = null;
          setError(true);
          setIsLoading(false);
          if (loadNext) loadNext();
        }, 10000);
        img.onload = () => {
          clearTimeout(timeoutId);
          setImageUrl(streetViewUrl);
          setIsLoading(false);
          if (loadNext) loadNext();
        };
        img.onerror = () => {
          clearTimeout(timeoutId);
          setError(true);
          setIsLoading(false);
          if (loadNext) loadNext();
        };
        img.src = streetViewUrl;
      } else {
        setError(true);
        setIsLoading(false);
        if (loadNext) loadNext();
      }
    });
  }, [address, isGoogleLoaded, apiKey, loadNext]);

  if (isLoading) {
    return (
      <div className={`${className} bg-gray-100 flex items-center justify-center relative`} style={{ minHeight: '128px', height: '128px' }}>
        <div className="flex items-center justify-center w-full h-full">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  if (error || !imageUrl) {
    return (
      <div className={`${className} bg-gray-100 flex items-center justify-center`} style={{ minHeight: '200px' }}>
        <div className="text-center text-gray-500">
          <svg className="w-8 h-8 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <div className="text-xs">Location preview unavailable</div>
          <div className="text-xs text-gray-400">Street View API may not be enabled</div>
        </div>
      </div>
    );
  }

  if (isBackground) {
    return (
      <div 
        className={`${className} bg-cover bg-center`}
        style={{
          backgroundImage: `url(${imageUrl})`,
          backgroundPosition: 'center center',
          minHeight: '200px'
        }}
      />
    );
  }

  return (
    <a
      href={imageUrl}
      target="_blank"
      rel="noopener noreferrer"
      className={`${className} block w-full h-full cursor-pointer hover:opacity-90 transition-opacity duration-200`}
      title="Click to view larger street view"
    >
      <img
        src={imageUrl}
        alt={`Street view of ${address}`}
        className="w-full h-full object-cover"
        onError={(e) => {
          e.currentTarget.style.display = 'none';
          e.currentTarget.parentElement!.style.display = 'none';
        }}
      />
      <div className="absolute inset-0 bg-black bg-opacity-20"></div>
      <div className="absolute top-2 right-2 bg-black bg-opacity-50 text-white text-xs px-2 py-1 rounded-full">
        <svg className="w-3 h-3 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
        </svg>
        View
      </div>
    </a>
  );
}

export { StreetViewImage };

// Price tiers for allottedMinutes (should match backend)
const priceTiers = [
  { min: 0, max: 199, minutes: 90 },
  { min: 200, max: 299, minutes: 120 },
  { min: 300, max: 399, minutes: 150 },
  { min: 400, max: 499, minutes: 180 },
  { min: 500, max: 999999, minutes: 240 }
];

function getAllottedMinutes(price: number | string | undefined) {
  if (!price) return undefined;
  const priceNum = typeof price === 'string' ? parseFloat(price) : price;
  const tier = priceTiers.find(t => priceNum >= t.min && priceNum <= t.max);
  return tier ? tier.minutes : undefined;
}

export function StaffDashboard() {
  const { user, loading, logout } = useAuth();
  const [, setLocation] = useLocation();
  const { location, error: locationError, isLoading: locationLoading } = useGeolocation();
  
  const [activeJob, setActiveJob] = useState<ActiveJob | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [radiusMeters, setRadiusMeters] = useState<number>(50000); // Default 50km
  const [completedToday, setCompletedToday] = useState<CompletedJob[]>([]);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [showClockInModal, setShowClockInModal] = useState(false);
  const [showClockOutModal, setShowClockOutModal] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const refreshIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      setLocation("/login");
      return;
    }
    
    fetchData();
  }, [user, loading, setLocation]);

  // Fetch customers only when location is available
  useEffect(() => {
    if (location) {
      fetchCustomers();
    }
  }, [location]);

  // Set up periodic refresh for active job data when there's an active job
  useEffect(() => {
    if (refreshIntervalRef.current) {
      clearInterval(refreshIntervalRef.current);
      refreshIntervalRef.current = null;
    }

    if (activeJob) {
      refreshIntervalRef.current = setInterval(() => {
        fetchActiveJob();
      }, 30000);
    }

    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
        refreshIntervalRef.current = null;
      }
    };
  }, [activeJob?.id]);

  useEffect(() => {
    if (activeJob) {
      const timer = window.setInterval(() => {
        const now = new Date().getTime();
        const clockIn = new Date(activeJob.clockInTime).getTime();
        setElapsedSeconds(Math.floor((now - clockIn) / 1000));
      }, 1000);

      return () => {
        window.clearInterval(timer);
      };
    }
  }, [activeJob]);

  const fetchData = async () => {
    try {
      const [activeJobResponse, completedResponse] = await Promise.all([
        fetch(buildApiUrl("/api/staff/active-job"), { credentials: "include" }),
        fetch(buildApiUrl("/api/staff/completed-today"), { credentials: "include" })
      ]);

      if (activeJobResponse.ok) {
        const activeData = await activeJobResponse.json();
        setActiveJob(activeData.data);
      }

      if (completedResponse.ok) {
        const completedData = await completedResponse.json();
        setCompletedToday(completedData.data);
      }
    } catch (error) {
      console.error("Failed to fetch data:", error);
    }
  };

  const fetchCustomers = async () => {
    if (!location) return;
    
    try {
      const response = await fetch(buildApiUrl("/api/staff/customers"), { credentials: "include" });
      if (response.ok) {
        const customersData = await response.json();
        console.log('Staff Dashboard: Received', customersData.data.length, 'customers with coordinates');
        setCustomers(customersData.data);
        setRadiusMeters(customersData.radiusMeters || 50000);
      }
    } catch (error) {
      console.error("Failed to fetch customers:", error);
    }
  };

  const fetchActiveJob = async () => {
    try {
      const response = await fetch(buildApiUrl("/api/staff/active-job"), { credentials: "include" });
      if (response.ok) {
        const data = await response.json();
        setActiveJob(data.data);
      }
    } catch (error) {
      console.error("Failed to fetch active job:", error);
    }
  };

  const calculateDistance = (customer: Customer) => {
    if (!location) return null;
    
    const customerLat = parseFloat(customer.latitude);
    const customerLng = parseFloat(customer.longitude);
    
    if (isNaN(customerLat) || isNaN(customerLng)) {
      console.warn('Invalid coordinates for customer:', customer.name, customer.latitude, customer.longitude);
      return null;
    }
    
    const R = 6371e3;
    const φ1 = location.latitude * Math.PI/180;
    const φ2 = customerLat * Math.PI/180;
    const Δφ = (customerLat - location.latitude) * Math.PI/180;
    const Δλ = (customerLng - location.longitude) * Math.PI/180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    const distance = Math.round(R * c);
    
    return distance;
  };

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const formatDistance = (meters: number) => {
    if (meters < 1000) return `${meters}m`;
    return `${(meters / 1000).toFixed(1)}km`;
  };

  const isOvertime = () => {
    if (!activeJob) return false;
    return elapsedSeconds > (activeJob.allottedMinutes * 60);
  };

  const handleClockIn = (customer: Customer) => {
    setSelectedCustomer(customer);
    setShowClockInModal(true);
  };

  const handleManualClockIn = () => {
    setSelectedCustomer(null);
    setShowClockInModal(true);
  };

  const handleClockOut = () => {
    setShowClockOutModal(true);
  };

  const handleClockInSuccess = () => {
    fetchData();
  };

  const handleClockOutSuccess = () => {
    setActiveJob(null);
    fetchData();
  };

  const nearbyCustomers = useMemo(() => {
    if (!location || !customers || customers.length === 0) {
      return [];
    }

    // Early exit if no customers have coordinates
    const customersWithCoords = customers.filter((customer: Customer) => 
      customer.latitude && customer.longitude
    );
    
    if (customersWithCoords.length === 0) return [];

    const customersWithDistance = customersWithCoords
      .map((customer: Customer) => {
        const distance = calculateDistance(customer);
        
        // Only include if within radius to save memory
        return distance !== null && distance <= radiusMeters ? { ...customer, distance } : null;
      })
      .filter(Boolean)
      .sort((a: any, b: any) => a.distance - b.distance);

    return customersWithDistance;
  }, [location?.latitude, location?.longitude, customers, radiusMeters]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <div className="text-gray-600 font-medium">Loading your dashboard...</div>
        </div>
      </div>
    );
  }

  // Show loading state while getting location
  if (locationLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <div className="text-gray-600 font-medium">Getting your location...</div>
          <p className="text-sm text-gray-500 mt-2">This helps us show nearby jobs</p>
        </div>
      </div>
    );
  }

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good Morning";
    if (hour < 17) return "Good Afternoon";
    return "Good Evening";
  };

  const getLocationStatusIcon = () => {
    if (locationLoading) {
      return (
        <div className="flex items-center text-blue-600">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
          <span className="text-sm">Getting location...</span>
        </div>
      );
    }
    
    if (locationError) {
      return (
        <div className="flex items-center text-red-600">
          <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          <span className="text-sm">Location unavailable</span>
        </div>
      );
    }
    
    if (location) {
      return (
        <div className="flex items-center text-green-600">
          <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
          <span className="inline-block px-2 py-1 text-xs font-semibold text-white bg-green-500 rounded-full">Active</span>
        </div>
      );
    }
    
    return null;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      {/* Minimal Header */}
      <div className="bg-white/80 backdrop-blur-sm border-b border-gray-200/50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </div>
              <div>
                <h1 className="text-xl font-semibold text-gray-900">
                  {getGreeting()}, {user?.firstName}
                </h1>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              {getLocationStatusIcon()}
              <button
                onClick={logout}
                className="inline-flex items-center px-3 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-600 bg-white/50 hover:bg-white hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all duration-200"
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                Logout
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Active Job Card - Enhanced Design */}
        {activeJob ? (
          <div className={`mb-8 rounded-2xl shadow-sm border ${isOvertime() ? 'bg-gradient-to-r from-red-50 to-pink-50 border-red-200' : 'bg-white border-gray-200'} p-6`}>
            {/* Header with customer and timer */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center space-x-4">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center ${isOvertime() ? 'bg-red-100' : 'bg-blue-100'}`}>
                  <svg className={`w-6 h-6 ${isOvertime() ? 'text-red-600' : 'text-blue-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">Currently Working</h2>
                  <p className="text-gray-600 font-medium">{activeJob.customerName}</p>
                  <p className="text-sm text-gray-500">{formatAddress(activeJob.customerAddress)}</p>
                </div>
              </div>
              <div className="text-right">
                <div className={`text-3xl font-bold ${isOvertime() ? 'text-red-600' : 'text-gray-900'}`}>
                  {formatTime(elapsedSeconds)}
                </div>
                <div className={`text-sm ${isOvertime() ? 'text-red-600' : 'text-gray-500'}`}>
                  {isOvertime() ? 'Overtime' : `${activeJob.allottedMinutes} min allocated`}
                </div>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="mb-6">
              <div className="flex justify-between items-center mb-3">
                <div className="flex items-center space-x-2">
                  <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                  <span className="text-sm font-medium text-gray-700">Progress</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className={`text-sm font-semibold ${
                    isOvertime() ? 'text-red-600' : 'text-gray-900'
                  }`}>
                    {Math.round((elapsedSeconds / (activeJob.allottedMinutes * 60)) * 100)}%
                  </span>
                </div>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3 shadow-inner">
                <div 
                  className={`h-3 rounded-full transition-all duration-500 ease-out shadow-sm ${
                    isOvertime() 
                      ? 'bg-gradient-to-r from-red-500 to-red-600' 
                      : elapsedSeconds > (activeJob.allottedMinutes * 60 * 0.8) 
                        ? 'bg-gradient-to-r from-yellow-500 to-yellow-600' 
                        : 'bg-gradient-to-r from-blue-500 to-blue-600'
                  }`}
                  style={{ 
                    width: `${Math.min(100, (elapsedSeconds / (activeJob.allottedMinutes * 60)) * 100)}%` 
                  }}
                ></div>
              </div>
            </div>

            {/* Time and Team Info */}
            <div className="space-y-6 mb-6">
              {/* Time Information - Side by side */}
              <div className="grid grid-cols-2 gap-4">
                {/* Start Time */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="flex items-center space-x-2 mb-3">
                    <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <h3 className="text-sm font-semibold text-gray-900">Started At</h3>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <div className="w-8 h-8 bg-gradient-to-br from-green-100 to-green-200 rounded-full flex items-center justify-center shadow-sm">
                        <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <div>
                        <div className="text-lg font-semibold text-gray-900">
                          {new Date(activeJob.clockInTime).toLocaleTimeString('en-AU', {
                            hour: '2-digit',
                            minute: '2-digit',
                            hour12: true
                          })}
                        </div>
                        <div className="text-sm text-gray-600">
                          {new Date(activeJob.clockInTime).toLocaleDateString('en-AU', {
                            weekday: 'short',
                            month: 'short',
                            day: 'numeric'
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Target Finish Time */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="flex items-center space-x-2 mb-3">
                    <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <h3 className="text-sm font-semibold text-gray-900">Target Finish</h3>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <div className="w-8 h-8 bg-gradient-to-br from-orange-100 to-orange-200 rounded-full flex items-center justify-center shadow-sm">
                        <svg className="w-4 h-4 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <div>
                        <div className="text-lg font-semibold text-gray-900">
                          {(() => {
                            const startTime = new Date(activeJob.clockInTime);
                            const targetTime = new Date(startTime.getTime() + (activeJob.allottedMinutes * 60 * 1000));
                            return targetTime.toLocaleTimeString('en-AU', {
                              hour: '2-digit',
                              minute: '2-digit',
                              hour12: true
                            });
                          })()}
                        </div>
                        <div className="text-sm text-gray-600">
                          {(() => {
                            const startTime = new Date(activeJob.clockInTime);
                            const targetTime = new Date(startTime.getTime() + (activeJob.allottedMinutes * 60 * 1000));
                            return targetTime.toLocaleDateString('en-AU', {
                              weekday: 'short',
                              month: 'short',
                              day: 'numeric'
                            });
                          })()}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Team Information */}
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="flex items-center space-x-2 mb-3">
                  <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  <h3 className="text-sm font-semibold text-gray-900">Team</h3>
                  <span className="text-xs text-gray-500 bg-gray-200 px-2 py-1 rounded-full">
                    {activeJob.teamSize} member{activeJob.teamSize !== 1 ? 's' : ''}
                  </span>
                </div>
                <div className="flex items-center space-x-2 mb-3">
                  <div 
                    className="w-3 h-3 rounded-full border-2 border-white shadow-sm"
                    style={{ backgroundColor: activeJob.teamColor || '#3b82f6' }}
                  ></div>
                  <span className="text-sm font-medium text-gray-800">{activeJob.teamName}</span>
                </div>
                <div className="space-y-2">
                  {activeJob.members.map((member) => (
                    <div key={member.id} className="flex items-center space-x-3">
                      <div className="w-8 h-8 bg-gradient-to-br from-blue-100 to-blue-200 rounded-full flex items-center justify-center shadow-sm">
                        <span className="text-xs font-semibold text-blue-700">
                          {member.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                        </span>
                      </div>
                      <div className="flex-1">
                        <span className="text-sm font-medium text-gray-900">{member.name}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Clock Out Button */}
            <div className="flex justify-center">
              <button
                onClick={handleClockOut}
                className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-xl shadow-sm text-white bg-red-500 hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-all duration-200"
              >
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                End Clean
              </button>
            </div>
          </div>
        ) : (
          /* Nearby Customers - Modern Minimal Design */
          <div className="mb-8">
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-black">Nearby Customers</h2>
            </div>
            
            {nearbyCustomers.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {nearbyCustomers.map((customer: any, idx: number) => (
                  <div key={customer.id} className="bg-white rounded-xl shadow-sm border border-gray-100 hover:shadow-md hover:border-gray-200 transition-all duration-200 overflow-hidden group">
                    {/* Street View Image - only render if idx <= currentImageIndex */}
                    <div className="relative h-32 bg-gray-100 flex items-stretch">
                      {idx <= currentImageIndex ? (
                        <StreetViewImage
                          address={customer.address}
                          className="relative w-full h-full"
                          loadNext={() => setCurrentImageIndex(i => i === idx ? i + 1 : i)}
                        />
                      ) : (
                        <div className="w-full h-full" style={{ minHeight: '128px' }}></div>
                      )}
                    </div>
                    {/* Customer details always visible */}
                    <div className="p-5">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex-1">
                          <h3 className="text-lg font-semibold text-gray-900 mb-1">{customer.name}</h3>
                          <div className="flex items-center text-sm text-gray-600 mb-3">
                            <svg className="w-4 h-4 mr-1 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                            {formatAddress(customer.address)}
                          </div>
                          {customer.phone && (
                            <div className="flex items-center text-sm text-gray-500 mb-3">
                              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                              </svg>
                              {formatPhoneNumber(customer.phone)}
                            </div>
                          )}
                          <div className="flex items-center text-sm text-gray-500">
                            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            {customer.distance ? formatDistance(customer.distance) + ' away' : 'Location unknown'}
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => handleClockIn(customer)}
                        className="w-full inline-flex items-center justify-center px-4 py-3 border border-transparent text-sm font-medium rounded-lg text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all duration-200 group-hover:shadow-sm"
                      >
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Start Clean
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
                <div className="mb-4">
                  <svg className="w-16 h-16 text-gray-300 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  {location ? 'No jobs available nearby' : 'Location Required'}
                </h3>
                <p className="text-gray-500 mb-4">
                  {location ? 'Try expanding your search or use manual search.' : 'Please enable location access to find nearby jobs.'}
                </p>
                {location && (
                  <button
                    onClick={handleManualClockIn}
                    className="inline-flex items-center px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-600 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all duration-200"
                  >
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    Search All Customers
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* Completed Today - Minimal Design */}
        <div>
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Completed Today</h2>
              <p className="text-sm text-gray-500">Your work summary</p>
            </div>
          </div>
          
          {completedToday.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {completedToday.map((job) => {
                const duration = new Date(job.clockOutTime).getTime() - new Date(job.clockInTime).getTime();
                const hours = Math.floor(duration / (1000 * 60 * 60));
                const minutes = Math.floor((duration % (1000 * 60 * 60)) / (1000 * 60));
                
                return (
                  <div key={job.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold text-gray-900 mb-1">{job.customerName}</h3>
                        <div className="flex items-center text-sm text-gray-600 mb-2">
                          <svg className="w-4 h-4 mr-1 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                          {formatAddress(job.customerAddress)}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-bold text-gray-900">
                          {hours}h {minutes}m
                        </div>
                        {job.lunchBreak && (
                          <div className="text-xs text-blue-600 font-medium">
                            {job.autoLunchDeducted ? '🍽️ Auto lunch' : '🍽️ Manual lunch'}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center text-sm text-gray-500">
                        <svg className="w-4 h-4 mr-1 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        {new Date(job.clockInTime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })} - {new Date(job.clockOutTime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
                      </div>
                      <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                        <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
              <div className="mb-4">
                <svg className="w-16 h-16 text-gray-300 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No jobs completed today</h3>
              <p className="text-gray-500">Your completed jobs will appear here</p>
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      <ClockInModal
        customer={selectedCustomer}
        isOpen={showClockInModal}
        onClose={() => setShowClockInModal(false)}
        onSuccess={handleClockInSuccess}
        allottedMinutes={selectedCustomer ? getAllottedMinutes(selectedCustomer.price) : undefined}
      />

      <ClockOutModal
        isOpen={showClockOutModal}
        onClose={() => setShowClockOutModal(false)}
        onSuccess={handleClockOutSuccess}
      />
    </div>
  );
} 