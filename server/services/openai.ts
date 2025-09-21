import OpenAI from "openai";

// Using GPT-4 for compatibility since GPT-5 may not be available
const apiKey = process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY_ENV_VAR;
if (!apiKey || apiKey === "sk-default") {
  console.error("OpenAI API key not found or invalid:", apiKey ? `${apiKey.substring(0, 10)}...` : "undefined");
} else {
  console.log("OpenAI API key loaded:", `${apiKey.substring(0, 10)}...${apiKey.substring(apiKey.length - 4)}`);
}

const openai = new OpenAI({ 
  apiKey: apiKey || "sk-default"
});

export interface ConversationContext {
  topics: Array<{ name: string; mentions: number }>;
  speakerNotes: Record<string, string>;
  runningJokes: string[];
  recentMessages: Array<{ speaker: string; content: string; timestamp: Date }>;
  personality: {
    voiceType: string;
    comedyLevel: number;
    researchLevel: number;
    energyLevel: number;
    responseStyle: string;
  };
}

export async function transcribeAudio(audioBuffer: Buffer): Promise<{ text: string; confidence?: number }> {
  try {
    // Create a temporary file-like object for the audio
    const file = new File([audioBuffer], "audio.wav", { type: "audio/wav" });
    
    const transcription = await openai.audio.transcriptions.create({
      file,
      model: "whisper-1",
      response_format: "json",
      language: "en",
    });

    return {
      text: transcription.text,
      confidence: 0.95, // Whisper doesn't provide confidence, but it's generally high
    };
  } catch (error) {
    console.error("Transcription error:", error);
    throw new Error(`Failed to transcribe audio: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export async function generateAIResponse(
  recentTranscript: string,
  context: ConversationContext
): Promise<{ response: string; confidence: number }> {
  try {
    const systemPrompt = createSystemPrompt(context);
    const userPrompt = createUserPrompt(recentTranscript, context);

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      response_format: { type: "json_object" },
      max_tokens: 500,
    });

    const result = JSON.parse(response.choices[0].message.content || "{}");
    
    return {
      response: result.response || "I see what you mean!",
      confidence: result.confidence || 0.8,
    };
  } catch (error) {
    console.error("AI response error:", error);
    throw new Error(`Failed to generate AI response: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export async function synthesizeSpeech(text: string, voiceType: string = "nova"): Promise<Buffer> {
  try {
    const voice = mapVoiceType(voiceType);
    
    const response = await openai.audio.speech.create({
      model: "tts-1",
      voice,
      input: text,
      response_format: "wav",
    });

    return Buffer.from(await response.arrayBuffer());
  } catch (error) {
    console.error("Speech synthesis error:", error);
    throw new Error(`Failed to synthesize speech: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export async function analyzeConversationTopic(
  messages: Array<{ speaker: string; content: string }>
): Promise<{
  topics: Array<{ name: string; mentions: number }>;
  sentiment: string;
  keyPoints: string[];
}> {
  try {
    const conversationText = messages
      .map(m => `${m.speaker}: ${m.content}`)
      .join("\n");

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `Analyze this conversation and extract key topics, overall sentiment, and main points. 
                   Respond with JSON in this format: 
                   { "topics": [{"name": "topic", "mentions": count}], "sentiment": "positive/neutral/negative", "keyPoints": ["point1", "point2"] }`
        },
        { role: "user", content: conversationText }
      ],
      response_format: { type: "json_object" },
    });

    return JSON.parse(response.choices[0].message.content || "{}");
  } catch (error) {
    console.error("Topic analysis error:", error);
    return { topics: [], sentiment: "neutral", keyPoints: [] };
  }
}

function createSystemPrompt(context: ConversationContext): string {
  const { personality } = context;
  
  return `You are a charismatic AI cohost for a Twitter/X Space. Your mission is to keep conversations flowing, add humor and insight, and be a beloved personality.

PERSONALITY SETTINGS:
- Voice Type: ${personality.voiceType}
- Comedy Level: ${personality.comedyLevel}% (0=serious, 100=comedian)
- Research Level: ${personality.researchLevel}% (0=casual, 100=academic)
- Energy Level: ${personality.energyLevel}% (0=calm, 100=hyperactive)
- Style: ${personality.responseStyle}

CONTEXT AWARENESS:
- Current topics: ${context.topics.map(t => `${t.name} (${t.mentions}x)`).join(", ")}
- Running jokes: ${context.runningJokes.join(", ")}
- Speaker notes: ${Object.entries(context.speakerNotes).map(([k, v]) => `${k}: ${v}`).join("; ")}

RESPONSE RULES:
- Keep responses under 30 seconds of speech (roughly 75 words)
- Match the energy and tone of the conversation
- Include callbacks to previous topics when relevant
- End with a question or smooth handoff to keep conversation flowing
- Use humor appropriately based on comedy level setting

Respond with JSON: {"response": "your response text", "confidence": 0.0-1.0}`;
}

function createUserPrompt(transcript: string, context: ConversationContext): string {
  return `Recent conversation:
${transcript}

Recent messages context:
${context.recentMessages.map(m => `${m.speaker}: ${m.content}`).slice(-3).join("\n")}

Generate an appropriate response as the AI cohost. Consider the ongoing conversation, your personality settings, and aim to add value while keeping things engaging.`;
}

function mapVoiceType(voiceType: string): "alloy" | "echo" | "fable" | "onyx" | "nova" | "shimmer" {
  switch (voiceType) {
    case "energetic-podcaster": return "nova";
    case "street-comedy-voice": return "echo";
    case "geeky-ufo-researcher": return "fable";
    case "professional-moderator": return "onyx";
    default: return "nova";
  }
}
