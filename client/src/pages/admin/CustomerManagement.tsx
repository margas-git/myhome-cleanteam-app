import { useState, useEffect } from "react";
import { AdminLayout } from "../../components/AdminLayout";
import { formatPhoneNumber } from "../../utils/phoneFormatter";
import { formatAddress } from "../../utils/addressFormatter";
import { AddressAutocomplete } from "../../components/AddressAutocomplete";
import { GoogleMapPreview } from "../../components/GoogleMapPreview";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { Label } from "../../components/ui/label";
import { buildApiUrl } from "../../config/api";
import { useGoogleMaps } from "../../hooks/useGoogleMaps";

// Toast notification types
interface Toast {
  id: string;
  type: 'success' | 'error' | 'info';
  message: string;
  duration?: number;
}

// Toast component
function Toast({ toast, onRemove }: { toast: Toast; onRemove: (id: string) => void }) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onRemove(toast.id);
    }, toast.duration || 5000);

    return () => clearTimeout(timer);
  }, [toast.id, toast.duration, onRemove]);

  const getToastStyles = () => {
    switch (toast.type) {
      case 'success':
        return 'bg-green-500 text-white';
      case 'error':
        return 'bg-red-500 text-white';
      case 'info':
        return 'bg-blue-500 text-white';
      default:
        return 'bg-gray-500 text-white';
    }
  };

  return (
    <div className={`fixed top-4 right-4 z-50 p-4 rounded-lg shadow-lg max-w-sm ${getToastStyles()}`}>
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">{toast.message}</span>
        <button
          onClick={() => onRemove(toast.id)}
          className="ml-4 text-white hover:text-gray-200 focus:outline-none"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}

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
  isFriendsFamily?: boolean;
  friendsFamilyMinutes?: number;
  active: boolean;
  latitude: string;
  longitude: string;
  createdAt: string;
}

// Reusable geocoding function
const geocodeAddress = (address: string): Promise<{ latitude: number; longitude: number } | null> => {
  return new Promise((resolve) => {
    
    if (!window.google?.maps?.Geocoder) {
      console.error('❌ Google Maps Geocoder not available');
      resolve(null);
      return;
    }

    try {
      const geocoder = new window.google.maps.Geocoder();
      const searchAddress = address + ', Australia';
      
      geocoder.geocode({ address: searchAddress }, (results: any[], status: string) => {
        
        if (status === 'OK' && results[0]) {
          const location = results[0].geometry.location;
          const lat = location.lat();
          const lng = location.lng();
          
          resolve({
            latitude: lat,
            longitude: lng
          });
        } else {
          console.error('❌ Geocoding failed:', status);
          resolve(null);
        }
      });
    } catch (error) {
      console.error('❌ Google Maps geocoding error:', error);
      resolve(null);
    }
  });
};

export function CustomerManagement() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [saving, setSaving] = useState(false);
  const [calculatingMetrics, setCalculatingMetrics] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [newCustomer, setNewCustomer] = useState({
    name: "",
    address: "",
    phone: "",
    email: "",
    notes: "",
    price: "",
    cleanFrequency: "weekly",
    isFriendsFamily: false,
    friendsFamilyMinutes: ""
  });
  const [editCustomer, setEditCustomer] = useState({
    name: "",
    address: "",
    phone: "",
    email: "",
    notes: "",
    price: "",
    cleanFrequency: "weekly",
    isFriendsFamily: false,
    friendsFamilyMinutes: ""
  });

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [customersPerPage] = useState(20);
  const [searchTerm, setSearchTerm] = useState("");

  // Add Google Maps hook at component level
  const { isLoaded: isGoogleLoaded } = useGoogleMaps();

  // Toast state
  const [toasts, setToasts] = useState<Toast[]>([]);

  // Helper function to format clean frequency for display
  const formatCleanFrequency = (frequency: string): string => {
    return frequency.charAt(0).toUpperCase() + frequency.slice(1).replace('-', ' ');
  };

  // Toast helper functions
  const addToast = (type: 'success' | 'error' | 'info', message: string, duration?: number) => {
    const id = Date.now().toString();
    setToasts(prev => [...prev, { id, type, message, duration }]);
  };

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  };

  useEffect(() => {
    fetchCustomers();
  }, []);

  // Reset to first page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [showArchived, searchTerm]);

  const fetchCustomers = async () => {
    try {
      const response = await fetch(buildApiUrl("/api/admin/customers"), {
        credentials: "include"
      });
      
      if (response.ok) {
        const data = await response.json();
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
    
    setSaving(true);
    try {
      // Geocode the address if Google Maps is loaded
      let latitude = "-37.8136"; // Default Melbourne coordinates
      let longitude = "144.9631";
      
      if (isGoogleLoaded && newCustomer.address) {
        const coordinates = await geocodeAddress(newCustomer.address);
        if (coordinates) {
          latitude = coordinates.latitude.toString();
          longitude = coordinates.longitude.toString();
        } else {
          console.log('❌ Geocoding failed, using default coordinates');
        }
      } else {
        console.log('❌ Google Maps not loaded or no address, using default coordinates');
      }

      const response = await fetch(buildApiUrl("/api/admin/customers"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        credentials: "include",
        body: JSON.stringify({
          ...newCustomer,
          latitude,
          longitude
        })
      });
      
      if (response.ok) {
        setNewCustomer({
          name: "",
          address: "",
          phone: "",
          email: "",
          notes: "",
          price: "",
          cleanFrequency: "weekly",
          isFriendsFamily: false,
          friendsFamilyMinutes: ""
        });
        setShowAddForm(false);
        fetchCustomers(); // Refresh the list
      } else {
        const error = await response.json();
        
        // Handle duplicate customer error specifically
        if (response.status === 409 && error.existingCustomer) {
          const status = error.existingCustomer.active ? "active" : "archived";
          alert(`Customer already exists!\n\nName: ${error.existingCustomer.name}\nAddress: ${error.existingCustomer.address}\nStatus: ${status}\n\nPlease check the customer list or use a different name/address.`);
        } else {
          alert(`Failed to add customer: ${error.error}`);
        }
      }
    } catch (error) {
      console.error("Failed to add customer:", error);
      alert("Failed to add customer");
    } finally {
      setSaving(false);
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
      cleanFrequency: customer.cleanFrequency,
      isFriendsFamily: customer.isFriendsFamily || false,
      friendsFamilyMinutes: customer.friendsFamilyMinutes?.toString() || ""
    });
  };

  const handleArchiveCustomer = async (customerId: number, isArchiving: boolean) => {
    
    try {
      const requestBody = { active: !isArchiving };
      
      const response = await fetch(buildApiUrl(`/api/admin/customers/${customerId}`), {
        method: "PUT",
        headers: {
          "Content-Type": "application/json"
        },
        credentials: "include",
        body: JSON.stringify(requestBody)
      });

      if (response.ok) {
        const result = await response.json();
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
      // Geocode the address if it has changed and Google Maps is loaded
      let latitude = editingCustomer.latitude;
      let longitude = editingCustomer.longitude;
      
      if (isGoogleLoaded && editCustomer.address !== editingCustomer.address) {
        const coordinates = await geocodeAddress(editCustomer.address);
        if (coordinates) {
          latitude = coordinates.latitude.toString();
          longitude = coordinates.longitude.toString();
        } else {
          console.log('❌ Geocoding failed, keeping original coordinates');
        }
      } else {
        console.log('❌ Google Maps not loaded or address unchanged, keeping original coordinates');
      }

      const response = await fetch(buildApiUrl(`/api/admin/customers/${editingCustomer.id}`), {
        method: "PUT",
        headers: {
          "Content-Type": "application/json"
        },
        credentials: "include",
        body: JSON.stringify({
          ...editCustomer,
          active: editingCustomer.active, // Keep current active status
          latitude,
          longitude
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
    setCalculatingMetrics(true);
    try {
      const response = await fetch(buildApiUrl("/api/admin/customers/calculate-metrics"), {
        method: "POST",
        credentials: "include"
      });
      if (response.ok) {
        await fetchCustomers();
        addToast('success', 'Customer metrics updated successfully!', 4000);
      } else {
        addToast('error', 'Failed to calculate metrics. Please try again.', 5000);
      }
    } catch (error) {
      addToast('error', 'Error calculating metrics. Please check your connection.', 5000);
    } finally {
      setCalculatingMetrics(false);
    }
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="mb-8">
            <div className="h-8 bg-gray-200 rounded animate-pulse mb-2"></div>
            <div className="h-4 bg-gray-200 rounded animate-pulse w-2/3"></div>
          </div>
          
          <div className="flex justify-between items-center mb-6">
            <div className="flex space-x-3">
              <div className="h-10 w-24 bg-gray-200 rounded animate-pulse"></div>
              <div className="h-10 w-32 bg-gray-200 rounded animate-pulse"></div>
            </div>
            <div className="h-10 w-32 bg-gray-200 rounded animate-pulse"></div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-6">
            {Array.from({ length: 12 }, (_, i) => (
              <div key={i} className="bg-white rounded-lg shadow-md p-6">
                <div className="h-6 bg-gray-200 rounded animate-pulse mb-2"></div>
                <div className="h-4 bg-gray-200 rounded animate-pulse mb-2"></div>
                <div className="h-4 bg-gray-200 rounded animate-pulse mb-2"></div>
                <div className="h-4 bg-gray-200 rounded animate-pulse mb-4"></div>
                <div className="flex space-x-2">
                  <div className="h-6 w-16 bg-gray-200 rounded animate-pulse"></div>
                  <div className="h-6 w-20 bg-gray-200 rounded animate-pulse"></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </AdminLayout>
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
              disabled={calculatingMetrics}
              className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <svg 
                className={`w-4 h-4 mr-2 ${calculatingMetrics ? 'animate-spin' : ''}`} 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              {calculatingMetrics ? 'Calculating...' : 'Calculate Metrics'}
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

        {/* Search and Pagination Controls */}
        <div className="mb-6">
          <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
            <div className="flex-1 max-w-md">
              <input
                type="text"
                placeholder="Search customers..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex items-center space-x-2 text-sm text-gray-600">
              <span>
                Showing {Math.min((currentPage - 1) * customersPerPage + 1, customers.filter(c => showArchived ? !c.active : c.active).length)} - {Math.min(currentPage * customersPerPage, customers.filter(c => showArchived ? !c.active : c.active).length)} of {customers.filter(c => showArchived ? !c.active : c.active).length} customers
              </span>
            </div>
          </div>
        </div>

        {/* Customer List */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {customers
            .filter(customer => showArchived ? !customer.active : customer.active)
            .filter(customer => 
              searchTerm === "" || 
              customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
              customer.address.toLowerCase().includes(searchTerm.toLowerCase()) ||
              (customer.phone && customer.phone.includes(searchTerm))
            )
            .slice((currentPage - 1) * customersPerPage, currentPage * customersPerPage)
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
                      <a 
                        href={`tel:${customer.phone.replace(/\s+/g, '')}`}
                        className="text-sm text-gray-500 hover:text-gray-700 cursor-pointer"
                        title="Call customer"
                      >
                        {formatPhoneNumber(customer.phone)}
                      </a>
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

        {/* Pagination */}
        {customers.filter(c => showArchived ? !c.active : c.active).filter(c => 
          searchTerm === "" || 
          c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          c.address.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (c.phone && c.phone.includes(searchTerm))
        ).length > customersPerPage && (
          <div className="mt-8 flex justify-center">
            <nav className="flex items-center space-x-2">
              <button
                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
                className="px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              
              {Array.from({ length: Math.ceil(customers.filter(c => showArchived ? !c.active : c.active).filter(c => 
                searchTerm === "" || 
                c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                c.address.toLowerCase().includes(searchTerm.toLowerCase()) ||
                (c.phone && c.phone.includes(searchTerm))
              ).length / customersPerPage) }, (_, i) => i + 1).map(page => (
                <button
                  key={page}
                  onClick={() => setCurrentPage(page)}
                  className={`px-3 py-2 text-sm font-medium rounded-md ${
                    currentPage === page
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-500 bg-white border border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  {page}
                </button>
              ))}
              
              <button
                onClick={() => setCurrentPage(Math.min(
                  Math.ceil(customers.filter(c => showArchived ? !c.active : c.active).filter(c => 
                    searchTerm === "" || 
                    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    c.address.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    (c.phone && c.phone.includes(searchTerm))
                  ).length / customersPerPage),
                  currentPage + 1
                ))}
                disabled={currentPage >= Math.ceil(customers.filter(c => showArchived ? !c.active : c.active).filter(c => 
                  searchTerm === "" || 
                  c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                  c.address.toLowerCase().includes(searchTerm.toLowerCase()) ||
                  (c.phone && c.phone.includes(searchTerm))
                ).length / customersPerPage)}
                className="px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </nav>
          </div>
        )}

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
                      isGoogleLoaded={isGoogleLoaded}
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
                {/* Friends & Family row (Add Customer) */}
                <div className="flex items-center space-x-4 mt-2">
                  <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 mr-2" htmlFor="isFriendsFamily">
                    Friends & Family
                  </label>
                  <input
                    type="checkbox"
                    id="isFriendsFamily"
                    checked={newCustomer.isFriendsFamily}
                    onChange={(e) => setNewCustomer(prev => ({ ...prev, isFriendsFamily: e.target.checked }))}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded mr-2"
                  />
                  {newCustomer.isFriendsFamily && (
                    <div className="flex items-center space-x-2 ml-2">
                      <label className="text-sm font-medium leading-none" htmlFor="friendsFamilyMinutes">
                        Cleaning duration (min)
                      </label>
                      <input
                        type="number"
                        id="friendsFamilyMinutes"
                        value={newCustomer.friendsFamilyMinutes}
                        onChange={(e) => setNewCustomer(prev => ({ ...prev, friendsFamilyMinutes: e.target.value }))}
                        placeholder="e.g., 30"
                        className="flex h-10 w-24 rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
                      />
                    </div>
                  )}
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
                    isGoogleLoaded={isGoogleLoaded}
                  />
                  {/* Coordinates Display */}
                  <div className="mt-2 p-3 bg-gray-50 rounded-md">
                    <div className="text-sm font-medium text-gray-700 mb-2">Current Coordinates</div>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-gray-600">Latitude:</span>
                        <span className="ml-2 font-mono text-gray-800">{editingCustomer.latitude}</span>
                      </div>
                      <div>
                        <span className="text-gray-600">Longitude:</span>
                        <span className="ml-2 font-mono text-gray-800">{editingCustomer.longitude}</span>
                      </div>
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      These coordinates will be updated when you save changes to the address
                    </div>
                  </div>
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
                {/* Friends & Family row (Edit Customer) */}
                <div className="flex items-center space-x-4 mt-2">
                  <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 mr-2" htmlFor="isFriendsFamily">
                    Friends & Family
                  </label>
                  <input
                    type="checkbox"
                    id="isFriendsFamily"
                    checked={editCustomer.isFriendsFamily}
                    onChange={(e) => setEditCustomer(prev => ({ ...prev, isFriendsFamily: e.target.checked }))}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded mr-2"
                  />
                  {editCustomer.isFriendsFamily && (
                    <div className="flex items-center space-x-2 ml-2">
                      <label className="text-sm font-medium leading-none" htmlFor="friendsFamilyMinutes">
                        Cleaning duration (min)
                      </label>
                      <input
                        type="number"
                        id="friendsFamilyMinutes"
                        value={editCustomer.friendsFamilyMinutes}
                        onChange={(e) => setEditCustomer(prev => ({ ...prev, friendsFamilyMinutes: e.target.value }))}
                        placeholder="e.g., 30"
                        className="flex h-10 w-24 rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
                      />
                    </div>
                  )}
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

        {/* Toast Notifications */}
        {toasts.map((toast) => (
          <Toast key={toast.id} toast={toast} onRemove={removeToast} />
        ))}
      </div>
    </AdminLayout>
  );
} 