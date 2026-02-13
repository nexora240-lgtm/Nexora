
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
    const PUBLIC_ROOM_CODE = '000000'; // Special room code for public chat - using 6-digit format required by server
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

    /**
     * Get the username to use - prioritizes logged-in account username
     */
    function getDefaultUsername() {
        // Check if user is logged in with an account
        if (window.NexoraAuth && window.NexoraAuth.isLoggedIn()) {
            const session = window.NexoraAuth.getSession();
            if (session && session.username) {
                return session.username;
            }
        }
        // Fall back to saved username from cookie
        return getUsernameFromCookie();
    }

    /**
     * Check if current username is from logged-in account
     */
    function isUsingAccountUsername() {
        return window.NexoraAuth && window.NexoraAuth.isLoggedIn();
    }

    /**
     * Check if user has dismissed the account prompt
     */
    function hasUserDismissedAccountPrompt() {
        return localStorage.getItem('nexora_circle_dismissed_account_prompt') === 'true';
    }

    /**
     * Show account creation prompt modal for guest users
     */
    function showAccountPrompt() {
        // Don't show if user is logged in or has dismissed it
        if (isUsingAccountUsername() || hasUserDismissedAccountPrompt()) {
            return;
        }
        
        const modal = document.getElementById('accountPromptModal');
        if (modal) {
            // Ensure modal is visible even in iframe/about:blank context
            modal.style.display = 'flex';
            modal.style.position = 'fixed';
            modal.style.inset = '0';
            modal.style.zIndex = '999999';
            
            // If we're in an iframe, ensure the modal covers the entire viewport
            if (window.self !== window.top) {
                modal.style.width = '100vw';
                modal.style.height = '100vh';
            }
        }
    }

    function loadSavedUsername() {
        const defaultUsername = getDefaultUsername();
        const isFromAccount = isUsingAccountUsername();
        
        // Show account prompt for guest users (only once when they first interact)
        if (!isFromAccount && !hasUserDismissedAccountPrompt()) {
            // Show prompt after a short delay to not interrupt user flow
            // Use longer delay if in iframe to ensure everything is loaded
            const delay = (window.self !== window.top) ? 2500 : 1500;
            setTimeout(showAccountPrompt, delay);
        }
        
        if (defaultUsername) {
            const joinInput = document.getElementById('joinUsernameInput');
            const createInput = document.getElementById('createUsernameInput');
            const publicInput = document.getElementById('publicUsernameInput');
            
            // Set the username value
            if (joinInput) {
                joinInput.value = defaultUsername;
                if (isFromAccount) {
                    joinInput.readOnly = true;
                    joinInput.placeholder = 'Using account username';
                    joinInput.style.opacity = '0.7';
                } else {
                    joinInput.readOnly = false;
                    joinInput.placeholder = 'Enter your username';
                    joinInput.style.opacity = '1';
                }
            }
            if (createInput) {
                createInput.value = defaultUsername;
                if (isFromAccount) {
                    createInput.readOnly = true;
                    createInput.placeholder = 'Using account username';
                    createInput.style.opacity = '0.7';
                } else {
                    createInput.readOnly = false;
                    createInput.placeholder = 'Enter your username';
                    createInput.style.opacity = '1';
                }
            }
            if (publicInput) {
                publicInput.value = defaultUsername;
                if (isFromAccount) {
                    publicInput.readOnly = true;
                    publicInput.placeholder = 'Using account username';
                    publicInput.style.opacity = '0.7';
                } else {
                    publicInput.readOnly = false;
                    publicInput.placeholder = 'Enter your username';
                    publicInput.style.opacity = '1';
                }
            }
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
    // Use account username if logged in, otherwise use input value
    let username;
    if (isUsingAccountUsername()) {
        username = getDefaultUsername();
    } else {
        username = document.getElementById('publicUsernameInput').value.trim();
    }
    
    if (!username) {
        alert('Please enter a username');
        return;
    }
    
    currentUsername = username;
    currentRoomCode = PUBLIC_ROOM_CODE;
    roomOwner = ''; // No owner in public chat
    
    // Only save to cookie if not using account username
    if (!isUsingAccountUsername()) {
        saveUsernameToCookie(username);
    }
    
    connectWebSocket();
}

function createRoom() {
    // Use account username if logged in, otherwise use input value
    let username;
    if (isUsingAccountUsername()) {
        username = getDefaultUsername();
    } else {
        username = document.getElementById('createUsernameInput').value.trim();
    }
    
    if (!username) {
        alert('Please enter a username');
        return;
    }

    currentUsername = username;
    currentRoomCode = generateRoomCode();
    roomOwner = username; // Set the creator as the owner

    sessionStorage.setItem(`circle_owner_${currentRoomCode}`, username);
    
    // Only save to cookie if not using account username
    if (!isUsingAccountUsername()) {
        saveUsernameToCookie(username);
    }
    
    connectWebSocket(true); // Pass true to indicate room creation
}

function joinRoom() {
    // Use account username if logged in, otherwise use input value
    let username;
    if (isUsingAccountUsername()) {
        username = getDefaultUsername();
    } else {
        username = document.getElementById('joinUsernameInput').value.trim();
    }
    
    const roomCode = document.getElementById('roomCodeInput').value.trim().toUpperCase();
    
    if (!username || !roomCode) {
        alert('Please enter both username and circle code');
        return;
    }

    currentUsername = username;
    currentRoomCode = roomCode;
    
    // Only save to cookie if not using account username
    if (!isUsingAccountUsername()) {
        saveUsernameToCookie(username);
    }
    
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

        // Handle server error messages (have message but no username)
        if (data.message && !data.username) {
            console.warn('[Chatroom] Server message:', data.message);
            if (data.connectionId) {
                console.debug('[Chatroom] Connection ID:', data.connectionId);
            }
            // Don't display these as chat messages
            return;
        }

        // Check if this is a chat message (must have both message and username)
        if (data.message && data.username) {
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

                // Only set owner if NOT in public chat
                if (ownerInfo && currentRoomCode !== PUBLIC_ROOM_CODE) {
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

                    const ownerLeaving = (username === roomOwner) && (currentRoomCode !== PUBLIC_ROOM_CODE);
                    
                    roomUsers = roomUsers.filter(u => u !== username);
                    delete userJoinTimes[username];

                    if (ownerLeaving && roomUsers.length > 0 && currentRoomCode !== PUBLIC_ROOM_CODE) {

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

            // Validate message data before displaying
            if (!username || username === 'undefined') {
                console.error('[Chatroom] Invalid username in message:', data);
                return;
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
    if (!messagesDiv) return;
    
    // Validate inputs
    if (!username || !message) {
        console.error('[Chatroom] Invalid message data:', { username, message, timestamp });
        return;
    }
    
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${isOwn ? 'own' : ''}`;
    
    // Handle invalid or missing timestamp
    let time = 'Now';
    if (timestamp) {
        const date = new Date(timestamp);
        if (!isNaN(date.getTime())) {
            time = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        }
    }
    
    messageDiv.innerHTML = `
        <div class="message-username">${escapeHtml(username)}</div>
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
    
    // Show pending users first (only for room owner in private rooms, NOT public chat)
    if (currentUsername === roomOwner && pendingUsers.length > 0 && !isPublicChat) {
        pendingUsers.forEach((user) => {
            const userDiv = document.createElement('div');
            userDiv.className = 'user-item pending-user';
            
            const usernameSpan = document.createElement('span');
            usernameSpan.className = 'user-name pending-name';
            usernameSpan.textContent = user;
            userDiv.appendChild(usernameSpan);
            
            // Create countdown timer display
            const countdownSpan = document.createElement('span');
            countdownSpan.className = 'approval-countdown';
            countdownSpan.id = `countdown-${user}`;
            
            // Calculate remaining time
            if (approvalTimers[user]) {
                const elapsed = Date.now() - approvalTimers[user].startTime;
                const remaining = Math.max(0, Math.ceil((APPROVAL_TIMEOUT - elapsed) / 1000));
                countdownSpan.textContent = `${remaining}s`;
                
                // Start interval to update countdown
                if (approvalTimers[user].interval) {
                    clearInterval(approvalTimers[user].interval);
                }
                approvalTimers[user].interval = setInterval(() => {
                    const countdownEl = document.getElementById(`countdown-${user}`);
                    if (countdownEl) {
                        const elapsed = Date.now() - approvalTimers[user].startTime;
                        const remaining = Math.max(0, Math.ceil((APPROVAL_TIMEOUT - elapsed) / 1000));
                        countdownEl.textContent = `${remaining}s`;
                    }
                }, 1000);
            } else {
                countdownSpan.textContent = '60s';
            }
            
            userDiv.appendChild(countdownSpan);
            
            // Create Allow button
            const allowBtn = document.createElement('button');
            allowBtn.className = 'allow-button';
            allowBtn.textContent = 'Allow';
            allowBtn.onclick = () => approveUser(user);
            userDiv.appendChild(allowBtn);
            
            // Create Deny button (optional, small X button)
            const denyBtn = document.createElement('button');
            denyBtn.className = 'deny-inline-button';
            denyBtn.textContent = '✕';
            denyBtn.title = 'Deny';
            denyBtn.onclick = () => denyUser(user);
            userDiv.appendChild(denyBtn);
            
            usersList.appendChild(userDiv);
        });
    }
    
    // Sort users: owner first, then current user, then others
    const sortedUsers = [...roomUsers].sort((a, b) => {
        // Owner always first
        if (a === roomOwner) return -1;
        if (b === roomOwner) return 1;
        
        // Current user second (if not owner)
        if (a === currentUsername) return -1;
        if (b === currentUsername) return 1;
        
        // Others maintain original order
        return 0;
    });
    
        
    sortedUsers.forEach((user, index) => {
                const userDiv = document.createElement('div');
        userDiv.className = 'user-item';
        
        const usernameSpan = document.createElement('span');
        usernameSpan.className = 'user-name';
        usernameSpan.textContent = user;
        
                // Only show owner badge if NOT in public chat
        if (user === roomOwner && roomOwner && !isPublicChat) {
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
    // No kicking in public chat
    if (currentRoomCode === PUBLIC_ROOM_CODE) {
        alert('Kicking is not allowed in the public circle.');
        return;
    }

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
    // Add to pending users list
    if (!pendingUsers.includes(username)) {
        pendingUsers.push(username);
    }

    // Start countdown timer for auto-deny
    approvalTimers[username] = {
        timeout: setTimeout(() => {
            autoDenyUser(username);
        }, APPROVAL_TIMEOUT),
        startTime: Date.now()
    };

    // Update the users list to show pending user
    updateUsersList();
}

function approveUser(username) {
    if (!username || !pendingUsers.includes(username)) return;

    if (approvalTimers[username]) {
        clearTimeout(approvalTimers[username].timeout);
        clearInterval(approvalTimers[username].interval);
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
}

function denyUser(username) {
    if (!username || !pendingUsers.includes(username)) return;

    if (approvalTimers[username]) {
        clearTimeout(approvalTimers[username].timeout);
        clearInterval(approvalTimers[username].interval);
        delete approvalTimers[username];
    }

    pendingUsers = pendingUsers.filter(u => u !== username);
    updateUsersList();

    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
            action: 'sendMessage',
            roomCode: currentRoomCode,
            username: currentUsername,
            message: `::DENIED::${username}`
        }));
    }
}

function autoDenyUser(username) {
    pendingUsers = pendingUsers.filter(u => u !== username);
    
    if (approvalTimers[username]) {
        clearInterval(approvalTimers[username].interval);
        delete approvalTimers[username];
    }
    
    updateUsersList();

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

function redirectToCreateAccount() {
    const modal = document.getElementById('accountPromptModal');
    if (modal) {
        modal.style.display = 'none';
    }
    
    // Save current state before redirecting
    saveChatroomState();
    
    // If in iframe (about:blank context), redirect the top window
    if (window.self !== window.top) {
        try {
            window.top.location.href = '/?route=/settings';
        } catch (e) {
            // Fallback if cross-origin prevents access to top
            window.location.href = '/?route=/settings';
        }
    } else {
        // Normal redirect
        window.location.href = '/?route=/settings';
    }
}

function continueAsGuest() {
    const modal = document.getElementById('accountPromptModal');
    const checkbox = document.getElementById('dontShowAgainCheckbox');
    
    if (modal) {
        modal.style.display = 'none';
    }
    
    // Save preference if checkbox is checked
    if (checkbox && checkbox.checked) {
        localStorage.setItem('nexora_circle_dismissed_account_prompt', 'true');
    }
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
    window.redirectToCreateAccount = redirectToCreateAccount;
    window.continueAsGuest = continueAsGuest;

    setTimeout(loadSavedUsername, 100);

    let chatroomMouseTrackingInitialized = false;
    let chatroomMouseTrackingObserver = null;
    const trackedMouseElements = new Set();

    // Setup mouse tracking for interactive elements
    function setupMouseTracking() {
        if (chatroomMouseTrackingInitialized) {
            return;
        }

        if (document.documentElement.classList.contains('performance-no-mouse-tracking')) {
            console.log('[Chatroom Mouse Tracking] Disabled due to performance settings');
            return;
        }

        const container = document.querySelector('.nexora-chatroom .container');
        if (!container) {
            console.warn('[Chatroom Mouse Tracking] No container element found');
            return;
        }

        console.log('[Chatroom Mouse Tracking] Setting up mouse tracking for chatroom');
        
        // Helper function to add tracking to an element
        const addTracking = (element) => {
            if (!element || element._hasMouseTracking || document.documentElement.classList.contains('performance-no-mouse-tracking')) return;
            element._hasMouseTracking = true;
            
            let rafId = null;
            const updateFromEvent = (e) => {
                const rect = element.getBoundingClientRect();
                const x = ((e.clientX - rect.left) / rect.width) * 100;
                const y = ((e.clientY - rect.top) / rect.height) * 100;
                
                if (rafId) return;
                rafId = requestAnimationFrame(() => {
                    element.style.setProperty('--x', x + '%');
                    element.style.setProperty('--y', y + '%');
                    rafId = null;
                });
            };

            const resetPosition = () => {
                element.style.setProperty('--x', '50%');
                element.style.setProperty('--y', '50%');
            };
            
            element.addEventListener('mousemove', updateFromEvent);
            element.addEventListener('mouseleave', resetPosition, { passive: true });

            element._mouseTrackingCleanup = () => {
                element.removeEventListener('mousemove', updateFromEvent);
                element.removeEventListener('mouseleave', resetPosition);
                element._hasMouseTracking = false;
                trackedMouseElements.delete(element);
            };
            trackedMouseElements.add(element);
            
            console.log('[Chatroom Mouse Tracking] Added tracking to:', element.className || element.id || element.tagName);
        };

        // Track mouse position on container
        addTracking(container);
        
        // Function to track all interactive elements
        const trackAllElements = () => {
            // Track mouse position on buttons
            const buttons = document.querySelectorAll('.nexora-chatroom button');
            buttons.forEach(addTracking);
            
            // Track mouse position on choice buttons
            const choiceButtons = document.querySelectorAll('.choice-button');
            choiceButtons.forEach(addTracking);
            
            // Track inputs
            const inputs = document.querySelectorAll('.nexora-chatroom input');
            inputs.forEach(addTracking);
        };
        
        trackAllElements();
        
        // Set up MutationObserver to track dynamically added elements
        const observer = new MutationObserver((mutations) => {
            let shouldRetrack = false;
            mutations.forEach((mutation) => {
                if (mutation.addedNodes.length > 0) {
                    shouldRetrack = true;
                }
            });
            if (shouldRetrack) {
                trackAllElements();
            }
        });
        
        // Observe the entire chatroom for changes
        const chatroom = document.querySelector('.nexora-chatroom');
        if (chatroom) {
            observer.observe(chatroom, { childList: true, subtree: true });
        }

        chatroomMouseTrackingObserver = observer;
        chatroomMouseTrackingInitialized = true;
        console.log('[Chatroom Mouse Tracking] Setup complete');
    }

    function teardownMouseTracking() {
        if (!chatroomMouseTrackingInitialized) return;
        trackedMouseElements.forEach((element) => {
            if (typeof element._mouseTrackingCleanup === 'function') {
                element._mouseTrackingCleanup();
            }
        });
        trackedMouseElements.clear();
        if (chatroomMouseTrackingObserver) {
            chatroomMouseTrackingObserver.disconnect();
            chatroomMouseTrackingObserver = null;
        }
        chatroomMouseTrackingInitialized = false;
        console.log('[Chatroom Mouse Tracking] Torn down due to performance settings');
    }
    
    // Initialize mouse tracking when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', setupMouseTracking);
    } else {
        setupMouseTracking();
    }

    document.addEventListener('settings:performanceChanged', (event) => {
        const disabled = event && event.detail && event.detail.settings ? !event.detail.settings.mouseTracking : document.documentElement.classList.contains('performance-no-mouse-tracking');
        if (disabled) {
            teardownMouseTracking();
        } else if (!chatroomMouseTrackingInitialized) {
            setupMouseTracking();
        }
    });

})();