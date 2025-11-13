// REPLACE THIS WITH YOUR AWS WEBSOCKET API ENDPOINT
const WS_URL = 'wss://4bmnyxahxh.execute-api.us-east-2.amazonaws.com/production';

let ws = null;
let currentUsername = '';
let currentRoomCode = '';

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

function connectWebSocket(isCreatingRoom = false) {
    ws = new WebSocket(WS_URL);
    
    ws.onopen = () => {
        ws.send(JSON.stringify({
            action: 'joinRoom',
            roomCode: currentRoomCode,
            username: currentUsername
        }));
        
        showChatScreen();
        
        // Automatically show enlarged room code when creating a new room
        if (isCreatingRoom) {
            setTimeout(() => {
                toggleRoomCodeOverlay();
            }, 300); // Small delay to ensure chat screen is visible first
        }
    };
    
    ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        displayMessage(data.username, data.message, data.timestamp, false);
    };
    
    ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        alert('Connection error. Please try again.');
    };
    
    ws.onclose = () => {
        console.log('WebSocket closed');
        alert('Connection closed. Please refresh and try again.');
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
