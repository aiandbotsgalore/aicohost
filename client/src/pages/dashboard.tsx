import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { SessionHeader } from "@/components/session-header";
import { AudioControls } from "@/components/audio-controls";
import { TranscriptPanel } from "@/components/transcript-panel";
import { PersonalityControls } from "@/components/personality-controls";
import { AnalyticsPanel } from "@/components/analytics-panel";
import { useWebSocket } from "@/hooks/use-websocket";
import { useAudio } from "@/hooks/use-audio";
import { useHotkeys } from "@/hooks/use-hotkeys";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Session, Speaker, Message, AIPersonality, Analytics, SessionMemory } from "@shared/schema";

const DEMO_SESSION_ID = "demo-session-1";

export default function Dashboard() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [currentSessionId, setCurrentSessionId] = useState<string>(DEMO_SESSION_ID);
  const [aiStatus, setAIStatus] = useState<"listening" | "processing" | "speaking">("listening");
  const [audioLevel, setAudioLevel] = useState(-60);

  // WebSocket connection with enhanced protocol support
  const { 
    isConnected, 
    lastMessage, 
    send, 
    sendTranscript,
    sendAiResponse,
    sendControlCommand,
    sendStatus 
  } = useWebSocket({
    sessionId: currentSessionId,
    clientType: 'browser',
    onTranscript: (data) => {
      // Handle incoming transcripts from desktop
      if (data?.text) {
        console.log('Transcript from desktop:', data.text);
        queryClient.invalidateQueries({ queryKey: ['/api/sessions', currentSessionId, 'messages'] });
      }
    },
    onAudioLevels: (data) => {
      // Handle audio levels from desktop
      if (data?.levels) {
        updateAudioLevel(data.levels[0] || -60);
      }
    },
    onStatus: (data) => {
      // Handle status updates
      if (data?.status === 'desktop_connected') {
        toast({ 
          title: "Desktop Connected", 
          description: "Audio processor connected successfully" 
        });
      } else if (data?.status === 'desktop_disconnected') {
        toast({ 
          title: "Desktop Disconnected", 
          description: "Audio processor disconnected",
          variant: "destructive"
        });
      }
    }
  });

  // Audio control interface
  const { 
    isRecording, 
    audioLevel: controlledAudioLevel, 
    startRecording, 
    stopRecording,
    togglePlayPause, 
    playAudio, 
    updateAudioLevel,
    sendAudioCommand,
    updateRecordingState 
  } = useAudio();

  // Hotkey handling
  const hotkeys = useHotkeys((key, command) => {
    handleHotkey(key, command);
  });

  // Update audio level from controlled source
  useEffect(() => {
    setAudioLevel(controlledAudioLevel);
  }, [controlledAudioLevel]);

  // Handle WebSocket messages with new protocol
  useEffect(() => {
    if (lastMessage) {
      const { type, source, data } = lastMessage;
      
      switch (type) {
        case 'newMessage':
          queryClient.invalidateQueries({ queryKey: ['/api/sessions', currentSessionId, 'messages'] });
          break;
          
        case 'ai_response':
          // AI response from browser or received back from desktop TTS
          if (source === 'desktop' && data?.audio) {
            setAIStatus("speaking");
            playAudio(data.audio);
            setTimeout(() => setAIStatus("listening"), 3000);
          }
          break;
          
        case 'aiResponse':
          // Legacy format support
          setAIStatus("speaking");
          if (data?.audio) {
            playAudio(data.audio);
          }
          queryClient.invalidateQueries({ queryKey: ['/api/sessions', currentSessionId, 'messages'] });
          setTimeout(() => setAIStatus("listening"), 3000);
          break;
          
        case 'transcript':
          // Transcript from desktop - handled by onTranscript callback
          if (source === 'desktop' && data?.text) {
            // Transcript handling is done by the onTranscript callback
            console.log('New transcript from desktop:', data.text);
          }
          break;
          
        case 'audio_levels':
          // Handled by onAudioLevels callback
          break;
          
        case 'control_command':
          // Control commands from other sources
          if (source === 'desktop' && data?.command) {
            console.log('Control command from desktop:', data.command);
          }
          break;
          
        case 'status':
          // Status updates handled by onStatus callback
          break;
          
        case 'personalityUpdated':
          queryClient.invalidateQueries({ queryKey: ['/api/sessions', currentSessionId, 'personality'] });
          break;
          
        case 'hotkeyTriggered':
          toast({ 
            title: "Hotkey Activated", 
            description: `Command: ${data?.command || 'unknown'}` 
          });
          break;
      }
    }
  }, [lastMessage, currentSessionId, queryClient, playAudio, toast]);

  // Initialize connection to external desktop app
  useEffect(() => {
    if (isConnected) {
      // Send status that browser control center is ready
      sendStatus('control_center_ready', { sessionId: currentSessionId });
      
      // Control center doesn't start recording from browser anymore
      // Audio capture happens on desktop app
    }
  }, [isConnected, currentSessionId, sendStatus]);

  // Queries
  const { data: session } = useQuery<Session>({
    queryKey: ['/api/sessions', currentSessionId],
    enabled: !!currentSessionId,
  });

  const { data: speakers = [] } = useQuery<Speaker[]>({
    queryKey: ['/api/sessions', currentSessionId, 'speakers'],
    enabled: !!currentSessionId,
  });

  const { data: messages = [] } = useQuery<Message[]>({
    queryKey: ['/api/sessions', currentSessionId, 'messages'],
    enabled: !!currentSessionId,
  });

  const { data: personality } = useQuery<AIPersonality>({
    queryKey: ['/api/sessions', currentSessionId, 'personality'],
    enabled: !!currentSessionId,
  });

  const { data: analytics } = useQuery<Analytics>({
    queryKey: ['/api/sessions', currentSessionId, 'analytics'],
    enabled: !!currentSessionId,
  });

  const { data: sessionMemory } = useQuery<SessionMemory>({
    queryKey: ['/api/sessions', currentSessionId, 'memory'],
    enabled: !!currentSessionId,
  });

  // Mutations
  const updatePersonalityMutation = useMutation({
    mutationFn: async (updates: Partial<AIPersonality>) => {
      return await apiRequest('PUT', `/api/sessions/${currentSessionId}/personality`, updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/sessions', currentSessionId, 'personality'] });
    },
  });

  // Event handlers
  const handlePersonalityChange = (updates: Partial<AIPersonality>) => {
    if (personality) {
      const newPersonality = { ...personality, ...updates };
      updatePersonalityMutation.mutate(updates);
      
      // Send update via WebSocket for real-time changes
      send({ type: 'updatePersonality', personality: newPersonality });
    }
  };

  const handleTogglePlayPause = () => {
    // Toggle the play/pause state and send command to desktop
    togglePlayPause((command) => {
      // Pass the send function from WebSocket
      send(command);
      
      // Update AI status based on new state
      if (!isRecording) {
        // Starting recording (Play)
        setAIStatus("listening");
        sendControlCommand('play', { action: 'startRecording' });
      } else {
        // Pausing recording (Pause)
        setAIStatus("processing");
        sendControlCommand('pause', { action: 'pauseRecording' });
      }
    });
  };

  const handleSkipTurn = () => {
    sendControlCommand('skip', { key: 's' });
  };

  const handleHotkey = (key: string, command: string) => {
    setAIStatus("processing");
    
    // Send control command to desktop
    sendControlCommand('hotkey', { key, command });
    
    // For AI response commands, also send AI response request
    if (['riff', 'oneLiner', 'wrap'].includes(command)) {
      const recentTranscript = messages
        .slice(-3)
        .map(m => m.content)
        .join(' ');
      
      // Generate AI response and send to desktop for TTS
      send({ 
        type: 'requestAIResponse', 
        transcript: recentTranscript,
        command 
      });
    }
  };

  const handleGenerateIntro = async () => {
    setAIStatus("processing");
    
    // Request AI to generate intro
    send({ 
      type: 'requestAIResponse', 
      transcript: "Generate a compelling cold open for this Twitter Space",
      command: 'generateIntro'
    });
    
    // The AI response will be automatically forwarded to desktop for TTS
  };

  const handleCreateSegue = async () => {
    setAIStatus("processing");
    
    // Request AI to create segue
    send({ 
      type: 'requestAIResponse', 
      transcript: "Create a smooth transition to the next segment",
      command: 'createSegue'
    });
    
    // The AI response will be automatically forwarded to desktop for TTS
  };

  const handleSummarizeSession = async () => {
    try {
      // This would generate a session summary
      toast({ title: "Session Summary", description: "Summary generation started" });
    } catch (error) {
      toast({ title: "Error", description: "Failed to generate summary", variant: "destructive" });
    }
  };

  const handleExportTranscript = async () => {
    try {
      // This would export the transcript
      const transcriptData = messages.map(m => {
        const speaker = speakers.find(s => s.id === m.speakerId);
        return `[${m.timestamp}] ${speaker?.name || 'Unknown'}: ${m.content}`;
      }).join('\n');
      
      const blob = new Blob([transcriptData], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `transcript-${currentSessionId}.txt`;
      a.click();
      URL.revokeObjectURL(url);
      
      toast({ title: "Export Complete", description: "Transcript downloaded successfully" });
    } catch (error) {
      toast({ title: "Export Failed", description: "Could not export transcript", variant: "destructive" });
    }
  };

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-foreground">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading AI Cohost Control Center...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <SessionHeader
        sessionId={currentSessionId}
        status={session.status}
        duration={session.duration || 0}
        listeners={session.listeners || 0}
      />
      
      <main className="flex-1 p-6 grid grid-cols-12 gap-6">
        <AudioControls
          audioLevel={audioLevel}
          aiStatus={aiStatus}
          aiResponseTime={analytics?.avgResponseTime || 1.2}
          aiConfidence={0.94} // This would come from the latest AI response
          isRecording={isRecording}
          onTogglePlayPause={handleTogglePlayPause}
          onSkipTurn={handleSkipTurn}
        />
        
        <TranscriptPanel
          messages={messages}
          speakers={speakers}
          sessionMemory={sessionMemory ? {
            topics: sessionMemory.topics as Array<{ name: string; mentions: number }> || [],
            speakerNotes: sessionMemory.speakerNotes as Record<string, string> || {},
            runningJokes: sessionMemory.runningJokes || []
          } : undefined}
        />
        
        <div className="col-span-3 space-y-6">
          {personality && (
            <PersonalityControls
              personality={{
                voiceType: personality.voiceType,
                comedyLevel: personality.comedyLevel || 60,
                researchLevel: personality.researchLevel || 40,
                energyLevel: personality.energyLevel || 75,
                responseStyle: personality.responseStyle || 'conversational',
              }}
              onPersonalityChange={handlePersonalityChange}
            />
          )}
          
          <AnalyticsPanel
            analytics={{
              aiSpeakingTime: analytics?.aiSpeakingTime || 0,
              totalResponses: analytics?.totalResponses || 0,
              avgResponseTime: analytics?.avgResponseTime || 0,
              interrupts: analytics?.interrupts || 0,
              jokeSuccessRate: analytics?.jokeSuccessRate || 0,
            }}
            clipMoments={sessionMemory?.clipMoments as Array<{ topic: string; timestamp: string }> || []}
            onGenerateIntro={handleGenerateIntro}
            onCreateSegue={handleCreateSegue}
            onSummarizeSession={handleSummarizeSession}
            onExportTranscript={handleExportTranscript}
          />
        </div>
      </main>
    </div>
  );
}
