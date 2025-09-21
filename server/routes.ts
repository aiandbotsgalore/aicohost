import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import { 
  insertSessionSchema, 
  insertSpeakerSchema, 
  insertMessageSchema,
  insertAIPersonalitySchema,
  insertAnalyticsSchema,
  type Session,
  type Message 
} from "@shared/schema";
import { transcribeAudio, generateAIResponse, synthesizeSpeech, analyzeConversationTopic } from "./services/openai";
import { audioProcessor } from "./services/audio";

interface WebSocketClient {
  ws: WebSocket;
  sessionId?: string;
  isHost?: boolean;
  clientType?: 'browser' | 'desktop';
  clientId: string;
}

interface ProtocolMessage {
  type: 'desktop_connect' | 'transcript' | 'audio_levels' | 'control_command' | 'ai_response' | 'status' | 'error' | 'connected';
  source: 'browser' | 'desktop' | 'server';
  data?: any;
  timestamp: string;
}

const clients = new Map<string, WebSocketClient>();

async function initializeDemoData() {
  try {
    const demoSessionId = "demo-session-1";
    const existingSession = await storage.getSession(demoSessionId);
    
    if (!existingSession) {
      // Create demo session directly with the ID we want
      const demoSession = {
        id: demoSessionId,
        title: "AI Cohost Demo Space",
        status: "live" as const,
        startTime: new Date(),
        endTime: null,
        listeners: 3,
        duration: 0,
        metadata: null,
      };
      
      // Store directly in memory
      (storage as any).sessions.set(demoSessionId, demoSession);
      
      // Create demo speakers
      const hostSpeaker = await storage.createSpeaker({
        sessionId: demoSessionId,
        name: "Demo Host",
        handle: "@demohost",
        isHost: true,
        isGuest: false,
        isAI: false,
        avatar: null,
      });
      
      const aiSpeaker = await storage.createSpeaker({
        sessionId: demoSessionId,
        name: "AI Cohost",
        handle: "@aicohost",
        isHost: false,
        isGuest: false,
        isAI: true,
        avatar: null,
      });
      
      // Initialize AI personality
      await storage.upsertAIPersonality({
        sessionId: demoSessionId,
        voiceType: "energetic-podcaster",
        comedyLevel: 60,
        researchLevel: 40,
        energyLevel: 75,
        responseStyle: "conversational",
      });
      
      // Initialize analytics
      await storage.upsertAnalytics({
        sessionId: demoSessionId,
        aiSpeakingTime: 0.25,
        totalResponses: 5,
        avgResponseTime: 1.8,
        interrupts: 1,
        jokeSuccessRate: 0.8,
      });
      
      // Initialize session memory
      await storage.upsertSessionMemory({
        sessionId: demoSessionId,
        topics: [
          { name: "AI Technology", mentions: 3 },
          { name: "Twitter Spaces", mentions: 2 },
          { name: "Voice Technology", mentions: 1 }
        ],
        speakerNotes: {
          [hostSpeaker.id]: "Interested in AI applications",
          [aiSpeaker.id]: "AI cohost personality active"
        },
        runningJokes: [
          "The AI that never runs out of coffee",
          "Better response time than humans"
        ],
        clipMoments: [
          { topic: "AI Technology", timestamp: "00:05:23" },
          { topic: "Future of Voice", timestamp: "00:12:45" }
        ],
      });
      
      // Add some demo messages
      await storage.createMessage({
        sessionId: demoSessionId,
        speakerId: hostSpeaker.id,
        content: "Welcome everyone to our AI Cohost demo! Today we're exploring the future of voice-enabled AI assistants.",
        confidence: 0.95,
        isAIGenerated: false,
        metadata: null,
      });
      
      await storage.createMessage({
        sessionId: demoSessionId,
        speakerId: aiSpeaker.id,
        content: "Thanks for having me! I'm excited to demonstrate how AI can enhance live conversations with real-time insights and engaging responses.",
        confidence: 0.92,
        isAIGenerated: true,
        metadata: null,
      });
      
      console.log("Demo data initialized successfully");
    }
  } catch (error) {
    console.error("Failed to initialize demo data:", error);
  }
}

export async function registerRoutes(app: Express): Promise<Server> {
  const httpServer = createServer(app);
  
  // WebSocket server on /ws path to avoid conflicts with Vite HMR
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });

  // Initialize demo data if needed
  await initializeDemoData();

  // Session routes
  app.get("/api/sessions", async (req, res) => {
    try {
      const sessions = await storage.getAllSessions();
      res.json(sessions);
    } catch (error) {
      res.status(500).json({ message: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  app.post("/api/sessions", async (req, res) => {
    try {
      const sessionData = insertSessionSchema.parse(req.body);
      const session = await storage.createSession(sessionData);
      
      // Initialize default AI personality and analytics
      await storage.upsertAIPersonality({ sessionId: session.id });
      await storage.upsertAnalytics({ sessionId: session.id });
      
      res.json(session);
    } catch (error) {
      res.status(400).json({ message: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  app.get("/api/sessions/:id", async (req, res) => {
    try {
      const session = await storage.getSession(req.params.id);
      if (!session) {
        return res.status(404).json({ message: "Session not found" });
      }
      res.json(session);
    } catch (error) {
      res.status(500).json({ message: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  app.patch("/api/sessions/:id", async (req, res) => {
    try {
      const session = await storage.updateSession(req.params.id, req.body);
      if (!session) {
        return res.status(404).json({ message: "Session not found" });
      }
      res.json(session);
    } catch (error) {
      res.status(500).json({ message: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  // Speaker routes
  app.get("/api/sessions/:sessionId/speakers", async (req, res) => {
    try {
      const speakers = await storage.getSessionSpeakers(req.params.sessionId);
      res.json(speakers);
    } catch (error) {
      res.status(500).json({ message: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  app.post("/api/sessions/:sessionId/speakers", async (req, res) => {
    try {
      const speakerData = insertSpeakerSchema.parse({
        ...req.body,
        sessionId: req.params.sessionId
      });
      const speaker = await storage.createSpeaker(speakerData);
      res.json(speaker);
    } catch (error) {
      res.status(400).json({ message: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  // Message routes
  app.get("/api/sessions/:sessionId/messages", async (req, res) => {
    try {
      const messages = await storage.getSessionMessages(req.params.sessionId);
      res.json(messages);
    } catch (error) {
      res.status(500).json({ message: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  app.post("/api/sessions/:sessionId/messages", async (req, res) => {
    try {
      const messageData = insertMessageSchema.parse({
        ...req.body,
        sessionId: req.params.sessionId
      });
      const message = await storage.createMessage(messageData);
      
      // Broadcast new message to all connected clients
      broadcastToSession(req.params.sessionId, {
        type: "newMessage",
        data: message
      });
      
      res.json(message);
    } catch (error) {
      res.status(400).json({ message: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  // AI Personality routes
  app.get("/api/sessions/:sessionId/personality", async (req, res) => {
    try {
      const personality = await storage.getAIPersonality(req.params.sessionId);
      if (!personality) {
        return res.status(404).json({ message: "AI personality not found" });
      }
      res.json(personality);
    } catch (error) {
      res.status(500).json({ message: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  app.put("/api/sessions/:sessionId/personality", async (req, res) => {
    try {
      const personalityData = insertAIPersonalitySchema.parse({
        ...req.body,
        sessionId: req.params.sessionId
      });
      const personality = await storage.upsertAIPersonality(personalityData);
      
      // Broadcast personality update
      broadcastToSession(req.params.sessionId, {
        type: "personalityUpdate",
        data: personality
      });
      
      res.json(personality);
    } catch (error) {
      res.status(400).json({ message: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  // Analytics routes
  app.get("/api/sessions/:sessionId/analytics", async (req, res) => {
    try {
      const analytics = await storage.getAnalytics(req.params.sessionId);
      if (!analytics) {
        return res.status(404).json({ message: "Analytics not found" });
      }
      res.json(analytics);
    } catch (error) {
      res.status(500).json({ message: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  // Session memory routes
  app.get("/api/sessions/:sessionId/memory", async (req, res) => {
    try {
      const memory = await storage.getSessionMemory(req.params.sessionId);
      if (!memory) {
        return res.status(404).json({ message: "Session memory not found" });
      }
      res.json(memory);
    } catch (error) {
      res.status(500).json({ message: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  // Test AI response generation
  app.post("/api/sessions/:sessionId/test-ai-response", async (req, res) => {
    try {
      const { transcript = "This is a test message" } = req.body;
      const sessionId = req.params.sessionId;
      
      const messages = await storage.getSessionMessages(sessionId);
      const recentMessages = messages.slice(-10);
      const personality = await storage.getAIPersonality(sessionId);
      const memory = await storage.getSessionMemory(sessionId);
      
      const context = {
        topics: memory?.topics as Array<{ name: string; mentions: number }> || [],
        speakerNotes: memory?.speakerNotes as Record<string, string> || {},
        runningJokes: memory?.runningJokes || [],
        recentMessages: recentMessages.map(m => ({
          speaker: m.speakerId,
          content: m.content,
          timestamp: m.timestamp!
        })),
        personality: {
          voiceType: personality?.voiceType || "energetic-podcaster",
          comedyLevel: personality?.comedyLevel || 60,
          researchLevel: personality?.researchLevel || 40,
          energyLevel: personality?.energyLevel || 75,
          responseStyle: personality?.responseStyle || "conversational"
        }
      };

      const { response, confidence } = await generateAIResponse(transcript, context);
      
      // Generate speech audio
      const audioBuffer = await synthesizeSpeech(response, context.personality.voiceType);
      
      res.json({
        response,
        confidence,
        audioSize: audioBuffer.length,
        context: {
          topics: context.topics.length,
          personality: context.personality.voiceType
        }
      });
    } catch (error) {
      res.status(500).json({ message: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  // WebSocket connection handling
  wss.on('connection', (ws, req) => {
    const clientId = Date.now().toString() + Math.random().toString(36).substr(2, 9);
    clients.set(clientId, { ws, clientId });

    ws.on('message', async (data) => {
      try {
        const message = JSON.parse(data.toString());
        await handleWebSocketMessage(clientId, message);
      } catch (error) {
        console.error('WebSocket message error:', error);
        const errorMessage: ProtocolMessage = {
          type: 'error',
          source: 'server',
          data: { message: error instanceof Error ? error.message : 'Unknown error' },
          timestamp: new Date().toISOString()
        };
        ws.send(JSON.stringify(errorMessage));
      }
    });

    ws.on('close', () => {
      const client = clients.get(clientId);
      if (client?.sessionId) {
        // Notify other clients about disconnection
        const statusMessage: ProtocolMessage = {
          type: 'status',
          source: 'server',
          data: {
            status: 'client_disconnected',
            clientType: client.clientType,
            clientId: clientId
          },
          timestamp: new Date().toISOString()
        };
        broadcastToSession(client.sessionId, statusMessage, clientId);
      }
      clients.delete(clientId);
    });

    // Send connection confirmation
    const connectedMessage: ProtocolMessage = {
      type: 'connected',
      source: 'server',
      data: { clientId },
      timestamp: new Date().toISOString()
    };
    ws.send(JSON.stringify(connectedMessage));
  });

  // Audio processing setup
  audioProcessor.on('audioLevel', (level) => {
    broadcast({ type: 'audioLevel', data: level });
  });

  audioProcessor.on('audioReady', async (audioData) => {
    try {
      const { text, confidence } = await transcribeAudio(audioData);
      if (text.trim()) {
        broadcast({ type: 'transcription', data: { text, confidence } });
      }
    } catch (error) {
      console.error('Transcription error:', error);
    }
  });

  async function handleWebSocketMessage(clientId: string, message: any) {
    const client = clients.get(clientId);
    if (!client || client.ws.readyState !== WebSocket.OPEN) return;

    // Handle legacy message format for backwards compatibility
    if (!message.source && !message.timestamp) {
      // Convert legacy format to new protocol format
      const legacyMessage = message;
      message = {
        type: legacyMessage.type,
        source: client.clientType || 'browser',
        data: legacyMessage.data || legacyMessage,
        timestamp: new Date().toISOString()
      };
    }

    switch (message.type) {
      case 'joinSession':
        client.sessionId = message.sessionId || message.data?.sessionId;
        client.isHost = message.isHost || message.data?.isHost || false;
        client.clientType = message.clientType || message.data?.clientType || 'browser';
        
        // Notify other clients about new connection
        if (client.sessionId) {
          const statusMessage: ProtocolMessage = {
            type: 'status',
            source: 'server',
            data: {
              status: 'client_connected',
              clientType: client.clientType,
              clientId: clientId
            },
            timestamp: new Date().toISOString()
          };
          broadcastToSession(client.sessionId, statusMessage, clientId);
        }
        break;

      case 'desktop_connect':
        // Desktop client connection
        client.clientType = 'desktop';
        client.sessionId = message.data?.sessionId;
        
        // Notify browser clients about desktop connection
        if (client.sessionId) {
          const desktopConnectMessage: ProtocolMessage = {
            type: 'status',
            source: 'server',
            data: {
              status: 'desktop_connected',
              sessionId: client.sessionId
            },
            timestamp: new Date().toISOString()
          };
          broadcastToBrowserClients(client.sessionId, desktopConnectMessage);
        }
        break;

      case 'transcript':
        // Desktop sends transcript → forward to browser
        if (client.clientType === 'desktop' && client.sessionId) {
          const transcriptMessage: ProtocolMessage = {
            type: 'transcript',
            source: 'desktop',
            data: message.data,
            timestamp: message.timestamp || new Date().toISOString()
          };
          broadcastToBrowserClients(client.sessionId, transcriptMessage);
        }
        break;

      case 'ai_response':
        // Browser sends AI response → forward to desktop for TTS
        if (client.clientType === 'browser' && client.sessionId) {
          const aiResponseMessage: ProtocolMessage = {
            type: 'ai_response',
            source: 'browser',
            data: message.data,
            timestamp: message.timestamp || new Date().toISOString()
          };
          broadcastToDesktopClients(client.sessionId, aiResponseMessage);
        }
        break;

      case 'control_command':
        // Browser sends control command → forward to desktop
        if (client.clientType === 'browser' && client.sessionId) {
          const controlMessage: ProtocolMessage = {
            type: 'control_command',
            source: 'browser',
            data: message.data,
            timestamp: message.timestamp || new Date().toISOString()
          };
          broadcastToDesktopClients(client.sessionId, controlMessage);
        }
        break;

      case 'audio_levels':
        // Desktop sends audio levels → forward to browser
        if (client.clientType === 'desktop' && client.sessionId) {
          const audioLevelMessage: ProtocolMessage = {
            type: 'audio_levels',
            source: 'desktop',
            data: message.data,
            timestamp: message.timestamp || new Date().toISOString()
          };
          broadcastToBrowserClients(client.sessionId, audioLevelMessage);
        }
        break;

      case 'status':
        // Forward status updates between clients
        if (client.sessionId) {
          const statusMessage: ProtocolMessage = {
            type: 'status',
            source: message.source || client.clientType || 'browser',
            data: message.data,
            timestamp: message.timestamp || new Date().toISOString()
          };
          broadcastToSession(client.sessionId, statusMessage, clientId);
        }
        break;

      // Legacy message types for backwards compatibility
      case 'audioData':
        if (message.data) {
          const audioBuffer = Buffer.from(message.data, 'base64');
          audioProcessor.processAudioChunk(audioBuffer);
        }
        break;

      case 'requestAIResponse':
        await handleAIResponseRequest(client, message);
        break;

      case 'hotkey':
        await handleHotkey(client, message);
        break;

      case 'updatePersonality':
        await handlePersonalityUpdate(client, message);
        break;
    }
  }

  async function handleAIResponseRequest(client: WebSocketClient, message: any) {
    if (!client.sessionId) return;

    try {
      const messages = await storage.getSessionMessages(client.sessionId);
      const recentMessages = messages.slice(-10);
      const personality = await storage.getAIPersonality(client.sessionId);
      const memory = await storage.getSessionMemory(client.sessionId);
      
      const context = {
        topics: memory?.topics as Array<{ name: string; mentions: number }> || [],
        speakerNotes: memory?.speakerNotes as Record<string, string> || {},
        runningJokes: memory?.runningJokes || [],
        recentMessages: recentMessages.map(m => ({
          speaker: m.speakerId,
          content: m.content,
          timestamp: m.timestamp!
        })),
        personality: {
          voiceType: personality?.voiceType || "energetic-podcaster",
          comedyLevel: personality?.comedyLevel || 60,
          researchLevel: personality?.researchLevel || 40,
          energyLevel: personality?.energyLevel || 75,
          responseStyle: personality?.responseStyle || "conversational"
        }
      };

      const { response, confidence } = await generateAIResponse(
        message.transcript || "",
        context
      );

      // Create AI message
      const speakers = await storage.getSessionSpeakers(client.sessionId);
      const aiSpeaker = speakers.find(s => s.isAI);
      
      if (aiSpeaker) {
        const aiMessage = await storage.createMessage({
          sessionId: client.sessionId,
          speakerId: aiSpeaker.id,
          content: response,
          confidence,
          isAIGenerated: true
        });

        // Generate speech audio
        const audioBuffer = await synthesizeSpeech(response, context.personality.voiceType);
        
        broadcastToSession(client.sessionId, {
          type: 'aiResponse',
          data: {
            message: aiMessage,
            audio: audioBuffer.toString('base64')
          }
        });

        // Update analytics
        const analytics = await storage.getAnalytics(client.sessionId);
        if (analytics) {
          await storage.upsertAnalytics({
            sessionId: client.sessionId,
            totalResponses: (analytics.totalResponses || 0) + 1,
            avgResponseTime: confidence * 2, // Simulate response time based on confidence
            aiSpeakingTime: analytics.aiSpeakingTime,
            interrupts: analytics.interrupts,
            jokeSuccessRate: analytics.jokeSuccessRate
          });
        }
      }
    } catch (error) {
      console.error('AI response error:', error);
      client.ws.send(JSON.stringify({ type: 'error', message: error instanceof Error ? error.message : 'Unknown error' }));
    }
  }

  async function handleHotkey(client: WebSocketClient, message: any) {
    if (!client.sessionId) return;

    const { key, command } = message;
    
    broadcastToSession(client.sessionId, {
      type: 'hotkeyTriggered',
      data: { key, command }
    });

    // Handle specific hotkey commands
    switch (command) {
      case 'riff':
        await handleAIResponseRequest(client, { transcript: "Continue with a creative riff on the current topic" });
        break;
      case 'oneLiner':
        await handleAIResponseRequest(client, { transcript: "Respond with just a quick one-liner" });
        break;
      case 'wrap':
        await handleAIResponseRequest(client, { transcript: "Help wrap up this topic in the next 10 seconds" });
        break;
    }
  }

  async function handlePersonalityUpdate(client: WebSocketClient, message: any) {
    if (!client.sessionId) return;

    try {
      const personality = await storage.upsertAIPersonality({
        sessionId: client.sessionId,
        ...message.personality
      });

      broadcastToSession(client.sessionId, {
        type: 'personalityUpdated',
        data: personality
      });
    } catch (error) {
      console.error('Personality update error:', error);
    }
  }

  function broadcast(message: any) {
    clients.forEach(client => {
      if (client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(JSON.stringify(message));
      }
    });
  }

  function broadcastToSession(sessionId: string, message: any, excludeClientId?: string) {
    clients.forEach((client, clientId) => {
      if (client.sessionId === sessionId && 
          client.ws.readyState === WebSocket.OPEN &&
          clientId !== excludeClientId) {
        client.ws.send(JSON.stringify(message));
      }
    });
  }

  function broadcastToBrowserClients(sessionId: string, message: ProtocolMessage) {
    clients.forEach(client => {
      if (client.sessionId === sessionId && 
          client.clientType === 'browser' && 
          client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(JSON.stringify(message));
      }
    });
  }

  function broadcastToDesktopClients(sessionId: string, message: ProtocolMessage) {
    clients.forEach(client => {
      if (client.sessionId === sessionId && 
          client.clientType === 'desktop' && 
          client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(JSON.stringify(message));
      }
    });
  }

  return httpServer;
}
