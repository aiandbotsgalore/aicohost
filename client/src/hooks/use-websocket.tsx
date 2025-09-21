import { useEffect, useRef, useState, useCallback } from "react";

// Protocol message types matching server implementation
type MessageType = 
  | 'desktop_connect' 
  | 'transcript' 
  | 'audio_levels' 
  | 'control_command' 
  | 'ai_response' 
  | 'status' 
  | 'error' 
  | 'connected'
  | 'joinSession'
  | 'audioData'
  | 'requestAIResponse'
  | 'hotkey'
  | 'updatePersonality'
  | 'newMessage'
  | 'personalityUpdate'
  | 'aiResponse'
  | 'hotkeyTriggered'
  | 'personalityUpdated';

type MessageSource = 'browser' | 'desktop' | 'server';

interface ProtocolMessage {
  type: MessageType;
  source: MessageSource;
  data?: any;
  timestamp: string;
}

interface UseWebSocketOptions {
  sessionId?: string;
  clientType?: 'browser' | 'desktop';
  onTranscript?: (data: any) => void;
  onAiResponse?: (data: any) => void;
  onAudioLevels?: (data: any) => void;
  onStatus?: (data: any) => void;
  onControlCommand?: (data: any) => void;
  onMessage?: (message: ProtocolMessage) => void;
}

export function useWebSocket(options: UseWebSocketOptions = {}) {
  const { 
    sessionId, 
    clientType = 'browser',
    onTranscript,
    onAiResponse,
    onAudioLevels,
    onStatus,
    onControlCommand,
    onMessage
  } = options;

  const ws = useRef<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<ProtocolMessage | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');

  // Message handlers
  const handleMessage = useCallback((message: ProtocolMessage) => {
    setLastMessage(message);
    
    // Call general message handler
    onMessage?.(message);
    
    // Call specific handlers based on message type
    switch (message.type) {
      case 'transcript':
        onTranscript?.(message.data);
        break;
      case 'ai_response':
        onAiResponse?.(message.data);
        break;
      case 'audio_levels':
        onAudioLevels?.(message.data);
        break;
      case 'status':
        onStatus?.(message.data);
        break;
      case 'control_command':
        onControlCommand?.(message.data);
        break;
      case 'connected':
        console.log('Connected to WebSocket server with ID:', message.data?.clientId);
        break;
      case 'error':
        console.error('WebSocket error:', message.data?.message);
        break;
    }
  }, [onTranscript, onAiResponse, onAudioLevels, onStatus, onControlCommand, onMessage]);

  // Send message with protocol format
  const sendMessage = useCallback((
    type: MessageType, 
    data?: any,
    options: { source?: MessageSource } = {}
  ) => {
    if (ws.current?.readyState === WebSocket.OPEN) {
      const message: ProtocolMessage = {
        type,
        source: options.source || clientType as MessageSource,
        data,
        timestamp: new Date().toISOString()
      };
      ws.current.send(JSON.stringify(message));
    } else {
      console.warn('WebSocket is not connected. Cannot send message:', type);
    }
  }, [clientType]);

  // Legacy send function for backwards compatibility
  const send = useCallback((message: any) => {
    if (typeof message === 'object' && message.type) {
      // If it's an object with a type, convert to new format
      sendMessage(message.type, message.data || message);
    } else {
      // Otherwise send as-is (shouldn't normally happen)
      if (ws.current?.readyState === WebSocket.OPEN) {
        ws.current.send(JSON.stringify(message));
      }
    }
  }, [sendMessage]);

  // Specific send methods for common operations
  const sendTranscript = useCallback((transcript: string, confidence?: number) => {
    sendMessage('transcript', { text: transcript, confidence });
  }, [sendMessage]);

  const sendAiResponse = useCallback((response: string, metadata?: any) => {
    sendMessage('ai_response', { response, ...metadata });
  }, [sendMessage]);

  const sendControlCommand = useCallback((command: string, params?: any) => {
    sendMessage('control_command', { command, ...params });
  }, [sendMessage]);

  const sendAudioLevels = useCallback((levels: number[]) => {
    sendMessage('audio_levels', { levels });
  }, [sendMessage]);

  const sendStatus = useCallback((status: string, details?: any) => {
    sendMessage('status', { status, ...details });
  }, [sendMessage]);

  // WebSocket connection setup
  useEffect(() => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    
    setConnectionStatus('connecting');
    const socket = new WebSocket(wsUrl);
    ws.current = socket;

    socket.onopen = () => {
      setIsConnected(true);
      setConnectionStatus('connected');
      
      // Send join session message directly using the socket
      if (sessionId && socket.readyState === WebSocket.OPEN) {
        const joinMessage = {
          type: 'joinSession',
          sessionId,
          clientType,
          isHost: clientType === 'browser'
        };
        socket.send(JSON.stringify(joinMessage));
      }

      // If desktop client, send desktop_connect message
      if (clientType === 'desktop' && sessionId && socket.readyState === WebSocket.OPEN) {
        const connectMessage: ProtocolMessage = {
          type: 'desktop_connect',
          source: 'desktop',
          data: { sessionId },
          timestamp: new Date().toISOString()
        };
        socket.send(JSON.stringify(connectMessage));
      }
    };

    socket.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        
        // Handle both new protocol and legacy format
        if (message.source && message.timestamp) {
          // New protocol format
          handleMessage(message as ProtocolMessage);
        } else {
          // Legacy format - convert to new format
          const protocolMessage: ProtocolMessage = {
            type: message.type || 'status',
            source: 'server',
            data: message.data || message,
            timestamp: new Date().toISOString()
          };
          handleMessage(protocolMessage);
        }
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error);
      }
    };

    socket.onclose = () => {
      setIsConnected(false);
      setConnectionStatus('disconnected');
      console.log('WebSocket connection closed');
    };

    socket.onerror = (error) => {
      console.error('WebSocket error:', error);
      setConnectionStatus('disconnected');
    };

    return () => {
      if (ws.current?.readyState === WebSocket.OPEN) {
        ws.current.close();
      }
    };
  }, [sessionId, clientType]);

  // Reconnection logic
  useEffect(() => {
    let reconnectTimer: NodeJS.Timeout;
    
    if (!isConnected && connectionStatus === 'disconnected') {
      // Attempt to reconnect after 3 seconds
      reconnectTimer = setTimeout(() => {
        console.log('Attempting to reconnect...');
        // The effect will re-run due to dependency on isConnected
      }, 3000);
    }
    
    return () => {
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
      }
    };
  }, [isConnected, connectionStatus]);

  return {
    isConnected,
    connectionStatus,
    lastMessage,
    send, // Legacy method
    sendMessage, // New protocol method
    sendTranscript,
    sendAiResponse,
    sendControlCommand,
    sendAudioLevels,
    sendStatus
  };
}