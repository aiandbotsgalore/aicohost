#!/usr/bin/env node

import { WebSocket } from 'ws';
import * as readline from 'readline';

// Configuration
const WS_URL = 'ws://localhost:5000/ws';
const SESSION_ID = 'demo-session-1';
const CLIENT_TYPE = 'desktop';

// Sample Twitter Space conversation data
const sampleConversation = [
  {
    speaker: "@techhost",
    text: "Welcome everyone to our Twitter Space about AI and the future of social audio! I'm excited to have you all here today.",
    confidence: 0.95
  },
  {
    speaker: "@guest1",
    text: "Thanks for having me! I think what's really interesting is how AI can enhance these live conversations in real-time.",
    confidence: 0.92
  },
  {
    speaker: "@techhost",
    text: "Absolutely! And speaking of AI, we actually have an AI cohost helping us today. It's analyzing our conversation and can jump in with insights.",
    confidence: 0.94
  },
  {
    speaker: "@guest2",
    text: "That's fascinating! How does the AI decide when to contribute to the conversation?",
    confidence: 0.88
  },
  {
    speaker: "@techhost",
    text: "Great question! The AI monitors the flow of conversation, identifies key topics, and can provide relevant insights or even crack a joke when appropriate.",
    confidence: 0.93
  },
  {
    speaker: "@guest1",
    text: "I've been working with voice AI for a few years now, and the progress in natural conversation flow is remarkable.",
    confidence: 0.90
  },
  {
    speaker: "@techhost",
    text: "What do you think are the biggest challenges still facing conversational AI?",
    confidence: 0.91
  },
  {
    speaker: "@guest2",
    text: "Context understanding and humor are still tough. Humans pick up on subtle cues that AI might miss.",
    confidence: 0.89
  },
  {
    speaker: "@guest1",
    text: "True, but I'm impressed by how well modern AI can maintain context across longer conversations now.",
    confidence: 0.87
  },
  {
    speaker: "@techhost",
    text: "Let's talk about the practical applications. How do you see AI cohosts being used in podcasts and live audio?",
    confidence: 0.94
  },
  {
    speaker: "@guest2",
    text: "I think fact-checking in real-time could be huge. Imagine having instant verification during political debates or news discussions.",
    confidence: 0.91
  },
  {
    speaker: "@guest1",
    text: "And for educational content, an AI could pull up relevant examples or statistics on the fly.",
    confidence: 0.88
  },
  {
    speaker: "@techhost",
    text: "Those are excellent points! The AI could also help moderate Q&A sessions, organizing questions by topic.",
    confidence: 0.92
  },
  {
    speaker: "@audience1",
    text: "Quick question from the audience - how do you prevent AI from interrupting at inappropriate times?",
    confidence: 0.85
  },
  {
    speaker: "@techhost",
    text: "That's where the human host controls come in. We can adjust the AI's participation level and response triggers.",
    confidence: 0.93
  }
];

// Audio level simulation
function generateAudioLevel() {
  // Simulate realistic audio levels with occasional spikes
  const base = Math.random() * 0.3 + 0.2; // Base level between 0.2-0.5
  const spike = Math.random() > 0.9 ? Math.random() * 0.3 : 0; // Occasional spikes
  return Math.min(base + spike, 1.0);
}

// Console colors for better readability
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  underscore: '\x1b[4m',
  
  // Foreground colors
  black: '\x1b[30m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  
  // Background colors
  bgBlack: '\x1b[40m',
  bgRed: '\x1b[41m',
  bgGreen: '\x1b[42m',
  bgYellow: '\x1b[43m',
  bgBlue: '\x1b[44m',
  bgMagenta: '\x1b[45m',
  bgCyan: '\x1b[46m',
  bgWhite: '\x1b[47m'
};

function log(type, message, data = null) {
  const timestamp = new Date().toLocaleTimeString();
  let prefix = '';
  let color = colors.white;
  
  switch (type) {
    case 'SEND':
      prefix = '→ SEND';
      color = colors.green;
      break;
    case 'RECEIVE':
      prefix = '← RECV';
      color = colors.blue;
      break;
    case 'STATUS':
      prefix = '◆ STATUS';
      color = colors.yellow;
      break;
    case 'ERROR':
      prefix = '✖ ERROR';
      color = colors.red;
      break;
    case 'AI':
      prefix = '🤖 AI';
      color = colors.magenta;
      break;
    case 'CONTROL':
      prefix = '⚙ CONTROL';
      color = colors.cyan;
      break;
    default:
      prefix = '• INFO';
  }
  
  console.log(`${color}${colors.bright}[${timestamp}] ${prefix}${colors.reset} ${message}`);
  if (data) {
    console.log(`${colors.dim}${JSON.stringify(data, null, 2)}${colors.reset}`);
  }
}

class DesktopSimulator {
  constructor() {
    this.ws = null;
    this.isConnected = false;
    this.conversationIndex = 0;
    this.isRunning = false;
    this.audioLevelInterval = null;
    this.transcriptInterval = null;
    this.statusInterval = null;
  }

  connect() {
    log('STATUS', `Connecting to WebSocket server at ${WS_URL}...`);
    
    this.ws = new WebSocket(WS_URL);
    
    this.ws.on('open', () => {
      log('STATUS', 'WebSocket connection established');
      this.isConnected = true;
      this.onConnect();
    });
    
    this.ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        this.handleMessage(message);
      } catch (error) {
        log('ERROR', 'Failed to parse message', { error: error.message, data: data.toString() });
      }
    });
    
    this.ws.on('close', () => {
      log('STATUS', 'WebSocket connection closed');
      this.isConnected = false;
      this.cleanup();
    });
    
    this.ws.on('error', (error) => {
      log('ERROR', 'WebSocket error', { error: error.message });
      this.cleanup();
    });
  }

  onConnect() {
    // Send desktop_connect message
    this.sendMessage('desktop_connect', {
      sessionId: SESSION_ID,
      deviceInfo: {
        platform: 'desktop',
        version: '1.0.0',
        capabilities: ['transcription', 'tts', 'audio_processing']
      }
    });
    
    // Also send joinSession for compatibility
    this.sendMessage('joinSession', {
      sessionId: SESSION_ID,
      clientType: CLIENT_TYPE,
      isHost: false
    });
    
    // Start simulation after a short delay
    setTimeout(() => {
      this.startSimulation();
    }, 1000);
  }

  sendMessage(type, data = null) {
    if (!this.isConnected) {
      log('ERROR', 'Cannot send message - not connected');
      return;
    }
    
    const message = {
      type,
      source: CLIENT_TYPE,
      data,
      timestamp: new Date().toISOString()
    };
    
    this.ws.send(JSON.stringify(message));
    log('SEND', `${type}`, data);
  }

  handleMessage(message) {
    log('RECEIVE', `${message.type}`, message.data);
    
    switch (message.type) {
      case 'connected':
        log('STATUS', `Connected to server with client ID: ${message.data?.clientId}`);
        break;
        
      case 'ai_response':
        this.handleAIResponse(message.data);
        break;
        
      case 'control_command':
        this.handleControlCommand(message.data);
        break;
        
      case 'status':
        log('STATUS', `Server status update`, message.data);
        break;
        
      case 'error':
        log('ERROR', `Server error: ${message.data?.message}`);
        break;
        
      default:
        log('STATUS', `Received ${message.type} message`);
    }
  }

  handleAIResponse(data) {
    log('AI', 'Received AI response for TTS conversion:');
    console.log(`${colors.bright}${colors.magenta}"${data.response || data}"${colors.reset}`);
    
    // Simulate TTS processing
    setTimeout(() => {
      log('AI', 'TTS conversion complete - audio would be played through speakers');
      this.sendMessage('status', {
        status: 'tts_complete',
        duration: 2.5 + Math.random() * 2, // Simulate variable speech duration
        wordCount: (data.response || data).split(' ').length
      });
    }, 500);
  }

  handleControlCommand(data) {
    log('CONTROL', `Received control command: ${data.command}`, data);
    
    switch (data.command) {
      case 'pause':
        this.pauseSimulation();
        break;
      case 'resume':
        this.resumeSimulation();
        break;
      case 'stop':
        this.stopSimulation();
        break;
      case 'adjust_speed':
        log('CONTROL', `Adjusting simulation speed to ${data.speed}x`);
        break;
      case 'skip_speaker':
        this.conversationIndex = Math.min(this.conversationIndex + 1, sampleConversation.length - 1);
        log('CONTROL', 'Skipped to next speaker');
        break;
      default:
        log('CONTROL', `Unknown command: ${data.command}`);
    }
  }

  startSimulation() {
    if (this.isRunning) return;
    
    log('STATUS', '🎬 Starting conversation simulation...');
    console.log(`${colors.dim}${'─'.repeat(60)}${colors.reset}`);
    this.isRunning = true;
    
    // Send initial status
    this.sendMessage('status', {
      status: 'processing_started',
      mode: 'simulation',
      sessionId: SESSION_ID
    });
    
    // Start sending transcripts every 3-5 seconds
    this.transcriptInterval = setInterval(() => {
      if (this.conversationIndex < sampleConversation.length) {
        this.sendTranscript();
      } else {
        // Loop back to beginning
        this.conversationIndex = 0;
        log('STATUS', '↻ Looping conversation...');
      }
    }, 3000 + Math.random() * 2000);
    
    // Send audio levels every 100ms for realistic visualization
    this.audioLevelInterval = setInterval(() => {
      this.sendAudioLevels();
    }, 100);
    
    // Send periodic status updates
    this.statusInterval = setInterval(() => {
      this.sendStatusUpdate();
    }, 10000);
  }

  sendTranscript() {
    const item = sampleConversation[this.conversationIndex];
    
    log('SEND', `📝 Transcript from ${item.speaker}`);
    console.log(`${colors.bright}"${item.text}"${colors.reset}`);
    
    this.sendMessage('transcript', {
      text: item.text,
      speaker: item.speaker,
      confidence: item.confidence,
      timestamp: Date.now(),
      isPartial: false,
      metadata: {
        index: this.conversationIndex,
        totalItems: sampleConversation.length,
        simulatedLatency: Math.random() * 100 + 50 // 50-150ms simulated latency
      }
    });
    
    this.conversationIndex++;
  }

  sendAudioLevels() {
    const levels = {
      input: generateAudioLevel(),
      output: generateAudioLevel(),
      speakers: {
        current: sampleConversation[Math.min(this.conversationIndex, sampleConversation.length - 1)]?.speaker || 'unknown',
        level: generateAudioLevel()
      }
    };
    
    this.sendMessage('audio_levels', levels);
  }

  sendStatusUpdate() {
    const status = {
      status: 'processing_active',
      statistics: {
        transcriptsProcessed: this.conversationIndex,
        totalDuration: Date.now() - this.startTime,
        avgConfidence: 0.91,
        activeConnections: 1,
        audioQuality: 'excellent'
      },
      systemHealth: {
        cpu: Math.random() * 30 + 20, // 20-50% CPU
        memory: Math.random() * 20 + 40, // 40-60% memory
        latency: Math.random() * 50 + 20 // 20-70ms latency
      }
    };
    
    this.sendMessage('status', status);
    log('STATUS', '📊 Sent system statistics update');
  }

  pauseSimulation() {
    if (!this.isRunning) return;
    
    log('STATUS', '⏸ Pausing simulation...');
    this.isRunning = false;
    
    clearInterval(this.transcriptInterval);
    clearInterval(this.audioLevelInterval);
    
    this.sendMessage('status', {
      status: 'processing_paused'
    });
  }

  resumeSimulation() {
    if (this.isRunning) return;
    
    log('STATUS', '▶ Resuming simulation...');
    this.startSimulation();
  }

  stopSimulation() {
    log('STATUS', '⏹ Stopping simulation...');
    this.cleanup();
    
    this.sendMessage('status', {
      status: 'processing_stopped'
    });
  }

  cleanup() {
    this.isRunning = false;
    
    if (this.transcriptInterval) {
      clearInterval(this.transcriptInterval);
      this.transcriptInterval = null;
    }
    
    if (this.audioLevelInterval) {
      clearInterval(this.audioLevelInterval);
      this.audioLevelInterval = null;
    }
    
    if (this.statusInterval) {
      clearInterval(this.statusInterval);
      this.statusInterval = null;
    }
  }

  disconnect() {
    log('STATUS', 'Disconnecting...');
    
    this.cleanup();
    
    if (this.ws) {
      this.sendMessage('status', {
        status: 'client_disconnecting'
      });
      
      this.ws.close();
      this.ws = null;
    }
    
    this.isConnected = false;
  }
}

// Main execution
function main() {
  console.clear();
  console.log(`${colors.bright}${colors.cyan}${'═'.repeat(60)}${colors.reset}`);
  console.log(`${colors.bright}${colors.cyan}    🎙️  Desktop Audio Processor Simulator${colors.reset}`);
  console.log(`${colors.bright}${colors.cyan}${'═'.repeat(60)}${colors.reset}\n`);
  
  console.log(`${colors.yellow}Configuration:${colors.reset}`);
  console.log(`  • WebSocket URL: ${WS_URL}`);
  console.log(`  • Session ID: ${SESSION_ID}`);
  console.log(`  • Client Type: ${CLIENT_TYPE}\n`);
  
  console.log(`${colors.yellow}Commands:${colors.reset}`);
  console.log(`  • ${colors.bright}q${colors.reset} - Quit`);
  console.log(`  • ${colors.bright}p${colors.reset} - Pause/Resume`);
  console.log(`  • ${colors.bright}r${colors.reset} - Reconnect`);
  console.log(`  • ${colors.bright}s${colors.reset} - Send test status\n`);
  
  console.log(`${colors.dim}${'─'.repeat(60)}${colors.reset}\n`);
  
  const simulator = new DesktopSimulator();
  simulator.startTime = Date.now();
  simulator.connect();
  
  // Setup keyboard input
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: true
  });
  
  // Enable raw mode for single keypress detection
  if (process.stdin.isTTY) {
    process.stdin.setRawMode(true);
  }
  
  process.stdin.on('keypress', (str, key) => {
    if (key.ctrl && key.name === 'c') {
      console.log('\n');
      log('STATUS', 'Shutting down...');
      simulator.disconnect();
      process.exit(0);
    }
    
    switch (str) {
      case 'q':
        console.log('\n');
        log('STATUS', 'Shutting down...');
        simulator.disconnect();
        process.exit(0);
        break;
        
      case 'p':
        if (simulator.isRunning) {
          simulator.pauseSimulation();
        } else {
          simulator.resumeSimulation();
        }
        break;
        
      case 'r':
        log('STATUS', 'Reconnecting...');
        simulator.disconnect();
        setTimeout(() => {
          simulator.connect();
        }, 1000);
        break;
        
      case 's':
        simulator.sendMessage('status', {
          status: 'test_status',
          message: 'Manual test status sent',
          timestamp: Date.now()
        });
        log('STATUS', 'Sent test status message');
        break;
    }
  });
  
  // Handle process termination
  process.on('SIGINT', () => {
    console.log('\n');
    log('STATUS', 'Received SIGINT, shutting down gracefully...');
    simulator.disconnect();
    process.exit(0);
  });
  
  process.on('SIGTERM', () => {
    log('STATUS', 'Received SIGTERM, shutting down gracefully...');
    simulator.disconnect();
    process.exit(0);
  });
}

// Start the simulator
main();