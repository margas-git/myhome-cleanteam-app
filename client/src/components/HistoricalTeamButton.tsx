import { useState } from "react";
import { HistoricalTeamView } from "./HistoricalTeamView";

interface HistoricalTeamButtonProps {
  className?: string;
}

export function HistoricalTeamButton({ className = "" }: HistoricalTeamButtonProps) {
  const [showHistoricalTeamView, setShowHistoricalTeamView] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

  return (
    <>
      <button
        onClick={() => setShowHistoricalTeamView(true)}
        className={`inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${className}`}
        title="View historical team composition"
      >
        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        Historical Teams
      </button>

      {showHistoricalTeamView && (
        <HistoricalTeamView
          selectedDate={selectedDate}
          onClose={() => setShowHistoricalTeamView(false)}
        />
      )}
    </>
  );
} 