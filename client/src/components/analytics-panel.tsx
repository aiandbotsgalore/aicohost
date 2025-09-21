import { useEffect, useState } from "react";

interface AnalyticsPanelProps {
  analytics: {
    aiSpeakingTime: number;
    totalResponses: number;
    avgResponseTime: number;
    interrupts: number;
    jokeSuccessRate: number;
  };
  clipMoments?: Array<{ topic: string; timestamp: string }>;
  onGenerateIntro: () => void;
  onCreateSegue: () => void;
  onSummarizeSession: () => void;
  onExportTranscript: () => void;
}

export function AnalyticsPanel({
  analytics,
  clipMoments = [],
  onGenerateIntro,
  onCreateSegue,
  onSummarizeSession,
  onExportTranscript,
}: AnalyticsPanelProps) {
  const [animatedValues, setAnimatedValues] = useState({
    aiSpeakingTime: 0,
    totalResponses: 0,
    avgResponseTime: 0,
    jokeSuccessRate: 0,
  });

  useEffect(() => {
    // Animate counter updates
    const duration = 1000; // 1 second
    const steps = 60;
    const stepDuration = duration / steps;

    let step = 0;
    const interval = setInterval(() => {
      step++;
      const progress = step / steps;
      
      setAnimatedValues({
        aiSpeakingTime: Math.round(analytics.aiSpeakingTime * progress * 100) / 100,
        totalResponses: Math.round(analytics.totalResponses * progress),
        avgResponseTime: Math.round(analytics.avgResponseTime * progress * 10) / 10,
        jokeSuccessRate: Math.round(analytics.jokeSuccessRate * progress * 100) / 100,
      });

      if (step >= steps) {
        clearInterval(interval);
        setAnimatedValues({
          aiSpeakingTime: analytics.aiSpeakingTime,
          totalResponses: analytics.totalResponses,
          avgResponseTime: analytics.avgResponseTime,
          jokeSuccessRate: analytics.jokeSuccessRate,
        });
      }
    }, stepDuration);

    return () => clearInterval(interval);
  }, [analytics]);

  const formatPercentage = (value: number) => {
    return `${Math.round(value * 100)}%`;
  };

  const formatTime = (value: number) => {
    return `${value.toFixed(1)}s`;
  };

  return (
    <div className="col-span-3 space-y-6">
      {/* AI Personality Controls - This would be moved to a separate component */}
      {/* Live Analytics */}
      <div className="bg-card rounded-lg p-6 border border-border">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <i className="fas fa-chart-line text-accent"></i>
          Live Analytics
        </h3>
        
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-primary" data-testid="text-speaking-time">
                {formatPercentage(animatedValues.aiSpeakingTime)}
              </div>
              <div className="text-xs text-muted-foreground">AI Speaking Time</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-secondary" data-testid="text-total-responses">
                {animatedValues.totalResponses}
              </div>
              <div className="text-xs text-muted-foreground">Total Responses</div>
            </div>
          </div>
          
          <div className="space-y-2">
            <div className="flex justify-between items-center text-sm">
              <span className="text-muted-foreground">Avg Response Time</span>
              <span className="font-mono" data-testid="text-avg-response-time">
                {formatTime(animatedValues.avgResponseTime)}
              </span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-muted-foreground">Interrupts</span>
              <span className="font-mono" data-testid="text-interrupts">
                {analytics.interrupts}
              </span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-muted-foreground">Joke Success Rate</span>
              <span className="font-mono text-accent" data-testid="text-joke-success">
                {formatPercentage(animatedValues.jokeSuccessRate)}
              </span>
            </div>
          </div>
          
          <div className="pt-4 border-t border-border">
            <h4 className="text-sm font-medium mb-2">Clip-Worthy Moments</h4>
            <div className="space-y-2 text-sm" data-testid="clip-moments">
              {clipMoments.length ? (
                clipMoments.map((moment, index) => (
                  <div key={index} className="flex justify-between items-center">
                    <span className="text-muted-foreground">{moment.topic}</span>
                    <span className="text-xs font-mono">{moment.timestamp}</span>
                  </div>
                ))
              ) : (
                <div className="text-muted-foreground">No clip moments identified yet</div>
              )}
            </div>
          </div>
        </div>
      </div>
      
      {/* Quick Actions */}
      <div className="bg-card rounded-lg p-6 border border-border">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <i className="fas fa-bolt text-primary"></i>
          Quick Actions
        </h3>
        
        <div className="space-y-2">
          <button 
            className="w-full px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors" 
            onClick={onGenerateIntro}
            data-testid="button-generate-intro"
          >
            <i className="fas fa-play mr-2"></i>Generate Cold Open
          </button>
          <button 
            className="w-full px-4 py-2 bg-secondary text-secondary-foreground rounded-lg text-sm font-medium hover:bg-secondary/90 transition-colors" 
            onClick={onCreateSegue}
            data-testid="button-create-segue"
          >
            <i className="fas fa-arrow-right mr-2"></i>Create Segment Bumper
          </button>
          <button 
            className="w-full px-4 py-2 bg-accent text-accent-foreground rounded-lg text-sm font-medium hover:bg-accent/90 transition-colors" 
            onClick={onSummarizeSession}
            data-testid="button-summarize-session"
          >
            <i className="fas fa-file-alt mr-2"></i>Generate Summary
          </button>
          <button 
            className="w-full px-4 py-2 bg-muted text-muted-foreground rounded-lg text-sm font-medium hover:bg-muted/80 transition-colors" 
            onClick={onExportTranscript}
            data-testid="button-export-transcript"
          >
            <i className="fas fa-download mr-2"></i>Export Transcript
          </button>
        </div>
      </div>
    </div>
  );
}
