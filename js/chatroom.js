
(function() {

    const WS_URL = 'wss://4bmnyxahxh.execute-api.us-east-2.amazonaws.com/production';

    let ws = null;
    let currentUsername = '';
    let currentRoomCode = '';
    let isRestoringState = false;
    let roomUsers = []; // Track users in the current room
    let pendingUsers = []; // Track users waiting for approval
    let approvalTimers = {}; // Track auto-kick timers for pending users
    let roomValidationTimeout = null; // Track room validation for join attempts
    let roomOwner = ''; // Track who created the room
    let userJoinTimes = {}; // Track when each user joined
    let isPendingApproval = false; // Track if current user is waiting for approval
    let myConnectionId = null; // Store our WebSocket connection ID
    let presenceAnnouncedTo = new Set(); // Track users we've already announced presence to
    const PUBLIC_ROOM_CODE = 'PUBLIC'; // Special room code for public chat
    const APPROVAL_TIMEOUT = 60000; // 60 seconds for host to respond

    const CHATROOM_STATE_KEY = 'nexora_circle_state';
    const USERNAME_COOKIE_KEY = 'nexora_circle_username';

    function saveUsernameToCookie(username) {

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

    if (window.NexoraCircle && window.NexoraCircle.initialized) {
                if (window.NexoraCircle.restoreChatroomState) {
            window.NexoraCircle.restoreChatroomState();
        }
        return;
    }

function saveChatroomState() {
        if (currentRoomCode && currentUsername) {
        const messagesDiv = document.getElementById('messages');
        const chatScreen = document.getElementById('chatScreen');
        const isInChat = chatScreen?.classList.contains('active') || false;
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
    }
}

function restoreChatroomState() {
        try {
        const stateJSON = sessionStorage.getItem(CHATROOM_STATE_KEY);
                if (!stateJSON) {
                        return false;
        }
        
        const state = JSON.parse(stateJSON);
                if (Date.now() - state.timestamp > 3600000) {
                        sessionStorage.removeItem(CHATROOM_STATE_KEY);
            return false;
        }
        
        currentUsername = state.username;
        currentRoomCode = state.roomCode;
                if (state.roomUsers) {
            roomUsers = state.roomUsers;
                    }
        if (state.roomOwner) {
            roomOwner = state.roomOwner;
                    }
        if (state.userJoinTimes) {
            userJoinTimes = state.userJoinTimes;
                    }
        
        if (state.isInChat) {
                        isRestoringState = true;

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

            setTimeout(() => {
                const messageInput = document.getElementById('messageInput');
                if (messageInput) {
                    messageInput.value = '';
                }
            }, 100);

            updateUsersList();

            connectWebSocket(false, true);
                        setTimeout(() => {
                isRestoringState = false;
                            }, 500);
            
            return true;
        }
        
        return false;
    } catch (e) {
                return false;
    }
}

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

    const messageInput = document.getElementById('messageInput');
    if (messageInput) {
        messageInput.value = '';
    }
    
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

    loadSavedUsername();

    setTimeout(() => document.getElementById('joinUsernameInput').focus(), 100);
}

function showCreateForm() {
    document.getElementById('choiceScreen').classList.add('hidden');
    document.getElementById('createForm').classList.add('active');
    document.getElementById('joinForm').classList.remove('active');
    const publicForm = document.getElementById('publicForm');
    if (publicForm) publicForm.classList.remove('active');

    loadSavedUsername();

    setTimeout(() => document.getElementById('createUsernameInput').focus(), 100);
}

function joinPublicChat() {
    document.getElementById('choiceScreen').classList.add('hidden');
    document.getElementById('joinForm').classList.remove('active');
    document.getElementById('createForm').classList.remove('active');
    const publicForm = document.getElementById('publicForm');
    if (publicForm) {
        publicForm.classList.add('active');

        loadSavedUsername();

        setTimeout(() => {
            const publicInput = document.getElementById('publicUsernameInput');
            if (publicInput) publicInput.focus();
        }, 100);
    }
}

function getUniqueUsername(baseUsername, existingUsers) {
    let username = baseUsername;
    let counter = 1;

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

    currentUsername = username;
    currentRoomCode = generateRoomCode();
    roomOwner = username; // Set the creator as the owner

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

    currentUsername = username;
    currentRoomCode = roomCode;
    saveUsernameToCookie(username);
    
    connectWebSocket(false, false, true); // Pass true for isJoining to validate room exists
}

function connectWebSocket(isCreatingRoom = false, isReconnecting = false, isJoining = false) {

    if (ws) {
        if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
            ws.close();
        }
        ws = null;
    }
    
    ws = new WebSocket(WS_URL);
    
    ws.onopen = () => {
                const joinStatus = (isJoining && currentRoomCode !== PUBLIC_ROOM_CODE) ? 'PENDING' : 'ACTIVE';
        
        ws.send(JSON.stringify({
            action: 'joinRoom',
            roomCode: currentRoomCode,
            username: currentUsername,
            status: joinStatus
        }));
                if (isJoining && currentRoomCode !== PUBLIC_ROOM_CODE) {
                        setTimeout(() => {
                ws.send(JSON.stringify({
                    action: 'sendMessage',
                    roomCode: currentRoomCode,
                    username: currentUsername,
                    message: `::JOIN_REQUEST::${currentUsername}`
                }));

                showWaitingScreen();
            }, 200);
            
            return; // Don't proceed with normal join flow yet
        }

        if (!roomUsers.includes(currentUsername)) {
            roomUsers = [currentUsername];
            userJoinTimes[currentUsername] = Date.now();
                                } else {
                                }

        if (isJoining && !isCreatingRoom) {
                        roomValidationTimeout = setTimeout(() => {

                if (roomUsers.length === 1 && roomUsers[0] === currentUsername) {
                                        alert(`Circle code "${currentRoomCode}" does not exist. Please check the code and try again.`);
                    if (ws) {
                        ws.close();
                    }
                    leaveChat();
                }
            }, 3500); // Increased to 3.5 seconds to allow for presence responses
        }

        setTimeout(() => {
            if (ws && ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({
                    action: 'sendMessage',
                    roomCode: currentRoomCode,
                    username: currentUsername,
                    message: `::PRESENCE::${roomOwner || ''}::${userJoinTimes[currentUsername]}`
                }));
                            }
        }, 300);
        
        if (!isReconnecting) {
            showChatScreen();
        }

        if (isCreatingRoom) {
            setTimeout(() => {
                toggleRoomCodeOverlay();
            }, 300); // Small delay to ensure chat screen is visible first
        }
    };
    
    ws.onmessage = (event) => {
        const data = JSON.parse(event.data);

        if (isRestoringState) {
                        return;
        }
        
                                if (data.type === 'error') {
            if (data.error === 'USERNAME_CONFLICT') {
                                const conflictingUsername = currentUsername;
                const conflictingRoomCode = currentRoomCode;
                
                alert(data.message);

                if (ws) {
                    ws.close();
                    ws = null;
                }

                if (conflictingRoomCode === PUBLIC_ROOM_CODE) {

                    document.getElementById('chatScreen').classList.remove('active');
                    document.getElementById('loginScreen').classList.remove('hidden');
                    hideWaitingScreen(); // Hide waiting screen if shown
                    joinPublicChat();

                    setTimeout(() => {
                        const input = document.getElementById('publicUsernameInput');
                        if (input) {
                            input.value = conflictingUsername + Math.floor(Math.random() * 100);
                            input.select();
                            input.focus();
                        }
                    }, 100);
                } else if (conflictingRoomCode) {

                    document.getElementById('chatScreen').classList.remove('active');
                    document.getElementById('loginScreen').classList.remove('hidden');
                    hideWaitingScreen(); // Hide waiting screen if shown
                    showJoinForm();

                    setTimeout(() => {
                        const roomInput = document.getElementById('roomCodeInput');
                        const usernameInput = document.getElementById('joinUsernameInput');
                        if (roomInput) roomInput.value = conflictingRoomCode;
                        if (usernameInput) {
                            usernameInput.value = conflictingUsername + Math.floor(Math.random() * 100);
                            usernameInput.select();
                            usernameInput.focus();
                        }
                    }, 100);
                }

                roomUsers = [];
                currentUsername = '';
                currentRoomCode = '';
                roomOwner = '';
                userJoinTimes = {};
                presenceAnnouncedTo.clear();
                
                return;
            }
                        return;
        }

        if (data.message) {
            const username = data.username;
            const messageText = data.message;

            if (messageText.startsWith('::JOIN_REQUEST::')) {
                const requester = messageText.split('::JOIN_REQUEST::')[1];
                                if (currentUsername === roomOwner) {
                    showApprovalModal(requester);
                }
                return;
            }

            if (messageText.startsWith('::APPROVED::')) {
                const parts = messageText.split('::');
                const approvedUser = parts[2];
                const owner = parts[3] || '';
                                
                if (currentUsername === approvedUser) {

                    hideWaitingScreen();
                    isPendingApproval = false;

                    if (owner) {
                        roomOwner = owner;
                    }

                    ws.send(JSON.stringify({
                        action: 'updateStatus',
                        roomCode: currentRoomCode,
                        username: currentUsername,
                        status: 'ACTIVE'
                    }));

                    if (!roomUsers.includes(currentUsername)) {
                        roomUsers = [currentUsername];
                        userJoinTimes[currentUsername] = Date.now();
                    }

                    setTimeout(() => {
                        if (ws && ws.readyState === WebSocket.OPEN) {
                            ws.send(JSON.stringify({
                                action: 'sendMessage',
                                roomCode: currentRoomCode,
                                username: currentUsername,
                                message: `::PRESENCE::${roomOwner}::${userJoinTimes[currentUsername]}`
                            }));
                        }
                    }, 300);
                    
                    showChatScreen();
                }
                return;
            }

            if (messageText.startsWith('::DENIED::')) {
                const deniedUser = messageText.split('::DENIED::')[1];
                                
                if (currentUsername === deniedUser) {
                    hideWaitingScreen();
                    alert('Your request to join was declined by the host.');
                    if (ws) {
                        ws.close();
                    }
                    showChoiceScreen();
                    document.getElementById('loginScreen').classList.remove('hidden');
                    document.getElementById('chatScreen').classList.remove('active');
                }
                return;
            }

            if (messageText.startsWith('::PRESENCE::')) {
                const parts = messageText.split('::');
                const ownerInfo = parts[2] || '';
                const joinTime = parseInt(parts[3]) || Date.now();
                
                                                if (roomValidationTimeout) {
                    clearTimeout(roomValidationTimeout);
                    roomValidationTimeout = null;
                                    }


                if (ownerInfo) {
                    if (!roomOwner || roomOwner !== ownerInfo) {
                        roomOwner = ownerInfo;
                                            }
                }

                const isNewUser = !roomUsers.includes(username);

                if (isNewUser) {
                    roomUsers.push(username);
                    userJoinTimes[username] = joinTime;
                                                            updateUsersList();

                    if (username !== currentUsername) {


                        const isExistingOwner = (username === ownerInfo && ownerInfo);
                        if (!isExistingOwner) {
                            addSystemMessage(`${username} joined the chat`);
                        }
                    }
                } else {

                                        updateUsersList();
                }


                if (username !== currentUsername && !presenceAnnouncedTo.has(username)) {
                    presenceAnnouncedTo.add(username);
                    setTimeout(() => {
                        if (ws && ws.readyState === WebSocket.OPEN) {
                            ws.send(JSON.stringify({
                                action: 'sendMessage',
                                roomCode: currentRoomCode,
                                username: currentUsername,
                                message: `::PRESENCE::${roomOwner || ''}::${userJoinTimes[currentUsername]}`
                            }));
                        }
                    }, 200);
                }
                
                return; // Don't display this message
            }

            if (messageText === '::LEAVE::') {
                                if (roomUsers.includes(username)) {

                    const ownerLeaving = (username === roomOwner);
                    
                    roomUsers = roomUsers.filter(u => u !== username);
                    delete userJoinTimes[username];

                    if (ownerLeaving && roomUsers.length > 0) {

                        const oldestUser = roomUsers.reduce((oldest, user) => {
                            return (userJoinTimes[user] || Infinity) < (userJoinTimes[oldest] || Infinity) ? user : oldest;
                        });
                        
                        const oldOwner = roomOwner;
                        roomOwner = oldestUser;
                                                sessionStorage.setItem(`circle_owner_${currentRoomCode}`, oldestUser);

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

            if (messageText.startsWith('::KICK::')) {
                const kickedUsername = messageText.split('::KICK::')[1];
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

            if (messageText.startsWith('::OWNER_CHANGE::')) {
                const newOwner = messageText.split('::OWNER_CHANGE::')[1];
                                roomOwner = newOwner;

                sessionStorage.setItem(`circle_owner_${currentRoomCode}`, newOwner);
                
                updateUsersList();
                return; // Don't display this message
            }

                        displayMessage(username, messageText, data.timestamp, username === currentUsername);
        }
    };
    
    ws.onerror = (error) => {

        if (!isReconnecting) {
                        alert('Connection error. Please try again.');
        }
    };
    
    ws.onclose = () => {

        if (!isReconnecting) {
                    }
    };
}

window.addEventListener('beforeunload', () => {
    if (ws && ws.readyState === WebSocket.OPEN && currentRoomCode && currentUsername) {

        ws.send(JSON.stringify({
            action: 'sendMessage',
            roomCode: currentRoomCode,
            username: currentUsername,
            message: '::LEAVE::'
        }));
            }
});

function leaveChat() {

    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
            action: 'sendMessage',
            roomCode: currentRoomCode,
            username: currentUsername,
            message: '::LEAVE::'
        }));
    }

    if (ws) {
        ws.close();
        ws = null;
    }

    roomUsers = [];
    currentUsername = '';
    currentRoomCode = '';
    roomOwner = '';
    userJoinTimes = {};
    presenceAnnouncedTo.clear(); // Clear presence tracking

    sessionStorage.removeItem(CHATROOM_STATE_KEY);

    const messagesDiv = document.getElementById('messages');
    if (messagesDiv) {
        messagesDiv.innerHTML = '';
    }

    const messageInput = document.getElementById('messageInput');
    if (messageInput) {
        messageInput.value = '';
    }

    const roomCodeElement = document.getElementById('headerRoomCode');
    if (roomCodeElement) {
        roomCodeElement.textContent = '';
        roomCodeElement.style.display = 'none';
    }

    document.getElementById('chatScreen').classList.remove('active');
    document.getElementById('loginScreen').classList.remove('hidden');

    const sidebar = document.getElementById('usersSidebar');
    if (sidebar) {

    }
    
    showChoiceScreen();
}

function showChatScreen() {
    document.getElementById('loginScreen').classList.add('hidden');
    document.getElementById('chatScreen').classList.add('active');

    if (!isRestoringState) {
        const messagesDiv = document.getElementById('messages');
        if (messagesDiv) {
            messagesDiv.innerHTML = '';
        }
    }

    const messageInput = document.getElementById('messageInput');
    if (messageInput) {
        messageInput.value = '';
    }

    const sidebar = document.getElementById('usersSidebar');
    if (sidebar) {
    }

    updateUsersList();
    
    const roomCodeElement = document.getElementById('headerRoomCode');

    if (currentRoomCode === PUBLIC_ROOM_CODE) {
        roomCodeElement.textContent = '';  // Hide room code for public chat
        roomCodeElement.style.display = 'none';
        document.getElementById('largeRoomCode').textContent = 'PUBLIC CIRCLE';
    } else {
        roomCodeElement.textContent = `Circle Code: ${currentRoomCode}`;
        roomCodeElement.style.display = 'inline-block';
        document.getElementById('largeRoomCode').textContent = currentRoomCode;
    }

    if (!roomUsers.includes(currentUsername)) {
        roomUsers.push(currentUsername);
    }
    updateUsersList();

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

        if (!roomUsers.includes(currentUsername)) {
            roomUsers.push(currentUsername);
            updateUsersList();
        }
        
        // Remove local display - message will be displayed when server echoes it back
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
    
                            
    if (!usersList || !userCount) {
                return;
    }
    
        userCount.textContent = roomUsers.length;

            
    usersList.innerHTML = '';
    
        
    const isPublicChat = currentRoomCode === PUBLIC_ROOM_CODE;
    
        
    roomUsers.forEach((user, index) => {
                const userDiv = document.createElement('div');
        userDiv.className = 'user-item';
        
        const usernameSpan = document.createElement('span');
        usernameSpan.className = 'user-name';
        usernameSpan.textContent = user;
        
                if (user === roomOwner && roomOwner) {
            usernameSpan.classList.add('owner');
            userDiv.classList.add('owner');
                    } else {
                    }

        if (user === currentUsername) {
            usernameSpan.textContent += ' (You)';
            usernameSpan.classList.add('current-user');
            userDiv.classList.add('current-user');
        }
        
        userDiv.appendChild(usernameSpan);




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
                    }
        
        usersList.appendChild(userDiv);
    });
}

function kickUser(username) {

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

        ws.send(JSON.stringify({
            action: 'sendMessage',
            roomCode: currentRoomCode,
            username: currentUsername,
            message: `::KICK::${username}`
        }));

        roomUsers = roomUsers.filter(u => u !== username);
        updateUsersList();
        addSystemMessage(`${username} was kicked from the chat`);

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

let currentPendingUser = null;
let waitingTimerInterval = null;
let approvalQueue = []; // Queue for multiple simultaneous join requests

function showApprovalModal(username) {

    if (!approvalQueue.includes(username) && username !== currentPendingUser) {
        approvalQueue.push(username);
            }

    if (!pendingUsers.includes(username)) {
        pendingUsers.push(username);
    }

    approvalTimers[username] = setTimeout(() => {
                autoDenyUser(username);
    }, APPROVAL_TIMEOUT);

    if (!currentPendingUser) {
        showNextApprovalRequest();
    }
}

function showNextApprovalRequest() {

    if (approvalQueue.length > 0) {
        currentPendingUser = approvalQueue.shift();
                
        const modal = document.getElementById('approvalModal');
        const usernameDisplay = document.getElementById('approvalUsername');
        
        if (modal && usernameDisplay) {

            let displayText = currentPendingUser;
            if (approvalQueue.length > 0) {
                displayText += ` (+${approvalQueue.length} more waiting)`;
            }
            usernameDisplay.textContent = displayText;
            modal.style.display = 'flex';
        }
    } else {
        currentPendingUser = null;
    }
}

function approveUser() {
    if (!currentPendingUser) return;
    
    const username = currentPendingUser;
    const modal = document.getElementById('approvalModal');

    if (approvalTimers[username]) {
        clearTimeout(approvalTimers[username]);
        delete approvalTimers[username];
    }

    pendingUsers = pendingUsers.filter(u => u !== username);

    if (!roomUsers.includes(username)) {
        roomUsers.push(username);
        userJoinTimes[username] = Date.now();
        updateUsersList();
    }

    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
            action: 'sendMessage',
            roomCode: currentRoomCode,
            username: currentUsername,
            message: `::APPROVED::${username}::${roomOwner}`
        }));
        
        addSystemMessage(`${username} joined the chat`);
    }

    if (approvalQueue.length > 0) {
        showNextApprovalRequest();
    } else {
        if (modal) {
            modal.style.display = 'none';
        }
        currentPendingUser = null;
    }
}

function denyUser() {
    if (!currentPendingUser) return;
    
    const username = currentPendingUser;
    const modal = document.getElementById('approvalModal');

    if (approvalTimers[username]) {
        clearTimeout(approvalTimers[username]);
        delete approvalTimers[username];
    }

    pendingUsers = pendingUsers.filter(u => u !== username);

    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
            action: 'sendMessage',
            roomCode: currentRoomCode,
            username: currentUsername,
            message: `::DENIED::${username}`
        }));
    }

    if (modal) {
        modal.style.display = 'none';
    }
    currentPendingUser = null;
}

function autoDenyUser(username) {

    approvalQueue = approvalQueue.filter(u => u !== username);

    if (currentPendingUser === username) {
        if (approvalQueue.length > 0) {
            showNextApprovalRequest();
        } else {
            const modal = document.getElementById('approvalModal');
            if (modal) {
                modal.style.display = 'none';
            }
            currentPendingUser = null;
        }
    }

    pendingUsers = pendingUsers.filter(u => u !== username);

    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
            action: 'sendMessage',
            roomCode: currentRoomCode,
            username: currentUsername,
            message: `::DENIED::${username}`
        }));
    }
}

function showWaitingScreen() {
    isPendingApproval = true;
    document.getElementById('loginScreen').classList.add('hidden');
    document.getElementById('chatScreen').classList.remove('active');
    
    const waitingScreen = document.getElementById('waitingScreen');
    if (waitingScreen) {
        waitingScreen.style.display = 'flex';
    }

    let timeLeft = 60;
    const timerDisplay = document.getElementById('waitingTimer');
    
    waitingTimerInterval = setInterval(() => {
        timeLeft--;
        if (timerDisplay) {
            timerDisplay.textContent = timeLeft;
        }
        
        if (timeLeft <= 0) {
            clearInterval(waitingTimerInterval);
            hideWaitingScreen();
            alert('Your request timed out. The host did not respond.');
            if (ws) {
                ws.close();
            }
            showChoiceScreen();
            document.getElementById('loginScreen').classList.remove('hidden');
        }
    }, 1000);
}

function hideWaitingScreen() {
    if (waitingTimerInterval) {
        clearInterval(waitingTimerInterval);
        waitingTimerInterval = null;
    }
    
    const waitingScreen = document.getElementById('waitingScreen');
    if (waitingScreen) {
        waitingScreen.style.display = 'none';
    }
}

function cancelJoinRequest() {
    hideWaitingScreen();
    if (ws) {
        ws.close();
    }
    showChoiceScreen();
    document.getElementById('loginScreen').classList.remove('hidden');
    document.getElementById('chatScreen').classList.remove('active');
}

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

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', setupChoiceButtonTracking);
    } else {
        setupChoiceButtonTracking();
    }
})();

    window.NexoraCircle = {
        initialized: true,
        saveChatroomState: saveChatroomState,
        restoreChatroomState: restoreChatroomState
    };

    window.saveChatroomState = saveChatroomState;
    window.restoreChatroomState = restoreChatroomState;

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
    window.approveUser = approveUser;
    window.denyUser = denyUser;
    window.cancelJoinRequest = cancelJoinRequest;

    setTimeout(loadSavedUsername, 100);

})();