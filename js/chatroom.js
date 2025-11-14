// Wrap in IIFE to prevent redeclaration errors when navigating back
(function() {
    // REPLACE THIS WITH YOUR AWS WEBSOCKET API ENDPOINT
    const WS_URL = 'wss://4bmnyxahxh.execute-api.us-east-2.amazonaws.com/production';

    let ws = null;
    let currentUsername = '';
    let currentRoomCode = '';
    let isRestoringState = false;
    let roomUsers = []; // Track users in the current room
    let roomValidationTimeout = null; // Track room validation for join attempts
    let roomOwner = ''; // Track who created the room
    let userJoinTimes = {}; // Track when each user joined
    const PUBLIC_ROOM_CODE = 'PUBLIC'; // Special room code for public chat

    // State preservation
    const CHATROOM_STATE_KEY = 'nexora_circle_state';
    const USERNAME_COOKIE_KEY = 'nexora_circle_username';

    // Cookie functions
    function saveUsernameToCookie(username) {
        // Save for session only (no expiry = session cookie)
        document.cookie = `${USERNAME_COOKIE_KEY}=${encodeURIComponent(username)}; path=/; SameSite=Strict`;
    }

    function getUsernameFromCookie() {
        const cookies = document.cookie.split(';');
        for (let cookie of cookies) {
            const [name, value] = cookie.trim().split('=');
            if (name === USERNAME_COOKIE_KEY) {
                return decodeURIComponent(value);
            }
        }
        return '';
    }

    // Load saved username into input fields when page loads
    function loadSavedUsername() {
        const savedUsername = getUsernameFromCookie();
        if (savedUsername) {
            const joinInput = document.getElementById('joinUsernameInput');
            const createInput = document.getElementById('createUsernameInput');
            const publicInput = document.getElementById('publicUsernameInput');
            if (joinInput) joinInput.value = savedUsername;
            if (createInput) createInput.value = savedUsername;
            if (publicInput) publicInput.value = savedUsername;
        }
    }

    // Prevent re-initialization if already loaded
    if (window.NexoraCircle && window.NexoraCircle.initialized) {
        console.log('Circle already initialized, restoring state...');
        if (window.NexoraCircle.restoreChatroomState) {
            window.NexoraCircle.restoreChatroomState();
        }
        return;
    }

// Save state when navigating away
function saveChatroomState() {
    console.log('Saving Circle state...', 'username:', currentUsername, 'room:', currentRoomCode);
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
            roomUsers: roomUsers,
            roomOwner: roomOwner,
            userJoinTimes: userJoinTimes,
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
    console.log('Attempting to restore Circle state...');
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
        
        // Restore room state
        if (state.roomUsers) {
            roomUsers = state.roomUsers;
            console.log('Restored roomUsers:', roomUsers);
        }
        if (state.roomOwner) {
            roomOwner = state.roomOwner;
            console.log('Restored roomOwner:', roomOwner);
        }
        if (state.userJoinTimes) {
            userJoinTimes = state.userJoinTimes;
            console.log('Restored userJoinTimes:', userJoinTimes);
        }
        
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
            
            // Update users list with restored data
            updateUsersList();
            
            // Reconnect WebSocket (isReconnecting = true to avoid calling showChatScreen again)
            connectWebSocket(false, true);
            console.log('Circle state restored successfully');
            
            // Reset flag after a short delay to allow reconnection
            setTimeout(() => {
                isRestoringState = false;
                console.log('Ready to receive new messages');
            }, 500);
            
            return true;
        }
        
        return false;
    } catch (e) {
        console.error('Error restoring Circle state:', e);
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
    const publicForm = document.getElementById('publicForm');
    if (publicForm) publicForm.classList.remove('active');
}

function showJoinForm() {
    document.getElementById('choiceScreen').classList.add('hidden');
    document.getElementById('joinForm').classList.add('active');
    document.getElementById('createForm').classList.remove('active');
    const publicForm = document.getElementById('publicForm');
    if (publicForm) publicForm.classList.remove('active');
    // Load saved username
    loadSavedUsername();
    // Focus on username input
    setTimeout(() => document.getElementById('joinUsernameInput').focus(), 100);
}

function showCreateForm() {
    document.getElementById('choiceScreen').classList.add('hidden');
    document.getElementById('createForm').classList.add('active');
    document.getElementById('joinForm').classList.remove('active');
    const publicForm = document.getElementById('publicForm');
    if (publicForm) publicForm.classList.remove('active');
    // Load saved username
    loadSavedUsername();
    // Focus on username input
    setTimeout(() => document.getElementById('createUsernameInput').focus(), 100);
}

function joinPublicChat() {
    document.getElementById('choiceScreen').classList.add('hidden');
    document.getElementById('joinForm').classList.remove('active');
    document.getElementById('createForm').classList.remove('active');
    const publicForm = document.getElementById('publicForm');
    if (publicForm) {
        publicForm.classList.add('active');
        // Load saved username
        loadSavedUsername();
        // Focus on username input
        setTimeout(() => {
            const publicInput = document.getElementById('publicUsernameInput');
            if (publicInput) publicInput.focus();
        }, 100);
    }
}

// Disambiguate username if it already exists in the room
function getUniqueUsername(baseUsername, existingUsers) {
    let username = baseUsername;
    let counter = 1;
    
    // Check if base username exists
    while (existingUsers.includes(username)) {
        username = `${baseUsername}-${counter}`;
        counter++;
    }
    
    return username;
}

function joinPublicChatWithUsername() {
    const username = document.getElementById('publicUsernameInput').value.trim();
    if (!username) {
        alert('Please enter a username');
        return;
    }
    
    currentUsername = username;
    currentRoomCode = PUBLIC_ROOM_CODE;
    saveUsernameToCookie(username);
    
    connectWebSocket();
}

function createRoom() {
    const username = document.getElementById('createUsernameInput').value.trim();
    if (!username) {
        alert('Please enter a username');
        return;
    }
    
    // For room creation, use base username (they're first)
    currentUsername = username;
    currentRoomCode = generateRoomCode();
    roomOwner = username; // Set the creator as the owner
    
    // Store owner in session storage so others can see it
    sessionStorage.setItem(`circle_owner_${currentRoomCode}`, username);
    
    saveUsernameToCookie(username);
    
    connectWebSocket(true); // Pass true to indicate room creation
}

function joinRoom() {
    const username = document.getElementById('joinUsernameInput').value.trim();
    const roomCode = document.getElementById('roomCodeInput').value.trim().toUpperCase();
    
    if (!username || !roomCode) {
        alert('Please enter both username and circle code');
        return;
    }
    
    // Store base username, will disambiguate after getting user list
    currentUsername = username;
    currentRoomCode = roomCode;
    saveUsernameToCookie(username);
    
    connectWebSocket(false, false, true); // Pass true for isJoining to validate room exists
}

function connectWebSocket(isCreatingRoom = false, isReconnecting = false, isJoining = false) {
    // Close existing connection if any, but only if it's actually open or connecting
    if (ws) {
        if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
            ws.close();
        }
        ws = null;
    }
    
    ws = new WebSocket(WS_URL);
    
    ws.onopen = () => {
        console.log('✅ WebSocket connected');
        
        // IMMEDIATELY add self to users list with join time (only if not already there from restoration)
        if (!roomUsers.includes(currentUsername)) {
            roomUsers = [currentUsername];
            userJoinTimes[currentUsername] = Date.now();
            console.log('✅ Set roomUsers to:', roomUsers);
            console.log('✅ Recorded join time:', userJoinTimes);
        } else {
            console.log('✅ Using restored roomUsers:', roomUsers);
            console.log('✅ Using restored join times:', userJoinTimes);
        }
        
        ws.send(JSON.stringify({
            action: 'joinRoom',
            roomCode: currentRoomCode,
            username: currentUsername
        }));
        console.log('✅ Sent joinRoom message');
        
        // If joining an existing room, validate that someone responds
        if (isJoining && !isCreatingRoom) {
            console.log('🔍 Validating room exists...');
            roomValidationTimeout = setTimeout(() => {
                // If still only one user (me) after timeout, room doesn't exist
                if (roomUsers.length === 1 && roomUsers[0] === currentUsername) {
                    console.log('❌ Room validation failed - no other users');
                    alert(`Circle code "${currentRoomCode}" does not exist. Please check the code and try again.`);
                    if (ws) {
                        ws.close();
                    }
                    leaveChat();
                }
            }, 3500); // Increased to 3.5 seconds to allow for presence responses
        }
        
        // Send presence announcement immediately
        setTimeout(() => {
            if (ws && ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({
                    action: 'sendMessage',
                    roomCode: currentRoomCode,
                    username: currentUsername,
                    message: `::PRESENCE::${roomOwner || ''}::${userJoinTimes[currentUsername]}`
                }));
                console.log('✅ Sent presence announcement with owner info:', roomOwner);
            }
        }, 300);
        
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
        console.log('Message type:', data.type);
        console.log('Current roomUsers:', roomUsers);
        
        // Handle regular messages
        if (data.message) {
            const username = data.username;
            const messageText = data.message;
            
            // Handle presence announcement
            if (messageText.startsWith('::PRESENCE::')) {
                const parts = messageText.split('::');
                const ownerInfo = parts[2] || '';
                const joinTime = parseInt(parts[3]) || Date.now();
                
                console.log('👤 Received presence from:', username, 'owner info:', ownerInfo, 'join time:', joinTime);
                
                // Clear room validation timeout - room exists!
                if (roomValidationTimeout) {
                    clearTimeout(roomValidationTimeout);
                    roomValidationTimeout = null;
                    console.log('✅ Room validated - other users found');
                }
                
                // Store owner if provided
                if (ownerInfo && !roomOwner) {
                    roomOwner = ownerInfo;
                    console.log('📌 Set room owner to:', roomOwner);
                }
                
                if (!roomUsers.includes(username)) {
                    roomUsers.push(username);
                    userJoinTimes[username] = joinTime;
                    console.log('✅ Added user. New roomUsers:', roomUsers);
                    console.log('✅ Join times:', userJoinTimes);
                    updateUsersList();
                    
                    // If it's not me, show join message and send my presence back
                    if (username !== currentUsername) {
                        addSystemMessage(`${username} joined the chat`);
                        
                        // Send my presence back
                        setTimeout(() => {
                            if (ws && ws.readyState === WebSocket.OPEN) {
                                ws.send(JSON.stringify({
                                    action: 'sendMessage',
                                    roomCode: currentRoomCode,
                                    username: currentUsername,
                                    message: `::PRESENCE::${roomOwner || ''}::${userJoinTimes[currentUsername]}`
                                }));
                                console.log('✅ Sent presence back to', username);
                            }
                        }, 200);
                    }
                }
                return; // Don't display this message
            }
            
            // Handle leave announcement
            if (messageText === '::LEAVE::') {
                console.log('👋 User leaving:', username);
                if (roomUsers.includes(username)) {
                    // Check if owner is leaving
                    const ownerLeaving = (username === roomOwner);
                    
                    roomUsers = roomUsers.filter(u => u !== username);
                    delete userJoinTimes[username];
                    
                    // If owner left and there are other users, transfer ownership
                    if (ownerLeaving && roomUsers.length > 0) {
                        // Find user who joined earliest (oldest member)
                        const oldestUser = roomUsers.reduce((oldest, user) => {
                            return (userJoinTimes[user] || Infinity) < (userJoinTimes[oldest] || Infinity) ? user : oldest;
                        });
                        
                        const oldOwner = roomOwner;
                        roomOwner = oldestUser;
                        console.log('👑 Ownership transferred from', oldOwner, 'to', oldestUser);
                        
                        // Update sessionStorage with new owner
                        sessionStorage.setItem(`circle_owner_${currentRoomCode}`, oldestUser);
                        
                        // Notify everyone about ownership transfer
                        if (ws && ws.readyState === WebSocket.OPEN) {
                            ws.send(JSON.stringify({
                                action: 'sendMessage',
                                roomCode: currentRoomCode,
                                username: currentUsername,
                                message: `::OWNER_CHANGE::${oldestUser}`
                            }));
                        }
                        
                        if (oldestUser === currentUsername) {
                            addSystemMessage('You are now the circle owner!');
                        } else {
                            addSystemMessage(`${oldestUser} is now the circle owner`);
                        }
                    }
                    
                    updateUsersList();
                    if (username !== currentUsername) {
                        addSystemMessage(`${username} left the chat`);
                    }
                }
                return; // Don't display this message
            }
            
            // Handle kick notification
            if (messageText.startsWith('::KICK::')) {
                const kickedUsername = messageText.split('::KICK::')[1];
                console.log('⚠️ Kick notification for:', kickedUsername);
                if (kickedUsername === currentUsername) {
                    alert('You have been kicked from the circle.');
                    leaveChat();
                    return;
                }
                if (roomUsers.includes(kickedUsername)) {
                    roomUsers = roomUsers.filter(u => u !== kickedUsername);
                    delete userJoinTimes[kickedUsername];
                    updateUsersList();
                    addSystemMessage(`${kickedUsername} was kicked from the chat`);
                }
                return; // Don't display this message
            }
            
            // Handle owner change notification
            if (messageText.startsWith('::OWNER_CHANGE::')) {
                const newOwner = messageText.split('::OWNER_CHANGE::')[1];
                console.log('👑 Owner change notification - new owner:', newOwner);
                roomOwner = newOwner;
                
                // Update sessionStorage with new owner
                sessionStorage.setItem(`circle_owner_${currentRoomCode}`, newOwner);
                
                updateUsersList();
                return; // Don't display this message
            }
            
            // Regular message - display it
            console.log('💬 Regular message from', username);
            displayMessage(username, messageText, data.timestamp, username === currentUsername);
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

// Send leave message when user closes tab/browser
window.addEventListener('beforeunload', () => {
    if (ws && ws.readyState === WebSocket.OPEN && currentRoomCode && currentUsername) {
        // Send leave notification synchronously
        ws.send(JSON.stringify({
            action: 'sendMessage',
            roomCode: currentRoomCode,
            username: currentUsername,
            message: '::LEAVE::'
        }));
        console.log('📤 Sent leave message on page unload');
    }
});

function leaveChat() {
    // Send leave notification
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
            action: 'sendMessage',
            roomCode: currentRoomCode,
            username: currentUsername,
            message: '::LEAVE::'
        }));
    }
    
    // Close WebSocket connection
    if (ws) {
        ws.close();
        ws = null;
    }
    
    // Reset state
    roomUsers = [];
    
    // Hide room code
    const roomCodeElement = document.getElementById('headerRoomCode');
    if (roomCodeElement) {
        roomCodeElement.textContent = '';
        roomCodeElement.style.display = 'none';
    }
    
    // Return to login screen
    document.getElementById('chatScreen').classList.remove('active');
    document.getElementById('loginScreen').classList.remove('hidden');
    
    // Hide external sidebar
    const sidebar = document.getElementById('usersSidebar');
    if (sidebar) {
        // CSS handles visibility now
    }
    
    showChoiceScreen();
}

function showChatScreen() {
    document.getElementById('loginScreen').classList.add('hidden');
    document.getElementById('chatScreen').classList.add('active');
    
    // FORCE show the sidebar (CSS handles this now)
    const sidebar = document.getElementById('usersSidebar');
    if (sidebar) {
        console.log('✅ SIDEBAR SHOULD BE VISIBLE VIA CSS');
    } else {
        console.error('❌ SIDEBAR ELEMENT NOT FOUND');
    }
    
    // FORCE update the user list
    console.log('🔄 Forcing user list update with:', roomUsers);
    updateUsersList();
    
    const roomCodeElement = document.getElementById('headerRoomCode');
    
    // Update header differently for public chat
    if (currentRoomCode === PUBLIC_ROOM_CODE) {
        roomCodeElement.textContent = '';  // Hide room code for public chat
        roomCodeElement.style.display = 'none';
        document.getElementById('largeRoomCode').textContent = 'PUBLIC CIRCLE';
    } else {
        roomCodeElement.textContent = `Circle Code: ${currentRoomCode}`;
        roomCodeElement.style.display = 'inline-block';
        document.getElementById('largeRoomCode').textContent = currentRoomCode;
    }
    
    // Initialize user list with current user
    if (!roomUsers.includes(currentUsername)) {
        roomUsers.push(currentUsername);
    }
    updateUsersList();
    
    // Try to request user list from server (if supported)
    setTimeout(() => {
        if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({
                action: 'requestUserList',
                roomCode: currentRoomCode
            }));
        }
    }, 500);
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
        
        // Ensure current user is in the list
        if (!roomUsers.includes(currentUsername)) {
            roomUsers.push(currentUsername);
            updateUsersList();
        }
        
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

function addSystemMessage(text) {
    const messagesDiv = document.getElementById('messages');
    const systemDiv = document.createElement('div');
    systemDiv.className = 'system-message';
    systemDiv.innerHTML = `<span class="system-icon">ℹ️</span> ${escapeHtml(text)}`;
    messagesDiv.appendChild(systemDiv);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

function updateUsersList() {
    const usersList = document.getElementById('usersList');
    const userCount = document.getElementById('userCount');
    
    console.log('=== UPDATE USERS LIST ===');
    console.log('usersList element:', usersList);
    console.log('userCount element:', userCount);
    console.log('roomUsers:', roomUsers);
    console.log('currentUsername:', currentUsername);
    console.log('roomOwner:', roomOwner);
    
    if (!usersList || !userCount) {
        console.error('User list elements not found in DOM!');
        return;
    }
    
    console.log('Updating user list:', roomUsers);
    userCount.textContent = roomUsers.length;
    
    // DON'T clear the list - just check what's there
    console.log('Current usersList.children.length BEFORE clear:', usersList.children.length);
    console.log('Current usersList.innerHTML BEFORE clear:', usersList.innerHTML);
    
    usersList.innerHTML = '';
    
    console.log('Cleared list. Now adding', roomUsers.length, 'users');
    
    const isPublicChat = currentRoomCode === PUBLIC_ROOM_CODE;
    
    console.log('About to loop through', roomUsers.length, 'users');
    
    roomUsers.forEach((user, index) => {
        console.log(`Creating user item ${index + 1}:`, user);
        const userDiv = document.createElement('div');
        userDiv.className = 'user-item';
        
        const usernameSpan = document.createElement('span');
        usernameSpan.className = 'user-name';
        usernameSpan.textContent = user;
        
        console.log('Created span with text:', usernameSpan.textContent);
        
        // Add owner class for room owner (star icon via CSS)
        if (user === roomOwner && roomOwner) {
            usernameSpan.classList.add('owner');
            userDiv.classList.add('owner');
            console.log('Added owner class');
        }
        
        // Add "You" indicator for current user
        if (user === currentUsername) {
            usernameSpan.textContent += ' (You)';
            usernameSpan.classList.add('current-user');
            userDiv.classList.add('current-user');
            console.log('Added current-user class and (You) text');
        }
        
        userDiv.appendChild(usernameSpan);
        console.log('Appended span to userDiv');
        
        // Add kick button only if:
        // 1. Not yourself
        // 2. Not public chat
        // 3. Current user is the owner
        // 4. Target user is not the owner
        const canKick = user !== currentUsername && 
                        !isPublicChat && 
                        currentUsername === roomOwner && 
                        user !== roomOwner;
        
        if (canKick) {
            const kickBtn = document.createElement('button');
            kickBtn.className = 'kick-button';
            kickBtn.textContent = 'Kick';
            kickBtn.onclick = () => kickUser(user);
            userDiv.appendChild(kickBtn);
            console.log('Added kick button');
        }
        
        usersList.appendChild(userDiv);
        console.log('✅ Appended user item to list');
        console.log('userDiv HTML:', userDiv.outerHTML);
        console.log('usersList now has', usersList.children.length, 'children');
    });
    
    console.log('✅ Finished updating user list. Total items:', usersList.children.length);
    console.log('Final usersList.innerHTML:', usersList.innerHTML);
}

function kickUser(username) {
    // Double-check permissions
    if (currentUsername !== roomOwner) {
        alert('Only the circle owner can kick users.');
        return;
    }
    
    if (username === roomOwner) {
        alert('Cannot kick the circle owner.');
        return;
    }
    
    if (!confirm(`Are you sure you want to kick ${username}?`)) {
        return;
    }
    
    if (ws && ws.readyState === WebSocket.OPEN) {
        // Send kick notification as a message
        ws.send(JSON.stringify({
            action: 'sendMessage',
            roomCode: currentRoomCode,
            username: currentUsername,
            message: `::KICK::${username}`
        }));
        
        // Immediately remove from local list
        roomUsers = roomUsers.filter(u => u !== username);
        updateUsersList();
        addSystemMessage(`${username} was kicked from the chat`);
        
        // Also send server kick if supported
        ws.send(JSON.stringify({
            action: 'kickUser',
            roomCode: currentRoomCode,
            kickedUsername: username,
            kickerUsername: currentUsername
        }));
    } else {
        alert('Not connected. Cannot kick user.');
    }
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
    window.NexoraCircle = {
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
    window.joinPublicChat = joinPublicChat;
    window.joinPublicChatWithUsername = joinPublicChatWithUsername;
    window.sendMessage = sendMessage;
    window.handleKeyPress = handleKeyPress;
    window.toggleRoomCodeOverlay = toggleRoomCodeOverlay;
    window.kickUser = kickUser;
    window.leaveChat = leaveChat;
    
    // Load saved username when chatroom initializes
    setTimeout(loadSavedUsername, 100);

})();
