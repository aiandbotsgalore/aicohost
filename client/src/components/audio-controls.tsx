import { useEffect, useState } from "react";

interface AudioControlsProps {
  audioLevel: number;
  aiStatus: string;
  aiResponseTime: number;
  aiConfidence: number;
  isRecording: boolean;
  onTogglePlayPause: () => void;
  onSkipTurn: () => void;
}

export function AudioControls({
  audioLevel,
  aiStatus,
  aiResponseTime,
  aiConfidence,
  isRecording,
  onTogglePlayPause,
  onSkipTurn,
}: AudioControlsProps) {
  const [waveformData, setWaveformData] = useState<number[]>([0.3, 0.8, 0.5, 1, 0.2, 0.6, 0.9, 0.4]);

  useEffect(() => {
    // Simulate waveform animation based on audio level
    const interval = setInterval(() => {
      setWaveformData(prev => prev.map(() => Math.random()));
    }, 200);

    return () => clearInterval(interval);
  }, [audioLevel]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'speaking': return 'text-speaking bg-speaking';
      case 'processing': return 'text-processing bg-processing';
      case 'listening': return 'text-accent bg-accent';
      default: return 'text-muted-foreground bg-muted';
    }
  };

  const getStatusIndicatorClass = (status: string) => {
    switch (status) {
      case 'speaking': return 'status-indicator status-speaking';
      case 'processing': return 'status-indicator status-processing';
      default: return 'status-indicator status-live';
    }
  };

  const formatAudioLevel = (level: number) => {
    return `${Math.round(level)} dB`;
  };

  return (
    <div className="col-span-3 space-y-6">
      {/* Audio Input Monitoring */}
      <div className="bg-card rounded-lg p-6 border border-border">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <i className="fas fa-volume-up text-primary"></i>
          Audio Input
        </h3>
        
        {/* Input Level Meters */}
        <div className="space-y-4">
          <div>
            <div className="flex justify-between text-sm text-muted-foreground mb-2">
              <span>Space Audio</span>
              <span data-testid="text-space-audio-level">{formatAudioLevel(audioLevel)}</span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div 
                className="audio-meter h-full rounded-full transition-all duration-200"
                style={{ width: `${Math.max(0, Math.min(100, (audioLevel + 60) / 60 * 100))}%` }}
              ></div>
            </div>
          </div>
          
          <div>
            <div className="flex justify-between text-sm text-muted-foreground mb-2">
              <span>AI Output</span>
              <span data-testid="text-ai-audio-level">{formatAudioLevel(audioLevel - 6)}</span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div 
                className="audio-meter h-full rounded-full transition-all duration-200"
                style={{ width: `${Math.max(0, Math.min(100, (audioLevel + 66) / 60 * 100))}%` }}
              ></div>
            </div>
          </div>
        </div>
        
        {/* Waveform Visualization */}
        <div className="mt-6">
          <div className="text-sm text-muted-foreground mb-2">Live Waveform</div>
          <div className="flex items-end justify-center gap-1 h-16" data-testid="waveform-display">
            {waveformData.map((height, index) => (
              <div
                key={index}
                className="waveform-bar w-1 bg-primary rounded-full transition-all duration-200"
                style={{ height: `${height * 64}px` }}
              ></div>
            ))}
          </div>
        </div>
      </div>
      
      {/* AI Status & Controls */}
      <div className="bg-card rounded-lg p-6 border border-border">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <i className="fas fa-robot text-secondary"></i>
          AI Cohost
        </h3>
        
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Status</span>
            <div className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${getStatusIndicatorClass(aiStatus)}`}></div>
              <span className={`text-sm font-medium ${getStatusColor(aiStatus).split(' ')[0]}`} data-testid="text-ai-status">
                {aiStatus.charAt(0).toUpperCase() + aiStatus.slice(1)}
              </span>
            </div>
          </div>
          
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Response Time</span>
            <span className="text-sm font-mono" data-testid="text-ai-response-time">
              {aiResponseTime.toFixed(1)}s
            </span>
          </div>
          
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Confidence</span>
            <span className="text-sm font-mono" data-testid="text-ai-confidence">
              {Math.round(aiConfidence * 100)}%
            </span>
          </div>
          
          {/* Quick Action Buttons */}
          <div className="grid grid-cols-2 gap-2 mt-4">
            <button 
              className="px-3 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors" 
              onClick={onTogglePlayPause}
              data-testid="button-toggle-play-pause"
            >
              <i className={`fas ${isRecording ? 'fa-pause' : 'fa-play'} mr-2`}></i>
              {isRecording ? 'Pause' : 'Play'}
            </button>
            <button 
              className="px-3 py-2 bg-muted text-muted-foreground rounded-lg text-sm font-medium hover:bg-muted/80 transition-colors" 
              onClick={onSkipTurn}
              data-testid="button-skip-turn"
            >
              <i className="fas fa-forward mr-2"></i>Skip
            </button>
          </div>
        </div>
      </div>
      
      {/* Hotkey Commands */}
      <div className="bg-card rounded-lg p-6 border border-border">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <i className="fas fa-keyboard text-accent"></i>
          Quick Commands
        </h3>
        
        <div className="space-y-2 text-sm">
          <div className="flex justify-between items-center py-1">
            <span className="text-muted-foreground">Riff on that</span>
            <kbd className="px-2 py-1 bg-muted rounded text-xs font-mono">R</kbd>
          </div>
          <div className="flex justify-between items-center py-1">
            <span className="text-muted-foreground">One-liner only</span>
            <kbd className="px-2 py-1 bg-muted rounded text-xs font-mono">1</kbd>
          </div>
          <div className="flex justify-between items-center py-1">
            <span className="text-muted-foreground">Wrap in 10</span>
            <kbd className="px-2 py-1 bg-muted rounded text-xs font-mono">W</kbd>
          </div>
          <div className="flex justify-between items-center py-1">
            <span className="text-muted-foreground">Switch tone</span>
            <kbd className="px-2 py-1 bg-muted rounded text-xs font-mono">T</kbd>
          </div>
        </div>
      </div>
    </div>
  );
}
