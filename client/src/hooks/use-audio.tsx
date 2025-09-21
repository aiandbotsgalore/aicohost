import { useState } from "react";

export function useAudio() {
  const [isRecording, setIsRecording] = useState(false);
  const [audioLevel, setAudioLevel] = useState(-60);
  const [sendCommand, setSendCommand] = useState<((command: any) => void) | null>(null);

  // This function now sends a command to start recording on the external desktop app
  const startRecording = async (onSendCommand: (command: any) => void) => {
    setSendCommand(() => onSendCommand);
    onSendCommand({ type: 'audioControl', action: 'startRecording' });
    setIsRecording(true);
  };

  // This function now sends a command to stop recording on the external desktop app
  const stopRecording = () => {
    if (sendCommand) {
      sendCommand({ type: 'audioControl', action: 'stopRecording' });
    }
    setIsRecording(false);
    setAudioLevel(-60);
  };

  // Toggle between play and pause states
  const togglePlayPause = (onSendCommand?: (command: any) => void) => {
    if (isRecording) {
      // Currently recording, so pause
      if (sendCommand) {
        sendCommand({ type: 'audioControl', action: 'pauseRecording' });
      }
      setIsRecording(false);
    } else {
      // Currently paused, so play/start recording
      const commandToSend = onSendCommand || sendCommand;
      if (commandToSend) {
        setSendCommand(() => commandToSend);
        commandToSend({ type: 'audioControl', action: 'startRecording' });
      }
      setIsRecording(true);
    }
  };

  // Keep the playAudio function for playing AI responses
  const playAudio = async (audioBase64: string) => {
    try {
      const audioData = atob(audioBase64);
      const arrayBuffer = new ArrayBuffer(audioData.length);
      const view = new Uint8Array(arrayBuffer);
      
      for (let i = 0; i < audioData.length; i++) {
        view[i] = audioData.charCodeAt(i);
      }

      const audioContext = new AudioContext();
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
      const source = audioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioContext.destination);
      source.start();
    } catch (error) {
      console.error('Error playing audio:', error);
    }
  };

  // Function to update audio level from external source
  const updateAudioLevel = (level: number) => {
    setAudioLevel(level);
  };

  // Function to send audio control commands
  const sendAudioCommand = (command: string, data?: any) => {
    if (sendCommand) {
      sendCommand({ type: 'audioControl', action: command, data });
    }
  };

  // Function to update recording state from external source
  const updateRecordingState = (recording: boolean) => {
    setIsRecording(recording);
  };

  return {
    isRecording,
    audioLevel,
    startRecording,
    stopRecording,
    togglePlayPause,
    playAudio,
    updateAudioLevel,
    sendAudioCommand,
    updateRecordingState,
  };
}