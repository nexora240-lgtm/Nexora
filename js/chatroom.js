// Wrap in IIFE to prevent redeclaration errors when navigating back
(function() {
    // REPLACE THIS WITH YOUR AWS WEBSOCKET API ENDPOINT
    const WS_URL = 'wss://4bmnyxahxh.execute-api.us-east-2.amazonaws.com/production';

    let ws = null;
    let currentUsername = '';
    let currentRoomCode = '';
    let isRestoringState = false;

    // State preservation
    const CHATROOM_STATE_KEY = 'nexora_chatroom_state';

    // Prevent re-initialization if already loaded
    if (window.NexoraChatroom && window.NexoraChatroom.initialized) {
        console.log('Chatroom already initialized, restoring state...');
        if (window.NexoraChatroom.restoreChatroomState) {
            window.NexoraChatroom.restoreChatroomState();
        }
        return;
    }

// Save state when navigating away
function saveChatroomState() {
    console.log('Saving chatroom state...', 'username:', currentUsername, 'room:', currentRoomCode);
    if (currentRoomCode && currentUsername) {
        const messagesDiv = document.getElementById('messages');
        const chatScreen = document.getElementById('chatScreen');
        const isInChat = chatScreen?.classList.contains('active') || false;
        console.log('Chat screen active:', isInChat);
        const state = {
            username: currentUsername,
            roomCode: currentRoomCode,
            messagesHTML: messagesDiv ? messagesDiv.innerHTML : '',
            scrollPosition: messagesDiv ? messagesDiv.scrollTop : 0,
            isInChat: isInChat,
            timestamp: Date.now()
        };
        sessionStorage.setItem(CHATROOM_STATE_KEY, JSON.stringify(state));
        console.log('State saved:', state);
    } else {
        console.log('No state to save (no username or room code)');
    }
}

// Restore state when returning
function restoreChatroomState() {
    console.log('Attempting to restore chatroom state...');
    try {
        const stateJSON = sessionStorage.getItem(CHATROOM_STATE_KEY);
        console.log('State from storage:', stateJSON);
        if (!stateJSON) {
            console.log('No state found');
            return false;
        }
        
        const state = JSON.parse(stateJSON);
        console.log('Parsed state:', state);
        
        // Check if state is less than 1 hour old
        if (Date.now() - state.timestamp > 3600000) {
            console.log('State expired');
            sessionStorage.removeItem(CHATROOM_STATE_KEY);
            return false;
        }
        
        currentUsername = state.username;
        currentRoomCode = state.roomCode;
        console.log('Restoring username:', currentUsername, 'room:', currentRoomCode);
        
        if (state.isInChat) {
            console.log('State indicates user was in chat, restoring...');
            isRestoringState = true;
            
            // Restore chat screen state
            const messagesDiv = document.getElementById('messages');
            if (messagesDiv) {
                messagesDiv.innerHTML = state.messagesHTML;
                setTimeout(() => {
                    messagesDiv.scrollTop = state.scrollPosition;
                }, 50);
            }
            
            document.getElementById('loginScreen').classList.add('hidden');
            document.getElementById('chatScreen').classList.add('active');
            document.getElementById('headerRoomCode').textContent = `Room Code: ${currentRoomCode}`;
            document.getElementById('largeRoomCode').textContent = currentRoomCode;
            
            // Reconnect WebSocket (isReconnecting = true to avoid calling showChatScreen again)
            connectWebSocket(false, true);
            console.log('State restored successfully');
            
            // Reset flag after a short delay to allow reconnection
            setTimeout(() => {
                isRestoringState = false;
                console.log('Ready to receive new messages');
            }, 500);
            
            return true;
        }
        
        return false;
    } catch (e) {
        console.error('Error restoring chatroom state:', e);
        return false;
    }
}

// Cursor tracking for glass morphism glow effects
const container = document.querySelector('.nexora-chatroom .container');
if (container) {
    container.addEventListener('mousemove', (e) => {
        const rect = container.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * 100;
        const y = ((e.clientY - rect.top) / rect.height) * 100;
        container.style.setProperty('--x', `${x}%`);
        container.style.setProperty('--y', `${y}%`);
    });
}

function generateRoomCode() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

function showChoiceScreen() {
    document.getElementById('choiceScreen').classList.remove('hidden');
    document.getElementById('joinForm').classList.remove('active');
    document.getElementById('createForm').classList.remove('active');
}

function showJoinForm() {
    document.getElementById('choiceScreen').classList.add('hidden');
    document.getElementById('joinForm').classList.add('active');
    document.getElementById('createForm').classList.remove('active');
    // Focus on username input
    setTimeout(() => document.getElementById('joinUsernameInput').focus(), 100);
}

function showCreateForm() {
    document.getElementById('choiceScreen').classList.add('hidden');
    document.getElementById('createForm').classList.add('active');
    document.getElementById('joinForm').classList.remove('active');
    // Focus on username input
    setTimeout(() => document.getElementById('createUsernameInput').focus(), 100);
}

function createRoom() {
    const username = document.getElementById('createUsernameInput').value.trim();
    if (!username) {
        alert('Please enter a username');
        return;
    }
    
    currentUsername = username;
    currentRoomCode = generateRoomCode();
    
    connectWebSocket(true); // Pass true to indicate room creation
}

function joinRoom() {
    const username = document.getElementById('joinUsernameInput').value.trim();
    const roomCode = document.getElementById('roomCodeInput').value.trim().toUpperCase();
    
    if (!username || !roomCode) {
        alert('Please enter both username and room code');
        return;
    }
    
    currentUsername = username;
    currentRoomCode = roomCode;
    
    connectWebSocket();
}

function connectWebSocket(isCreatingRoom = false, isReconnecting = false) {
    // Close existing connection if any, but only if it's actually open or connecting
    if (ws) {
        if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
            ws.close();
        }
        ws = null;
    }
    
    ws = new WebSocket(WS_URL);
    
    ws.onopen = () => {
        console.log('WebSocket connected');
        ws.send(JSON.stringify({
            action: 'joinRoom',
            roomCode: currentRoomCode,
            username: currentUsername
        }));
        
        if (!isReconnecting) {
            showChatScreen();
        }
        
        // Automatically show enlarged room code when creating a new room
        if (isCreatingRoom) {
            setTimeout(() => {
                toggleRoomCodeOverlay();
            }, 300); // Small delay to ensure chat screen is visible first
        }
    };
    
    ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        
        // Don't display messages during state restoration
        if (isRestoringState) {
            console.log('Ignoring message during restoration:', data);
            return;
        }
        
        console.log('Received message:', data);
        
        // Check if message already exists in the DOM to prevent duplicates
        const messagesDiv = document.getElementById('messages');
        if (messagesDiv) {
            const messageText = data.message;
            const existingMessages = Array.from(messagesDiv.querySelectorAll('.message-content'));
            const isDuplicate = existingMessages.some(msg => 
                msg.textContent === messageText && 
                messagesDiv.innerHTML.includes(data.username)
            );
            if (!isDuplicate) {
                displayMessage(data.username, data.message, data.timestamp, false);
            } else {
                console.log('Duplicate message ignored');
            }
        }
    };
    
    ws.onerror = (error) => {
        // Only log and alert for non-reconnecting scenarios
        if (!isReconnecting) {
            console.error('WebSocket error:', error);
            alert('Connection error. Please try again.');
        }
    };
    
    ws.onclose = () => {
        // Only log if not reconnecting to reduce console noise
        if (!isReconnecting) {
            console.log('WebSocket closed');
        }
    };
}

function showChatScreen() {
    document.getElementById('loginScreen').classList.add('hidden');
    document.getElementById('chatScreen').classList.add('active');
    document.getElementById('headerRoomCode').textContent = `Room Code: ${currentRoomCode}`;
    document.getElementById('largeRoomCode').textContent = currentRoomCode;
}

function toggleRoomCodeOverlay() {
    const overlay = document.getElementById('roomCodeOverlay');
    overlay.classList.toggle('active');
}

function sendMessage() {
    const input = document.getElementById('messageInput');
    const message = input.value.trim();
    
    if (!message) return;
    
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
            action: 'sendMessage',
            roomCode: currentRoomCode,
            username: currentUsername,
            message: message
        }));
        
        displayMessage(currentUsername, message, Date.now(), true);
        input.value = '';
    } else {
        alert('Not connected. Please refresh and try again.');
    }
}

function displayMessage(username, message, timestamp, isOwn) {
    const messagesDiv = document.getElementById('messages');
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${isOwn ? 'own' : ''}`;
    
    const time = new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    messageDiv.innerHTML = `
        <div class="message-username">${username}</div>
        <div class="message-content">${escapeHtml(message)}</div>
        <div class="message-time">${time}</div>
    `;
    
    messagesDiv.appendChild(messageDiv);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

function addStatusMessage(text) {
    const messagesDiv = document.getElementById('messages');
    const statusDiv = document.createElement('div');
    statusDiv.className = 'status-message';
    statusDiv.textContent = text;
    messagesDiv.appendChild(statusDiv);
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function handleKeyPress(event) {
    if (event.key === 'Enter') {
        sendMessage();
    }
}

// Cursor tracking for choice buttons
(function() {
    function setupChoiceButtonTracking() {
        const choiceButtons = document.querySelectorAll('.nexora-chatroom .choice-button');
        
        choiceButtons.forEach(button => {
            let rafId = null;

            function updateFromEvent(e) {
                const rect = button.getBoundingClientRect();
                const x = ((e.clientX - rect.left) / rect.width) * 100;
                const y = ((e.clientY - rect.top) / rect.height) * 100;
                
                if (rafId) return;
                rafId = requestAnimationFrame(() => {
                    button.style.setProperty('--x', x + '%');
                    button.style.setProperty('--y', y + '%');
                    rafId = null;
                });
            }

            button.addEventListener('mousemove', updateFromEvent);
            button.addEventListener('mouseleave', () => {
                button.style.setProperty('--x', '50%');
                button.style.setProperty('--y', '50%');
            }, { passive: true });
        });
    }

    // Setup tracking when page loads
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', setupChoiceButtonTracking);
    } else {
        setupChoiceButtonTracking();
    }
})();

    // Expose necessary functions globally
    window.NexoraChatroom = {
        initialized: true,
        saveChatroomState: saveChatroomState,
        restoreChatroomState: restoreChatroomState
    };

    // Make functions globally accessible for compatibility
    window.saveChatroomState = saveChatroomState;
    window.restoreChatroomState = restoreChatroomState;

    // Also expose UI functions that HTML might call
    window.showChoiceScreen = showChoiceScreen;
    window.showJoinForm = showJoinForm;
    window.showCreateForm = showCreateForm;
    window.createRoom = createRoom;
    window.joinRoom = joinRoom;
    window.sendMessage = sendMessage;
    window.handleKeyPress = handleKeyPress;
    window.toggleRoomCodeOverlay = toggleRoomCodeOverlay;

})();
