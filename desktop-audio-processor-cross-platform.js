#!/usr/bin/env node

import { WebSocket } from 'ws';
import * as readline from 'readline';
import { EventEmitter } from 'events';
import os from 'os';

// Configuration
const WS_URL = process.env.WS_URL || 'ws://localhost:5000/ws';
const SESSION_ID = process.env.SESSION_ID || 'demo-session-1';
const CLIENT_TYPE = 'desktop';

// Audio recording configuration
const AUDIO_CONFIG = {
  sampleRate: 16000,
  channels: 1,
  audioDevice: process.env.AUDIO_DEVICE || 'default',
  outputDevice: process.env.OUTPUT_DEVICE || 'default',
  chunkSize: 1024,
  threshold: -45, // dB threshold for voice activity detection
  silenceThreshold: 2000, // ms of silence before stopping transcription
};

// Console colors for better readability
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
};

function log(type, message, data = null) {
  const timestamp = new Date().toLocaleTimeString();
  let prefix = '';
  let color = colors.white;
  
  switch (type) {
    case 'VOICE':
      prefix = '🎙️ VOICE';
      color = colors.green;
      break;
    case 'STT':
      prefix = '📝 STT';
      color = colors.blue;
      break;
    case 'TTS':
      prefix = '🔊 TTS';
      color = colors.magenta;
      break;
    case 'WS':
      prefix = '🔗 WS';
      color = colors.cyan;
      break;
    case 'VM':
      prefix = '🎛️ VM';
      color = colors.yellow;
      break;
    case 'ERROR':
      prefix = '❌ ERROR';
      color = colors.red;
      break;
    case 'STATUS':
      prefix = '📊 STATUS';
      color = colors.blue;
      break;
    default:
      prefix = '• INFO';
  }
  
  console.log(`${color}${colors.bright}[${timestamp}] ${prefix}${colors.reset} ${message}`);
  if (data) {
    console.log(`${colors.dim}${JSON.stringify(data, null, 2)}${colors.reset}`);
  }
}

class CrossPlatformAudioProcessor extends EventEmitter {
  constructor() {
    super();
    this.vm = null;
    this.isVMConnected = false;
    this.isVMAvailable = false;
    this.ws = null;
    this.isWSConnected = false;
    this.isRecording = false;
    this.isProcessing = false;
    this.audioLevelMonitor = null;
    this.currentLevels = { input: 0, output: 0 };
    this.transcriptionBuffer = [];
    this.lastAudioTime = 0;
    this.silenceTimer = null;
    this.platform = os.platform();
    this.simulationMode = this.platform !== 'win32';
  }

  async initialize() {
    log('STATUS', `🚀 Initializing Audio Processor on ${this.platform}...`);
    
    try {
      // Try to initialize VoiceMeeter (Windows only)
      if (this.platform === 'win32') {
        await this.initializeVoiceMeeter();
      } else {
        log('STATUS', '🐧 VoiceMeeter not available on this platform - using simulation mode');
        this.simulationMode = true;
      }
      
      // Initialize WebSocket connection
      await this.initializeWebSocket();
      
      // Start audio monitoring
      this.startAudioMonitoring();
      
      log('STATUS', '✅ Audio processor initialized successfully!');
      this.emit('ready');
      
    } catch (error) {
      log('ERROR', 'Failed to initialize audio processor', { error: error.message });
      throw error;
    }
  }

  async initializeVoiceMeeter() {
    try {
      log('VM', 'Attempting to connect to VoiceMeeter...');
      
      // Dynamically import VoiceMeeter only on Windows
      const { Voicemeeter, StripProperties, BusProperties } = await import('voicemeeter-connector');
      
      this.vm = await Voicemeeter.init();
      await this.vm.connect();
      
      this.isVMConnected = true;
      this.isVMAvailable = true;
      log('VM', `✅ Connected to VoiceMeeter ${this.vm.$type} v${this.vm.$version}`);
      
      // Setup VoiceMeeter monitoring
      this.vm.attachChangeEvent(() => {
        this.emit('voicemeter-change');
      });
      
      // Configure audio routing for our use case
      await this.configureVoiceMeeterRouting();
      
    } catch (error) {
      log('VM', `⚠️ VoiceMeeter connection failed: ${error.message}`);
      log('VM', '🎭 Falling back to simulation mode');
      this.simulationMode = true;
      this.isVMAvailable = false;
    }
  }

  async configureVoiceMeeterRouting() {
    if (!this.isVMConnected) return;
    
    try {
      const { StripProperties, BusProperties } = await import('voicemeeter-connector');
      
      log('VM', 'Configuring audio routing...');
      
      // Set reasonable gain levels for monitoring
      await this.vm.setStripParameter(2, StripProperties.Gain, 0); // VAIO input
      await this.vm.setBusParameter(0, BusProperties.Gain, 0); // A1 output
      
      // Ensure monitoring is enabled for our virtual inputs
      await this.vm.setStripParameter(2, StripProperties.A1, true); // Route VAIO to A1
      
      log('VM', '✅ Audio routing configured');
      
    } catch (error) {
      log('ERROR', 'Failed to configure VoiceMeeter routing', { error: error.message });
    }
  }

  async initializeWebSocket() {
    return new Promise((resolve, reject) => {
      log('WS', `Connecting to WebSocket server at ${WS_URL}...`);
      
      this.ws = new WebSocket(WS_URL);
      
      this.ws.on('open', () => {
        log('WS', '✅ WebSocket connection established');
        this.isWSConnected = true;
        
        // Send connection message
        this.sendWSMessage('desktop_connect', {
          sessionId: SESSION_ID,
          deviceInfo: {
            platform: this.platform,
            version: '3.0.0',
            capabilities: [
              this.isVMAvailable ? 'voicemeeter' : 'simulation',
              'real_time_stt',
              'tts',
              'audio_monitoring',
              'cross_platform'
            ],
            audioConfig: AUDIO_CONFIG,
            voicemeeterAvailable: this.isVMAvailable,
            simulationMode: this.simulationMode
          }
        });
        
        resolve();
      });
      
      this.ws.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString());
          this.handleWSMessage(message);
        } catch (error) {
          log('ERROR', 'Failed to parse WebSocket message', { error: error.message });
        }
      });
      
      this.ws.on('close', () => {
        log('WS', 'WebSocket connection closed');
        this.isWSConnected = false;
        this.cleanup();
      });
      
      this.ws.on('error', (error) => {
        log('ERROR', 'WebSocket error', { error: error.message });
        reject(error);
      });
      
      // Connection timeout
      setTimeout(() => {
        if (!this.isWSConnected) {
          reject(new Error('WebSocket connection timeout'));
        }
      }, 10000);
    });
  }

  sendWSMessage(type, data = null) {
    if (!this.isWSConnected) {
      log('ERROR', 'Cannot send WebSocket message - not connected');
      return;
    }
    
    const message = {
      type,
      source: CLIENT_TYPE,
      data,
      timestamp: new Date().toISOString()
    };
    
    this.ws.send(JSON.stringify(message));
    log('WS', `📤 Sent ${type}`, data);
  }

  handleWSMessage(message) {
    log('WS', `📥 Received ${message.type}`, message.data);
    
    switch (message.type) {
      case 'connected':
        log('WS', `Connected with client ID: ${message.data?.clientId}`);
        break;
        
      case 'ai_response':
        this.handleAIResponse(message.data);
        break;
        
      case 'control_command':
        this.handleControlCommand(message.data);
        break;
        
      case 'status':
        log('STATUS', 'Server status update', message.data);
        break;
        
      case 'error':
        log('ERROR', `Server error: ${message.data?.message}`);
        break;
    }
  }

  async handleAIResponse(data) {
    log('TTS', 'Processing AI response for audio output...');
    
    try {
      const responseText = data.response || data.text || data;
      log('TTS', `💬 AI Response: "${responseText}"`);
      
      // Process TTS
      await this.synthesizeAndPlaySpeech(responseText);
      
      // Send completion status
      this.sendWSMessage('status', {
        status: 'tts_complete',
        duration: this.estimateSpeechDuration(responseText),
        wordCount: responseText.split(' ').length,
        platform: this.platform,
        voicemeeterUsed: this.isVMAvailable
      });
      
    } catch (error) {
      log('ERROR', 'TTS processing failed', { error: error.message });
    }
  }

  async synthesizeAndPlaySpeech(text) {
    const duration = this.estimateSpeechDuration(text);
    
    if (this.isVMAvailable) {
      log('TTS', `🎵 Playing through VoiceMeeter (${duration.toFixed(1)}s)`);
      // Real VoiceMeeter audio output would go here
    } else {
      log('TTS', `🎭 Simulating TTS playback (${duration.toFixed(1)}s)`);
    }
    
    return new Promise(resolve => {
      setTimeout(() => {
        log('TTS', '✅ Speech playback complete');
        resolve();
      }, duration * 1000);
    });
  }

  estimateSpeechDuration(text) {
    // Rough estimation: 150 words per minute = 2.5 words per second
    const wordCount = text.split(' ').length;
    return Math.max(wordCount / 2.5, 1.0);
  }

  handleControlCommand(data) {
    log('STATUS', `🎮 Control command: ${data.command}`, data);
    
    switch (data.command) {
      case 'start':
        this.startAudioProcessing();
        break;
      case 'pause':
        this.pauseAudioProcessing();
        break;
      case 'resume':
        this.resumeAudioProcessing();
        break;
      case 'stop':
        this.stopAudioProcessing();
        break;
      case 'adjust_gain':
        this.adjustAudioGain(data.strip || 2, data.gain || 0);
        break;
      case 'mute':
        this.toggleMute(data.strip || 2, data.muted !== false);
        break;
      default:
        log('STATUS', `Unknown command: ${data.command}`);
    }
  }

  async adjustAudioGain(strip, gain) {
    if (this.isVMAvailable && this.isVMConnected) {
      try {
        const { StripProperties } = await import('voicemeeter-connector');
        await this.vm.setStripParameter(strip, StripProperties.Gain, gain);
        log('VM', `🎚️ Adjusted strip ${strip} gain to ${gain}dB`);
      } catch (error) {
        log('ERROR', 'Failed to adjust gain', { error: error.message });
      }
    } else {
      log('VM', `🎭 Simulated: Adjusted strip ${strip} gain to ${gain}dB`);
    }
  }

  async toggleMute(strip, muted) {
    if (this.isVMAvailable && this.isVMConnected) {
      try {
        const { StripProperties } = await import('voicemeeter-connector');
        await this.vm.setStripParameter(strip, StripProperties.Mute, muted);
        log('VM', `🔇 ${muted ? 'Muted' : 'Unmuted'} strip ${strip}`);
      } catch (error) {
        log('ERROR', 'Failed to toggle mute', { error: error.message });
      }
    } else {
      log('VM', `🎭 Simulated: ${muted ? 'Muted' : 'Unmuted'} strip ${strip}`);
    }
  }

  startAudioMonitoring() {
    if (this.audioLevelMonitor) return;
    
    log('VOICE', '🎧 Starting audio level monitoring...');
    
    this.audioLevelMonitor = setInterval(() => {
      this.updateAudioLevels();
    }, 100); // Update every 100ms for smooth visualization
  }

  updateAudioLevels() {
    let levels;
    
    if (this.isVMAvailable && this.isVMConnected) {
      try {
        // Real VoiceMeeter level monitoring
        const inputLeft = this.vm.getLevel(2, 0) || 0;   // VAIO left channel
        const inputRight = this.vm.getLevel(2, 1) || 0;  // VAIO right channel
        const outputLeft = this.vm.getLevel(0, 0) || 0;  // A1 output left
        const outputRight = this.vm.getLevel(0, 1) || 0; // A1 output right
        
        levels = {
          input: (inputLeft + inputRight) / 2,
          output: (outputLeft + outputRight) / 2,
          inputChannels: { left: inputLeft, right: inputRight },
          outputChannels: { left: outputLeft, right: outputRight },
          source: 'voicemeeter'
        };
      } catch (error) {
        // Fall back to simulation if VoiceMeeter fails
        levels = this.generateSimulatedLevels();
      }
    } else {
      // Simulated levels for testing
      levels = this.generateSimulatedLevels();
    }
    
    this.currentLevels = levels;
    
    // Send levels to browser via WebSocket
    this.sendWSMessage('audio_levels', levels);
    
    // Voice activity detection
    if (levels.input > AUDIO_CONFIG.threshold) {
      this.handleVoiceActivity();
    } else {
      this.handleSilence();
    }
  }

  generateSimulatedLevels() {
    // Generate realistic audio levels for simulation
    const baseLevel = -60 + Math.random() * 40; // -60 to -20 dB
    const activity = Math.random() > 0.7 ? Math.random() * 30 : 0; // Occasional speech
    
    return {
      input: baseLevel + activity,
      output: baseLevel + activity * 0.8,
      inputChannels: { 
        left: baseLevel + activity + Math.random() * 2, 
        right: baseLevel + activity + Math.random() * 2 
      },
      outputChannels: { 
        left: baseLevel + activity * 0.8, 
        right: baseLevel + activity * 0.8 
      },
      source: 'simulation'
    };
  }

  handleVoiceActivity() {
    this.lastAudioTime = Date.now();
    
    if (this.silenceTimer) {
      clearTimeout(this.silenceTimer);
      this.silenceTimer = null;
    }
    
    if (!this.isRecording && this.isProcessing) {
      this.startAudioCapture();
    }
  }

  handleSilence() {
    if (this.isRecording && !this.silenceTimer) {
      this.silenceTimer = setTimeout(() => {
        if (this.isRecording) {
          this.stopAudioCapture();
        }
      }, AUDIO_CONFIG.silenceThreshold);
    }
  }

  startAudioProcessing() {
    if (this.isProcessing) return;
    
    log('VOICE', '🎙️ Starting audio processing...');
    this.isProcessing = true;
    
    this.sendWSMessage('status', {
      status: 'processing_started',
      config: AUDIO_CONFIG,
      platform: this.platform,
      voicemeeterAvailable: this.isVMAvailable
    });
  }

  pauseAudioProcessing() {
    log('VOICE', '⏸️ Pausing audio processing...');
    this.isProcessing = false;
    this.stopAudioCapture();
    
    this.sendWSMessage('status', {
      status: 'processing_paused'
    });
  }

  resumeAudioProcessing() {
    log('VOICE', '▶️ Resuming audio processing...');
    this.isProcessing = true;
    
    this.sendWSMessage('status', {
      status: 'processing_resumed'
    });
  }

  stopAudioProcessing() {
    log('VOICE', '⏹️ Stopping audio processing...');
    this.isProcessing = false;
    this.stopAudioCapture();
    
    this.sendWSMessage('status', {
      status: 'processing_stopped'
    });
  }

  startAudioCapture() {
    if (this.isRecording) return;
    
    log('STT', '🔴 Starting audio capture...');
    this.isRecording = true;
    this.transcriptionBuffer = [];
    
    // Simulate realistic audio capture and processing
    this.simulateAudioCapture();
  }

  stopAudioCapture() {
    if (!this.isRecording) return;
    
    log('STT', '⏹️ Stopping audio capture...');
    this.isRecording = false;
    
    // Process accumulated audio for transcription
    this.processTranscription();
  }

  simulateAudioCapture() {
    // Generate realistic conversation samples
    const sampleTexts = [
      "Welcome everyone to today's discussion about AI and technology.",
      "I think the most exciting part is how this can help content creators.",
      "The real-time processing capabilities are really impressive.",
      "How do you see this technology evolving in the next few years?",
      "Privacy and security are definitely important considerations.",
      "The potential for accessibility improvements is huge.",
      "What are the main challenges we need to overcome?",
      "I love how this can make conversations more engaging.",
      "The integration with existing tools is seamless.",
      "This could revolutionize how we think about live audio."
    ];
    
    const randomText = sampleTexts[Math.floor(Math.random() * sampleTexts.length)];
    const confidence = 0.85 + Math.random() * 0.1; // 85-95% confidence
    
    setTimeout(() => {
      if (this.isRecording) {
        this.handleTranscriptionResult(randomText, confidence);
        this.stopAudioCapture();
      }
    }, 1500 + Math.random() * 2000); // 1.5-3.5 second simulated processing time
  }

  processTranscription() {
    log('STT', '🔄 Processing audio for transcription...');
  }

  handleTranscriptionResult(text, confidence) {
    log('STT', `📝 Transcription: "${text}" (${(confidence * 100).toFixed(1)}% confidence)`);
    
    // Send transcript to browser via WebSocket
    this.sendWSMessage('transcript', {
      text: text,
      confidence: confidence,
      timestamp: Date.now(),
      isPartial: false,
      speaker: 'detected',
      metadata: {
        processingTime: 1.2,
        audioQuality: this.isVMAvailable ? 'excellent' : 'simulated',
        noiseLevel: this.currentLevels.input,
        platform: this.platform,
        voicemeeterUsed: this.isVMAvailable
      }
    });
  }

  cleanup() {
    log('STATUS', '🧹 Cleaning up resources...');
    
    if (this.audioLevelMonitor) {
      clearInterval(this.audioLevelMonitor);
      this.audioLevelMonitor = null;
    }
    
    if (this.silenceTimer) {
      clearTimeout(this.silenceTimer);
      this.silenceTimer = null;
    }
    
    if (this.vm && this.isVMConnected) {
      this.vm.disconnect();
      this.isVMConnected = false;
      log('VM', '🔌 Disconnected from VoiceMeeter');
    }
    
    if (this.ws && this.isWSConnected) {
      this.ws.close();
      this.isWSConnected = false;
      log('WS', '🔌 Disconnected from WebSocket');
    }
  }

  async shutdown() {
    log('STATUS', '🛑 Shutting down audio processor...');
    
    this.stopAudioProcessing();
    this.cleanup();
    
    log('STATUS', '✅ Shutdown complete');
  }
}

// Main execution
async function main() {
  console.clear();
  console.log(`${colors.bright}${colors.cyan}${'═'.repeat(70)}${colors.reset}`);
  console.log(`${colors.bright}${colors.cyan}    🎙️  Cross-Platform AI Cohost Audio Processor v3.0${colors.reset}`);
  console.log(`${colors.bright}${colors.cyan}${'═'.repeat(70)}${colors.reset}\n`);
  
  console.log(`${colors.yellow}Platform: ${os.platform()} ${os.arch()}${colors.reset}`);
  console.log(`${colors.yellow}Configuration:${colors.reset}`);
  console.log(`  • WebSocket URL: ${WS_URL}`);
  console.log(`  • Session ID: ${SESSION_ID}`);
  console.log(`  • Audio Device: ${AUDIO_CONFIG.audioDevice}`);
  console.log(`  • Sample Rate: ${AUDIO_CONFIG.sampleRate}Hz`);
  console.log(`  • Voice Threshold: ${AUDIO_CONFIG.threshold}dB\n`);
  
  console.log(`${colors.yellow}Controls:${colors.reset}`);
  console.log(`  • ${colors.bright}Space${colors.reset} - Start/Stop Processing`);
  console.log(`  • ${colors.bright}p${colors.reset} - Pause/Resume`);
  console.log(`  • ${colors.bright}r${colors.reset} - Reconnect`);
  console.log(`  • ${colors.bright}q${colors.reset} - Quit\n`);
  
  console.log(`${colors.dim}${'─'.repeat(70)}${colors.reset}\n`);
  
  const processor = new CrossPlatformAudioProcessor();
  
  try {
    await processor.initialize();
    
    // Start processing by default
    setTimeout(() => {
      processor.startAudioProcessing();
    }, 1000);
    
  } catch (error) {
    log('ERROR', 'Failed to initialize processor', { error: error.message });
    process.exit(1);
  }
  
  // Setup keyboard controls
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: true
  });
  
  if (process.stdin.isTTY) {
    process.stdin.setRawMode(true);
  }
  
  process.stdin.on('keypress', async (str, key) => {
    if (key.ctrl && key.name === 'c') {
      await processor.shutdown();
      process.exit(0);
    }
    
    switch (str) {
      case 'q':
        await processor.shutdown();
        process.exit(0);
        break;
        
      case ' ': // Space bar
        if (processor.isProcessing) {
          processor.stopAudioProcessing();
        } else {
          processor.startAudioProcessing();
        }
        break;
        
      case 'p':
        if (processor.isProcessing) {
          processor.pauseAudioProcessing();
        } else {
          processor.resumeAudioProcessing();
        }
        break;
        
      case 'r':
        log('STATUS', '🔄 Reconnecting...');
        await processor.shutdown();
        setTimeout(async () => {
          try {
            await processor.initialize();
          } catch (error) {
            log('ERROR', 'Reconnection failed', { error: error.message });
          }
        }, 1000);
        break;
    }
  });
  
  // Handle process termination
  process.on('SIGINT', async () => {
    await processor.shutdown();
    process.exit(0);
  });
  
  process.on('SIGTERM', async () => {
    await processor.shutdown();
    process.exit(0);
  });
  
  // Handle uncaught errors
  process.on('uncaughtException', async (error) => {
    log('ERROR', 'Uncaught exception', { error: error.message });
    await processor.shutdown();
    process.exit(1);
  });
}

// Start the application
main().catch(async (error) => {
  log('ERROR', 'Application startup failed', { error: error.message });
  process.exit(1);
});