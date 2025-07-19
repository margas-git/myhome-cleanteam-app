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
        }
      }
    } catch (error) {
      console.error("Failed to fetch current clean info:", error);
    }
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
          clockOutAllMembers: true,
          selectedMemberIds: cleanInfo.members.map(member => member.id)
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
              <div className="mb-3">
                <h4 className="font-medium text-gray-900">Team Members</h4>
              </div>

              <div className="space-y-2">
                {cleanInfo.members.map((member) => (
                  <div key={member.id} className="flex items-center space-x-3 p-2 border rounded">
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
            disabled={loading || !cleanInfo}
            className="flex-1 bg-red-600 text-white py-2 px-4 rounded-md hover:bg-red-700 disabled:opacity-50"
          >
            {loading ? "Ending Clean..." : `End Clean (${cleanInfo?.members.length || 0} Member${(cleanInfo?.members.length || 0) !== 1 ? 's' : ''})`}
          </button>
        </div>
      </div>
    </div>
  );
} 