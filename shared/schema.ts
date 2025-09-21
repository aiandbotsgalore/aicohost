import { sql } from "drizzle-orm";
import { pgTable, text, varchar, jsonb, timestamp, integer, boolean, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const sessions = pgTable("sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  status: text("status").notNull().default("waiting"), // waiting, live, ended
  startTime: timestamp("start_time").defaultNow(),
  endTime: timestamp("end_time"),
  listeners: integer("listeners").default(0),
  duration: integer("duration").default(0), // in seconds
  metadata: jsonb("metadata"),
});

export const speakers = pgTable("speakers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sessionId: varchar("session_id").references(() => sessions.id).notNull(),
  name: text("name").notNull(),
  handle: text("handle"),
  isHost: boolean("is_host").default(false),
  isGuest: boolean("is_guest").default(false),
  isAI: boolean("is_ai").default(false),
  avatar: text("avatar"),
  joinedAt: timestamp("joined_at").defaultNow(),
});

export const messages = pgTable("messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sessionId: varchar("session_id").references(() => sessions.id).notNull(),
  speakerId: varchar("speaker_id").references(() => speakers.id).notNull(),
  content: text("content").notNull(),
  timestamp: timestamp("timestamp").defaultNow(),
  confidence: real("confidence"),
  isAIGenerated: boolean("is_ai_generated").default(false),
  metadata: jsonb("metadata"),
});

export const sessionMemory = pgTable("session_memory", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sessionId: varchar("session_id").references(() => sessions.id).notNull(),
  topics: jsonb("topics"), // { name: string, mentions: number }[]
  speakerNotes: jsonb("speaker_notes"), // { [speakerId]: string }
  runningJokes: text("running_jokes").array(),
  clipMoments: jsonb("clip_moments"), // { topic: string, timestamp: string }[]
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const aiPersonality = pgTable("ai_personality", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sessionId: varchar("session_id").references(() => sessions.id).notNull(),
  voiceType: text("voice_type").notNull().default("energetic-podcaster"),
  comedyLevel: integer("comedy_level").default(60), // 0-100
  researchLevel: integer("research_level").default(40), // 0-100
  energyLevel: integer("energy_level").default(75), // 0-100
  responseStyle: text("response_style").default("conversational"), // conversational, formal
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const analytics = pgTable("analytics", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sessionId: varchar("session_id").references(() => sessions.id).notNull(),
  aiSpeakingTime: real("ai_speaking_time").default(0), // percentage
  totalResponses: integer("total_responses").default(0),
  avgResponseTime: real("avg_response_time").default(0), // seconds
  interrupts: integer("interrupts").default(0),
  jokeSuccessRate: real("joke_success_rate").default(0), // percentage
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertSessionSchema = createInsertSchema(sessions).omit({
  id: true,
  startTime: true,
});

export const insertSpeakerSchema = createInsertSchema(speakers).omit({
  id: true,
  joinedAt: true,
});

export const insertMessageSchema = createInsertSchema(messages).omit({
  id: true,
  timestamp: true,
});

export const insertSessionMemorySchema = createInsertSchema(sessionMemory).omit({
  id: true,
  updatedAt: true,
});

export const insertAIPersonalitySchema = createInsertSchema(aiPersonality).omit({
  id: true,
  updatedAt: true,
});

export const insertAnalyticsSchema = createInsertSchema(analytics).omit({
  id: true,
  updatedAt: true,
});

export type Session = typeof sessions.$inferSelect;
export type InsertSession = z.infer<typeof insertSessionSchema>;
export type Speaker = typeof speakers.$inferSelect;
export type InsertSpeaker = z.infer<typeof insertSpeakerSchema>;
export type Message = typeof messages.$inferSelect;
export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type SessionMemory = typeof sessionMemory.$inferSelect;
export type InsertSessionMemory = z.infer<typeof insertSessionMemorySchema>;
export type AIPersonality = typeof aiPersonality.$inferSelect;
export type InsertAIPersonality = z.infer<typeof insertAIPersonalitySchema>;
export type Analytics = typeof analytics.$inferSelect;
export type InsertAnalytics = z.infer<typeof insertAnalyticsSchema>;
