import { useState, useEffect } from "react";

interface SessionHeaderProps {
  sessionId?: string;
  status: string;
  duration: number;
  listeners: number;
}

export function SessionHeader({ sessionId, status, duration, listeners }: SessionHeaderProps) {
  const [formattedDuration, setFormattedDuration] = useState("00:00:00");

  useEffect(() => {
    const formatDuration = (seconds: number) => {
      const hours = Math.floor(seconds / 3600);
      const minutes = Math.floor((seconds % 3600) / 60);
      const secs = seconds % 60;
      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    setFormattedDuration(formatDuration(duration));
  }, [duration]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'live': return 'bg-accent';
      case 'waiting': return 'bg-processing';
      case 'ended': return 'bg-muted';
      default: return 'bg-muted';
    }
  };

  const getStatusIndicatorClass = (status: string) => {
    switch (status) {
      case 'live': return 'status-indicator status-live';
      case 'processing': return 'status-indicator status-processing';
      default: return 'status-indicator';
    }
  };

  return (
    <header className="bg-card border-b border-border px-6 py-4 flex items-center justify-between">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-3">
          <i className="fas fa-microphone-alt text-2xl text-primary"></i>
          <h1 className="text-xl font-semibold">AI Cohost Control Center</h1>
        </div>
        <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(status)}`}>
          <div className={`w-2 h-2 rounded-full ${getStatusColor(status)} ${getStatusIndicatorClass(status)}`}></div>
          <span data-testid="session-status">{status.toUpperCase()}</span>
        </div>
      </div>
      
      <div className="flex items-center gap-4">
        <div className="text-sm text-muted-foreground" data-testid="session-duration">
          {formattedDuration}
        </div>
        <div className="flex items-center gap-2">
          <i className="fas fa-users text-muted-foreground"></i>
          <span className="text-sm font-medium" data-testid="session-listeners">{listeners}</span>
        </div>
        <button 
          className="p-2 hover:bg-muted rounded-lg transition-colors" 
          data-testid="button-settings"
        >
          <i className="fas fa-cog text-muted-foreground"></i>
        </button>
      </div>
    </header>
  );
}
