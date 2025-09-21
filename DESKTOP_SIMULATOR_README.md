# Desktop Audio Processor Simulator

This test script simulates a desktop audio processor connecting to the web application's WebSocket server to test the bidirectional communication flow between desktop and browser clients.

## Files Created

1. **`server/desktop-simulator.js`** - The main desktop simulator script
2. **`desktop-simulator-test.html`** - Browser-based test interface for testing bidirectional communication
3. **`test-desktop-simulator.js`** - Simple test runner script

## How to Run the Desktop Simulator

### Method 1: Direct Execution
```bash
cd server
node desktop-simulator.js
```

### Method 2: Using Test Runner
```bash
node test-desktop-simulator.js
```

## Features

The desktop simulator provides:

### 1. Realistic Twitter Space Simulation
- Sends transcripts from a simulated conversation every 3-5 seconds
- Includes multiple speakers with different confidence levels
- Cycles through conversation topics about AI and voice technology

### 2. Audio Level Updates
- Sends audio level data every 100ms
- Simulates realistic audio levels with occasional spikes
- Includes input, output, and speaker-specific levels

### 3. Status Messages
- Sends periodic system status updates every 10 seconds
- Includes processing statistics and system health metrics
- Reports connection state changes

### 4. Control Command Handling
- Responds to pause/resume commands from browser
- Handles skip speaker commands
- Processes stop commands gracefully

### 5. AI Response Processing
- Receives AI responses from browser
- Simulates Text-to-Speech conversion
- Reports TTS completion status back to server

## Interactive Commands

When running the desktop simulator, you can use these keyboard shortcuts:

- **`q`** - Quit the simulator
- **`p`** - Pause/Resume simulation
- **`r`** - Reconnect to server
- **`s`** - Send test status message
- **`Ctrl+C`** - Graceful shutdown

## Testing Bidirectional Communication

### Step 1: Start the Application
Ensure your main application is running (`npm run dev`)

### Step 2: Start Desktop Simulator
In a new terminal:
```bash
cd server
node desktop-simulator.js
```

### Step 3: Open Browser Test Interface
Open `desktop-simulator-test.html` in your browser or navigate to the main application

### Step 4: Test Communication Flow

The simulator demonstrates:

1. **Desktop → Browser Flow:**
   - Transcripts appear in real-time
   - Audio levels update continuously
   - Status messages show connection state

2. **Browser → Desktop Flow:**
   - Control commands (pause/resume/skip)
   - AI responses for TTS conversion

## Console Output

The desktop simulator uses color-coded console output:

- **Green (→ SEND)** - Messages sent to server
- **Blue (← RECV)** - Messages received from server
- **Yellow (◆ STATUS)** - Status updates
- **Magenta (🤖 AI)** - AI response handling
- **Cyan (⚙ CONTROL)** - Control commands
- **Red (✖ ERROR)** - Error messages

## Protocol Message Format

All messages follow this structure:
```javascript
{
  type: 'transcript' | 'audio_levels' | 'control_command' | 'ai_response' | 'status' | 'error',
  source: 'desktop' | 'browser' | 'server',
  data: any,
  timestamp: ISO 8601 string
}
```

## Sample Conversation Data

The simulator includes a realistic Twitter Space conversation covering:
- AI technology discussions
- Voice technology applications
- Real-time conversation enhancement
- Fact-checking and moderation
- Educational content delivery

Each transcript includes:
- Speaker handle (e.g., @techhost, @guest1)
- Transcript text
- Confidence score (0.85-0.95)
- Metadata (index, latency, timestamp)

## Troubleshooting

If the simulator cannot connect:
1. Ensure the main application is running on port 5000
2. Check that the WebSocket path is `/ws`
3. Verify no firewall is blocking local connections
4. Check console for specific error messages

## Integration Notes

The desktop simulator integrates with the existing WebSocket server implementation in `server/routes.ts` and works with:
- Session management (uses `demo-session-1` by default)
- Speaker tracking
- Message storage
- AI personality settings
- Analytics updates

This simulator provides a complete testing environment for the AI cohost system's bidirectional communication capabilities.