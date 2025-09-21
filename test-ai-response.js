import { WebSocket } from 'ws';

// Quick test script for AI response routing
const WS_URL = 'ws://localhost:5000/ws';

console.log('🔌 Testing AI Response Routing...\n');

const ws = new WebSocket(WS_URL);

let testPassed = false;
let responseReceived = false;

ws.on('open', () => {
    console.log('✅ Connected to WebSocket server');
    
    // Join as a browser client
    ws.send(JSON.stringify({
        type: 'joinSession',
        sessionId: 'demo-session-1',
        clientType: 'browser',
        isHost: true
    }));
    
    // Wait a moment then request AI response
    setTimeout(() => {
        console.log('📤 Requesting AI response...');
        ws.send(JSON.stringify({
            type: 'requestAIResponse',
            source: 'browser',
            data: {
                context: [
                    { role: 'system', content: 'You are a helpful AI cohost in a Twitter Space.' },
                    { role: 'user', content: 'What makes a great podcast conversation?' }
                ],
                sessionId: 'demo-session-1'
            },
            timestamp: new Date().toISOString()
        }));
        
        // Set timeout for response
        setTimeout(() => {
            if (!responseReceived) {
                console.log('❌ Timeout - no AI response received after 5 seconds');
                process.exit(1);
            }
        }, 5000);
    }, 1000);
});

ws.on('message', (data) => {
    try {
        const message = JSON.parse(data.toString());
        console.log(`📥 Received: ${message.type}`);
        
        if (message.type === 'aiResponse' || message.type === 'ai_response') {
            responseReceived = true;
            console.log('\n✅ AI Response received successfully!');
            console.log('Response:', message.data?.response || message.data);
            testPassed = true;
            
            // Close connection and exit
            ws.close();
            console.log('\n✅ Test passed - AI response routing works!');
            process.exit(0);
        }
    } catch (e) {
        console.error('Error parsing message:', e);
    }
});

ws.on('error', (error) => {
    console.error('❌ WebSocket error:', error.message);
    process.exit(1);
});

ws.on('close', () => {
    console.log('Connection closed');
    if (!testPassed) {
        process.exit(1);
    }
});