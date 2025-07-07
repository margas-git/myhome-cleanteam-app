import React, { useState, useEffect } from "react";
import { AdminLayout } from "../../components/AdminLayout";
import { buildApiUrl } from "../../config/api";

interface LunchBreakDebug {
  hasOverride: boolean;
  overrideValue: boolean | null;
  rules: {
    minHours: number;
    actualHours: number;
    minJobs: number;
    actualJobs: number;
    startTime: string;
    finishTime: string;
    actualStartTime: string | null;
    actualFinishTime: string | null;
  };
  conditions: Array<{
    name: string;
    passed: boolean;
    description: string;
  }>;
}

interface TimesheetData {
  staffName: string;
  monday: { hours: number; jobs: number; lunchBreak: boolean; startTime: string | null; endTime: string | null; lunchBreakDebug?: LunchBreakDebug };
  tuesday: { hours: number; jobs: number; lunchBreak: boolean; startTime: string | null; endTime: string | null; lunchBreakDebug?: LunchBreakDebug };
  wednesday: { hours: number; jobs: number; lunchBreak: boolean; startTime: string | null; endTime: string | null; lunchBreakDebug?: LunchBreakDebug };
  thursday: { hours: number; jobs: number; lunchBreak: boolean; startTime: string | null; endTime: string | null; lunchBreakDebug?: LunchBreakDebug };
  friday: { hours: number; jobs: number; lunchBreak: boolean; startTime: string | null; endTime: string | null; lunchBreakDebug?: LunchBreakDebug };
  saturday: { hours: number; jobs: number; lunchBreak: boolean; startTime: string | null; endTime: string | null; lunchBreakDebug?: LunchBreakDebug };
  sunday: { hours: number; jobs: number; lunchBreak: boolean; startTime: string | null; endTime: string | null; lunchBreakDebug?: LunchBreakDebug };
  totalHours: number;
  totalJobs: number;
}

interface ReportData {
  timesheets: {
    weekly: TimesheetData[];
    stats: {
      totalHours: number;
      totalJobs: number;
    };
  };
  customerAnalytics: {
    averageTimePerJob: number;
    totalJobs: number;
    totalRevenue: number;
    topCustomers: any[];
  };
  staffPerformance: {
    efficiency: number;
    overtimeHours: number;
    topPerformers: any[];
  };
  financial: {
    revenue: number;
    costs: number;
    profit: number;
    monthlyTrend: any[];
  };
}

// Helper to format 24h time string to 12h AM/PM
function formatTo12Hour(timeStr: string | undefined) {
  if (!timeStr) return '';
  const [hour, minute] = timeStr.split(':').map(Number);
  if (isNaN(hour) || isNaN(minute)) return timeStr;
  const date = new Date();
  date.setHours(hour, minute, 0, 0);
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}

export function Reports() {
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<'week' | 'month' | 'quarter'>('week');
  const [weekFilter, setWeekFilter] = useState<'thisWeek' | 'lastWeek'>('thisWeek');
  const [activeTab, setActiveTab] = useState<'timesheets' | 'customers' | 'staff' | 'financial'>('timesheets');
  const [expandedStaff, setExpandedStaff] = useState<Set<string>>(new Set());
  const [tempLunchBreakOverrides, setTempLunchBreakOverrides] = useState<Map<string, boolean>>(new Map());
  const [updatingLunchBreak, setUpdatingLunchBreak] = useState<Set<string>>(new Set());
  const [lunchBreakSettings, setLunchBreakSettings] = useState<{ minHours: number; durationMinutes: number; startTime: string; finishTime: string } | null>(null);

  useEffect(() => {
    fetchReportData();
    fetchLunchBreakSettings();
  }, [dateRange, weekFilter]);

  // Listen for settings updates and refresh timesheet data
  useEffect(() => {
    const handleSettingsUpdate = () => {
      if (activeTab === 'timesheets') {
        fetchTimesheetData();
      }
    };

    window.addEventListener('settingsUpdated', handleSettingsUpdate);
    
    return () => {
      window.removeEventListener('settingsUpdated', handleSettingsUpdate);
    };
  }, [activeTab]);

  const fetchLunchBreakSettings = async () => {
    try {
      const res = await fetch(buildApiUrl('/api/admin/settings/lunch-break'), {
        credentials: 'include'
      });
      const data = await res.json();
      if (res.ok) {
        setLunchBreakSettings(data.data); // Access the data property
      } else {
        // Handle error silently
      }
    } catch (err) {
      // Handle error silently
    }
  };

  const fetchTimesheetData = async () => {
    try {
      const res = await fetch(buildApiUrl(`/api/admin/reports/timesheets?weekFilter=${weekFilter}`), {
        credentials: 'include'
      });
      const data = await res.json();
      if (res.ok) {
        // The API returns { success: true, data: { weekly: [...], stats: {...} } }
        // We need to set it as the timesheets property
        setReportData(prev => prev ? { ...prev, timesheets: data.data } : { timesheets: data.data } as ReportData);
      } else {
        setError(data.error || 'Failed to fetch timesheet data');
      }
    } catch (err) {
      setError('Failed to fetch timesheet data');
    }
  };

  const fetchReportData = async () => {
    try {
      setLoading(true);
      
      if (activeTab === 'timesheets') {
        await fetchTimesheetData();
      } else {
        // TODO: Replace with actual API calls for other tabs
        // For now, using mock data
        const mockData: ReportData = {
          timesheets: {
            weekly: [],
            stats: {
              totalHours: 0,
              totalJobs: 0
            }
          },
          customerAnalytics: {
            averageTimePerJob: 2.5,
            totalJobs: 142,
            totalRevenue: 35500,
            topCustomers: [
              { name: "ABC Corp", jobs: 25, revenue: 6250, avgTime: 2.2 },
              { name: "XYZ Ltd", jobs: 18, revenue: 4500, avgTime: 2.8 },
              { name: "123 Industries", jobs: 15, revenue: 3750, avgTime: 2.1 }
            ]
          },
          staffPerformance: {
            efficiency: 87,
            overtimeHours: 28,
            topPerformers: [
              { name: "Mike Wilson", efficiency: 92, jobsCompleted: 72, avgTime: 2.1 },
              { name: "John Smith", efficiency: 88, jobsCompleted: 62, avgTime: 2.3 },
              { name: "Sarah Johnson", efficiency: 85, jobsCompleted: 48, avgTime: 2.4 }
            ]
          },
          financial: {
            revenue: 35500,
            costs: 28400,
            profit: 7100,
            monthlyTrend: [
              { month: "Jan", revenue: 32000, costs: 25600, profit: 6400 },
              { month: "Feb", revenue: 33500, costs: 26800, profit: 6700 },
              { month: "Mar", revenue: 35500, costs: 28400, profit: 7100 }
            ]
          }
        };
        
        setReportData(mockData);
      }
    } catch (error) {
      // Handle error silently
    } finally {
      setLoading(false);
    }
  };

  const toggleStaffExpanded = (staffName: string) => {
    const newExpanded = new Set(expandedStaff);
    if (newExpanded.has(staffName)) {
      newExpanded.delete(staffName);
    } else {
      newExpanded.add(staffName);
    }
    setExpandedStaff(newExpanded);
  };

  const getDayData = (staff: TimesheetData, day: string) => {
    const dayData = staff[day as keyof typeof staff] as { hours: number; jobs: number; lunchBreak: boolean; startTime: string | null; endTime: string | null; lunchBreakDebug?: LunchBreakDebug };
    
    // Check for temporary override
    const overrideKey = `${staff.staffName}-${day}`;
    const hasOverride = tempLunchBreakOverrides.has(overrideKey);
    const overrideValue = tempLunchBreakOverrides.get(overrideKey);
    
    // Use override if it exists, otherwise use original data
    const finalLunchBreak = hasOverride ? overrideValue! : dayData.lunchBreak;
    
    // Calculate hours with lunch break adjustment
    let adjustedHours = dayData.hours;
    
    // If there's a temporary override, we need to recalculate the hours
    if (hasOverride) {
      // The original hours from the backend already include the lunch break deduction if it was applied
      // So we need to reverse the original calculation and apply the new one
      
      // If the original data had a lunch break but our override doesn't, add back 0.5 hours
      if (dayData.lunchBreak && !finalLunchBreak) {
        adjustedHours += 0.5; // Add back 30 minutes
      }
      // If the original data didn't have a lunch break but our override does, subtract 0.5 hours
      else if (!dayData.lunchBreak && finalLunchBreak) {
        adjustedHours -= 0.5; // Subtract 30 minutes
      }
    }
    
    // Round to 2 decimal places
    adjustedHours = Math.round(adjustedHours * 100) / 100;
    
    return {
      hours: adjustedHours,
      jobs: dayData.jobs,
      lunchBreak: finalLunchBreak,
      startTime: dayData.startTime || '-',
      endTime: dayData.endTime || '-',
      lunchBreakDebug: dayData.lunchBreakDebug
    };
  };

  const getAdjustedTotalHours = (staff: TimesheetData) => {
    let totalHours = 0;
    const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    
    days.forEach(day => {
      const dayData = getDayData(staff, day);
      totalHours += dayData.hours;
    });
    
    return Math.round(totalHours * 100) / 100;
  };

  const handleLunchBreakToggle = async (staffName: string, day: string, newValue: boolean) => {
    const updateKey = `${staffName}-${day}`;
    setUpdatingLunchBreak(prev => new Set(prev).add(updateKey));
    
    try {
      // Get the date for the specific day of the week
      const today = new Date();
      const dayOfWeek = today.getDay(); // 0 = Sunday, 1 = Monday, etc.
      const dayMap = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
      const targetDayIndex = dayMap.indexOf(day);
      
      // Calculate the date for the target day of the current week
      const daysDiff = targetDayIndex - dayOfWeek;
      const targetDate = new Date(today);
      targetDate.setDate(today.getDate() + daysDiff);
      
      const response = await fetch('/api/admin/timesheets/lunch-break', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          staffName,
          date: targetDate.toISOString().split('T')[0], // YYYY-MM-DD format
          hasLunchBreak: newValue
        })
      });

      if (response.ok) {
        // Set temporary override for immediate visual feedback
        const overrideKey = `${staffName}-${day}`;
        setTempLunchBreakOverrides(prev => {
          const newMap = new Map(prev);
          newMap.set(overrideKey, newValue);
          return newMap;
        });
      } else {
        // Revert the override if the API call fails
        setTempLunchBreakOverrides(prev => {
          const newMap = new Map(prev);
          newMap.delete(`${staffName}-${day}`);
          return newMap;
        });
        alert('Failed to update lunch break override. Please try again.');
      }
    } catch (error) {
      // Handle error silently
    } finally {
      setUpdatingLunchBreak(prev => {
        const newSet = new Set(prev);
        newSet.delete(updateKey);
        return newSet;
      });
    }
  };

  const tabs = [
    { id: 'timesheets', name: 'Timesheets', icon: '📋' },
    { id: 'customers', name: 'Customer Analytics', icon: '👥' },
    { id: 'staff', name: 'Staff Performance', icon: '👨‍💼' },
    { id: 'financial', name: 'Financial', icon: '💰' }
  ] as const;

  if (loading) {
    return (
      <AdminLayout>
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="text-gray-600">Loading reports...</div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="mb-8">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                Reports & Analytics
              </h1>
              <p className="mt-2 text-gray-600">
                Comprehensive insights into your cleaning operations.
              </p>
            </div>
            <div className="flex items-center space-x-4">
              {activeTab === 'timesheets' && (
                <>
                  <label htmlFor="weekFilter" className="text-sm font-medium text-gray-700">
                    Week:
                  </label>
                  <select
                    id="weekFilter"
                    value={weekFilter}
                    onChange={(e) => setWeekFilter(e.target.value as 'thisWeek' | 'lastWeek')}
                    className="block w-32 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  >
                    <option value="thisWeek">This Week</option>
                    <option value="lastWeek">Last Week</option>
                  </select>
                </>
              )}
              <label htmlFor="dateRange" className="text-sm font-medium text-gray-700">
                Date Range:
              </label>
              <select
                id="dateRange"
                value={dateRange}
                onChange={(e) => setDateRange(e.target.value as 'week' | 'month' | 'quarter')}
                className="block w-32 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              >
                <option value="week">This Week</option>
                <option value="month">This Month</option>
                <option value="quarter">This Quarter</option>
              </select>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="border-b border-gray-200 mb-6">
          <nav className="-mb-px flex space-x-8">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`
                  py-2 px-1 border-b-2 font-medium text-sm flex items-center space-x-2
                  ${activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }
                `}
              >
                <span>{tab.icon}</span>
                <span>{tab.name}</span>
              </button>
            ))}
          </nav>
        </div>

        {/* Report Content */}
        <div className="space-y-6">
          {activeTab === 'timesheets' && (
            <div className="space-y-6">
              {/* Quick Stats - Full Width */}
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Stats</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="text-center">
                    <p className="text-3xl font-bold text-blue-600">
                      {reportData?.timesheets.stats.totalHours || 0}h
                    </p>
                    <p className="text-sm text-gray-500">Total Hours This Week</p>
                  </div>
                  <div className="text-center">
                    <p className="text-3xl font-bold text-green-600">
                      {reportData?.timesheets.stats.totalJobs || 0}
                    </p>
                    <p className="text-sm text-gray-500">Total Jobs</p>
                  </div>
                </div>
              </div>

              {/* Weekly Timesheet - Full Width */}
              <div className="bg-white rounded-lg shadow">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h3 className="text-lg font-semibold text-gray-900">Weekly Timesheet</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Staff Member</th>
                        <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Monday</th>
                        <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Tuesday</th>
                        <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Wednesday</th>
                        <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Thursday</th>
                        <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Friday</th>
                        <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {reportData?.timesheets.weekly.map((staff, index) => {
                        const isExpanded = expandedStaff.has(staff.staffName);
                        return (
                          <React.Fragment key={staff.staffName}>
                            <tr className="hover:bg-gray-50">
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                <div className="flex items-center space-x-2">
                                  <button
                                    onClick={() => toggleStaffExpanded(staff.staffName)}
                                    className="text-gray-400 hover:text-gray-600 transition-transform duration-200"
                                    style={{ transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}
                                  >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                    </svg>
                                  </button>
                                  <span>{staff.staffName}</span>
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-center">
                                <div className="flex items-center justify-center space-x-1">
                                  {(() => {
                                    const dayData = getDayData(staff, 'monday');
                                    return (
                                      <>
                                        <span className={
                                          dayData.hours > 0 && lunchBreakSettings ? (
                                            dayData.hours >= lunchBreakSettings.minHours && dayData.jobs >= 2 ?
                                              '' :
                                              'text-red-600'
                                          ) : ''
                                        }>{dayData.hours > 0 ? `${dayData.hours}h` : '-'}</span>
                                        {dayData.hours > 0 && (
                                          (() => {
                                            if (!lunchBreakSettings) {
                                              return null; // Don't show alerts until settings load
                                            }
                                            
                                            // Check if any sub-row condition failed
                                            const startFailed = dayData.lunchBreakDebug?.conditions?.[2]?.passed === false;
                                            const endFailed = dayData.lunchBreakDebug?.conditions?.[3]?.passed === false;
                                            const cleansFailed = dayData.lunchBreakDebug?.conditions?.[1]?.passed === false;
                                            
                                            // Show alert if any condition failed
                                            if (startFailed || endFailed || cleansFailed) {
                                              return (
                                                <span title="One or more lunch break conditions failed - check expanded details" className="text-red-500">⚠️</span>
                                              );
                                            }
                                            
                                            return null;
                                          })()
                                        )}
                                      </>
                                    );
                                  })()}
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-center">
                                <div className="flex items-center justify-center space-x-1">
                                  {(() => {
                                    const dayData = getDayData(staff, 'tuesday');
                                    return (
                                      <>
                                        <span className={
                                          dayData.hours > 0 && lunchBreakSettings ? (
                                            dayData.hours >= lunchBreakSettings.minHours && dayData.jobs >= 2 ?
                                              '' :
                                              'text-red-600'
                                          ) : ''
                                        }>{dayData.hours > 0 ? `${dayData.hours}h` : '-'}</span>
                                        {dayData.hours > 0 && (
                                          (() => {
                                            if (!lunchBreakSettings) {
                                              return null; // Don't show alerts until settings load
                                            }
                                            
                                            // Check if any sub-row condition failed
                                            const startFailed = dayData.lunchBreakDebug?.conditions?.[2]?.passed === false;
                                            const endFailed = dayData.lunchBreakDebug?.conditions?.[3]?.passed === false;
                                            const cleansFailed = dayData.lunchBreakDebug?.conditions?.[1]?.passed === false;
                                            
                                            // Show alert if any condition failed
                                            if (startFailed || endFailed || cleansFailed) {
                                              return (
                                                <span title="One or more lunch break conditions failed - check expanded details" className="text-red-500">⚠️</span>
                                              );
                                            }
                                            
                                            return null;
                                          })()
                                        )}
                                      </>
                                    );
                                  })()}
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-center">
                                <div className="flex items-center justify-center space-x-1">
                                  {(() => {
                                    const dayData = getDayData(staff, 'wednesday');
                                    return (
                                      <>
                                        <span className={
                                          dayData.hours > 0 && lunchBreakSettings ? (
                                            dayData.hours >= lunchBreakSettings.minHours && dayData.jobs >= 2 ?
                                              '' :
                                              'text-red-600'
                                          ) : ''
                                        }>{dayData.hours > 0 ? `${dayData.hours}h` : '-'}</span>
                                        {dayData.hours > 0 && (
                                          (() => {
                                            if (!lunchBreakSettings) {
                                              return null; // Don't show alerts until settings load
                                            }
                                            
                                            // Check if any sub-row condition failed
                                            const startFailed = dayData.lunchBreakDebug?.conditions?.[2]?.passed === false;
                                            const endFailed = dayData.lunchBreakDebug?.conditions?.[3]?.passed === false;
                                            const cleansFailed = dayData.lunchBreakDebug?.conditions?.[1]?.passed === false;
                                            
                                            // Show alert if any condition failed
                                            if (startFailed || endFailed || cleansFailed) {
                                              return (
                                                <span title="One or more lunch break conditions failed - check expanded details" className="text-red-500">⚠️</span>
                                              );
                                            }
                                            
                                            return null;
                                          })()
                                        )}
                                      </>
                                    );
                                  })()}
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-center">
                                <div className="flex items-center justify-center space-x-1">
                                  {(() => {
                                    const dayData = getDayData(staff, 'thursday');
                                    return (
                                      <>
                                        <span className={
                                          dayData.hours > 0 && lunchBreakSettings ? (
                                            dayData.hours >= lunchBreakSettings.minHours && dayData.jobs >= 2 ?
                                              '' :
                                              'text-red-600'
                                          ) : ''
                                        }>{dayData.hours > 0 ? `${dayData.hours}h` : '-'}</span>
                                        {dayData.hours > 0 && (
                                          (() => {
                                            if (!lunchBreakSettings) {
                                              return null; // Don't show alerts until settings load
                                            }
                                            
                                            // Check if any sub-row condition failed
                                            const startFailed = dayData.lunchBreakDebug?.conditions?.[2]?.passed === false;
                                            const endFailed = dayData.lunchBreakDebug?.conditions?.[3]?.passed === false;
                                            const cleansFailed = dayData.lunchBreakDebug?.conditions?.[1]?.passed === false;
                                            
                                            // Show alert if any condition failed
                                            if (startFailed || endFailed || cleansFailed) {
                                              return (
                                                <span title="One or more lunch break conditions failed - check expanded details" className="text-red-500">⚠️</span>
                                              );
                                            }
                                            
                                            return null;
                                          })()
                                        )}
                                      </>
                                    );
                                  })()}
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-center">
                                <div className="flex items-center justify-center space-x-1">
                                  {(() => {
                                    const dayData = getDayData(staff, 'friday');
                                    return (
                                      <>
                                        <span className={
                                          dayData.hours > 0 && lunchBreakSettings ? (
                                            dayData.hours >= lunchBreakSettings.minHours && dayData.jobs >= 2 ?
                                              '' :
                                              'text-red-600'
                                          ) : ''
                                        }>{dayData.hours > 0 ? `${dayData.hours}h` : '-'}</span>
                                        {dayData.hours > 0 && (
                                          (() => {
                                            if (!lunchBreakSettings) {
                                              return null; // Don't show alerts until settings load
                                            }
                                            
                                            // Check if any sub-row condition failed
                                            const startFailed = dayData.lunchBreakDebug?.conditions?.[2]?.passed === false;
                                            const endFailed = dayData.lunchBreakDebug?.conditions?.[3]?.passed === false;
                                            const cleansFailed = dayData.lunchBreakDebug?.conditions?.[1]?.passed === false;
                                            
                                            // Show alert if any condition failed
                                            if (startFailed || endFailed || cleansFailed) {
                                              return (
                                                <span title="One or more lunch break conditions failed - check expanded details" className="text-red-500">⚠️</span>
                                              );
                                            }
                                            
                                            return null;
                                          })()
                                        )}
                                      </>
                                    );
                                  })()}
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 text-center">
                                {getAdjustedTotalHours(staff)}h
                              </td>
                            </tr>
                            {isExpanded && (
                              <React.Fragment>
                                {/* Lunch Break Row */}
                                <tr key={`${staff.staffName}-lunch`} className="bg-gray-50">
                                  <td className="px-6 py-3 text-sm text-gray-600 font-medium">
                                    <div className="flex items-center">
                                      <div className="w-6"></div>
                                      <span>Lunch Break</span>
                                    </div>
                                  </td>
                                  {['monday', 'tuesday', 'wednesday', 'thursday', 'friday'].map((day) => {
                                    const dayData = getDayData(staff, day);
                                    const updateKey = `${staff.staffName}-${day}`;
                                    const isUpdating = updatingLunchBreak.has(updateKey);
                                    const hasManualOverride = dayData.lunchBreakDebug?.hasOverride;
                                    

                                    
                                    return (
                                      <td key={`${day}-lunch`} className="px-6 py-3 text-center">
                                        <div className="flex items-center justify-center space-x-1">
                                          <label className="flex items-center">
                                            <input
                                              key={`${staff.staffName}-${day}-${dayData.lunchBreak}`}
                                              type="checkbox"
                                              checked={dayData.lunchBreak}
                                              onChange={(e) => {
                                                handleLunchBreakToggle(staff.staffName, day, e.target.checked);
                                              }}
                                              disabled={isUpdating}
                                              className={`rounded border-gray-300 text-orange-600 focus:ring-orange-500 ${
                                                isUpdating ? 'opacity-50 cursor-not-allowed' : ''
                                              }`}
                                            />
                                            {isUpdating && (
                                              <div className="ml-2 w-4 h-4 border-2 border-orange-600 border-t-transparent rounded-full animate-spin"></div>
                                            )}
                                          </label>
                                          {hasManualOverride && (
                                            <svg 
                                              className="w-4 h-4 text-blue-600" 
                                              fill="none" 
                                              stroke="currentColor" 
                                              viewBox="0 0 24 24"
                                            >
                                              <title>Manual override applied</title>
                                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                            </svg>
                                          )}
                                        </div>
                                      </td>
                                    );
                                  })}
                                  <td className="px-6 py-3"></td>
                                </tr>
                                
                                {/* Start Time Row */}
                                <tr key={`${staff.staffName}-start`} className="bg-gray-50">
                                  <td className="px-6 py-3 text-sm text-gray-600 font-medium">
                                    <div className="flex items-center">
                                      <div className="w-6"></div>
                                      <span>Start</span>
                                    </div>
                                  </td>
                                  {['monday', 'tuesday', 'wednesday', 'thursday', 'friday'].map((day) => {
                                    const dayData = getDayData(staff, day);
                                    const failed = dayData.lunchBreakDebug?.conditions?.[2]?.passed === false;
                                    const required = dayData.lunchBreakDebug?.rules?.startTime;
                                    return (
                                      <td key={`${day}-start`} className={`px-6 py-3 text-sm text-center ${failed ? 'text-red-600' : 'text-gray-600'}`}> 
                                        {dayData.startTime}
                                        {failed && required ? (
                                          <>
                                            <br />
                                            <span className="text-xs">(&gt;= {formatTo12Hour(required)})</span>
                                          </>
                                        ) : ''}
                                      </td>
                                    );
                                  })}
                                  <td className="px-6 py-3"></td>
                                </tr>
                                
                                {/* End Time Row */}
                                <tr key={`${staff.staffName}-end`} className="bg-gray-50">
                                  <td className="px-6 py-3 text-sm text-gray-600 font-medium">
                                    <div className="flex items-center">
                                      <div className="w-6"></div>
                                      <span>End</span>
                                    </div>
                                  </td>
                                  {['monday', 'tuesday', 'wednesday', 'thursday', 'friday'].map((day) => {
                                    const dayData = getDayData(staff, day);
                                    const failed = dayData.lunchBreakDebug?.conditions?.[3]?.passed === false;
                                    const required = dayData.lunchBreakDebug?.rules?.finishTime;
                                    return (
                                      <td key={`${day}-end`} className={`px-6 py-3 text-sm text-center ${failed ? 'text-red-600' : 'text-gray-600'}`}> 
                                        {dayData.endTime}
                                        {failed && required ? (
                                          <>
                                            <br />
                                            <span className="text-xs">(&gt;= {formatTo12Hour(required)})</span>
                                          </>
                                        ) : ''}
                                      </td>
                                    );
                                  })}
                                  <td className="px-6 py-3"></td>
                                </tr>
                                
                                {/* Cleans Row */}
                                <tr key={`${index}-cleans`} className="bg-gray-50">
                                  <td className="px-6 py-3 text-sm text-gray-600 font-medium">
                                    <div className="flex items-center">
                                      <div className="w-6"></div>
                                      <span>Cleans</span>
                                    </div>
                                  </td>
                                  {['monday', 'tuesday', 'wednesday', 'thursday', 'friday'].map((day) => {
                                    const dayData = getDayData(staff, day);
                                    const failed = dayData.lunchBreakDebug?.conditions?.[1]?.passed === false;
                                    const required = dayData.lunchBreakDebug?.rules?.minJobs;
                                    return (
                                      <td key={`${day}-jobs`} className={`px-6 py-3 text-sm text-center ${failed ? 'text-red-600' : 'text-gray-600'}`}> 
                                        {dayData.jobs}
                                        {failed && required ? (
                                          <>
                                            <br />
                                            <span className="text-xs">(&gt;= {required})</span>
                                          </>
                                        ) : ''}
                                      </td>
                                    );
                                  })}
                                  <td className="px-6 py-3"></td>
                                </tr>
                              </React.Fragment>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'customers' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                <div className="bg-white rounded-lg shadow p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Average Time</h3>
                  <p className="text-3xl font-bold text-blue-600">{reportData?.customerAnalytics.averageTimePerJob}h</p>
                  <p className="text-sm text-gray-500">per job</p>
                </div>
                <div className="bg-white rounded-lg shadow p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Total Jobs</h3>
                  <p className="text-3xl font-bold text-green-600">{reportData?.customerAnalytics.totalJobs}</p>
                  <p className="text-sm text-gray-500">completed</p>
                </div>
                <div className="bg-white rounded-lg shadow p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Total Revenue</h3>
                  <p className="text-3xl font-bold text-purple-600">${reportData?.customerAnalytics.totalRevenue?.toLocaleString()}</p>
                  <p className="text-sm text-gray-500">this period</p>
                </div>
                <div className="bg-white rounded-lg shadow p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Avg Revenue</h3>
                  <p className="text-3xl font-bold text-orange-600">
                    ${reportData?.customerAnalytics.totalRevenue && reportData?.customerAnalytics.totalJobs 
                      ? Math.round(reportData.customerAnalytics.totalRevenue / reportData.customerAnalytics.totalJobs)
                      : 0}
                  </p>
                  <p className="text-sm text-gray-500">per job</p>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h3 className="text-lg font-semibold text-gray-900">Top Customers</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Customer</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Jobs</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Revenue</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Avg Time</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {reportData?.customerAnalytics.topCustomers.map((customer, index) => (
                        <tr key={index}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{customer.name}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{customer.jobs}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${customer.revenue.toLocaleString()}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{customer.avgTime}h</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'staff' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="bg-white rounded-lg shadow p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Overall Efficiency</h3>
                  <p className="text-3xl font-bold text-green-600">{reportData?.staffPerformance.efficiency}%</p>
                  <p className="text-sm text-gray-500">team average</p>
                </div>
                <div className="bg-white rounded-lg shadow p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Overtime Hours</h3>
                  <p className="text-3xl font-bold text-orange-600">{reportData?.staffPerformance.overtimeHours}h</p>
                  <p className="text-sm text-gray-500">this period</p>
                </div>
                <div className="bg-white rounded-lg shadow p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Active Staff</h3>
                  <p className="text-3xl font-bold text-blue-600">{reportData?.staffPerformance.topPerformers.length}</p>
                  <p className="text-sm text-gray-500">team members</p>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h3 className="text-lg font-semibold text-gray-900">Top Performers</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Staff Member</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Efficiency</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Jobs Completed</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Avg Time</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {reportData?.staffPerformance.topPerformers.map((staff, index) => (
                        <tr key={index}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{staff.name}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{staff.efficiency}%</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{staff.jobsCompleted}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{staff.avgTime}h</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'financial' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="bg-white rounded-lg shadow p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Revenue</h3>
                  <p className="text-3xl font-bold text-green-600">${reportData?.financial.revenue?.toLocaleString()}</p>
                  <p className="text-sm text-gray-500">this period</p>
                </div>
                <div className="bg-white rounded-lg shadow p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Costs</h3>
                  <p className="text-3xl font-bold text-red-600">${reportData?.financial.costs?.toLocaleString()}</p>
                  <p className="text-sm text-gray-500">this period</p>
                </div>
                <div className="bg-white rounded-lg shadow p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Profit</h3>
                  <p className="text-3xl font-bold text-blue-600">${reportData?.financial.profit?.toLocaleString()}</p>
                  <p className="text-sm text-gray-500">this period</p>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h3 className="text-lg font-semibold text-gray-900">Monthly Trend</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Month</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Revenue</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Costs</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Profit</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Margin</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {reportData?.financial.monthlyTrend.map((month, index) => (
                        <tr key={index}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{month.month}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${month.revenue.toLocaleString()}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${month.costs.toLocaleString()}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${month.profit.toLocaleString()}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {Math.round((month.profit / month.revenue) * 100)}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
