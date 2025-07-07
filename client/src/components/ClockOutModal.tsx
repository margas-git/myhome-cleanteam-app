import { useState, useEffect } from "react";
import { formatAddress } from '../utils/addressFormatter';
import { buildApiUrl } from "../config/api";

interface CleanInfo {
  jobId: number;
  customerName: string;
  customerAddress: string;
  teamName: string;
  teamColor: string;
  clockInTime: string;
  members: {
    id: number;
    userId: number;
    name: string;
    clockInTime: string;
  }[];
}

interface ClockOutModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function ClockOutModal({ isOpen, onClose, onSuccess }: ClockOutModalProps) {
  const [lunchBreak, setLunchBreak] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cleanInfo, setCleanInfo] = useState<CleanInfo | null>(null);
  const [showMemberSelection, setShowMemberSelection] = useState(false);
  const [selectedMembers, setSelectedMembers] = useState<number[]>([]);

  // Fetch current clean information when modal opens
  useEffect(() => {
    if (isOpen) {
      fetchCurrentCleanInfo();
    }
  }, [isOpen]);

  const fetchCurrentCleanInfo = async () => {
    try {
      const response = await fetch(buildApiUrl("/api/staff/time-entries/current"), {
        credentials: "include"
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data) {
          setCleanInfo(data.data);
          // Default to selecting all members
          setSelectedMembers(data.data.members.map((member: any) => member.id));
        }
      }
    } catch (error) {
      console.error("Failed to fetch current clean info:", error);
    }
  };

  const handleMemberToggle = (memberId: number) => {
    setSelectedMembers(prev => 
      prev.includes(memberId) 
        ? prev.filter(id => id !== memberId)
        : [...prev, memberId]
    );
  };

  const handleClockOut = async () => {
    if (!cleanInfo) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(buildApiUrl("/api/staff/time-entries/clock-out"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        credentials: "include",
        body: JSON.stringify({
          lunchBreak,
          clockOutAllMembers: selectedMembers.length === cleanInfo.members.length,
          selectedMemberIds: selectedMembers
        })
      });

      const data = await response.json();

      if (response.ok) {
        onSuccess();
        onClose();
      } else {
        setError(data.error || "Failed to end clean");
      }
    } catch (error) {
      setError("Network error occurred");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <h3 className="text-lg font-semibold mb-4">End Clean</h3>
        
        {cleanInfo ? (
          <>
            {/* Clean Information */}
            <div className="mb-6 p-4 border rounded-lg bg-gray-50">
              <div className="flex items-center space-x-3 mb-3">
                <div 
                  className="w-4 h-4 rounded-full"
                  style={{ backgroundColor: cleanInfo.teamColor }}
                />
                <div>
                  <h4 className="font-medium text-gray-900">{cleanInfo.customerName}</h4>
                  <p className="text-sm text-gray-600">{formatAddress(cleanInfo.customerAddress)}</p>
                  <p className="text-xs text-gray-500">Team: {cleanInfo.teamName}</p>
                </div>
              </div>
              <p className="text-xs text-gray-500">
                Started: {new Date(cleanInfo.clockInTime).toLocaleString()}
              </p>
            </div>

            {/* Team Members Section */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-medium text-gray-900">Team Members</h4>
                <button
                  onClick={() => setShowMemberSelection(!showMemberSelection)}
                  className="text-blue-600 hover:text-blue-800 text-sm flex items-center gap-1"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                  </svg>
                  {showMemberSelection ? "Done" : "Edit"}
                </button>
              </div>

              <div className="space-y-2">
                {cleanInfo.members.map((member) => (
                  <div key={member.id} className="flex items-center space-x-3 p-2 border rounded">
                    {showMemberSelection && (
                      <input
                        type="checkbox"
                        checked={selectedMembers.includes(member.id)}
                        onChange={() => handleMemberToggle(member.id)}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                    )}
                    <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                      <span className="text-sm font-medium text-blue-600">
                        {member.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                      </span>
                    </div>
                    <div className="flex-1">
                      <span className="text-sm font-medium">{member.name}</span>
                    </div>
                  </div>
                ))}
              </div>

              {showMemberSelection && (
                <p className="text-xs text-gray-500 mt-2">
                  Uncheck team members you don't want to end the clean for. All members are selected by default.
                </p>
              )}
            </div>


          </>
        ) : (
          <div className="text-center py-8">
            <p className="text-gray-500">Loading clean information...</p>
          </div>
        )}

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        <div className="flex space-x-4">
          <button
            onClick={onClose}
            disabled={loading}
            className="flex-1 bg-gray-200 text-gray-800 py-2 px-4 rounded-md hover:bg-gray-300 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleClockOut}
            disabled={loading || !cleanInfo || selectedMembers.length === 0}
            className="flex-1 bg-red-600 text-white py-2 px-4 rounded-md hover:bg-red-700 disabled:opacity-50"
          >
            {loading ? "Ending Clean..." : `End Clean (${selectedMembers.length} Member${selectedMembers.length !== 1 ? 's' : ''})`}
          </button>
        </div>
      </div>
    </div>
  );
} 