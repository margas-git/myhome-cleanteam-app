import { useState, useEffect } from "react";
import { AdminLayout } from "../../components/AdminLayout";
import { formatPhoneNumber } from "../../utils/phoneFormatter";
import { buildApiUrl } from "../../config/api";

interface Staff {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  role: string;
  isDriver?: boolean;
  active: boolean;
  createdAt: string;
  activeJob: any;
  team?: {
    teamId: number;
    teamName: string;
    teamColor: string;
  } | null;
}

export function StaffManagement() {
  const [staff, setStaff] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingStaff, setEditingStaff] = useState<Staff | null>(null);
  const [saving, setSaving] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [newStaff, setNewStaff] = useState({
    email: "",
    firstName: "",
    lastName: "",
    phone: "",
    password: "",
    role: "staff",
    isDriver: false
  });
  const [editStaff, setEditStaff] = useState({
    email: "",
    firstName: "",
    lastName: "",
    phone: "",
    password: "",
    role: "staff",
    isDriver: false
  });

  useEffect(() => {
    fetchStaff();
  }, []);

  const fetchStaff = async () => {
    try {
      const response = await fetch(buildApiUrl("/api/admin/staff"), {
        credentials: "include"
      });
      
      if (response.ok) {
        const data = await response.json();
        setStaff(data.data);
      }
    } catch (error) {
      console.error("Failed to fetch staff:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const response = await fetch(buildApiUrl("/api/admin/staff"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        credentials: "include",
        body: JSON.stringify(newStaff)
      });
      
      if (response.ok) {
        setNewStaff({
          email: "",
          firstName: "",
          lastName: "",
          phone: "",
          password: "",
          role: "staff",
          isDriver: false
        });
        setShowAddForm(false);
        fetchStaff(); // Refresh the list
      } else {
        const error = await response.json();
        alert(`Failed to add staff: ${error.error}`);
      }
    } catch (error) {
      console.error("Failed to add staff:", error);
      alert("Failed to add staff");
    }
  };

  const handleEditStaff = (member: Staff) => {
    setEditingStaff(member);
    setEditStaff({
      email: member.email,
      firstName: member.firstName,
      lastName: member.lastName,
      phone: member.phone || "",
      password: "",
      role: member.role,
      isDriver: member.isDriver || false
    });
  };

  const handleUpdateStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStaff) return;
    
    setSaving(true);
    try {
      const response = await fetch(buildApiUrl(`/api/admin/staff/${editingStaff.id}`), {
        method: "PUT",
        headers: {
          "Content-Type": "application/json"
        },
        credentials: "include",
        body: JSON.stringify(editStaff)
      });
      
      if (response.ok) {
        setEditingStaff(null);
        fetchStaff(); // Refresh the list
      } else {
        const error = await response.json();
        alert(`Failed to update staff: ${error.error}`);
      }
    } catch (error) {
      console.error("Failed to update staff:", error);
      alert("Failed to update staff");
    } finally {
      setSaving(false);
    }
  };

  const handleArchiveStaff = async (staffId: number, isArchiving: boolean) => {
    try {
      const response = await fetch(buildApiUrl(`/api/admin/staff/${staffId}`), {
        method: "PUT",
        headers: {
          "Content-Type": "application/json"
        },
        credentials: "include",
        body: JSON.stringify({ active: !isArchiving })
      });

      if (response.ok) {
        fetchStaff(); // Refresh the list
      } else {
        const error = await response.json();
        alert(`Failed to ${isArchiving ? 'archive' : 'restore'} staff: ${error.error}`);
      }
    } catch (error) {
      console.error("Failed to archive staff:", error);
      alert("Failed to archive staff");
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
            Staff Management
          </h1>
          <p className="mt-2 text-gray-600">
            View and manage staff members, their roles, and team assignments.
          </p>
        </div>

        <div className="flex justify-between items-center mb-6">
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
            onClick={() => setShowAddForm(true)}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            Add Staff
          </button>
        </div>

        {/* Staff List */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {staff
            .filter(member => showArchived ? !member.active : member.active)
            .map((member) => (
              <div key={member.id} className={`bg-white rounded-lg shadow-md p-6 relative ${!member.active ? 'opacity-60' : ''}`}>
                {/* Edit button positioned absolutely in top-right corner */}
                <button
                  onClick={() => handleEditStaff(member)}
                  className="absolute top-4 right-4 inline-flex items-center p-2 border border-gray-300 rounded text-sm text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 shadow-sm"
                  title="Edit Staff"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </button>
                
                <div className="pr-12">
                  <h3 className="text-lg font-semibold text-gray-900 mb-1">
                    {member.firstName} {member.lastName}
                  </h3>
                  <div className="flex items-center space-x-2 mb-2">
                    <svg className="w-4 h-4 min-w-4 min-h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207" />
                    </svg>
                    <p className="text-sm text-gray-600 truncate max-w-full" style={{overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'}}>
                      {member.email}
                    </p>
                  </div>
                  {member.phone && (
                    <div className="flex items-center space-x-2 mb-2">
                      <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                      </svg>
                      <a 
                        href={`tel:${member.phone.replace(/\s/g, '')}`}
                        className="text-sm text-gray-500 hover:text-blue-600 transition-colors duration-200"
                      >
                        {formatPhoneNumber(member.phone)}
                      </a>
                    </div>
                  )}
                  <div className="flex items-center space-x-2 mt-3">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      member.role === 'admin' ? 'bg-red-100 text-red-800' :
                      member.role === 'manager' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-blue-100 text-blue-800'
                    }`}>
                      {member.role.charAt(0).toUpperCase() + member.role.slice(1)}
                    </span>
                    {member.team && (
                      <span 
                        className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium text-white"
                        style={{ backgroundColor: member.team.teamColor }}
                      >
                        {member.team.teamName}
                      </span>
                    )}
                    {!member.active && (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                        Archived
                      </span>
                    )}
                  </div>
                </div>
                
                <div className="space-y-2">
                  {member.isDriver && (
                    <div className="flex items-center text-sm text-gray-600">
                      <svg className="w-4 h-4 mr-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      Driver
                    </div>
                  )}
                  {member.activeJob && (
                    <div className="flex items-center text-sm text-green-600">
                      <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Active - {member.activeJob.customerName}
                    </div>
                  )}
                </div>
              </div>
            ))}
        </div>
      </div>

      {/* Add Staff Modal */}
      {showAddForm && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <button
              onClick={() => setShowAddForm(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Add New Staff</h3>
              <form onSubmit={handleAddStaff}>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">First Name</label>
                    <input
                      type="text"
                      required
                      value={newStaff.firstName}
                      onChange={(e) => setNewStaff({...newStaff, firstName: e.target.value})}
                      className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Last Name</label>
                    <input
                      type="text"
                      required
                      value={newStaff.lastName}
                      onChange={(e) => setNewStaff({...newStaff, lastName: e.target.value})}
                      className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Email</label>
                    <input
                      type="email"
                      required
                      value={newStaff.email}
                      onChange={(e) => setNewStaff({...newStaff, email: e.target.value})}
                      className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Phone</label>
                    <input
                      type="tel"
                      value={newStaff.phone}
                      onChange={(e) => {
                        const rawValue = e.target.value.replace(/\D/g, '');
                        let formattedValue = rawValue;
                        if (rawValue.length >= 4) {
                          formattedValue = rawValue.slice(0, 4) + ' ' + rawValue.slice(4);
                        }
                        if (rawValue.length >= 7) {
                          formattedValue = formattedValue.slice(0, 8) + ' ' + formattedValue.slice(8);
                        }
                        setNewStaff({...newStaff, phone: formattedValue});
                      }}
                      placeholder="0000 000 000"
                      className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Password</label>
                    <input
                      type="password"
                      required
                      value={newStaff.password}
                      onChange={(e) => setNewStaff({...newStaff, password: e.target.value})}
                      className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Role</label>
                    <select
                      value={newStaff.role}
                      onChange={(e) => setNewStaff({...newStaff, role: e.target.value})}
                      className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="staff">Staff</option>
                      <option value="manager">Manager</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>
                  <div className="flex items-center">
                    <input
                      id="new-staff-driver"
                      type="checkbox"
                      checked={newStaff.isDriver}
                      onChange={(e) => setNewStaff({...newStaff, isDriver: e.target.checked})}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <label htmlFor="new-staff-driver" className="ml-2 block text-sm text-gray-900">
                      Driver
                    </label>
                  </div>
                </div>
                <div className="flex justify-end space-x-3 mt-6">
                  <button
                    type="button"
                    onClick={() => setShowAddForm(false)}
                    className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  >
                    Add Staff
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Edit Staff Modal */}
      {editingStaff && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <button
              onClick={() => setEditingStaff(null)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Edit Staff</h3>
              <form onSubmit={handleUpdateStaff}>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">First Name</label>
                    <input
                      type="text"
                      required
                      value={editStaff.firstName}
                      onChange={(e) => setEditStaff({...editStaff, firstName: e.target.value})}
                      className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Last Name</label>
                    <input
                      type="text"
                      required
                      value={editStaff.lastName}
                      onChange={(e) => setEditStaff({...editStaff, lastName: e.target.value})}
                      className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Email</label>
                    <input
                      type="email"
                      required
                      value={editStaff.email}
                      onChange={(e) => setEditStaff({...editStaff, email: e.target.value})}
                      className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Phone</label>
                    <input
                      type="tel"
                      value={editStaff.phone}
                      onChange={(e) => {
                        const rawValue = e.target.value.replace(/\D/g, '');
                        let formattedValue = rawValue;
                        if (rawValue.length >= 4) {
                          formattedValue = rawValue.slice(0, 4) + ' ' + rawValue.slice(4);
                        }
                        if (rawValue.length >= 7) {
                          formattedValue = formattedValue.slice(0, 8) + ' ' + formattedValue.slice(8);
                        }
                        setEditStaff({...editStaff, phone: formattedValue});
                      }}
                      placeholder="0000 000 000"
                      className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Password</label>
                    <input
                      type="password"
                      value={editStaff.password}
                      onChange={(e) => setEditStaff({...editStaff, password: e.target.value})}
                      placeholder="Leave blank to keep current password"
                      className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    />
                    <p className="mt-1 text-xs text-gray-500">Leave blank to keep current password</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Role</label>
                    <select
                      value={editStaff.role}
                      onChange={(e) => setEditStaff({...editStaff, role: e.target.value})}
                      className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="staff">Staff</option>
                      <option value="manager">Manager</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>
                  <div className="flex items-center">
                    <input
                      id="edit-staff-driver"
                      type="checkbox"
                      checked={editStaff.isDriver}
                      onChange={(e) => setEditStaff({...editStaff, isDriver: e.target.checked})}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <label htmlFor="edit-staff-driver" className="ml-2 block text-sm text-gray-900">
                      Driver
                    </label>
                  </div>
                </div>
                  <div className="flex justify-between items-center pt-4">
                    <button
                      type="button"
                      onClick={() => handleArchiveStaff(editingStaff.id, editingStaff.active)}
                      className={`inline-flex items-center h-[42px] px-4 border rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                        editingStaff.active 
                          ? 'border-red-300 text-red-700 bg-red-50 hover:bg-red-100 focus:ring-red-500' 
                          : 'border-green-300 text-green-700 bg-green-50 hover:bg-green-100 focus:ring-green-500'
                      }`}
                      title={editingStaff.active ? "Archive Staff" : "Restore Staff"}
                    >
                      {editingStaff.active ? (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                        </svg>
                      ) : (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                      )}
                    </button>
                    <div className="flex space-x-3">
                      <button
                        type="button"
                        onClick={() => setEditingStaff(null)}
                        className="inline-flex items-center h-[42px] px-4 border border-gray-300 rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                        title="Cancel"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                      <button
                        type="submit"
                        disabled={saving}
                        className="inline-flex items-center h-[42px] px-4 border border-transparent rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                        title="Save Changes"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </button>
                    </div>
                  </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
} 