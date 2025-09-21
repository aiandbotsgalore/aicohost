import { 
  type Session, type InsertSession,
  type Speaker, type InsertSpeaker,
  type Message, type InsertMessage,
  type SessionMemory, type InsertSessionMemory,
  type AIPersonality, type InsertAIPersonality,
  type Analytics, type InsertAnalytics
} from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  // Sessions
  getSession(id: string): Promise<Session | undefined>;
  createSession(session: InsertSession): Promise<Session>;
  updateSession(id: string, updates: Partial<Session>): Promise<Session | undefined>;
  getAllSessions(): Promise<Session[]>;

  // Speakers
  getSpeaker(id: string): Promise<Speaker | undefined>;
  createSpeaker(speaker: InsertSpeaker): Promise<Speaker>;
  getSessionSpeakers(sessionId: string): Promise<Speaker[]>;

  // Messages
  getMessage(id: string): Promise<Message | undefined>;
  createMessage(message: InsertMessage): Promise<Message>;
  getSessionMessages(sessionId: string): Promise<Message[]>;

  // Session Memory
  getSessionMemory(sessionId: string): Promise<SessionMemory | undefined>;
  upsertSessionMemory(memory: InsertSessionMemory): Promise<SessionMemory>;

  // AI Personality
  getAIPersonality(sessionId: string): Promise<AIPersonality | undefined>;
  upsertAIPersonality(personality: InsertAIPersonality): Promise<AIPersonality>;

  // Analytics
  getAnalytics(sessionId: string): Promise<Analytics | undefined>;
  upsertAnalytics(analytics: InsertAnalytics): Promise<Analytics>;
}

export class MemStorage implements IStorage {
  private sessions: Map<string, Session> = new Map();
  private speakers: Map<string, Speaker> = new Map();
  private messages: Map<string, Message> = new Map();
  private sessionMemories: Map<string, SessionMemory> = new Map();
  private aiPersonalities: Map<string, AIPersonality> = new Map();
  private analytics: Map<string, Analytics> = new Map();

  async getSession(id: string): Promise<Session | undefined> {
    return this.sessions.get(id);
  }

  async createSession(insertSession: InsertSession): Promise<Session> {
    const id = randomUUID();
    const session: Session = {
      ...insertSession,
      id,
      startTime: new Date(),
      endTime: null,
      listeners: 0,
      duration: 0,
      metadata: insertSession.metadata || null,
      status: insertSession.status || "waiting",
    };
    this.sessions.set(id, session);
    return session;
  }

  async updateSession(id: string, updates: Partial<Session>): Promise<Session | undefined> {
    const session = this.sessions.get(id);
    if (!session) return undefined;
    
    const updatedSession = { ...session, ...updates };
    this.sessions.set(id, updatedSession);
    return updatedSession;
  }

  async getAllSessions(): Promise<Session[]> {
    return Array.from(this.sessions.values());
  }

  async getSpeaker(id: string): Promise<Speaker | undefined> {
    return this.speakers.get(id);
  }

  async createSpeaker(insertSpeaker: InsertSpeaker): Promise<Speaker> {
    const id = randomUUID();
    const speaker: Speaker = {
      ...insertSpeaker,
      id,
      joinedAt: new Date(),
      handle: insertSpeaker.handle || null,
      isHost: insertSpeaker.isHost || false,
      isGuest: insertSpeaker.isGuest || false,
      isAI: insertSpeaker.isAI || false,
      avatar: insertSpeaker.avatar || null,
    };
    this.speakers.set(id, speaker);
    return speaker;
  }

  async getSessionSpeakers(sessionId: string): Promise<Speaker[]> {
    return Array.from(this.speakers.values()).filter(s => s.sessionId === sessionId);
  }

  async getMessage(id: string): Promise<Message | undefined> {
    return this.messages.get(id);
  }

  async createMessage(insertMessage: InsertMessage): Promise<Message> {
    const id = randomUUID();
    const message: Message = {
      ...insertMessage,
      id,
      timestamp: new Date(),
      metadata: insertMessage.metadata || null,
      confidence: insertMessage.confidence || null,
      isAIGenerated: insertMessage.isAIGenerated || false,
    };
    this.messages.set(id, message);
    return message;
  }

  async getSessionMessages(sessionId: string): Promise<Message[]> {
    return Array.from(this.messages.values())
      .filter(m => m.sessionId === sessionId)
      .sort((a, b) => a.timestamp!.getTime() - b.timestamp!.getTime());
  }

  async getSessionMemory(sessionId: string): Promise<SessionMemory | undefined> {
    return this.sessionMemories.get(sessionId);
  }

  async upsertSessionMemory(insertMemory: InsertSessionMemory): Promise<SessionMemory> {
    const existing = this.sessionMemories.get(insertMemory.sessionId);
    const id = existing?.id || randomUUID();
    
    const memory: SessionMemory = {
      ...insertMemory,
      id,
      updatedAt: new Date(),
      topics: insertMemory.topics || null,
      speakerNotes: insertMemory.speakerNotes || null,
      clipMoments: insertMemory.clipMoments || null,
      runningJokes: insertMemory.runningJokes || null,
    };
    this.sessionMemories.set(insertMemory.sessionId, memory);
    return memory;
  }

  async getAIPersonality(sessionId: string): Promise<AIPersonality | undefined> {
    return this.aiPersonalities.get(sessionId);
  }

  async upsertAIPersonality(insertPersonality: InsertAIPersonality): Promise<AIPersonality> {
    const existing = this.aiPersonalities.get(insertPersonality.sessionId);
    const id = existing?.id || randomUUID();
    
    const personality: AIPersonality = {
      ...insertPersonality,
      id,
      updatedAt: new Date(),
      voiceType: insertPersonality.voiceType || "energetic-podcaster",
      comedyLevel: insertPersonality.comedyLevel || 60,
      researchLevel: insertPersonality.researchLevel || 40,
      energyLevel: insertPersonality.energyLevel || 75,
      responseStyle: insertPersonality.responseStyle || "conversational",
    };
    this.aiPersonalities.set(insertPersonality.sessionId, personality);
    return personality;
  }

  async getAnalytics(sessionId: string): Promise<Analytics | undefined> {
    return this.analytics.get(sessionId);
  }

  async upsertAnalytics(insertAnalytics: InsertAnalytics): Promise<Analytics> {
    const existing = this.analytics.get(insertAnalytics.sessionId);
    const id = existing?.id || randomUUID();
    
    const analytics: Analytics = {
      ...insertAnalytics,
      id,
      updatedAt: new Date(),
      aiSpeakingTime: insertAnalytics.aiSpeakingTime || 0,
      totalResponses: insertAnalytics.totalResponses || 0,
      avgResponseTime: insertAnalytics.avgResponseTime || 0,
      interrupts: insertAnalytics.interrupts || 0,
      jokeSuccessRate: insertAnalytics.jokeSuccessRate || 0,
    };
    this.analytics.set(insertAnalytics.sessionId, analytics);
    return analytics;
  }
}

export const storage = new MemStorage();
