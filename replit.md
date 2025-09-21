# AI Cohost for Twitter/X Spaces

## Overview

This is a real-time voice-enabled AI agent that acts as a charismatic cohost for Twitter/X Spaces. The application captures live audio, processes it through speech-to-text, generates intelligent AI responses, and synthesizes speech back to the conversation. The system is designed to keep conversations flowing with humor, insight, and human-like interaction while maintaining extremely low latency (under 2 seconds for first response).

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

The client is built using **React 18** with **TypeScript** and **Vite** as the build tool. The UI leverages **shadcn/ui** components built on **Radix UI** primitives with **Tailwind CSS** for styling. The application uses a modern single-page architecture with **Wouter** for lightweight routing.

**State Management**: React Query (TanStack Query) handles server state and caching, while local component state manages UI interactions. WebSocket connections provide real-time communication between client and server.

**Control Center Mode**: The frontend now operates as a control center without browser audio capture. It receives transcripts, audio levels, and status updates from an external desktop audio processor via WebSocket, while sending control commands and AI responses back.

### Backend Architecture

The server is built with **Express.js** and **TypeScript**, following a RESTful API pattern with WebSocket support for real-time features. The architecture separates concerns into distinct service layers:

**Audio Service**: Handles audio chunk processing, level calculation, and buffering with configurable sample rates and chunk sizes.

**OpenAI Service**: Integrates with OpenAI's APIs for speech-to-text (Whisper), text generation (GPT), and text-to-speech synthesis. Includes conversation context management and personality-driven response generation.

**Storage Layer**: Implements an in-memory storage system with interfaces designed for easy migration to persistent databases. Stores sessions, speakers, messages, AI personality configurations, and analytics data.

### Real-time Communication

**WebSocket Integration**: Bidirectional communication for live audio streaming, AI status updates, and message broadcasting. Supports session management with host/guest roles and automatic reconnection handling.

**Audio Pipeline**: Captures audio through virtual audio cables or loopback systems, processes through STT with partial streaming, generates contextual responses, and synthesizes speech with prosody control.

### Data Models

The schema defines core entities including sessions (live/waiting/ended states), speakers (host/guest/AI roles), messages with confidence scores, session memory for context retention, AI personality configurations, and analytics tracking.

**Memory Management**: Implements both session-scoped and long-term memory with configurable retention policies, confidence-based filtering, and automatic summarization after sessions.

### AI Personality System

**Dynamic Personalities**: Supports multiple voice types (energetic podcaster, street comedy, UFO researcher) with adjustable parameters for comedy level, research depth, and energy. Includes real-time voice swapping with preview capabilities.

**Response Strategies**: Implements various interaction patterns including turn-taking with interruption handling, contextual joke insertion, smooth topic transitions, and escalation to human hosts when needed.

## External Dependencies

### AI Services
- **OpenAI API**: Core service for Whisper speech-to-text, GPT-4/5 text generation, and TTS synthesis
- **Neon Database**: PostgreSQL database service for production data persistence
- **Drizzle ORM**: Type-safe database operations with PostgreSQL dialect

### Development Tools
- **Vite**: Frontend build tool with hot module replacement and optimization
- **TypeScript**: Type safety across the entire application stack
- **ESBuild**: Fast bundling for production server builds

### UI and Styling
- **Tailwind CSS**: Utility-first CSS framework with custom design tokens
- **Radix UI**: Accessible component primitives for complex UI interactions
- **Lucide React**: Comprehensive icon library for user interface elements

### Audio Processing
- **Web Audio API**: Browser-native audio capture and processing capabilities
- **Virtual Audio Cables**: External audio routing for live space integration

### Real-time Features
- **WebSocket**: Native browser/Node.js WebSocket implementation for live communication
- **React Query**: Efficient server state management with caching and synchronization

### Session Management
- **connect-pg-simple**: PostgreSQL session store for user authentication and persistence
- **Express Session**: Server-side session management with secure cookie handling