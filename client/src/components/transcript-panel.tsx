import { useEffect, useRef } from "react";
import { type Message, type Speaker } from "@shared/schema";

interface TranscriptPanelProps {
  messages: Message[];
  speakers: Speaker[];
  sessionMemory?: {
    topics: Array<{ name: string; mentions: number }>;
    speakerNotes: Record<string, string>;
    runningJokes: string[];
  };
}

export function TranscriptPanel({ messages, speakers, sessionMemory }: TranscriptPanelProps) {
  const transcriptRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Auto-scroll to bottom when new messages arrive
    if (transcriptRef.current) {
      transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight;
    }
  }, [messages]);

  const getSpeakerInfo = (speakerId: string) => {
    const speaker = speakers.find(s => s.id === speakerId);
    return speaker || { name: 'Unknown', isAI: false, isGuest: false };
  };

  const getSpeakerInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const getSpeakerColor = (speaker: { isAI: boolean; isGuest: boolean }) => {
    if (speaker.isAI) return 'bg-secondary';
    if (speaker.isGuest) return 'bg-accent';
    return 'bg-primary';
  };

  const formatTimestamp = (timestamp: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).format(new Date(timestamp));
  };

  return (
    <div className="col-span-6 space-y-6">
      {/* Live Transcript */}
      <div className="bg-card rounded-lg border border-border h-96">
        <div className="p-6 border-b border-border flex items-center justify-between">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <i className="fas fa-comment-alt text-primary"></i>
            Live Transcript
          </h3>
          <div className="flex items-center gap-2">
            <div className="pulse-dot w-2 h-2 bg-destructive rounded-full"></div>
            <span className="text-sm text-muted-foreground">Recording</span>
          </div>
        </div>
        
        <div 
          ref={transcriptRef}
          className="p-6 h-80 overflow-y-auto"
          data-testid="transcript-container"
        >
          {messages.length === 0 ? (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              <p>Waiting for conversation to begin...</p>
            </div>
          ) : (
            messages.map((message, index) => {
              const speaker = getSpeakerInfo(message.speakerId);
              return (
                <div 
                  key={message.id} 
                  className="transcript-line mb-4 last:mb-0"
                  data-testid={`message-${index}`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium ${getSpeakerColor({ isAI: speaker.isAI || false, isGuest: speaker.isGuest || false })}`}>
                      {speaker.isAI ? (
                        <i className="fas fa-robot text-xs"></i>
                      ) : (
                        <span>{getSpeakerInitials(speaker.name)}</span>
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-sm font-medium ${speaker.isAI ? 'text-secondary' : ''}`}>
                          {speaker.name}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {formatTimestamp(message.timestamp!)}
                        </span>
                        {speaker.isGuest && (
                          <span className="px-2 py-0.5 bg-accent/20 text-accent text-xs rounded-full">
                            Guest
                          </span>
                        )}
                        {message.isAIGenerated && (
                          <span className="px-2 py-0.5 bg-secondary/20 text-secondary text-xs rounded-full">
                            AI
                          </span>
                        )}
                      </div>
                      <p className="text-sm">{message.content}</p>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
      
      {/* Session Memory & Context */}
      <div className="bg-card rounded-lg p-6 border border-border">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <i className="fas fa-brain text-accent"></i>
          Session Memory
        </h3>
        
        <div className="grid grid-cols-2 gap-4">
          <div>
            <h4 className="text-sm font-medium text-muted-foreground mb-2">Key Topics</h4>
            <div className="space-y-2" data-testid="key-topics">
              {sessionMemory?.topics?.length ? (
                sessionMemory.topics.map((topic, index) => (
                  <div key={index} className="flex items-center justify-between text-sm">
                    <span>{topic.name}</span>
                    <span className="text-muted-foreground">{topic.mentions}x</span>
                  </div>
                ))
              ) : (
                <div className="text-sm text-muted-foreground">No topics identified yet</div>
              )}
            </div>
          </div>
          
          <div>
            <h4 className="text-sm font-medium text-muted-foreground mb-2">Speaker Notes</h4>
            <div className="space-y-2" data-testid="speaker-notes">
              {sessionMemory?.speakerNotes && Object.keys(sessionMemory.speakerNotes).length ? (
                Object.entries(sessionMemory.speakerNotes).map(([speakerId, note]) => {
                  const speaker = getSpeakerInfo(speakerId);
                  return (
                    <div key={speakerId} className="text-sm">
                      <span className="font-medium">{speaker.name}:</span>{' '}
                      <span className="text-muted-foreground">{note}</span>
                    </div>
                  );
                })
              ) : (
                <div className="text-sm text-muted-foreground">No speaker notes yet</div>
              )}
            </div>
          </div>
        </div>
        
        <div className="mt-4 pt-4 border-t border-border">
          <h4 className="text-sm font-medium text-muted-foreground mb-2">Running Jokes & Callbacks</h4>
          <div className="text-sm text-muted-foreground" data-testid="running-jokes">
            {sessionMemory?.runningJokes?.length ? (
              sessionMemory.runningJokes.map((joke, index) => (
                <div key={index}>• {joke}</div>
              ))
            ) : (
              <div>No running jokes yet</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
