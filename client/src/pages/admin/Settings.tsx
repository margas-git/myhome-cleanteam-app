import { useEffect, useState } from "react";
import { AdminLayout } from "../../components/AdminLayout";
import { buildApiUrl } from "../../config/api";

interface PriceTier {
  id: number;
  priceMin: number;
  priceMax: number;
  allottedMinutes: number;
}

interface EditingPriceTier {
  id: number;
  priceMin: string;
  priceMax: string;
  allottedMinutes: string;
}

interface LunchBreakSettings {
  minHours: number;
  durationMinutes: number;
  startTime: string;
  finishTime: string;
}

interface StaffPayRateSettings {
  payRatePerHour: number;
}

interface GeolocationRadiusSettings {
  radiusMeters: number;
}

interface TimesheetSettings {
  staffStartTime: string;
  payRatePerHour: number;
}

interface PayrollSettings {
  payRatePerHour: number;
  staffStartTime: string;
  lunchBreakMinHours: number;
  lunchBreakDurationMinutes: number;
  lunchBreakStartTime: string;
  lunchBreakFinishTime: string;
}

export default function Settings() {
  // Payroll Settings
  const [payrollSettings, setPayrollSettings] = useState<PayrollSettings>({
    payRatePerHour: 32.31,
    staffStartTime: "08:00",
    lunchBreakMinHours: 5,
    lunchBreakDurationMinutes: 30,
    lunchBreakStartTime: "09:00",
    lunchBreakFinishTime: "17:00"
  });

  // Geolocation Radius Settings
  const [geolocationRadiusSettings, setGeolocationRadiusSettings] = useState<GeolocationRadiusSettings>({
    radiusMeters: 50000
  });

  // Price Tiers
  const [priceTiers, setPriceTiers] = useState<PriceTier[]>([]);
  const [newTier, setNewTier] = useState({
    priceMin: "",
    priceMax: "",
    allottedMinutes: ""
  });

  const [editingTier, setEditingTier] = useState<EditingPriceTier | null>(null);

  // Timesheet Settings
  const [timesheetSettings, setTimesheetSettings] = useState<TimesheetSettings>({
    staffStartTime: "08:00",
    payRatePerHour: 25
  });

  // UI State
  const [activeTab, setActiveTab] = useState<'payroll' | 'geolocation-radius' | 'price-tiers'>('payroll');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchPayrollSettings();
    fetchGeolocationRadiusSettings();
    fetchPriceTiers();
  }, []);

  const fetchPayrollSettings = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(buildApiUrl("/api/admin/settings/payroll"), { credentials: "include" });
      const data = await res.json();
      if (res.ok && data.success) {
        setPayrollSettings(data.data);
      }
    } catch (e) {
      setError("Failed to load payroll settings");
    } finally {
      setLoading(false);
    }
  };

  const fetchGeolocationRadiusSettings = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(buildApiUrl("/api/admin/settings/geolocation-radius"), { credentials: "include" });
      const data = await res.json();
      if (res.ok && data.success) {
        setGeolocationRadiusSettings(data.data);
      }
    } catch (e) {
      setError("Failed to load geolocation radius settings");
    } finally {
      setLoading(false);
    }
  };

  const fetchPriceTiers = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(buildApiUrl("/api/admin/settings/price-tiers"), { credentials: "include" });
      const data = await res.json();
      if (res.ok && data.success) {
        setPriceTiers(data.data);
      }
    } catch (e) {
      setError("Failed to load price tiers");
    } finally {
      setLoading(false);
    }
  };

  const savePayrollSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(false);
    try {
      const res = await fetch(buildApiUrl("/api/admin/settings/payroll"), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payrollSettings)
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSuccess(true);
        setTimeout(() => setSuccess(false), 3000);
        window.dispatchEvent(new CustomEvent('settingsUpdated'));
      } else {
        setError(data.error || "Failed to save payroll settings");
      }
    } catch (e) {
      setError("Failed to save payroll settings");
    } finally {
      setSaving(false);
    }
  };

  const saveGeolocationRadiusSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(false);
    try {
      const res = await fetch(buildApiUrl("/api/admin/settings/geolocation-radius"), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(geolocationRadiusSettings)
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSuccess(true);
        setTimeout(() => setSuccess(false), 3000);
      } else {
        setError(data.error || "Failed to save geolocation radius settings");
      }
    } catch (e) {
      setError("Failed to save geolocation radius settings");
    } finally {
      setSaving(false);
    }
  };

  const addPriceTier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTier.priceMin || !newTier.priceMax || !newTier.allottedMinutes) {
      setError("All fields are required");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const res = await fetch(buildApiUrl("/api/admin/settings/price-tiers"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          priceMin: Number(newTier.priceMin),
          priceMax: Number(newTier.priceMax),
          allottedMinutes: Number(newTier.allottedMinutes)
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setPriceTiers([...priceTiers, data.data]);
        setNewTier({ priceMin: "", priceMax: "", allottedMinutes: "" });
        setSuccess(true);
        setTimeout(() => setSuccess(false), 3000);
      } else {
        setError(data.error || "Failed to add price tier");
      }
    } catch (e) {
      setError("Failed to add price tier");
    } finally {
      setSaving(false);
    }
  };

  const deletePriceTier = async (id: number) => {
    if (!confirm("Are you sure you want to delete this price tier?")) {
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const res = await fetch(buildApiUrl(`/api/admin/settings/price-tiers/${id}`), {
        method: "DELETE",
        credentials: "include"
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setPriceTiers(priceTiers.filter(tier => tier.id !== id));
        setSuccess(true);
        setTimeout(() => setSuccess(false), 3000);
      } else {
        setError(data.error || "Failed to delete price tier");
      }
    } catch (e) {
      setError("Failed to delete price tier");
    } finally {
      setSaving(false);
    }
  };

  const editPriceTier = (tier: PriceTier) => {
    setEditingTier({
      id: tier.id,
      priceMin: String(tier.priceMin),
      priceMax: String(tier.priceMax),
      allottedMinutes: String(tier.allottedMinutes)
    });
  };

  const updatePriceTier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTier) return;

    setSaving(true);
    setError(null);
    try {
      const res = await fetch(buildApiUrl(`/api/admin/settings/price-tiers/${editingTier.id}`), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          priceMin: Number(editingTier.priceMin),
          priceMax: Number(editingTier.priceMax),
          allottedMinutes: Number(editingTier.allottedMinutes)
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setPriceTiers(priceTiers.map(tier => tier.id === editingTier.id ? data.data : tier));
        setEditingTier(null);
        setSuccess(true);
        setTimeout(() => setSuccess(false), 3000);
      } else {
        setError(data.error || "Failed to update price tier");
      }
    } catch (e) {
      setError("Failed to update price tier");
    } finally {
      setSaving(false);
    }
  };

  const cancelEdit = () => {
    setEditingTier(null);
  };

  const saveTimesheetSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(false);
    try {
      const res = await fetch(buildApiUrl("/api/admin/settings/staff-pay-rate"), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ payRatePerHour: timesheetSettings.payRatePerHour })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSuccess(true);
        setTimeout(() => setSuccess(false), 2000);
        window.dispatchEvent(new CustomEvent('settingsUpdated'));
      } else {
        setError(data.error || "Failed to save pay rate");
      }
    } catch (e) {
      setError("Failed to save pay rate");
    } finally {
      setSaving(false);
    }
  };

  const tabs = [
    { id: 'payroll', name: 'Payroll Settings', icon: '💸' },
    { id: 'geolocation-radius', name: 'Geolocation Radius', icon: '📍' },
    { id: 'price-tiers', name: 'Customer Price Tiers', icon: '📊' }
  ] as const;

  return (
    <AdminLayout>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Settings</h1>
        <p className="mb-6 text-gray-600">Configure system settings and business rules.</p>

        {/* Tab Navigation */}
        <div className="border-b border-gray-200 mb-6">
          <nav className="-mb-px flex space-x-8">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <span className="mr-2">{tab.icon}</span>
                {tab.name}
              </button>
            ))}
          </nav>
        </div>

        {loading && (
          <div className="text-center py-8">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <p className="mt-2 text-sm text-gray-600">Loading settings...</p>
          </div>
        )}

        {!loading && (
          <>
            {/* Success/Error Messages */}
            {success && (
              <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-md">
                <p className="text-green-800 text-sm">Settings saved successfully!</p>
              </div>
            )}
            {error && (
              <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-md">
                <p className="text-red-800 text-sm">{error}</p>
              </div>
            )}

            {/* Payroll Settings Tab */}
            {activeTab === 'payroll' && (
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">Payroll Settings</h2>
                <p className="text-sm text-gray-600 mb-6">Configure pay rate, staff start time, and lunch break rules for payroll and timesheet calculations.</p>
                <form onSubmit={savePayrollSettings} className="space-y-8">
                  
                  {/* Pay Rate and Start Time Section */}
                  <div>
                    <h3 className="text-lg font-medium text-gray-900 mb-4">Staff Pay & Schedule</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Staff Pay Rate (per hour)</label>
                        <div className="mt-1 relative">
                          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <span className="text-gray-500 sm:text-sm">$</span>
                          </div>
                          <input
                            type="number"
                            min={0}
                            step={0.01}
                            value={payrollSettings.payRatePerHour}
                            onChange={e => setPayrollSettings({ ...payrollSettings, payRatePerHour: Number(e.target.value) })}
                            className="block w-full border border-gray-300 rounded-md pl-7 pr-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                            required
                          />
                        </div>
                        <span className="text-xs text-gray-500 mt-1 block">This rate is used for calculating labor costs and efficiency metrics.</span>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Staff Start Time</label>
                        <input
                          type="time"
                          value={payrollSettings.staffStartTime}
                          onChange={e => setPayrollSettings({ ...payrollSettings, staffStartTime: e.target.value })}
                          className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                          required
                        />
                        <span className="text-xs text-gray-500 mt-1 block">This time will be used as the default staff start time for timesheets.</span>
                      </div>
                    </div>
                  </div>

                  {/* Lunch Break Rules Section */}
                  <div>
                    <h3 className="text-lg font-medium text-gray-900 mb-4">Lunch Break Rules</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Minimum hours worked for lunch break</label>
                        <input
                          type="number"
                          min={1}
                          max={12}
                          value={payrollSettings.lunchBreakMinHours}
                          onChange={e => setPayrollSettings({ ...payrollSettings, lunchBreakMinHours: Number(e.target.value) })}
                          className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                          required
                        />
                        <span className="text-xs text-gray-500 mt-1 block">Staff must work at least this many hours to receive a lunch break deduction.</span>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Lunch break duration (minutes)</label>
                        <input
                          type="number"
                          min={10}
                          max={120}
                          step={5}
                          value={payrollSettings.lunchBreakDurationMinutes}
                          onChange={e => setPayrollSettings({ ...payrollSettings, lunchBreakDurationMinutes: Number(e.target.value) })}
                          className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                          required
                        />
                        <span className="text-xs text-gray-500 mt-1 block">How many minutes to deduct for lunch break.</span>
                      </div>
                    </div>
                  </div>

                  {/* Lunch Break Eligibility Times Section */}
                  <div>
                    <h3 className="text-lg font-medium text-gray-900 mb-4">Lunch Break Eligibility Times</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Start time for lunch break eligibility</label>
                        <input
                          type="time"
                          value={payrollSettings.lunchBreakStartTime}
                          onChange={e => setPayrollSettings({ ...payrollSettings, lunchBreakStartTime: e.target.value })}
                          className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                          required
                        />
                        <span className="text-xs text-gray-500 mt-1 block">Staff must start work before this time to be eligible for lunch break.</span>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Finish time for lunch break eligibility</label>
                        <input
                          type="time"
                          value={payrollSettings.lunchBreakFinishTime}
                          onChange={e => setPayrollSettings({ ...payrollSettings, lunchBreakFinishTime: e.target.value })}
                          className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                          required
                        />
                        <span className="text-xs text-gray-500 mt-1 block">Staff must finish work after this time to be eligible for lunch break.</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-4">
                    <button
                      type="submit"
                      disabled={saving}
                      className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                    >
                      {saving ? "Saving..." : "Save Payroll Settings"}
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Geolocation Radius Tab */}
            {activeTab === 'geolocation-radius' && (
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">Geolocation Radius Settings</h2>
                <p className="text-sm text-gray-600 mb-6">Configure the maximum distance for staff to see nearby customers on their dashboard.</p>
                
                <form onSubmit={saveGeolocationRadiusSettings} className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Maximum Search Radius</label>
                    <div className="flex items-center space-x-4">
                      <input
                        type="number"
                        min={1}
                        max={1000000}
                        step={1}
                        value={geolocationRadiusSettings.radiusMeters}
                        onChange={e => setGeolocationRadiusSettings({...geolocationRadiusSettings, radiusMeters: Number(e.target.value)})}
                        className="block w-32 border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                        required
                      />
                      <span className="text-sm text-gray-500">meters</span>
                      <span className="text-sm text-gray-400">({(geolocationRadiusSettings.radiusMeters / 1000).toFixed(1)} km)</span>
                    </div>
                    <span className="text-xs text-gray-500 ml-2">Staff will only see customers within this distance from their current location.</span>
                  </div>
                  
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div className="flex items-start">
                      <div className="flex-shrink-0">
                        <svg className="h-5 w-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <div className="ml-3">
                        <h3 className="text-sm font-medium text-blue-800">How it works</h3>
                        <div className="mt-2 text-sm text-blue-700">
                          <p>• Staff must enable location access on their device</p>
                          <p>• Only customers within the specified radius will appear</p>
                          <p>• This helps staff focus on nearby jobs and reduces travel time</p>
                          <p>• Recommended: 10-50km depending on your service area</p>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-4">
                    <button
                      type="submit"
                      disabled={saving}
                      className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                    >
                      {saving ? "Saving..." : "Save Radius Settings"}
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Price Tiers Tab */}
            {activeTab === 'price-tiers' && (
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">Customer Price Tiers</h2>
                <p className="text-sm text-gray-600 mb-6">Define time allocation tiers based on customer pricing to help with job planning and efficiency calculations.</p>
                
                {/* Add New Tier Form */}
                <div className="mb-8 p-4 bg-gray-50 rounded-lg">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Add New Price Tier</h3>
                  <form onSubmit={addPriceTier} className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Price Min ($)</label>
                      <input
                        type="number"
                        min={0}
                        step={0.01}
                        value={newTier.priceMin}
                        onChange={e => setNewTier({...newTier, priceMin: e.target.value})}
                        className="block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                        placeholder="0.00"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Price Max ($)</label>
                      <input
                        type="number"
                        min={0}
                        step={0.01}
                        value={newTier.priceMax}
                        onChange={e => setNewTier({...newTier, priceMax: e.target.value})}
                        className="block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                        placeholder="0.00"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Allotted Minutes</label>
                      <input
                        type="number"
                        min={1}
                        value={newTier.allottedMinutes}
                        onChange={e => setNewTier({...newTier, allottedMinutes: e.target.value})}
                        className="block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                        placeholder="60"
                        required
                      />
                    </div>
                    <div className="flex items-end">
                      <button
                        type="submit"
                        disabled={saving}
                        className="w-full inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50"
                      >
                        {saving ? "Adding..." : "Add Tier"}
                      </button>
                    </div>
                  </form>
                </div>

                {/* Existing Tiers Table */}
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Current Price Tiers</h3>
                  {priceTiers.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <p>No price tiers configured yet.</p>
                      <p className="text-sm">Add your first price tier above to get started.</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Price Range</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Allotted Time</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {priceTiers.map((tier) => (
                            <tr key={tier.id}>
                              {editingTier?.id === tier.id ? (
                                // Editing mode
                                <>
                                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                    <div className="grid grid-cols-2 gap-2">
                                      <input
                                        type="number"
                                        min={0}
                                        step={0.01}
                                        value={editingTier.priceMin}
                                        onChange={e => setEditingTier({...editingTier, priceMin: e.target.value})}
                                        className="block w-full border border-gray-300 rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                                        placeholder="Min"
                                      />
                                      <input
                                        type="number"
                                        min={0}
                                        step={0.01}
                                        value={editingTier.priceMax}
                                        onChange={e => setEditingTier({...editingTier, priceMax: e.target.value})}
                                        className="block w-full border border-gray-300 rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                                        placeholder="Max"
                                      />
                                    </div>
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                    <input
                                      type="number"
                                      min={1}
                                      value={editingTier.allottedMinutes}
                                      onChange={e => setEditingTier({...editingTier, allottedMinutes: e.target.value})}
                                      className="block w-full border border-gray-300 rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                                      placeholder="Minutes"
                                    />
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                    <div className="flex items-center space-x-2">
                                      <button
                                        onClick={updatePriceTier}
                                        disabled={saving}
                                        className="inline-flex items-center p-2 border border-gray-300 rounded text-sm text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                                        title="Save changes"
                                      >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                        </svg>
                                      </button>
                                      <button
                                        onClick={cancelEdit}
                                        disabled={saving}
                                        className="inline-flex items-center p-2 border border-gray-300 rounded text-sm text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                                        title="Cancel edit"
                                      >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                      </button>
                                    </div>
                                  </td>
                                </>
                              ) : (
                                // View mode
                                <>
                                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                    ${Number(tier.priceMin).toFixed(2)} - ${Number(tier.priceMax).toFixed(2)}
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                    {Math.floor(tier.allottedMinutes / 60)}h {tier.allottedMinutes % 60}m
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                    <div className="flex items-center space-x-2">
                                      <button
                                        onClick={() => editPriceTier(tier)}
                                        disabled={saving}
                                        className="inline-flex items-center p-2 border border-gray-300 rounded text-sm text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                                        title="Edit tier"
                                      >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                        </svg>
                                      </button>
                                      <button
                                        onClick={() => deletePriceTier(tier.id)}
                                        disabled={saving}
                                        className="inline-flex items-center p-2 border border-red-300 rounded text-sm text-red-700 bg-red-50 hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50"
                                        title="Delete tier"
                                      >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                        </svg>
                                      </button>
                                    </div>
                                  </td>
                                </>
                              )}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </AdminLayout>
  );
} 