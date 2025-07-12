import { useState, useEffect } from "react";
import { AdminLayout } from "../../components/AdminLayout";
import { formatAddress } from '../../utils/addressFormatter';
import { buildApiUrl } from "../../config/api";

interface Team {
  id: number;
  name: string;
  colorHex: string;
  active: boolean;
  memberCount: number;
  members?: Staff[];
  createdAt: string;
  activeJob?: {
    id: number;
    customerName: string;
    customerAddress: string;
  };
  averageEfficiency?: number;
  averageWageRatio?: number;
  totalRevenue?: number;
  totalWages?: number;
  completedJobsCount?: number;
}

interface Staff {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  active: boolean;
}

export function TeamManagement() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [allStaff, setAllStaff] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const [saving, setSaving] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [newTeam, setNewTeam] = useState({
    name: "",
    color: "#3B82F6",
    description: ""
  });
  const [editTeam, setEditTeam] = useState({
    name: "",
    color: "#3B82F6"
  });

  const colorOptions = [
    { value: "#3B82F6", name: "Blue" },
    { value: "#10B981", name: "Green" },
    { value: "#F59E0B", name: "Orange" },
    { value: "#EF4444", name: "Red" },
    { value: "#8B5CF6", name: "Purple" },
    { value: "#06B6D4", name: "Cyan" },
    { value: "#84CC16", name: "Lime" },
    { value: "#F97316", name: "Orange" }
  ];

  useEffect(() => {
    fetchTeams();
    fetchStaff();
  }, []);

  const fetchTeams = async () => {
    try {
      const response = await fetch(buildApiUrl("/api/admin/teams"), {
        credentials: "include"
      });
      
      if (response.ok) {
        const data = await response.json();
        setTeams(data.data);
      }
    } catch (error) {
      console.error("Failed to fetch teams:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStaff = async () => {
    try {
      const response = await fetch(buildApiUrl("/api/admin/staff"), {
        credentials: "include"
      });
      
      if (response.ok) {
        const data = await response.json();
        setAllStaff(data.data);
      }
    } catch (error) {
      console.error("Failed to fetch staff:", error);
    }
  };

  const handleAddTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const response = await fetch(buildApiUrl("/api/admin/teams"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        credentials: "include",
        body: JSON.stringify({
          name: newTeam.name,
          colorHex: newTeam.color,
          description: newTeam.description
        })
      });
      
      if (response.ok) {
        setNewTeam({
          name: "",
          color: "#3B82F6",
          description: ""
        });
        setShowAddForm(false);
        fetchTeams(); // Refresh the list
      } else {
        const error = await response.json();
        alert(`Failed to add team: ${error.error}`);
      }
    } catch (error) {
      console.error("Failed to add team:", error);
      alert("Failed to add team");
    }
  };

  const handleEditTeam = async (team: Team) => {
    try {
      // Fetch team details with members
      const response = await fetch(buildApiUrl(`/api/admin/teams/${team.id}`), {
        credentials: "include"
      });
      
      if (response.ok) {
        const data = await response.json();
        const teamWithMembers = data.data;
        setEditingTeam(teamWithMembers);
        setEditTeam({
          name: teamWithMembers.name,
          color: teamWithMembers.colorHex
        });
      }
    } catch (error) {
      console.error("Failed to fetch team details:", error);
      // Fallback to original team data
      setEditingTeam(team);
      setEditTeam({
        name: team.name,
        color: team.colorHex
      });
    }
  };

  const handleUpdateTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTeam) return;
    
    setSaving(true);
    try {
      const response = await fetch(buildApiUrl(`/api/admin/teams/${editingTeam.id}`), {
        method: "PUT",
        headers: {
          "Content-Type": "application/json"
        },
        credentials: "include",
        body: JSON.stringify({
          name: editTeam.name,
          colorHex: editTeam.color
        })
      });
      
      if (response.ok) {
        setEditingTeam(null);
        fetchTeams(); // Refresh the list
      } else {
        const error = await response.json();
        alert(`Failed to update team: ${error.error}`);
      }
    } catch (error) {
      console.error("Failed to update team:", error);
      alert("Failed to update team");
    } finally {
      setSaving(false);
    }
  };

  const handleArchiveTeam = async (teamId: number, isArchiving: boolean) => {
    try {
      const response = await fetch(buildApiUrl(`/api/admin/teams/${teamId}`), {
        method: "PUT",
        headers: {
          "Content-Type": "application/json"
        },
        credentials: "include",
        body: JSON.stringify({ active: !isArchiving })
      });

      if (response.ok) {
        fetchTeams(); // Refresh the list
      } else {
        const error = await response.json();
        alert(`Failed to ${isArchiving ? 'archive' : 'restore'} team: ${error.error}`);
      }
    } catch (error) {
      console.error("Failed to archive team:", error);
      alert("Failed to archive team");
    }
  };

  const handleAddTeamMember = async (teamId: number, userId: number) => {
    try {
      const response = await fetch(buildApiUrl(`/api/admin/teams/${teamId}/members`), {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        credentials: "include",
        body: JSON.stringify({ userId })
      });
      
      if (response.ok) {
        // Refresh the editing team data to show the new member
        if (editingTeam) {
          const teamResponse = await fetch(buildApiUrl(`/api/admin/teams/${editingTeam.id}`), {
            credentials: "include"
          });
          
          if (teamResponse.ok) {
            const teamData = await teamResponse.json();
            setEditingTeam(teamData.data);
          }
        }
        // Also refresh the main teams list
        fetchTeams();
      } else {
        const error = await response.json();
        alert(error.error || "Failed to add team member");
      }
    } catch (error) {
      console.error("Failed to add team member:", error);
      alert("Failed to add team member");
    }
  };

  const handleRemoveTeamMember = async (teamId: number, userId: number) => {
    try {
      const response = await fetch(buildApiUrl(`/api/admin/teams/${teamId}/members/${userId}`), {
        method: "DELETE",
        credentials: "include"
      });

      if (response.ok) {
        // Refresh team details and teams list
        fetchTeams();
        // Refresh the editing team data
        if (editingTeam) {
          const teamResponse = await fetch(buildApiUrl(`/api/admin/teams/${teamId}`), {
            credentials: "include"
          });
          if (teamResponse.ok) {
            const data = await teamResponse.json();
            setEditingTeam(data.data);
          }
        }
      } else {
        const error = await response.json();
        alert(`Failed to remove team member: ${error.error}`);
      }
    } catch (error) {
      console.error("Failed to remove team member:", error);
      alert("Failed to remove team member");
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
            Team Management
          </h1>
          <p className="mt-2 text-gray-600">
            Create and manage cleaning teams, assign members, and track performance.
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
            Add Team
          </button>
        </div>

        {/* Team List */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {teams.filter(team => showArchived ? !team.active : team.active).map((team) => (
            <div key={team.id} className="bg-white rounded-lg shadow p-6 relative">
              {/* Edit button in top right */}
              <button 
                onClick={() => handleEditTeam(team)}
                className="absolute top-6 right-6 inline-flex items-center p-2 border border-gray-300 rounded text-sm text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                title="Edit Team"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </button>

              <div className="flex items-center mb-4">
                <div 
                  className="w-8 h-8 rounded-full flex items-center justify-center text-white font-medium"
                  style={{ backgroundColor: team.colorHex }}
                >
                  {team.name.charAt(0)}
                </div>
                <h3 className="ml-3 text-lg font-medium text-gray-900">
                  {team.name}
                </h3>
              </div>

              {/* Active badge separate from header - only show for archived teams */}
              {!team.active && (
                <div className="mb-4">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                    Archived
                  </span>
                </div>
              )}
              
              <div className="text-sm text-gray-500 mb-3">
                {/* Show team members instead of count */}
                <div className="mb-2 flex items-center">
                  <svg className="w-4 h-4 mr-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  <span className="font-medium">Team Members:</span>
                </div>
                {team.members && team.members.length > 0 ? (
                  <div className="space-y-1 ml-6 mb-5">
                    {team.members.map((member) => (
                      <div key={member.id} className="text-gray-600">
                        {member.firstName} {member.lastName}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-gray-400 italic ml-6 mb-5">No members assigned</div>
                )}
                
                {/* Team Performance Metrics */}
                <div className="mt-3 space-y-2">
                  {/* Efficiency */}
                  <div className="p-2 bg-gray-50 border border-gray-200 rounded">
                    <div className="text-gray-800 font-medium text-sm">Average Efficiency:</div>
                    <div className={`text-sm font-semibold ${
                      team.averageEfficiency && team.averageEfficiency >= 100 ? 'text-green-600' : 
                      team.averageEfficiency && team.averageEfficiency >= 80 ? 'text-yellow-600' : 'text-red-600'
                    }`}>
                      {team.averageEfficiency ? `${team.averageEfficiency}%` : 'N/A'}
                    </div>
                  </div>

                  {/* Wage Ratio */}
                  <div className="p-2 bg-gray-50 border border-gray-200 rounded">
                    <div className="text-gray-800 font-medium text-sm">Average Wage Ratio:</div>
                    <div className={`text-sm font-semibold ${
                      team.averageWageRatio && team.averageWageRatio <= 30 ? 'text-green-600' : 
                      team.averageWageRatio && team.averageWageRatio <= 40 ? 'text-yellow-600' : 'text-red-600'
                    }`}>
                      {team.averageWageRatio ? `${team.averageWageRatio}%` : 'N/A'}
                    </div>
                  </div>

                  {/* Revenue and Jobs */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="p-2 bg-gray-50 border border-gray-200 rounded">
                      <div className="text-gray-800 font-medium text-xs">Total Revenue:</div>
                      <div className="text-sm font-semibold text-green-600">
                        ${team.totalRevenue ? team.totalRevenue.toLocaleString() : '0'}
                      </div>
                    </div>
                    <div className="p-2 bg-gray-50 border border-gray-200 rounded">
                      <div className="text-gray-800 font-medium text-xs">Completed Jobs:</div>
                      <div className="text-sm font-semibold text-blue-600">
                        {team.completedJobsCount || 0}
                      </div>
                    </div>
                  </div>
                </div>
                
                {team.activeJob && (
                  <div className="mt-3 p-2 bg-blue-50 border border-blue-200 rounded">
                    <div className="text-blue-800 font-medium">Currently cleaning:</div>
                    <div className="text-blue-700">{team.activeJob.customerName}</div>
                    <div className="text-blue-600 text-xs">{formatAddress(team.activeJob.customerAddress)}</div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {teams.length === 0 && (
          <div className="text-center py-12">
            <div className="text-gray-500">No teams found. Create your first team to get started.</div>
          </div>
        )}
      </div>

      {/* Add Team Modal */}
      {showAddForm && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center">
          <div className="bg-white rounded-lg p-6 w-full max-w-md relative">
            <button
              onClick={() => setShowAddForm(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              Add New Team
            </h3>
            
            <form onSubmit={handleAddTeam} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Team Name *
                </label>
                <input
                  type="text"
                  required
                  value={newTeam.name}
                  onChange={(e) => setNewTeam({ ...newTeam, name: e.target.value })}
                  className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                  placeholder="e.g., Cleaning Team A"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Team Color
                </label>
                <div className="mt-2 grid grid-cols-4 gap-2">
                  {colorOptions.map((color) => (
                    <button
                      key={color.value}
                      type="button"
                      onClick={() => setNewTeam({ ...newTeam, color: color.value })}
                      className={`w-full h-10 rounded-md border-2 ${
                        newTeam.color === color.value ? 'border-gray-900' : 'border-gray-200'
                      }`}
                      style={{ backgroundColor: color.value }}
                      title={color.name}
                    />
                  ))}
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Description
                </label>
                <textarea
                  value={newTeam.description}
                  onChange={(e) => setNewTeam({ ...newTeam, description: e.target.value })}
                  className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                  rows={3}
                  placeholder="Optional description of the team's responsibilities..."
                />
              </div>
              
              <div className="flex justify-end space-x-3 pt-4">
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
                  Add Team
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Team Form Modal */}
      {editingTeam && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <button
              onClick={() => setEditingTeam(null)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Edit Team</h3>
              <form onSubmit={handleUpdateTeam}>
                <div className="space-y-4">
                  <div className="flex items-end space-x-3">
                    <div className="flex-1">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Team Name</label>
                      <input
                        type="text"
                        required
                        value={editTeam.name}
                        onChange={(e) => setEditTeam({...editTeam, name: e.target.value})}
                        className="block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                    <div className="w-12">
                      <label className="block text-sm font-medium text-gray-700 mb-1">&nbsp;</label>
                      <input
                        type="color"
                        required
                        value={editTeam.color}
                        onChange={(e) => setEditTeam({...editTeam, color: e.target.value})}
                        className="block w-full h-[42px] rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 cursor-pointer"
                        style={{ backgroundColor: editTeam.color }}
                        title="Team Color"
                      />
                    </div>
                  </div>
                </div>

                {/* Staff Management Section */}
                <div className="mt-6 border-t pt-4">
                  {/* Current Team Members */}
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Current Members:</label>
                    {editingTeam.members && editingTeam.members.length > 0 ? (
                      <div className="space-y-2">
                        {editingTeam.members.map((member) => (
                          <div key={member.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200 hover:bg-gray-100 transition-colors">
                            <div className="flex items-center space-x-3">
                              <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                                <span className="text-sm font-medium text-blue-700">
                                  {member.firstName.charAt(0)}{member.lastName.charAt(0)}
                                </span>
                              </div>
                              <div>
                                <div className="text-sm font-medium text-gray-900">
                                  {member.firstName} {member.lastName}
                                </div>
                                <div className="text-xs text-gray-500">{member.role}</div>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleRemoveTeamMember(editingTeam.id, member.id)}
                              className="text-red-600 hover:text-red-800 hover:bg-red-50 p-1 rounded transition-colors"
                              title="Remove member"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-sm text-gray-500 italic p-3 bg-gray-50 rounded-lg border border-gray-200">
                        No members assigned
                      </div>
                    )}
                  </div>

                  {/* Add New Member */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Add Member:</label>
                    <select
                      onChange={(e) => {
                        const selectedStaff = allStaff.find(staff => staff.id === parseInt(e.target.value));
                        if (selectedStaff) {
                          handleAddTeamMember(editingTeam.id, selectedStaff.id);
                        }
                      }}
                      className="block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      defaultValue=""
                    >
                      <option value="" disabled>Select staff member...</option>
                      {allStaff
                        .filter(staff => {
                          // Only show active staff who are not already assigned to any team
                          if (!staff.active) return false;
                          
                          // Check if staff is already assigned to any team
                          const isAssignedToAnyTeam = teams.some(team => 
                            team.members && team.members.some(member => member.id === staff.id)
                          );
                          
                          return !isAssignedToAnyTeam;
                        })
                        .map((staff) => (
                          <option key={staff.id} value={staff.id}>
                            {staff.firstName} {staff.lastName}
                          </option>
                        ))}
                    </select>
                  </div>
                </div>

                <div className="flex justify-between items-center pt-4">
                  <button
                    type="button"
                    onClick={() => handleArchiveTeam(editingTeam.id, editingTeam.active)}
                    className={`inline-flex items-center h-[42px] px-4 border rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                      editingTeam.active 
                        ? 'border-red-300 text-red-700 bg-red-50 hover:bg-red-100 focus:ring-red-500' 
                        : 'border-green-300 text-green-700 bg-green-50 hover:bg-green-100 focus:ring-green-500'
                    }`}
                    title={editingTeam.active ? "Archive Team" : "Restore Team"}
                  >
                    {editingTeam.active ? (
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
                      onClick={() => setEditingTeam(null)}
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