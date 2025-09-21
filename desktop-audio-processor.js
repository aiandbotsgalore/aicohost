#!/usr/bin/env node

import { Voicemeeter, StripProperties, BusProperties } from "voicemeeter-connector";
import { WebSocket } from 'ws';
import * as readline from 'readline';
import { EventEmitter } from 'events';

// Configuration
const WS_URL = process.env.WS_URL || 'ws://localhost:5000/ws';
const SESSION_ID = process.env.SESSION_ID || 'demo-session-1';
const CLIENT_TYPE = 'desktop';

// Audio recording configuration
const AUDIO_CONFIG = {
  sampleRate: 16000,
  channels: 1,
  audioDevice: process.env.AUDIO_DEVICE || 'VAIO',  // VoiceMeeter virtual input
  outputDevice: process.env.OUTPUT_DEVICE || 'speakers',
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

class VoiceMeeterAudioProcessor extends EventEmitter {
  constructor() {
    super();
    this.vm = null;
    this.isVMConnected = false;
    this.ws = null;
    this.isWSConnected = false;
    this.isRecording = false;
    this.isProcessing = false;
    this.recordingProcess = null;
    this.audioLevelMonitor = null;
    this.currentLevels = { input: 0, output: 0 };
    this.transcriptionBuffer = [];
    this.lastAudioTime = 0;
    this.silenceTimer = null;
  }

  async initialize() {
    log('STATUS', '🚀 Initializing VoiceMeeter Audio Processor...');
    
    try {
      // Initialize VoiceMeeter connection
      await this.initializeVoiceMeeter();
      
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
      log('VM', 'Connecting to VoiceMeeter...');
      
      this.vm = await Voicemeeter.init();
      await this.vm.connect();
      
      this.isVMConnected = true;
      log('VM', `✅ Connected to VoiceMeeter ${this.vm.$type} v${this.vm.$version}`);
      
      // Setup VoiceMeeter monitoring
      this.vm.attachChangeEvent(() => {
        this.emit('voicemeter-change');
      });
      
      // Configure audio routing for our use case
      await this.configureVoiceMeeterRouting();
      
    } catch (error) {
      log('ERROR', 'VoiceMeeter connection failed', { 
        error: error.message,
        suggestion: 'Make sure VoiceMeeter is running and try again'
      });
      throw error;
    }
  }

  async configureVoiceMeeterRouting() {
    try {
      log('VM', 'Configuring audio routing...');
      
      // Ensure proper gain levels for monitoring
      // Strip 0 is typically hardware input 1
      // Strip 1 is typically hardware input 2  
      // Strip 2 is typically VAIO (virtual input)
      
      // Set reasonable gain levels
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
            platform: 'desktop',
            version: '2.0.0',
            capabilities: ['voicemeeter', 'real_time_stt', 'tts', 'audio_monitoring'],
            audioConfig: AUDIO_CONFIG
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
      log('TTS', `"${responseText}"`);
      
      // Here you would implement TTS conversion and audio playback
      // For now, we'll simulate the process
      await this.synthesizeAndPlaySpeech(responseText);
      
      // Send completion status
      this.sendWSMessage('status', {
        status: 'tts_complete',
        duration: this.estimateSpeechDuration(responseText),
        wordCount: responseText.split(' ').length
      });
      
    } catch (error) {
      log('ERROR', 'TTS processing failed', { error: error.message });
    }
  }

  async synthesizeAndPlaySpeech(text) {
    // Simulate TTS processing time
    const duration = this.estimateSpeechDuration(text);
    
    log('TTS', `🎵 Playing synthesized speech (${duration.toFixed(1)}s)`);
    
    // For now, we simulate the TTS process
    // In a real implementation, you would:
    // 1. Convert text to speech using OpenAI TTS or similar
    // 2. Save audio file temporarily
    // 3. Play through system audio or VoiceMeeter virtual cable
    // 4. Use ffplay, aplay, or Windows Sound APIs for playback
    
    log('TTS', `💬 AI Response: "${text}"`);
    
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
    if (!this.isVMConnected) return;
    
    try {
      await this.vm.setStripParameter(strip, StripProperties.Gain, gain);
      log('VM', `🎚️ Adjusted strip ${strip} gain to ${gain}dB`);
    } catch (error) {
      log('ERROR', 'Failed to adjust gain', { error: error.message });
    }
  }

  async toggleMute(strip, muted) {
    if (!this.isVMConnected) return;
    
    try {
      await this.vm.setStripParameter(strip, StripProperties.Mute, muted);
      log('VM', `🔇 ${muted ? 'Muted' : 'Unmuted'} strip ${strip}`);
    } catch (error) {
      log('ERROR', 'Failed to toggle mute', { error: error.message });
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
    if (!this.isVMConnected) return;
    
    try {
      // Monitor input levels from VAIO (strip 2) and output levels
      const inputLeft = this.vm.getLevel(2, 0) || 0;   // VAIO left channel
      const inputRight = this.vm.getLevel(2, 1) || 0;  // VAIO right channel
      const outputLeft = this.vm.getLevel(0, 0) || 0;  // A1 output left
      const outputRight = this.vm.getLevel(0, 1) || 0; // A1 output right
      
      // Calculate average levels
      const inputLevel = (inputLeft + inputRight) / 2;
      const outputLevel = (outputLeft + outputRight) / 2;
      
      this.currentLevels = {
        input: inputLevel,
        output: outputLevel,
        inputChannels: { left: inputLeft, right: inputRight },
        outputChannels: { left: outputLeft, right: outputRight }
      };
      
      // Send levels to browser via WebSocket
      this.sendWSMessage('audio_levels', this.currentLevels);
      
      // Voice activity detection
      if (inputLevel > AUDIO_CONFIG.threshold) {
        this.handleVoiceActivity();
      } else {
        this.handleSilence();
      }
      
    } catch (error) {
      // Silent fail for level monitoring to avoid spam
    }
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
      config: AUDIO_CONFIG
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
    
    // Start recording from the specified audio device
    // This would use a library like node-record-lpcm16 to capture audio
    this.simulateAudioCapture();
  }

  stopAudioCapture() {
    if (!this.isRecording) return;
    
    log('STT', '⏹️ Stopping audio capture...');
    this.isRecording = false;
    
    if (this.recordingProcess) {
      this.recordingProcess.kill();
      this.recordingProcess = null;
    }
    
    // Process accumulated audio for transcription
    this.processTranscription();
  }

  simulateAudioCapture() {
    // Simulate realistic audio capture and transcription
    const sampleTexts = [
      "So what do you think about the future of AI in voice technology?",
      "I believe we're just scratching the surface of what's possible.",
      "The integration with real-time conversation is fascinating.",
      "How do you see this impacting content creators and podcasters?",
      "The potential for accessibility improvements is enormous.",
      "Real-time language translation could be revolutionary.",
      "What are the biggest technical challenges we're facing?",
      "Latency is definitely one of the key factors to consider.",
      "The quality of speech synthesis has improved dramatically.",
      "Privacy and security concerns are also important to address."
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
    // This would send audio data to speech-to-text service
    // For simulation, we'll use the simulate method
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
      speaker: 'detected', // Could implement speaker identification
      metadata: {
        processingTime: 1.2, // seconds
        audioQuality: 'good',
        noiseLevel: this.currentLevels.input
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
    
    if (this.recordingProcess) {
      this.recordingProcess.kill();
      this.recordingProcess = null;
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
  console.log(`${colors.bright}${colors.cyan}    🎙️  VoiceMeeter AI Cohost Audio Processor v2.0${colors.reset}`);
  console.log(`${colors.bright}${colors.cyan}${'═'.repeat(70)}${colors.reset}\n`);
  
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
  
  const processor = new VoiceMeeterAudioProcessor();
  
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