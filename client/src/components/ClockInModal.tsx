import { useState, useEffect, useRef } from "react";
import { useGoogleMaps } from "../hooks/useGoogleMaps";
import { formatAddress } from '../utils/addressFormatter';
import { buildApiUrl } from "../config/api";
import { StreetViewImage } from "../pages/staff/StaffDashboard";

interface Customer {
  id: number;
  name: string;
  address: string;
}

interface Team {
  id: number;
  name: string;
  color: string;
}

interface TeamMember {
  id: number;
  firstName: string;
  lastName: string;
  teamId: number;
}

interface ClockInModalProps {
  customer: Customer | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  allottedMinutes?: number;
  preloadedTeams?: Team[];
  preloadedTeamMembers?: { [teamId: number]: TeamMember[] };
  preloadedOtherTeamMembers?: TeamMember[];
}

export function ClockInModal({ customer, isOpen, onClose, onSuccess, allottedMinutes, preloadedTeams, preloadedTeamMembers, preloadedOtherTeamMembers }: ClockInModalProps) {
  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<number | null>(null);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [selectedMembers, setSelectedMembers] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [otherTeamMembers, setOtherTeamMembers] = useState<TeamMember[]>([]);
  const [selectedOtherMembers, setSelectedOtherMembers] = useState<number[]>([]);
  const [addedOtherMembers, setAddedOtherMembers] = useState<TeamMember[]>([]);
  
  // Customer search state
  const [allCustomers, setAllCustomers] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(customer);
  const [searchTerm, setSearchTerm] = useState('');
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);
  // const { apiKey } = useGoogleMaps();
  const apiKey = "AIzaSyDhogaiA91DQLL0spIyywjBsB7An04TGhI";

  useEffect(() => {
    if (isOpen) {
      if (preloadedTeams) {
        setTeams(preloadedTeams);
        if (preloadedTeams.length === 1) {
          setSelectedTeam(preloadedTeams[0].id);
        }
      } else {
        fetchTeams();
      }
      if (!customer) {
        fetchAllCustomers();
      }
    }
  }, [isOpen, customer, preloadedTeams]);

  useEffect(() => {
    setSelectedCustomer(customer);
  }, [customer]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      if (!target.closest('.customer-search-container')) {
        setShowCustomerDropdown(false);
      }
    };

    if (showCustomerDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showCustomerDropdown]);

  useEffect(() => {
    if (selectedTeam) {
      if (preloadedTeamMembers && preloadedTeamMembers[selectedTeam]) {
        setTeamMembers(preloadedTeamMembers[selectedTeam]);
        setSelectedMembers(preloadedTeamMembers[selectedTeam].map((member: TeamMember) => member.id));
      } else {
        fetchTeamMembers(selectedTeam);
      }
    }
  }, [selectedTeam, preloadedTeamMembers]);

  const fetchTeams = async () => {
    try {
      const response = await fetch(buildApiUrl("/api/staff/teams"), {
        credentials: "include"
      });
      
      if (response.ok) {
        const data = await response.json();
        setTeams(data.data);
        if (data.data.length === 1) {
          setSelectedTeam(data.data[0].id);
        }
      }
    } catch (error) {
      console.error("Failed to fetch teams:", error);
    }
  };

  const fetchAllCustomers = async () => {
    try {
      const response = await fetch(buildApiUrl("/api/staff/customers"), {
        credentials: "include"
      });
      
      if (response.ok) {
        const data = await response.json();
        setAllCustomers(data.data);
      }
    } catch (error) {
      console.error("Failed to fetch customers:", error);
    }
  };

  const fetchTeamMembers = async (teamId: number) => {
    try {
      const response = await fetch(buildApiUrl(`/api/staff/teams/${teamId}/members`), {
        credentials: "include"
      });
      
      if (response.ok) {
        const data = await response.json();
        setTeamMembers(data.data || []);
        // Auto-select all team members by default
        setSelectedMembers(data.data?.map((member: TeamMember) => member.id) || []);
      }
    } catch (error) {
      console.error("Failed to fetch team members:", error);
    }
  };

  const fetchOtherTeamMembers = async () => {
    if (!selectedTeam) {
      console.error("No team selected");
      return;
    }
    
    console.log("🔍 Fetching other team members for team:", selectedTeam);
    
    try {
      const url = buildApiUrl(`/api/staff/teams/other-members?teamId=${selectedTeam}`);
      console.log("📡 API URL:", url);
      
      const response = await fetch(url, {
        credentials: "include"
      });
      
      console.log("📥 Response status:", response.status);
      
      if (response.ok) {
        const data = await response.json();
        console.log("📋 Received data:", data);
        setOtherTeamMembers(data.data || []);
      } else {
        console.error("❌ API error:", response.status, response.statusText);
      }
    } catch (error) {
      console.error("Failed to fetch other team members:", error);
    }
  };

  const handleMemberToggle = (memberId: number) => {
    setSelectedMembers(prev => 
      prev.includes(memberId) 
        ? prev.filter(id => id !== memberId)
        : [...prev, memberId]
    );
  };

  const handleOtherMemberToggle = (memberId: number) => {
    setSelectedOtherMembers(prev => 
      prev.includes(memberId) 
        ? prev.filter(id => id !== memberId)
        : [...prev, memberId]
    );
  };

  const handleAddOtherMembers = () => {
    // Get the actual member objects for the selected IDs
    const membersToAdd = otherTeamMembers.filter(member => 
      selectedOtherMembers.includes(member.id)
    );
    
    // Add selected other team members to the main selection
    setSelectedMembers(prev => [...prev, ...selectedOtherMembers]);
    
    // Add them to the addedOtherMembers list so they show in the UI
    setAddedOtherMembers(prev => [...prev, ...membersToAdd]);
    
    setShowAddMemberModal(false);
    setSelectedOtherMembers([]);
  };

  const handleRemoveOtherMember = (memberId: number) => {
    // Remove from selected members
    setSelectedMembers(prev => prev.filter(id => id !== memberId));
    
    // Remove from added other members
    setAddedOtherMembers(prev => prev.filter(member => member.id !== memberId));
  };

  const handleOpenAddMemberModal = () => {
    setShowAddMemberModal(true);
    
    // Use pre-loaded data if available, otherwise fetch
    if (preloadedOtherTeamMembers && selectedTeam) {
      // Filter the pre-loaded data for the current team
      const filteredOtherMembers = preloadedOtherTeamMembers.filter(member => 
        member.teamId !== selectedTeam
      );
      setOtherTeamMembers(filteredOtherMembers);
    } else {
      fetchOtherTeamMembers();
    }
  };

  const handleClockIn = async () => {
    if (!selectedTeam || !selectedCustomer || !selectedMembers.length) {
      setError("Please fill in all required fields");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await fetch(buildApiUrl("/api/staff/time-entries/clock-in"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          teamId: typeof selectedTeam === 'object' && selectedTeam !== null ? (selectedTeam as any).id : selectedTeam,
          customerId: selectedCustomer && typeof selectedCustomer === 'object' ? (selectedCustomer as any).id : selectedCustomer,
          memberIds: selectedMembers.map(m => typeof m === 'object' && m !== null ? (m as any).id : m)
        })
      });

      const data = await response.json();

      if (response.ok) {
        onSuccess();
        onClose();
      } else {
        setError(data.error || "Failed to clock in");
      }
    } catch (error) {
      setError("Network error occurred");
    } finally {
      setLoading(false);
    }
  };

  const getInitials = (firstName: string, lastName: string) => {
    return `${firstName[0]}${lastName[0]}`.toUpperCase();
  };

  const getMemberTeam = (memberId: number) => {
    const member = otherTeamMembers.find(m => m.id === memberId);
    if (member) {
      if (member.teamId === null) {
        return 'Unassigned';
      }
      const team = teams.find(t => t.id === member.teamId);
      return team?.name || 'Unknown Team';
    }
    return '';
  };

  // Calculate adjusted completion time based on number of selected team members
  const calculateAdjustedCompletionTime = () => {
    if (!allottedMinutes) return null;
    
    const selectedCount = selectedMembers.length;
    let adjustedMinutes = allottedMinutes;
    
    // Adjust time based on team size (same logic as backend)
    if (selectedCount === 1) {
      adjustedMinutes = allottedMinutes * 2; // Solo: double the time
    } else if (selectedCount > 2) {
      adjustedMinutes = Math.round(allottedMinutes * (2 / selectedCount));
    }
    // For 2 people, use the default time
    
    const now = new Date();
    const completionTime = new Date(now.getTime() + adjustedMinutes * 60000);
    return completionTime.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    });
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <div className="fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border bg-white p-6 shadow-lg duration-200 sm:rounded-lg sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute right-4 top-4 rounded-sm opacity-70 transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:pointer-events-none"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
              <path d="M18 6 6 18"></path>
              <path d="m6 6 12 12"></path>
            </svg>
            <span className="sr-only">Close</span>
          </button>

          {/* Header */}
          <div className="flex flex-col space-y-1.5 text-center sm:text-left">
            <h2 className="text-lg font-semibold leading-none tracking-tight">Clock In</h2>
            <p className="text-sm text-gray-600">Select a customer to start tracking time</p>
          </div>

          <div className="space-y-4 py-4">
            {/* Customer Information */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Customer</label>
              {selectedCustomer ? (
                <div className="p-3 border rounded-lg bg-gray-50">
                  <div>
                    <div className="font-medium text-black">{selectedCustomer.name}</div>
                    <div className="text-sm text-gray-600">{selectedCustomer.address ? formatAddress(selectedCustomer.address) : ''}</div>
                    {allottedMinutes && (
                      <div className="text-xs text-blue-600 mt-1">
                        Target completion time: <span className="font-semibold">
                          {calculateAdjustedCompletionTime()}
                        </span>
                        {selectedMembers.length !== 2 && (
                          <span className="text-xs text-gray-500 ml-1">
                            ({selectedMembers.length} {selectedMembers.length === 1 ? 'person' : 'people'})
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="relative customer-search-container">
                  <input
                    type="text"
                    placeholder="Search for a customer..."
                    value={searchTerm}
                    onChange={(e) => {
                      setSearchTerm(e.target.value);
                      setShowCustomerDropdown(true);
                    }}
                    onFocus={() => setShowCustomerDropdown(true)}
                    className="w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  {showCustomerDropdown && searchTerm && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                      {allCustomers
                        .filter(c => c.name.toLowerCase().includes(searchTerm.toLowerCase()))
                        .map(customer => (
                          <button
                            key={customer.id}
                            onClick={() => {
                              setSelectedCustomer(customer);
                              setSearchTerm('');
                              setShowCustomerDropdown(false);
                            }}
                            className="w-full p-3 text-left hover:bg-gray-50 border-b border-gray-100 last:border-b-0"
                          >
                            <div className="font-medium">{customer.name}</div>
                            <div className="text-sm text-gray-600">{formatAddress(customer.address)}</div>
                          </button>
                        ))}
                    </div>
                  )}
                </div>
              )}
            </div>



            {/* Team Selection */}
            {teams.length > 1 && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path>
                    <circle cx="9" cy="7" r="4"></circle>
                    <path d="M22 21v-2a4 4 0 0 0-3-3.87"></path>
                    <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                  </svg>
                  Select Team
                </label>
                <div className="border rounded-lg p-4 bg-gray-50">
                  <div className="space-y-3">
                    {teams.map((team) => (
                      <div key={team.id} className="flex items-center space-x-3">
                        <button
                          type="button"
                          role="checkbox"
                          aria-checked={selectedTeam === team.id}
                          data-state={selectedTeam === team.id ? "checked" : "unchecked"}
                          onClick={() => setSelectedTeam(team.id)}
                          className={`peer h-4 w-4 shrink-0 rounded-sm border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${
                            selectedTeam === team.id 
                              ? 'bg-blue-600 border-blue-600 text-white' 
                              : 'border-gray-300 bg-white'
                          }`}
                        >
                          {selectedTeam === team.id && (
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                              <polyline points="20,6 9,17 4,12"></polyline>
                            </svg>
                          )}
                        </button>
                        <label className="flex items-center space-x-2 cursor-pointer flex-1">
                          <div 
                            className="w-8 h-8 rounded-full flex items-center justify-center"
                            style={{ backgroundColor: `${team.color}20` }}
                          >
                            <span className="text-sm font-medium" style={{ color: team.color }}>
                              {team.name.split(' ').map(word => word[0]).join('').toUpperCase()}
                            </span>
                          </div>
                          <span className="text-sm font-medium">{team.name}</span>
                        </label>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-gray-500 mt-3">Select a team to clock in with</p>
                </div>
              </div>
            )}

            {/* Team Members Section */}
            {selectedTeam && (teamMembers.length > 0 || addedOtherMembers.length > 0) && (
              <div className="mt-6">
                <div className="border rounded-lg p-4 bg-gray-50">
                  <label className="text-base font-medium flex items-center mb-3">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 mr-2">
                      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path>
                      <circle cx="9" cy="7" r="4"></circle>
                      <path d="M22 21v-2a4 4 0 0 0-3-3.87"></path>
                      <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                    </svg>
                    Team Members Present
                  </label>
                  
                  {/* Current Team Members */}
                  {teamMembers.length > 0 && (
                    <div className="space-y-3 mb-4">
                      {teamMembers.map((member) => (
                        <div key={member.id} className="flex items-center space-x-3">
                          <button
                            type="button"
                            role="checkbox"
                            aria-checked={selectedMembers.includes(member.id)}
                            data-state={selectedMembers.includes(member.id) ? "checked" : "unchecked"}
                            onClick={() => handleMemberToggle(member.id)}
                            className={`peer h-4 w-4 shrink-0 rounded-sm border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${
                              selectedMembers.includes(member.id)
                                ? 'bg-blue-600 border-blue-600 text-white' 
                                : 'border-gray-300 bg-white'
                            }`}
                          >
                            {selectedMembers.includes(member.id) && (
                              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                                <polyline points="20,6 9,17 4,12"></polyline>
                              </svg>
                            )}
                          </button>
                          <label className="flex items-center space-x-2 cursor-pointer flex-1">
                            <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                              <span className="text-sm font-medium text-blue-600">
                                {getInitials(member.firstName, member.lastName)}
                              </span>
                            </div>
                            <span className="text-sm font-medium">{member.firstName} {member.lastName}</span>
                          </label>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Added Other Team Members */}
                  {addedOtherMembers.length > 0 && (
                    <div className="space-y-3 mb-4">
                      <div className="text-xs font-medium text-gray-600 mb-2">Added from other teams:</div>
                      {addedOtherMembers.map((member) => (
                        <div key={member.id} className="flex items-center space-x-3">
                          <button
                            type="button"
                            role="checkbox"
                            aria-checked={selectedMembers.includes(member.id)}
                            data-state={selectedMembers.includes(member.id) ? "checked" : "unchecked"}
                            onClick={() => handleMemberToggle(member.id)}
                            className={`peer h-4 w-4 shrink-0 rounded-sm border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${
                              selectedMembers.includes(member.id)
                                ? 'bg-blue-600 border-blue-600 text-white' 
                                : 'border-gray-300 bg-white'
                            }`}
                          >
                            {selectedMembers.includes(member.id) && (
                              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                                <polyline points="20,6 9,17 4,12"></polyline>
                              </svg>
                            )}
                          </button>
                          <label className="flex items-center space-x-2 cursor-pointer flex-1">
                            <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                              <span className="text-sm font-medium text-green-600">
                                {getInitials(member.firstName, member.lastName)}
                              </span>
                            </div>
                            <div className="flex-1">
                              <span className="text-sm font-medium">{member.firstName} {member.lastName}</span>
                              <div className="text-xs text-gray-500">{getMemberTeam(member.id)}</div>
                            </div>
                          </label>
                          <button
                            onClick={() => handleRemoveOtherMember(member.id)}
                            className="text-red-500 hover:text-red-700 p-1"
                            title="Remove member"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M18 6 6 18"></path>
                              <path d="m6 6 12 12"></path>
                            </svg>
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  <p className="text-xs text-gray-500 mt-3">Unchecked team members won't be tracked for this clean</p>
                  <div className="mt-4 border-t pt-4">
                    <button 
                      onClick={handleOpenAddMemberModal}
                      className="inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-gray-300 bg-white hover:bg-gray-50 h-9 rounded-md px-3 w-full"
                    >
                      Add Team Member from Other Team
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Error Message */}
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}
          </div>

          {/* Footer Buttons */}
          <div className="flex gap-3 pt-4">
            <button
              onClick={onClose}
              disabled={loading}
              className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 h-10 px-4 py-2 flex-1"
            >
              Cancel
            </button>
            <button
              onClick={handleClockIn}
              disabled={loading || !selectedTeam || !selectedCustomer}
              className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-blue-600 text-white hover:bg-blue-700 h-10 px-4 py-2 flex-1"
            >
              {loading ? "Clocking In..." : "Clock In"}
            </button>
          </div>
        </div>
      </div>

      {/* Add Team Member Modal */}
      {showAddMemberModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-[60]">
          <div className="fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border bg-white p-6 shadow-lg duration-200 sm:rounded-lg sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
            {/* Close button */}
            <button
              onClick={() => setShowAddMemberModal(false)}
              className="absolute right-4 top-4 rounded-sm opacity-70 transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:pointer-events-none"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                <path d="M18 6 6 18"></path>
                <path d="m6 6 12 12"></path>
              </svg>
              <span className="sr-only">Close</span>
            </button>

            {/* Header */}
            <div className="flex flex-col space-y-1.5 text-center sm:text-left">
              <h2 className="text-lg font-semibold leading-none tracking-tight">Add Team Members</h2>
              <p className="text-sm text-gray-600">Select members from other teams to include</p>
            </div>

            <div className="space-y-4 py-4">
              {/* Other Team Members */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Available Team Members</label>
                <div className="border rounded-lg p-4 bg-gray-50 max-h-60 overflow-y-auto">
                  {otherTeamMembers.length === 0 ? (
                    <p className="text-sm text-gray-500 text-center py-4">No other team members available</p>
                  ) : (
                    <div className="space-y-3">
                      {otherTeamMembers
                        .filter(member => !addedOtherMembers.some(added => added.id === member.id))
                        .map((member) => (
                        <div key={member.id} className="flex items-center space-x-3">
                          <button
                            type="button"
                            role="checkbox"
                            aria-checked={selectedOtherMembers.includes(member.id)}
                            data-state={selectedOtherMembers.includes(member.id) ? "checked" : "unchecked"}
                            onClick={() => handleOtherMemberToggle(member.id)}
                            className={`peer h-4 w-4 shrink-0 rounded-sm border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${
                              selectedOtherMembers.includes(member.id)
                                ? 'bg-blue-600 border-blue-600 text-white' 
                                : 'border-gray-300 bg-white'
                            }`}
                          >
                            {selectedOtherMembers.includes(member.id) && (
                              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                                <polyline points="20,6 9,17 4,12"></polyline>
                              </svg>
                            )}
                          </button>
                          <label className="flex items-center space-x-2 cursor-pointer flex-1">
                            <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                              <span className="text-sm font-medium text-green-600">
                                {getInitials(member.firstName, member.lastName)}
                              </span>
                            </div>
                            <div className="flex-1">
                              <span className="text-sm font-medium">{member.firstName} {member.lastName}</span>
                            </div>
                          </label>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Footer Buttons */}
            <div className="flex gap-3 pt-4">
              <button
                onClick={() => setShowAddMemberModal(false)}
                className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 h-10 px-4 py-2 flex-1"
              >
                Cancel
              </button>
              <button
                onClick={handleAddOtherMembers}
                disabled={selectedOtherMembers.length === 0}
                className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-blue-600 text-white hover:bg-blue-700 h-10 px-4 py-2 flex-1"
              >
                Add Selected ({selectedOtherMembers.length})
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
} 