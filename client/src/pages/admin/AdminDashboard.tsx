import { useState, useEffect, useRef, useCallback } from "react";
import { AdminLayout } from "../../components/AdminLayout";
import { formatAddress } from "../../utils/addressFormatter";
import { AdminDashboardMap } from "../../components/AdminDashboardMap";
import { buildApiUrl, buildSSEUrl } from "../../config/api";

interface DashboardStats {
  activeCleans: number;
  completedCleans: number;
  efficiency: number;
  revenue: number;
  wageRatio: number;
}

interface Clean {
  jobId: number;
  customerName: string;
  customerAddress: string;
  customerLatitude?: string;
  customerLongitude?: string;
  teamName: string;
  teamColor: string;
  price: number;
  clockInTime: string;
  clockOutTime?: string;
  lunchBreak?: boolean;
  efficiency?: number;
  allocatedMinutes?: number;
  timeDifferenceMinutes?: number;
  wageRatio?: number;
  members: {
    id: number;
    userId: number;
    name: string;
    clockInTime: string;
    clockOutTime?: string;
    teamName?: string;
    teamColor?: string;
    isCoreTeam?: boolean;
  }[];
  isFriendsFamily?: boolean;
}

export function AdminDashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [completedCleans, setCompletedCleans] = useState<Clean[]>([]);
  const [activeCleans, setActiveCleans] = useState<Clean[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingClean, setEditingClean] = useState<Clean | null>(null);
  const [saving, setSaving] = useState(false);
  const [dateFilter, setDateFilter] = useState<'today' | 'yesterday' | 'thisWeek' | 'lastWeek' | 'custom'>('today');
  const [customRange, setCustomRange] = useState<{ start: string; end: string }>({ start: '2025-06-01', end: '2025-06-30' });
  const [isUpdating, setIsUpdating] = useState(false);
  const [appliedDateFilter, setAppliedDateFilter] = useState<'today' | 'yesterday' | 'thisWeek' | 'lastWeek' | 'custom'>('today');
  const [appliedCustomRange, setAppliedCustomRange] = useState<{ start: string; end: string }>({ start: '2025-06-01', end: '2025-06-30' });
  
  // SSE connection state
  const [sseConnected, setSseConnected] = useState(false);
  const [connectionAttempts, setConnectionAttempts] = useState(0);
  


  // Refs for the datetime inputs
  const clockInRef = useRef<HTMLInputElement>(null);
  const clockOutRef = useRef<HTMLInputElement>(null);
  const updateTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Helper function to convert UTC time to local datetime-local format (without seconds)
  const toLocalDateTimeString = (utcDateString: string) => {
    const date = new Date(utcDateString);
    // Format as YYYY-MM-DDTHH:MM (local time, no timezone math)
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  // Helper function to convert local date string to UTC Date object
  const localDateToUTC = (dateString: string, timeString: string = '00:00:00') => {
    const localDate = new Date(dateString + 'T' + timeString);
    return new Date(localDate.getTime() - (localDate.getTimezoneOffset() * 60000));
  };

  // Helper function to format UTC date in local timezone for display
  const formatUTCDateAsLocal = (utcDate: Date) => {
    const localDate = new Date(utcDate.getTime() + (utcDate.getTimezoneOffset() * 60000));
    return `${localDate.getDate().toString().padStart(2, '0')}/${(localDate.getMonth()+1).toString().padStart(2, '0')} ${localDate.getHours().toString().padStart(2, '0')}:${localDate.getMinutes().toString().padStart(2, '0')}`;
  };

  // Helper function to get date range based on filter
  const getDateRange = (filter: 'today' | 'yesterday' | 'thisWeek' | 'lastWeek' | 'custom') => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    switch (filter) {
      case 'today':
        return {
          start: today,
          end: new Date(today.getTime() + 24 * 60 * 60 * 1000)
        };
      case 'yesterday':
        const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
        return {
          start: yesterday,
          end: today
        };
      case 'thisWeek':
        // Get Monday of current week (assuming Monday is start of work week)
        const dayOfWeek = today.getDay();
        const monday = new Date(today.getTime() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1) * 24 * 60 * 60 * 1000);
        const sunday = new Date(monday.getTime() + 6 * 24 * 60 * 60 * 1000);
        return {
          start: monday,
          end: new Date(sunday.getTime() + 24 * 60 * 60 * 1000) // End at next Monday 00:00
        };
      case 'lastWeek':
        const thisMonday = new Date(today.getTime() - (today.getDay() === 0 ? 6 : today.getDay() - 1) * 24 * 60 * 60 * 1000);
        const lastMonday = new Date(thisMonday.getTime() - 7 * 24 * 60 * 60 * 1000);
        const lastSunday = new Date(thisMonday.getTime() - 1 * 24 * 60 * 60 * 1000);
        return {
          start: lastMonday,
          end: new Date(lastSunday.getTime() + 24 * 60 * 60 * 1000)
        };
      case 'custom':
        if (customRange.start && customRange.end) {
          // Convert local dates to UTC for consistent timezone handling
          const utcStart = localDateToUTC(customRange.start, '00:00:00');
          const utcEnd = localDateToUTC(customRange.end, '23:59:59.999');
          
          return { start: utcStart, end: new Date(utcEnd.getTime() + 1) }; // Add 1ms to make it exclusive
        } else {
          // Fallback to today if no custom range is set
          return { start: today, end: new Date(today.getTime() + 24 * 60 * 60 * 1000) };
        }
    }
  };

  // Helper function to filter cleans by date range
  const filterCleansByDate = (cleans: Clean[], filter: 'today' | 'yesterday' | 'thisWeek' | 'lastWeek' | 'custom') => {
    const { start, end } = getDateRange(filter);
    
    return cleans.filter(clean => {
      if (clean.clockOutTime) {
        const completionDate = new Date(clean.clockOutTime);
        return completionDate >= start && completionDate < end;
      }
      return true;
    });
  };

  // Helper function to get efficiency status
  const getEfficiencyStatus = (efficiency: number) => {
    if (efficiency >= 100) {
      return { color: 'bg-green-100 text-green-800', label: 'Excellent' };
    } else if (efficiency >= 80) {
      return { color: 'bg-yellow-100 text-yellow-800', label: 'Good' };
    } else if (efficiency >= 60) {
      return { color: 'bg-orange-100 text-orange-800', label: 'Fair' };
    } else {
      return { color: 'bg-red-100 text-red-800', label: 'Needs Attention' };
    }
  };

  // Helper function to get wage ratio status
  const getWageRatioStatus = (wageRatio: number) => {
    if (wageRatio <= 49) {
      return { color: 'text-green-600', label: 'Excellent' };
    } else if (wageRatio <= 59) {
      return { color: 'text-gray-500', label: 'Normal' };
    } else if (wageRatio <= 65) {
      return { color: 'text-yellow-600', label: 'Warning' };
    } else if (wageRatio <= 70) {
      return { color: 'text-red-600', label: 'High' };
    } else {
      return { color: 'text-red-800', label: 'Critical' };
    }
  };

  // Helper function to format time difference
  const formatTimeDifference = (timeDifferenceMinutes: number) => {
    if (timeDifferenceMinutes === 0) {
      return '(±0 mins)';
    } else if (timeDifferenceMinutes > 0) {
      return `(+${timeDifferenceMinutes} mins)`;
    } else {
      return `(${timeDifferenceMinutes} mins)`;
    }
  };

  // Debounced update function to prevent rapid re-renders
  const debouncedUpdate = useCallback((updateFn: () => void, delay: number = 500) => {
    if (updateTimeoutRef.current) {
      clearTimeout(updateTimeoutRef.current);
    }
    updateTimeoutRef.current = setTimeout(() => {
      updateFn();
    }, delay);
  }, []);

  // Optimistic update for active cleans
  const optimisticUpdateActiveCleans = useCallback((newActiveCleans: Clean[]) => {
    setActiveCleans(newActiveCleans);
  }, []);

  const fetchDashboardData = useCallback(async (showLoading: boolean = false) => {
    if (showLoading) {
      setIsUpdating(true);
    }

    try {
      // Build query parameters for completed cleans API
      const completedParams = new URLSearchParams();
      completedParams.append('dateFilter', appliedDateFilter);
      if (appliedDateFilter === 'custom' && appliedCustomRange.start && appliedCustomRange.end) {
        completedParams.append('customStart', appliedCustomRange.start);
        completedParams.append('customEnd', appliedCustomRange.end);
      }

      const [statsResponse, completedResponse, activeResponse] = await Promise.all([
        fetch(buildApiUrl(`/api/admin/dashboard?dateFilter=${appliedDateFilter}`), { credentials: "include" }),
        fetch(buildApiUrl(`/api/admin/cleans/completed?${completedParams.toString()}`), { credentials: "include" }),
        fetch(buildApiUrl("/api/admin/cleans/active"), { credentials: "include" })
      ]);
      
      if (statsResponse.ok) {
        const statsData = await statsResponse.json();
        setStats(statsData.data);
      }

      if (completedResponse.ok) {
        const completedData = await completedResponse.json();
        setCompletedCleans(completedData.data || []);
      } else {
        console.error("Failed to fetch completed cleans:", completedResponse.status, completedResponse.statusText);
      }

      if (activeResponse.ok) {
        const activeData = await activeResponse.json();
        setActiveCleans(activeData.data || []);
      } else {
        console.error("Failed to fetch active cleans:", activeResponse.status, activeResponse.statusText);
      }
    } catch (error) {
      console.error("Failed to fetch dashboard data:", error);
    } finally {
      setLoading(false);
      setIsUpdating(false);
    }
  }, [appliedDateFilter, appliedCustomRange]);

  useEffect(() => {
    fetchDashboardData(true);
  }, [appliedDateFilter, appliedCustomRange, fetchDashboardData]);

  // Set up SSE for real-time updates
  useEffect(() => {
    // Check if SSE is disabled via environment variable
    const sseDisabled = process.env.REACT_APP_DISABLE_SSE === 'true';
    
    if (sseDisabled) {
      console.log("SSE disabled, using polling fallback");
      setSseConnected(false);
      const pollInterval = setInterval(() => {
        fetchDashboardData();
      }, 30000); // Poll every 30 seconds
      
      return () => {
        clearInterval(pollInterval);
      };
    }

    let eventSource: EventSource | null = null;

    const connectSSE = () => {
      try {
        // Close existing connection if any
        if (eventSource) {
          eventSource.close();
        }

        // Create new SSE connection
        eventSource = new EventSource(buildSSEUrl("/api/admin/dashboard/events"), {
          withCredentials: true
        });

        eventSource.onopen = () => {
          console.log("SSE connection established");
          setSseConnected(true);
          setConnectionAttempts(0); // Reset connection attempts on successful connection
        };

        eventSource.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            
            switch (data.type) {
              case 'connected':
                console.log("SSE connected:", data.message);
                break;
              case 'heartbeat':
                // Optional: handle heartbeat for connection monitoring
                break;
              case 'staff_clocked_in':
              case 'staff_clocked_out':
              case 'dashboard_update':
                // Refresh dashboard data when real-time events occur
                console.log("Real-time update received:", data.type);
                fetchDashboardData();
                break;
              default:
                console.log("Unknown SSE event type:", data.type);
            }
          } catch (error) {
            console.error("Error parsing SSE message:", error);
          }
        };

        eventSource.onerror = (error) => {
          console.error("SSE connection error:", error);
          setSseConnected(false);
          setConnectionAttempts(prev => prev + 1);
          
          // Attempt to reconnect after a delay, but limit attempts
          if (connectionAttempts < 3) {
            setTimeout(() => {
              if (eventSource) {
                eventSource.close();
                connectSSE();
              }
            }, 5000);
          } else {
            // After 3 failed attempts, stay in polling mode
            console.log("SSE connection failed after 3 attempts, staying in polling mode");
          }
        };

      } catch (error) {
        console.error("Failed to establish SSE connection:", error);
        // Fallback to polling if SSE fails
        console.log("Falling back to polling...");
        setSseConnected(false);
        setConnectionAttempts(prev => prev + 1);
        
        // Only set up polling if we haven't exceeded connection attempts
        if (connectionAttempts < 3) {
          const pollInterval = setInterval(() => {
            fetchDashboardData();
          }, 30000); // Poll every 30 seconds as fallback

          return () => {
            clearInterval(pollInterval);
          };
        }
      }
    };

    // Start SSE connection
    connectSSE();

    // Cleanup on unmount
    return () => {
      if (eventSource) {
        eventSource.close();
      }
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }
      setSseConnected(false);
    };
  }, []); // Empty dependency array - SSE connection should be established once

  const saveCleanTimes = async () => {
    if (!editingClean || !clockInRef.current) return;

    setSaving(true);
    try {
      const clockInTime = clockInRef.current.value;
      const clockOutTime = clockOutRef.current?.value || null;

      // Convert local datetime to UTC for storage
      const utcClockInTime = new Date(clockInTime).toISOString();
      const utcClockOutTime = clockOutTime ? new Date(clockOutTime).toISOString() : null;

      // Update the job's overall times
      const response = await fetch(buildApiUrl(`/api/admin/cleans/${editingClean.jobId}`), {
        method: "PUT",
        headers: {
          "Content-Type": "application/json"
        },
        credentials: "include",
        body: JSON.stringify({
          clockInTime: utcClockInTime,
          clockOutTime: utcClockOutTime
        })
      });

      if (response.ok) {
        // Refresh the dashboard data to show updated times
        await fetchDashboardData();
        setEditingClean(null);
      } else {
        const errorData = await response.json();
        console.error("Failed to update clean times:", errorData.error);
        alert("Failed to update clean times: " + errorData.error);
      }
    } catch (error) {
      console.error("Error updating clean times:", error);
      alert("Error updating clean times. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleEndClean = async (jobId: number) => {
    if (!confirm("Are you sure you want to end this clean? This will end the clean for all team members.")) {
      return;
    }

    setSaving(true);
    try {
      const response = await fetch(buildApiUrl("/api/admin/cleans/end-active"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        credentials: "include",
        body: JSON.stringify({
          jobId
        })
      });

      if (response.ok) {
        // Refresh the dashboard data to show updated times
        await fetchDashboardData();
      } else {
        const errorData = await response.json();
        console.error("Failed to end clean:", errorData.error);
        alert("Failed to end clean: " + errorData.error);
      }
    } catch (error) {
      console.error("Error ending clean:", error);
      alert("Error ending clean. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-600">Loading...</div>
      </div>
    );
  }

    return (
    <AdminLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="mb-6">
          <div className="flex flex-col space-y-4">
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-2xl font-bold text-gray-900">
                  Admin Dashboard
                </h1>
                <div className="flex items-center space-x-1 text-xs bg-gray-50 px-2 py-1 rounded-full">
                  <div className={`w-2 h-2 rounded-full ${
                    isUpdating ? 'bg-blue-500 animate-pulse' : 
                    sseConnected ? 'bg-green-500' : 
                    'bg-yellow-500'
                  }`}></div>
                  <span className={`font-medium ${
                    isUpdating ? 'text-blue-600' : 
                    sseConnected ? 'text-green-600' : 
                    'text-yellow-600'
                  }`}>
                    {isUpdating ? 'Updating...' : 
                     sseConnected ? 'Live' : 
                     connectionAttempts > 0 ? 'Polling' : 'Connecting...'}
                  </span>
                </div>
              </div>
              <p className="mt-1 text-sm text-gray-600">
                Monitor active cleans, view completed jobs, and manage your team.
              </p>
            </div>
            {/* Date Filter Controls */}
            <div className="mb-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
                <div className="flex items-center space-x-4">
                  <div className="flex items-center space-x-2">
                    <label className="text-sm font-medium text-gray-700">Date Range:</label>
                    <select
                      value={dateFilter}
                      onChange={(e) => {
                        const newFilter = e.target.value as 'today' | 'yesterday' | 'thisWeek' | 'lastWeek' | 'custom';
                        setDateFilter(newFilter);
                        
                        // Automatically apply non-custom filters
                        if (newFilter !== 'custom') {
                          setAppliedDateFilter(newFilter);
                          setAppliedCustomRange(customRange); // Keep existing custom range for when switching back
                        }
                      }}
                      className="border border-gray-300 rounded-md px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="today">Today</option>
                      <option value="yesterday">Yesterday</option>
                      <option value="thisWeek">This Week</option>
                      <option value="lastWeek">Last Week</option>
                      <option value="custom">Custom Range</option>
                    </select>
                  </div>
                  
                  {dateFilter === 'custom' && (
                    <div className="flex items-center space-x-2">
                      <input
                        type="date"
                        value={customRange.start}
                        onChange={(e) => setCustomRange({ ...customRange, start: e.target.value })}
                        className="border border-gray-300 rounded-md px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                      <span className="text-gray-500">to</span>
                      <input
                        type="date"
                        value={customRange.end}
                        onChange={(e) => setCustomRange({ ...customRange, end: e.target.value })}
                        className="border border-gray-300 rounded-md px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                  )}
                  
                  {dateFilter === 'custom' && (
                    <button
                      onClick={() => {
                        setAppliedDateFilter(dateFilter);
                        setAppliedCustomRange(customRange);
                      }}
                      className="inline-flex items-center px-3 py-1 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                    >
                      Apply Filter
                    </button>
                  )}
                </div>
                

              </div>
            </div>
          </div>
        </div>
          {/* Stats Overview */}
          <div className="mb-8">
            {/* Small screens: Horizontal scrolling */}
            <div className="flex sm:hidden overflow-x-auto pb-4 space-x-4 snap-x snap-mandatory w-screen -mx-4 sm:-mx-6 lg:-mx-8">
            
            <div className="rounded-lg text-card-foreground bg-white shadow-lg border-0 hover:shadow-xl transition-shadow flex-shrink-0 w-80 max-w-[85vw] snap-start">
              <div className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-base font-medium text-gray-600">On Time Target</p>
                    <p className={`text-3xl font-bold ${stats?.efficiency && stats.efficiency >= 100 ? 'text-green-600' : stats?.efficiency && stats.efficiency >= 80 ? 'text-yellow-600' : 'text-red-600'}`}>
                      {stats?.efficiency || 0}%
                    </p>
                    <p className={`text-base font-medium ${stats?.efficiency && stats.efficiency >= 100 ? 'text-green-600' : stats?.efficiency && stats.efficiency >= 80 ? 'text-yellow-600' : 'text-red-600'}`}>
                      {stats?.efficiency && stats.efficiency >= 100 ? 'Excellent' : stats?.efficiency && stats.efficiency >= 80 ? 'Good' : 'Needs attention'}
                    </p>
                  </div>
                  <div className={`p-3 rounded-full ${stats?.efficiency && stats.efficiency >= 100 ? 'bg-green-100' : stats?.efficiency && stats.efficiency >= 80 ? 'bg-yellow-100' : 'bg-red-100'}`}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`h-7 w-7 ${stats?.efficiency && stats.efficiency >= 100 ? 'text-green-600' : stats?.efficiency && stats.efficiency >= 80 ? 'text-yellow-600' : 'text-red-600'}`}>
                      <polyline points="22 7 13.5 15.5 8.5 10.5 2 17"></polyline>
                      <polyline points="16 7 22 7 22 13"></polyline>
                    </svg>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="rounded-lg text-card-foreground bg-white shadow-lg border-0 hover:shadow-xl transition-shadow flex-shrink-0 w-80 max-w-[85vw] snap-start">
              <div className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-base font-medium text-gray-600">Revenue</p>
                    <p className="text-3xl font-bold text-gray-900">${stats?.revenue || 0}</p>
                    <p className="text-base text-orange-600 font-medium">
                      {dateFilter === 'today' ? "Today's total" : 
                       dateFilter === 'yesterday' ? "Yesterday's total" : 
                       "This week's total"}
                    </p>
                  </div>
                  <div className="p-3 rounded-full bg-orange-100">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-dollar-sign h-7 w-7 text-orange-600">
                      <line x1="12" x2="12" y1="1" y2="23"></line>
                      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
                    </svg>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="rounded-lg text-card-foreground bg-white shadow-lg border-0 hover:shadow-xl transition-shadow flex-shrink-0 w-80 max-w-[85vw] snap-start">
              <div className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-base font-medium text-gray-600">Wage Ratio</p>
                    <p className={`text-3xl font-bold ${stats?.wageRatio && stats.wageRatio <= 55 ? 'text-green-600' : stats?.wageRatio && stats.wageRatio <= 60 ? 'text-yellow-600' : stats?.wageRatio && stats.wageRatio <= 65 ? 'text-orange-600' : stats?.wageRatio && stats.wageRatio <= 70 ? 'text-red-600' : stats?.wageRatio && stats.wageRatio <= 75 ? 'text-red-700' : 'text-red-800'}`}>
                      {stats?.wageRatio || 0}%
                    </p>
                    <p className={`text-base font-medium ${stats?.wageRatio && stats.wageRatio <= 55 ? 'text-green-600' : stats?.wageRatio && stats.wageRatio <= 60 ? 'text-yellow-600' : stats?.wageRatio && stats.wageRatio <= 65 ? 'text-orange-600' : stats?.wageRatio && stats.wageRatio <= 70 ? 'text-red-600' : stats?.wageRatio && stats.wageRatio <= 75 ? 'text-red-700' : 'text-red-800'}`}>
                      {stats?.wageRatio && stats.wageRatio <= 55 ? 'On Target' : stats?.wageRatio && stats.wageRatio <= 60 ? 'OK' : stats?.wageRatio && stats.wageRatio <= 65 ? 'High' : stats?.wageRatio && stats.wageRatio <= 70 ? 'Very High' : stats?.wageRatio && stats.wageRatio <= 75 ? 'Critical' : 'Extreme'}
                    </p>
                  </div>
                  <div className={`p-3 rounded-full ${stats?.wageRatio && stats.wageRatio <= 55 ? 'bg-green-100' : stats?.wageRatio && stats.wageRatio <= 60 ? 'bg-yellow-100' : stats?.wageRatio && stats.wageRatio <= 65 ? 'bg-orange-100' : stats?.wageRatio && stats.wageRatio <= 70 ? 'bg-red-100' : stats?.wageRatio && stats.wageRatio <= 75 ? 'bg-red-200' : 'bg-red-300'}`}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`h-7 w-7 ${stats?.wageRatio && stats.wageRatio <= 55 ? 'text-green-600' : stats?.wageRatio && stats.wageRatio <= 60 ? 'text-yellow-600' : stats?.wageRatio && stats.wageRatio <= 65 ? 'text-orange-600' : stats?.wageRatio && stats.wageRatio <= 70 ? 'text-red-600' : stats?.wageRatio && stats.wageRatio <= 75 ? 'text-red-700' : 'text-red-800'}`}>
                      <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
                    </svg>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          {/* Small screens and up: Grid layout */}
          <div className="hidden sm:grid sm:grid-cols-2 xl:grid-cols-3 gap-4 lg:gap-6">
          
          <div className="rounded-lg text-card-foreground bg-white shadow-lg border-0 hover:shadow-xl transition-shadow">
            <div className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-base font-medium text-gray-600">On Time Target</p>
                  <p className={`text-3xl font-bold ${stats?.efficiency && stats.efficiency >= 100 ? 'text-green-600' : stats?.efficiency && stats.efficiency >= 80 ? 'text-yellow-600' : 'text-red-600'}`}>
                    {stats?.efficiency || 0}%
                  </p>
                  <p className={`text-base font-medium ${stats?.efficiency && stats.efficiency >= 100 ? 'text-green-600' : stats?.efficiency && stats.efficiency >= 80 ? 'text-yellow-600' : 'text-red-600'}`}>
                    {stats?.efficiency && stats.efficiency >= 100 ? 'Excellent' : stats?.efficiency && stats.efficiency >= 80 ? 'Good' : 'Needs attention'}
                  </p>
                </div>
                <div className={`p-3 rounded-full ${stats?.efficiency && stats.efficiency >= 100 ? 'bg-green-100' : stats?.efficiency && stats.efficiency >= 80 ? 'bg-yellow-100' : 'bg-red-100'}`}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`h-7 w-7 ${stats?.efficiency && stats.efficiency >= 100 ? 'text-green-600' : stats?.efficiency && stats.efficiency >= 80 ? 'text-yellow-600' : 'text-red-600'}`}>
                    <polyline points="22 7 13.5 15.5 8.5 10.5 2 17"></polyline>
                    <polyline points="16 7 22 7 22 13"></polyline>
                  </svg>
                </div>
              </div>
            </div>
          </div>
          
          <div className="rounded-lg text-card-foreground bg-white shadow-lg border-0 hover:shadow-xl transition-shadow">
            <div className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-base font-medium text-gray-600">Revenue</p>
                  <p className="text-3xl font-bold text-gray-900">${stats?.revenue || 0}</p>
                  <p className="text-base text-orange-600 font-medium">
                    {dateFilter === 'today' ? "Today's total" : 
                     dateFilter === 'yesterday' ? "Yesterday's total" : 
                     "This week's total"}
                  </p>
                </div>
                <div className="p-3 rounded-full bg-orange-100">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-dollar-sign h-7 w-7 text-orange-600">
                    <line x1="12" x2="12" y1="1" y2="23"></line>
                    <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
                  </svg>
                </div>
              </div>
            </div>
          </div>
          
          <div className="rounded-lg text-card-foreground bg-white shadow-lg border-0 hover:shadow-xl transition-shadow">
            <div className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-base font-medium text-gray-600">Wage Ratio</p>
                  <p className={`text-3xl font-bold ${stats?.wageRatio && stats.wageRatio <= 55 ? 'text-green-600' : stats?.wageRatio && stats.wageRatio <= 60 ? 'text-yellow-600' : stats?.wageRatio && stats.wageRatio <= 65 ? 'text-orange-600' : stats?.wageRatio && stats.wageRatio <= 70 ? 'text-red-600' : stats?.wageRatio && stats.wageRatio <= 75 ? 'text-red-700' : 'text-red-800'}`}>
                    {stats?.wageRatio || 0}%
                  </p>
                  <p className={`text-base font-medium ${stats?.wageRatio && stats.wageRatio <= 55 ? 'text-green-600' : stats?.wageRatio && stats.wageRatio <= 60 ? 'text-yellow-600' : stats?.wageRatio && stats.wageRatio <= 65 ? 'text-orange-600' : stats?.wageRatio && stats.wageRatio <= 70 ? 'text-red-600' : stats?.wageRatio && stats.wageRatio <= 75 ? 'text-red-700' : 'text-red-800'}`}>
                    {stats?.wageRatio && stats.wageRatio <= 55 ? 'On Target' : stats?.wageRatio && stats.wageRatio <= 60 ? 'OK' : stats?.wageRatio && stats.wageRatio <= 65 ? 'High' : stats?.wageRatio && stats.wageRatio <= 70 ? 'Very High' : stats?.wageRatio && stats.wageRatio <= 75 ? 'Critical' : 'Extreme'}
                  </p>
                </div>
                <div className={`p-3 rounded-full ${stats?.wageRatio && stats.wageRatio <= 55 ? 'bg-green-100' : stats?.wageRatio && stats.wageRatio <= 60 ? 'bg-yellow-100' : stats?.wageRatio && stats.wageRatio <= 65 ? 'bg-orange-100' : stats?.wageRatio && stats.wageRatio <= 70 ? 'bg-red-100' : stats?.wageRatio && stats.wageRatio <= 75 ? 'bg-red-200' : 'bg-red-300'}`}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`h-7 w-7 ${stats?.wageRatio && stats.wageRatio <= 55 ? 'text-green-600' : stats?.wageRatio && stats.wageRatio <= 60 ? 'text-yellow-600' : stats?.wageRatio && stats.wageRatio <= 65 ? 'text-orange-600' : stats?.wageRatio && stats.wageRatio <= 70 ? 'text-red-600' : stats?.wageRatio && stats.wageRatio <= 75 ? 'text-red-700' : 'text-red-800'}`}>
                    <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
                  </svg>
                </div>
              </div>
            </div>
          </div>
        </div>
        </div>

        {/* Active Cleans */}
        <div className="rounded-lg text-card-foreground bg-white shadow-lg border-0 mt-6">
          <div className="flex flex-col space-y-1.5 p-6">
            <div className="font-semibold tracking-tight flex items-center text-xl">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-activity h-6 w-6 mr-2 text-blue-500">
                <path d="M22 12h-2.48a2 2 0 0 0-1.93 1.46l-2.35 8.36a.25.25 0 0 1-.48 0L9.24 2.18a.25.25 0 0 0-.48 0l-2.35 8.36A2 2 0 0 1 4.49 12H2"></path>
              </svg>
              Active Cleans ({filterCleansByDate(activeCleans, dateFilter).length})
            </div>
          </div>
          <div className="p-6 pt-0">
            <div className="space-y-4">
              {filterCleansByDate(activeCleans, dateFilter).length === 0 ? (
                <div className="text-center text-gray-500 py-8">No active cleans for selected date range</div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                  {filterCleansByDate(activeCleans, dateFilter).map((clean) => (
                    <div key={clean.jobId} className="bg-gray-50 rounded-lg shadow-md p-6 transition-all duration-300 ease-in-out hover:shadow-lg">
                      <div className="flex justify-between items-start mb-1">
                        <div className="flex-1">
                          <h3 className="text-lg font-semibold text-gray-900 mb-1">
                            {clean.customerName}
                          </h3>
                          <div className="flex items-start space-x-2 mb-2">
                            <svg className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                            <p className="text-sm text-gray-600">
                              {formatAddress(clean.customerAddress)}
                            </p>
                          </div>
                          <div className="flex items-center space-x-2 mb-2">
                            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <p className="text-sm text-gray-500">
                              Started: {new Date(clean.clockInTime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
                            </p>
                          </div>
                        </div>
                        <div className="flex flex-col space-y-2">
                          <button
                            onClick={() => setEditingClean(clean)}
                            className="inline-flex items-center p-2 border border-gray-300 rounded text-sm text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                            title="Edit Clean"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                        </div>
                      </div>
                      {/* Team/Staff info at bottom */}
                      <div className="border-t border-gray-200 pt-4 mt-4">
                        <div className="flex items-center space-x-2">
                          <div 
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: clean.teamColor }}
                          />
                          <span
                            className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
                            style={{ backgroundColor: clean.teamColor + '20', color: clean.teamColor }}
                          >
                            {clean.teamName}
                          </span>
                          {/* Show core team members in team color */}
                          {clean.members && clean.members.filter(m => m.isCoreTeam).map((member) => (
                            <span
                              key={member.id}
                              className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
                              style={{ backgroundColor: clean.teamColor + '20', color: clean.teamColor }}
                            >
                              {member.name}
                            </span>
                          ))}
                          {/* Show additional staff with + prefix */}
                          {clean.members && clean.members.filter(m => !m.isCoreTeam).map((member) => (
                            <span
                              key={member.id}
                              className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
                              style={{ backgroundColor: (member.teamColor || '#888') + '20', color: member.teamColor || '#888' }}
                            >
                              + {member.name}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Completed Cleans */}
        <div className="rounded-lg text-card-foreground bg-white shadow-lg border-0 mt-6">
          <div className="flex flex-col space-y-1.5 p-6">
            <div className="font-semibold tracking-tight flex items-center text-xl">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-circle-check-big h-6 w-6 mr-2 text-green-500">
                <path d="M21.801 10A10 10 0 1 1 17 3.335"></path>
                <path d="m9 11 3 3L22 4"></path>
              </svg>
              Completed Cleans ({completedCleans.length})
            </div>
          </div>
          <div className="p-6 pt-0">
            <div className="space-y-4">
              {completedCleans.length === 0 ? (
                <div className="text-center text-gray-500 py-8">No completed cleans for selected date range</div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                  {completedCleans.map((clean) => (
                    <div key={clean.jobId} className="bg-gray-50 rounded-lg shadow-md p-6 transition-all duration-300 ease-in-out hover:shadow-lg">
                      <div className="flex justify-between items-start mb-1">
                        <div className="flex-1">
                          <h3 className="text-lg font-semibold text-gray-900 mb-1">
                            {clean.customerName}
                          </h3>
                          <div className="flex items-start space-x-2 mb-2">
                            <svg className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                            <p className="text-sm text-gray-600">
                              {formatAddress(clean.customerAddress)}
                            </p>
                          </div>
                          <div className="flex items-center space-x-2 mb-2">
                            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <div className="text-sm text-gray-500">
                              {new Date(clean.clockInTime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })} - {clean.clockOutTime ? new Date(clean.clockOutTime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }) : 'In Progress'}
                              {clean.timeDifferenceMinutes !== undefined && (
                                <span className={`ml-2 text-xs font-medium ${
                                  clean.timeDifferenceMinutes === 0 
                                    ? 'text-gray-500' 
                                    : clean.timeDifferenceMinutes > 0 
                                      ? 'text-red-600' 
                                      : 'text-green-600'
                                }`}>
                                  {formatTimeDifference(clean.timeDifferenceMinutes)}
                                </span>
                              )}
                              {/* Date on its own row */}
                              {clean.clockInTime && (
                                <div className="text-xs text-gray-400 mt-1">
                                  {new Date(clean.clockInTime).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                                </div>
                              )}
                            </div>
                          </div>
                          {/* Price and Wage Ratio Display */}
                          <div className="flex items-center space-x-2 mb-2">
                            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                            </svg>
                            <p className="text-sm text-gray-500">
                              ${clean.price}
                              {clean.isFriendsFamily && (
                                <span className="text-black-500"> for Friends & Family</span>
                              )}
                              {clean.wageRatio !== undefined && clean.wageRatio > 0 && (
                                <span>
                                  {" "}at <span className={getWageRatioStatus(clean.wageRatio).color}>{clean.wageRatio}%</span> Wage Ratio
                                </span>
                              )}
                            </p>
                          </div>
                          {/* Team/Staff info moved to bottom */}
                        </div>
                        <button
                          onClick={() => setEditingClean(clean)}
                          className="inline-flex items-center p-2 border border-gray-300 rounded text-sm text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                          title="Edit Clean"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                      </div>
                      {/* Team/Staff info at bottom */}
                      <div className="border-t border-gray-200 pt-4 mt-4">
                        <div className="flex items-center space-x-2">
                          <span
                            className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
                            style={{ backgroundColor: clean.teamColor + '20', color: clean.teamColor }}
                          >
                            {clean.teamName}
                          </span>
                          {/* Show core team members in team color */}
                          {clean.members && clean.members.filter(m => m.isCoreTeam).map((member) => (
                            <span
                              key={member.id}
                              className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
                              style={{ backgroundColor: clean.teamColor + '20', color: clean.teamColor }}
                            >
                              {member.name}
                            </span>
                          ))}
                          {/* Show additional staff with + prefix */}
                          {clean.members && clean.members.filter(m => !m.isCoreTeam).map((member) => (
                            <span
                              key={member.id}
                              className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
                              style={{ backgroundColor: (member.teamColor || '#888') + '20', color: member.teamColor || '#888' }}
                            >
                              + {member.name}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Customer Locations */}
        <div className="rounded-lg text-card-foreground bg-white shadow-lg border-0 mt-6">
          <div className="flex flex-col space-y-1.5 p-6">
            <div className="font-semibold tracking-tight flex items-center text-xl">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-map-pin h-6 w-6 mr-2 text-blue-500">
                <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"></path>
                <circle cx="12" cy="10" r="3"></circle>
              </svg>
              Customer Locations
            </div>
          </div>
          <div className="p-6 pt-0">
            <AdminDashboardMap 
              customers={[
                ...activeCleans.map(clean => ({
                  id: clean.jobId,
                  name: clean.customerName,
                  address: clean.customerAddress,
                  latitude: clean.customerLatitude || '',
                  longitude: clean.customerLongitude || '',
                  teamColor: clean.teamColor,
                  status: 'active' as const
                })),
                ...completedCleans.map(clean => ({
                  id: clean.jobId,
                  name: clean.customerName,
                  address: clean.customerAddress,
                  latitude: clean.customerLatitude || '',
                  longitude: clean.customerLongitude || '',
                  teamColor: clean.teamColor,
                  status: 'completed' as const
                }))
              ]}
              className="w-full"
            />
          </div>
        </div>
      </div>



      {/* Edit Clean Modal */}
      {editingClean && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md relative">
            <button
              onClick={() => setEditingClean(null)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              Edit Clean Times
            </h3>
            
            <div className="space-y-4">
              <div>
                <p className="text-sm font-medium text-gray-700 mb-2">
                  Customer: {editingClean.customerName}
                </p>
                <p className="text-sm text-gray-500 mb-4">
                  Team: {editingClean.teamName}
                </p>
                <div className="mb-4">
                  <p className="text-sm text-gray-600 font-medium">Team Members:</p>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {editingClean.members.map((member) => (
                      <span 
                        key={member.id}
                        className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-800"
                      >
                        {member.name}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Start Time
                </label>
                <input
                  ref={clockInRef}
                  type="datetime-local"
                  defaultValue={toLocalDateTimeString(editingClean.clockInTime)}
                  className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  End Time
                </label>
                <input
                  ref={clockOutRef}
                  type="datetime-local"
                  defaultValue={editingClean.clockOutTime ? toLocalDateTimeString(editingClean.clockOutTime) : ""}
                  className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                  placeholder="Leave empty for active cleans"
                />
              </div>
              
              <div className="flex justify-between pt-4">
                <div className="flex space-x-3">
                  {!editingClean.clockOutTime && (
                    <button
                      type="button"
                      onClick={() => handleEndClean(editingClean.jobId)}
                      disabled={saving}
                      className="inline-flex items-center px-4 py-2 text-sm text-white bg-green-600 rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Complete Clean
                    </button>
                  )}
                </div>
                <div className="flex space-x-3">
                  <button
                    type="button"
                    onClick={() => setEditingClean(null)}
                    className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={saveCleanTimes}
                    disabled={saving}
                    className="px-4 py-2 text-sm text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {saving ? "Saving..." : "Save Changes"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
} 