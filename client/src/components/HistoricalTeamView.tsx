import { useState, useEffect } from "react";
import { buildApiUrl } from "../config/api";

interface TeamMember {
  userId: number;
  teamId: number;
  startDate: string;
  endDate: string | null;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
}

interface Team {
  id: number;
  name: string;
  colorHex: string;
  active: boolean;
}

interface HistoricalTeamViewProps {
  selectedDate: string;
  onClose: () => void;
}

export function HistoricalTeamView({ selectedDate, onClose }: HistoricalTeamViewProps) {
  const [teams, setTeams] = useState<Team[]>([]);
  const [teamMembers, setTeamMembers] = useState<Record<number, TeamMember[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchHistoricalTeamData();
  }, [selectedDate]);

  const fetchHistoricalTeamData = async () => {
    setLoading(true);
    setError(null);

    try {
      // First, fetch all teams
      const teamsResponse = await fetch(buildApiUrl("/api/admin/teams"), {
        credentials: "include"
      });

      if (!teamsResponse.ok) {
        throw new Error("Failed to fetch teams");
      }

      const teamsData = await teamsResponse.json();
      const activeTeams = teamsData.data.filter((team: Team) => team.active);
      setTeams(activeTeams);

      // Then, fetch team members for each team at the selected date
      const membersData: Record<number, TeamMember[]> = {};
      
      await Promise.all(
        activeTeams.map(async (team: Team) => {
          try {
            const membersResponse = await fetch(
              buildApiUrl(`/api/admin/teams/${team.id}/members/${selectedDate}`),
              { credentials: "include" }
            );

            if (membersResponse.ok) {
              const data = await membersResponse.json();
              membersData[team.id] = data.data.members || [];
            } else {
              console.warn(`Failed to fetch members for team ${team.id}`);
              membersData[team.id] = [];
            }
          } catch (error) {
            console.error(`Error fetching members for team ${team.id}:`, error);
            membersData[team.id] = [];
          }
        })
      );

      setTeamMembers(membersData);
    } catch (error) {
      console.error("Error fetching historical team data:", error);
      setError("Failed to load historical team data");
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const isCurrentMember = (member: TeamMember) => {
    return !member.endDate || new Date(member.endDate) > new Date(selectedDate);
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-center py-8">
            <div className="text-gray-600">Loading historical team data...</div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
          <div className="text-center py-8">
            <div className="text-red-600 mb-4">{error}</div>
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-lg font-medium text-gray-900">
              Team Composition on {formatDate(selectedDate)}
            </h3>
            <p className="text-sm text-gray-500 mt-1">
              Showing team members as of {selectedDate}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {teams.map((team) => {
            const members = teamMembers[team.id] || [];
            const currentMembers = members.filter(isCurrentMember);
            const pastMembers = members.filter(member => !isCurrentMember(member));

            return (
              <div key={team.id} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                <div className="flex items-center mb-4">
                  <div 
                    className="w-8 h-8 rounded-full flex items-center justify-center text-white font-medium"
                    style={{ backgroundColor: team.colorHex }}
                  >
                    {team.name.charAt(0)}
                  </div>
                  <h4 className="ml-3 text-lg font-medium text-gray-900">
                    {team.name}
                  </h4>
                </div>

                {/* Current Members */}
                <div className="mb-4">
                  <h5 className="text-sm font-medium text-gray-700 mb-2">
                    Current Members ({currentMembers.length})
                  </h5>
                  {currentMembers.length > 0 ? (
                    <div className="space-y-2">
                      {currentMembers.map((member) => (
                        <div key={member.userId} className="flex items-center justify-between p-2 bg-white rounded border border-gray-200">
                          <div>
                            <div className="text-sm font-medium text-gray-900">
                              {member.firstName} {member.lastName}
                            </div>
                            <div className="text-xs text-gray-500">{member.role}</div>
                          </div>
                          <div className="text-xs text-green-600 bg-green-100 px-2 py-1 rounded">
                            Active
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-sm text-gray-500 italic p-2 bg-white rounded border border-gray-200">
                      No current members
                    </div>
                  )}
                </div>

                {/* Past Members */}
                {pastMembers.length > 0 && (
                  <div>
                    <h5 className="text-sm font-medium text-gray-700 mb-2">
                      Past Members ({pastMembers.length})
                    </h5>
                    <div className="space-y-2">
                      {pastMembers.map((member) => (
                        <div key={member.userId} className="flex items-center justify-between p-2 bg-white rounded border border-gray-200 opacity-75">
                          <div>
                            <div className="text-sm font-medium text-gray-900">
                              {member.firstName} {member.lastName}
                            </div>
                            <div className="text-xs text-gray-500">
                              {member.role} • Left: {member.endDate ? formatDate(member.endDate) : 'Unknown'}
                            </div>
                          </div>
                          <div className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                            Past
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Team Summary */}
                <div className="mt-4 pt-3 border-t border-gray-200">
                  <div className="text-xs text-gray-500">
                    <div>Total members: {members.length}</div>
                    <div>Active members: {currentMembers.length}</div>
                    {pastMembers.length > 0 && (
                      <div>Past members: {pastMembers.length}</div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {teams.length === 0 && (
          <div className="text-center py-8">
            <div className="text-gray-500">No teams found for the selected date.</div>
          </div>
        )}

        <div className="mt-6 pt-4 border-t border-gray-200">
          <div className="flex justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
} 