import { useState, useEffect } from "react";
import { AdminLayout } from "../../components/AdminLayout";
import { formatPhoneNumber } from "../../utils/phoneFormatter";
import { formatAddress } from "../../utils/addressFormatter";
import { AddressAutocomplete } from "../../components/AddressAutocomplete";
import { GoogleMapPreview } from "../../components/GoogleMapPreview";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { Label } from "../../components/ui/label";
import { buildApiUrl } from "../../config/api";

interface Customer {
  id: number;
  name: string;
  address: string;
  phone: string;
  email?: string;
  notes?: string;
  price: number;
  cleanFrequency: string;
  targetTimeMinutes?: number;
  averageWageRatio?: number;
  active: boolean;
  latitude: string;
  longitude: string;
  createdAt: string;
}

export function CustomerManagement() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [saving, setSaving] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [newCustomer, setNewCustomer] = useState({
    name: "",
    address: "",
    phone: "",
    email: "",
    notes: "",
    price: "",
    cleanFrequency: "weekly"
  });
  const [editCustomer, setEditCustomer] = useState({
    name: "",
    address: "",
    phone: "",
    email: "",
    notes: "",
    price: "",
    cleanFrequency: "weekly"
  });

  // Helper function to format clean frequency for display
  const formatCleanFrequency = (frequency: string): string => {
    return frequency.charAt(0).toUpperCase() + frequency.slice(1).replace('-', ' ');
  };



  useEffect(() => {
    fetchCustomers();
  }, []);

  const fetchCustomers = async () => {
    try {
      console.log('fetchCustomers called');
      const response = await fetch(buildApiUrl("/api/admin/customers"), {
        credentials: "include"
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log('Fetched customers:', data.data);
        setCustomers(data.data);
      } else {
        console.error('Failed to fetch customers, status:', response.status);
      }
    } catch (error) {
      console.error("Failed to fetch customers:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const response = await fetch(buildApiUrl("/api/admin/customers"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        credentials: "include",
        body: JSON.stringify(newCustomer)
      });
      
      if (response.ok) {
        setNewCustomer({
          name: "",
          address: "",
          phone: "",
          email: "",
          notes: "",
          price: "",
          cleanFrequency: "weekly"
        });
        setShowAddForm(false);
        fetchCustomers(); // Refresh the list
      } else {
        const error = await response.json();
        alert(`Failed to add customer: ${error.error}`);
      }
    } catch (error) {
      console.error("Failed to add customer:", error);
      alert("Failed to add customer");
    }
  };

  const handleEditCustomer = (customer: Customer) => {
    setEditingCustomer(customer);
    setEditCustomer({
      name: customer.name,
      address: customer.address,
      phone: customer.phone || "",
      email: customer.email || "",
      notes: customer.notes || "",
      price: customer.price.toString(),
      cleanFrequency: customer.cleanFrequency
    });
  };

  const handleArchiveCustomer = async (customerId: number, isArchiving: boolean) => {
    console.log('handleArchiveCustomer called:', { customerId, isArchiving });
    
    try {
      const requestBody = { active: !isArchiving };
      console.log('Sending request body:', requestBody);
      
      const response = await fetch(buildApiUrl(`/api/admin/customers/${customerId}`), {
        method: "PUT",
        headers: {
          "Content-Type": "application/json"
        },
        credentials: "include",
        body: JSON.stringify(requestBody)
      });

      console.log('Response status:', response.status);
      console.log('Response ok:', response.ok);

      if (response.ok) {
        const result = await response.json();
        console.log('Archive successful:', result);
        setEditingCustomer(null); // Close the popup
        fetchCustomers(); // Refresh the list
      } else {
        const error = await response.json();
        console.error('Archive failed:', error);
        alert(`Failed to ${isArchiving ? 'archive' : 'restore'} customer: ${error.error}`);
      }
    } catch (error) {
      console.error("Failed to archive customer:", error);
      alert("Failed to archive customer");
    }
  };

  const handleUpdateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCustomer) return;
    
    setSaving(true);
    try {
      const response = await fetch(buildApiUrl(`/api/admin/customers/${editingCustomer.id}`), {
        method: "PUT",
        headers: {
          "Content-Type": "application/json"
        },
        credentials: "include",
        body: JSON.stringify({
          ...editCustomer,
          active: editingCustomer.active, // Keep current active status
          latitude: editingCustomer.latitude, // Keep current coordinates
          longitude: editingCustomer.longitude
        })
      });
      
      if (response.ok) {
        setEditingCustomer(null);
        fetchCustomers(); // Refresh the list
      } else {
        const error = await response.json();
        alert(`Failed to update customer: ${error.error}`);
      }
    } catch (error) {
      console.error("Failed to update customer:", error);
      alert("Failed to update customer");
    } finally {
      setSaving(false);
    }
  };

  const handleCalculateMetrics = async () => {
    try {
      const response = await fetch(buildApiUrl("/api/admin/customers/calculate-metrics"), {
        method: "POST",
        credentials: "include"
      });
      if (response.ok) {
        await fetchCustomers();
        alert("Customer metrics updated!");
      } else {
        alert("Failed to calculate metrics");
      }
    } catch (error) {
      alert("Error calculating metrics");
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
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            Customer Management
          </h1>
          <p className="mt-2 text-gray-600">
            View and manage customers, their addresses, and cleaning schedules.
          </p>
        </div>

        <div className="flex justify-between items-center mb-6">
          <div className="flex space-x-3">
            <button
              onClick={() => setShowArchived(!showArchived)}
              className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              {showArchived ? (
                <>
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Show Active
                </>
              ) : (
                <>
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                  </svg>
                  Show Archived
                </>
              )}
            </button>
            <button
              onClick={handleCalculateMetrics}
              className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Calculate Metrics
            </button>
          </div>
          <button
            onClick={() => setShowAddForm(true)}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            Add Customer
          </button>
        </div>

        {/* Customer List */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {customers
            .filter(customer => showArchived ? !customer.active : customer.active)
            .map((customer) => (
              <div key={customer.id} className={`bg-white rounded-lg shadow-md p-6 ${!customer.active ? 'opacity-60' : ''}`}>
                                  <div className="flex justify-between items-start mb-1">
                                  <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900 mb-1">
                    {customer.name}
                  </h3>
                  <div className="flex items-start space-x-2 mb-2">
                    <svg className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <p className="text-sm text-gray-600">
                      {formatAddress(customer.address)}
                    </p>
                  </div>
                  {customer.phone && (
                    <div className="flex items-center space-x-2 mb-2">
                      <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                      </svg>
                      <p className="text-sm text-gray-500">
                        {formatPhoneNumber(customer.phone)}
                      </p>
                    </div>
                  )}
                  <div className="flex items-center space-x-2 mb-2">
                    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p className="text-sm text-gray-500">
                      Efficiency: {customer.targetTimeMinutes ? (
                        <span className={customer.targetTimeMinutes >= 100 ? 'text-green-600' : customer.targetTimeMinutes >= 80 ? 'text-yellow-600' : 'text-red-600'}>{customer.targetTimeMinutes}%</span>
                      ) : (
                        <span className="text-gray-400">Not set</span>
                      )}
                    </p>
                  </div>
                  <div className="flex items-center space-x-2 mb-2">
                    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                    </svg>
                    <p className="text-sm text-gray-500">
                      Wage Ratio: {customer.averageWageRatio ? (
                        <span className={customer.averageWageRatio <= 55 ? 'text-green-600' : customer.averageWageRatio <= 60 ? 'text-yellow-600' : customer.averageWageRatio <= 65 ? 'text-orange-600' : 'text-red-600'}>{customer.averageWageRatio}%</span>
                      ) : (
                        <span className="text-gray-400">Not set</span>
                      )}
                    </p>
                  </div>
                  <div className="flex items-center space-x-2 mt-3">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      {formatCleanFrequency(customer.cleanFrequency)}
                    </span>
                    {!customer.active && (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                        Archived
                      </span>
                    )}
                  </div>
                </div>
                  <button
                    onClick={() => handleEditCustomer(customer)}
                    className="inline-flex items-center p-2 border border-gray-300 rounded text-sm text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    title="Edit Customer"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                </div>
                
                <div className="space-y-2">
                  {customer.email && (
                    <div className="flex items-center text-sm text-gray-600">
                      <svg className="w-4 h-4 mr-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                      {customer.email}
                    </div>
                  )}
                </div>
              </div>
            ))}
        </div>

        {/* Add Customer Form Modal */}
        {showAddForm && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto relative">
              <button
                onClick={() => setShowAddForm(false)}
                className="absolute top-4 right-4 text-gray-600 hover:text-gray-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 z-10"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
              <div className="flex flex-col space-y-1.5 text-center sm:text-left mb-6">
                <h2 className="text-lg font-semibold leading-none tracking-tight">Add New Customer</h2>
              </div>
              <form onSubmit={handleAddCustomer} className="space-y-4">
                <div>
                  <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70" htmlFor="name">
                    Customer Name *
                  </label>
                  <input
                    id="name"
                    type="text"
                    required
                    value={newCustomer.name}
                    onChange={(e) => setNewCustomer({...newCustomer, name: e.target.value})}
                    placeholder="Enter customer name"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70" htmlFor="address">
                    Address *
                  </label>
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <AddressAutocomplete
                        value={newCustomer.address}
                        onChange={(value) => setNewCustomer({...newCustomer, address: value})}
                        required
                        placeholder="Start typing address for suggestions..."
                        className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm w-full"
                      />
                    </div>
                  </div>
                  {newCustomer.address && (
                    <GoogleMapPreview 
                      address={newCustomer.address} 
                      className="mt-2"
                    />
                  )}
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70" htmlFor="phone">
                      Phone
                    </label>
                    <input
                      id="phone"
                      type="tel"
                      value={newCustomer.phone}
                      onChange={(e) => setNewCustomer({...newCustomer, phone: e.target.value})}
                      placeholder="0000 000 000"
                      maxLength={12}
                      className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm w-full"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70" htmlFor="price">
                      Price
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">$</span>
                      <input
                        id="price"
                        type="number"
                        required
                        value={newCustomer.price}
                        onChange={(e) => setNewCustomer({...newCustomer, price: e.target.value})}
                        className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm w-full pl-8"
                      />
                    </div>
                  </div>
                </div>
                <div>
                  <Label htmlFor="frequency">Cleaning Frequency</Label>
                  <Select 
                    value={newCustomer.cleanFrequency} 
                    onValueChange={(value) => setNewCustomer(prev => ({ ...prev, cleanFrequency: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="weekly">Weekly</SelectItem>
                      <SelectItem value="fortnightly">Fortnightly</SelectItem>
                      <SelectItem value="tri-weekly">Tri-weekly</SelectItem>
                      <SelectItem value="monthly">Monthly</SelectItem>
                      <SelectItem value="one-off">One-off</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70" htmlFor="notes">
                    Notes
                  </label>
                  <textarea
                    id="notes"
                    value={newCustomer.notes}
                    onChange={(e) => setNewCustomer({...newCustomer, notes: e.target.value})}
                    placeholder="Special instructions, access codes, etc."
                    rows={3}
                    className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  />
                </div>
                <div className="flex justify-end gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowAddForm(false)}
                    className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-blue-600 text-white hover:bg-blue-700 h-10 px-4 py-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                    Add Customer
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Edit Customer Form Modal */}
        {editingCustomer && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto relative">
              <button
                onClick={() => setEditingCustomer(null)}
                className="absolute top-4 right-4 text-gray-600 hover:text-gray-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 z-10"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
              <div className="flex flex-col space-y-1.5 text-center sm:text-left mb-6">
                <h2 className="text-lg font-semibold leading-none tracking-tight">Edit Customer</h2>
              </div>
              <form onSubmit={handleUpdateCustomer} className="space-y-4">
                <div>
                  <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70" htmlFor="edit-name">
                    Customer Name *
                  </label>
                  <input
                    id="edit-name"
                    type="text"
                    required
                    value={editCustomer.name}
                    onChange={(e) => setEditCustomer({...editCustomer, name: e.target.value})}
                    placeholder="Enter customer name"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70" htmlFor="edit-address">
                    Address *
                  </label>
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <AddressAutocomplete
                        value={editCustomer.address}
                        onChange={(value) => setEditCustomer({...editCustomer, address: value})}
                        required
                        placeholder="Start typing address for suggestions..."
                        className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm w-full"
                      />
                    </div>
                  </div>
                  <GoogleMapPreview 
                    address={editCustomer.address} 
                    className="mt-2"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70" htmlFor="edit-phone">
                      Phone
                    </label>
                    <input
                      id="edit-phone"
                      type="tel"
                      value={editCustomer.phone}
                      onChange={(e) => setEditCustomer({...editCustomer, phone: e.target.value})}
                      placeholder="0000 000 000"
                      maxLength={12}
                      className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm w-full"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70" htmlFor="edit-price">
                      Price
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">$</span>
                      <input
                        id="edit-price"
                        type="number"
                        required
                        value={editCustomer.price}
                        onChange={(e) => setEditCustomer({...editCustomer, price: e.target.value})}
                        className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm w-full pl-8"
                      />
                    </div>
                  </div>
                </div>
                <div>
                  <Label htmlFor="edit-frequency">Cleaning Frequency</Label>
                  <Select 
                    value={editCustomer.cleanFrequency} 
                    onValueChange={(value) => setEditCustomer(prev => ({ ...prev, cleanFrequency: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="weekly">Weekly</SelectItem>
                      <SelectItem value="fortnightly">Fortnightly</SelectItem>
                      <SelectItem value="tri-weekly">Tri-weekly</SelectItem>
                      <SelectItem value="monthly">Monthly</SelectItem>
                      <SelectItem value="one-off">One-off</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70" htmlFor="edit-notes">
                    Notes
                  </label>
                  <textarea
                    id="edit-notes"
                    value={editCustomer.notes}
                    onChange={(e) => setEditCustomer({...editCustomer, notes: e.target.value})}
                    placeholder="Special instructions, access codes, etc."
                    rows={3}
                    className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  />
                </div>
                <div className="flex justify-between items-center pt-4">
                  <button
                    type="button"
                    onClick={() => handleArchiveCustomer(editingCustomer.id, editingCustomer.active)}
                    className={`inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 h-10 px-4 py-2 ${
                      editingCustomer.active 
                        ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90' 
                        : 'bg-green-600 text-white hover:bg-green-700'
                    }`}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      {editingCustomer.active ? (
                        <>
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 6h18M5 6v14a2 2 0 002 2h10a2 2 0 002-2V6m-3 0V4a2 2 0 00-2-2H9a2 2 0 00-2 2v2" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 11h4M10 15h4" />
                        </>
                      ) : (
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      )}
                    </svg>
                    {editingCustomer.active ? 'Archive' : 'Restore'}
                  </button>
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => setEditingCustomer(null)}
                      className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={saving}
                      className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-blue-600 text-white hover:bg-blue-700 h-10 px-4 py-2"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.2 3a2 2 0 0 1 1.4.6l3.8 3.8a2 2 0 0 1 .6 1.4V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 21v-7a1 1 0 0 0-1-1H8a1 1 0 0 0-1 1v7" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 3v4a1 1 0 0 0 1 1h7" />
                      </svg>
                      Save
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
} 