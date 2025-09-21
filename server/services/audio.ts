import { EventEmitter } from "events";

export class AudioProcessor extends EventEmitter {
  private isProcessing = false;
  private audioBuffer: Buffer[] = [];
  private readonly SAMPLE_RATE = 44100;
  private readonly CHUNK_SIZE = 4096;

  constructor() {
    super();
  }

  startProcessing() {
    this.isProcessing = true;
    this.emit("processingStarted");
  }

  stopProcessing() {
    this.isProcessing = false;
    this.audioBuffer = [];
    this.emit("processingStopped");
  }

  processAudioChunk(chunk: Buffer): void {
    if (!this.isProcessing) return;

    this.audioBuffer.push(chunk);
    
    // Calculate audio levels for visualization
    const audioLevel = this.calculateAudioLevel(chunk);
    this.emit("audioLevel", audioLevel);

    // If we have enough audio data, process it
    if (this.getTotalBufferSize() >= this.CHUNK_SIZE * 10) {
      this.processBufferedAudio();
    }
  }

  private calculateAudioLevel(buffer: Buffer): number {
    // Convert buffer to audio samples and calculate RMS
    const samples = new Int16Array(buffer.buffer, buffer.byteOffset, buffer.byteLength / 2);
    let sum = 0;
    
    for (let i = 0; i < samples.length; i++) {
      sum += samples[i] * samples[i];
    }
    
    const rms = Math.sqrt(sum / samples.length);
    const normalizedLevel = Math.min(rms / 32768, 1.0);
    
    // Convert to dB scale
    const dbLevel = 20 * Math.log10(normalizedLevel + 0.001);
    return Math.max(dbLevel, -60); // Clamp to -60dB minimum
  }

  private getTotalBufferSize(): number {
    return this.audioBuffer.reduce((total, chunk) => total + chunk.length, 0);
  }

  private processBufferedAudio(): void {
    const audioData = Buffer.concat(this.audioBuffer);
    this.audioBuffer = [];
    
    // Emit processed audio for transcription
    this.emit("audioReady", audioData);
  }

  // Detect if someone is currently speaking
  detectSpeechActivity(audioLevel: number): boolean {
    const SPEECH_THRESHOLD = -40; // dB threshold for speech detection
    return audioLevel > SPEECH_THRESHOLD;
  }

  // Simple voice activity detection
  private voiceActivityBuffer: number[] = [];
  private readonly VAD_BUFFER_SIZE = 10;

  updateVoiceActivity(audioLevel: number): boolean {
    this.voiceActivityBuffer.push(audioLevel);
    
    if (this.voiceActivityBuffer.length > this.VAD_BUFFER_SIZE) {
      this.voiceActivityBuffer.shift();
    }

    // Consider speech active if recent average is above threshold
    const avgLevel = this.voiceActivityBuffer.reduce((sum, level) => sum + level, 0) / this.voiceActivityBuffer.length;
    return this.detectSpeechActivity(avgLevel);
  }

  // Audio routing helpers
  createMixMinusOutput(inputAudio: Buffer, excludeChannels: number[] = []): Buffer {
    // This would implement mix-minus to prevent feedback
    // For now, return the input audio (would need more complex audio processing)
    return inputAudio;
  }

  applyNoiseReduction(audioBuffer: Buffer): Buffer {
    // Placeholder for noise reduction algorithm
    // In production, this would use proper audio DSP
    return audioBuffer;
  }

  applyEchoCanellation(audioBuffer: Buffer, referenceAudio: Buffer): Buffer {
    // Placeholder for acoustic echo cancellation
    // In production, this would implement AEC algorithms
    return audioBuffer;
  }
}

export const audioProcessor = new AudioProcessor();
