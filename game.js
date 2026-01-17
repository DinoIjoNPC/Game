// DOM Elements
const roomIdHeader = document.getElementById('roomIdHeader');
const roomIdDisplay = document.getElementById('roomIdDisplay');
const playerCount = document.getElementById('playerCount');
const playersList = document.getElementById('playersList');
const waitingPlayersList = document.getElementById('waitingPlayersList');
const readyBtn = document.getElementById('readyBtn');
const leaveRoomBtn = document.getElementById('leaveRoomBtn');
const chatMessages = document.getElementById('chatMessages');
const chatInput = document.getElementById('chatInput');
const sendChatBtn = document.getElementById('sendChatBtn');
const inviteLink = document.getElementById('inviteLink');

const lobbyView = document.getElementById('lobbyView');
const gameView = document.getElementById('gameView');
const gameEndView = document.getElementById('gameEndView');

const currentPlayer = document.getElementById('currentPlayer');
const scoreDisplay = document.getElementById('scoreDisplay');
const turnIndicator = document.getElementById('turnIndicator');

// Game state
let socket;
let roomId;
let playerName;
let playerId;
let isHost = false;
let currentRoom = null;
let gameData = null;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    // Get URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    roomId = window.location.pathname.split('/').pop();
    playerName = urlParams.get('playerName') || 'Player';
    
    // Initialize socket connection
    socket = io();
    
    // Set up UI
    roomIdHeader.textContent = roomId;
    roomIdDisplay.textContent = roomId;
    inviteLink.textContent = window.location.href.split('?')[0];
    
    // Set up event listeners
    readyBtn.addEventListener('click', toggleReady);
    leaveRoomBtn.addEventListener('click', leaveRoom);
    sendChatBtn.addEventListener('click', sendChat);
    chatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendChat();
    });
    
    // Game board event listeners
    document.querySelectorAll('.cell').forEach(cell => {
        cell.addEventListener('click', handleCellClick);
    });
    
    // Set up socket event handlers
    setupSocketEvents();
    
    // Join room
    socket.emit('join-room', { roomId, playerName });
});

// Set up socket event handlers
function setupSocketEvents() {
    // Room joined
    socket.on('room-joined', (data) => {
        playerId = socket.id;
        isHost = data.isHost;
        currentRoom = data.room;
        
        updatePlayerList(currentRoom.players);
        updatePlayerCount(currentRoom.players.length);
        
        // If game is already in progress, show game view
        if (currentRoom.gameState === 'playing') {
            gameData = currentRoom.gameData;
            startGame(gameData);
        }
    });
    
    // Player joined
    socket.on('player-joined', (player) => {
        // Update player list
        if (currentRoom) {
            currentRoom.players.push(player);
            updatePlayerList(currentRoom.players);
            updatePlayerCount(currentRoom.players.length);
        }
        
        // Show notification
        addChatMessage('System', `${player.name} bergabung ke room`);
    });
    
    // Player left
    socket.on('player-left', (leftPlayerId) => {
        if (currentRoom) {
            currentRoom.players = currentRoom.players.filter(p => p.id !== leftPlayerId);
            updatePlayerList(currentRoom.players);
            updatePlayerCount(currentRoom.players.length);
        }
    });
    
    // Player ready update
    socket.on('player-ready-update', (data) => {
        if (currentRoom) {
            const player = currentRoom.players.find(p => p.id === data.playerId);
            if (player) {
                player.isReady = true;
                updatePlayerList(currentRoom.players);
            }
            
            if (data.allReady) {
                // All players ready, start countdown
                startGameCountdown();
            }
        }
    });
    
    // Game started
    socket.on('game-started', (data) => {
        gameData = data;
        startGame(data);
    });
    
    // Game update
    socket.on('game-update', (data) => {
        gameData = data;
        updateGame(data);
        
        // Check if game ended
        if (data.gameState === 'finished') {
            showGameEnd(data);
        }
    });
    
    // New message
    socket.on('new-message', (message) => {
        addChatMessage(message.playerName, message.message, message.timestamp);
    });
    
    // Error
    socket.on('error', (error) => {
        alert(error.message);
        window.location.href = '/';
    });
}

// Update player list
function updatePlayerList(players) {
    playersList.innerHTML = '';
    waitingPlayersList.innerHTML = '';
    
    players.forEach(player => {
        // For players panel
        const playerItem = document.createElement('div');
        playerItem.className = 'player-item';
        playerItem.id = `player-${player.id}`;
        
        playerItem.innerHTML = `
            <div class="player-name">
                <i class="fas fa-user"></i>
                <span>${player.name}</span>
                ${player.isHost ? '<span class="player-host"><i class="fas fa-crown"></i> Host</span>' : ''}
            </div>
            <div class="player-status">
                ${player.isReady ? '<span class="player-ready"><i class="fas fa-check-circle"></i> Ready</span>' : '<span class="player-waiting">Waiting</span>'}
            </div>
        `;
        
        playersList.appendChild(playerItem);
        
        // For waiting lobby
        const waitingPlayerItem = document.createElement('div');
        waitingPlayerItem.className = 'player-item';
        waitingPlayerItem.innerHTML = `
            <div class="player-name">
                <i class="fas fa-user"></i>
                <span>${player.name}</span>
            </div>
            <div class="player-status">
                ${player.isReady ? '<i class="fas fa-check-circle" style="color:#4cc9f0"></i>' : '<i class="fas fa-clock" style="opacity:0.5"></i>'}
            </div>
        `;
        
        waitingPlayersList.appendChild(waitingPlayerItem);
    });
}

// Update player count
function updatePlayerCount(count) {
    playerCount.textContent = count;
}

// Toggle ready status
function toggleReady() {
    socket.emit('player-ready', { roomId, playerId: socket.id });
    readyBtn.disabled = true;
    readyBtn.innerHTML = '<i class="fas fa-check"></i> Menunggu pemain lain...';
}

// Start game countdown
function startGameCountdown() {
    const countdownElement = document.getElementById('countdown');
    const countdownNumber = document.getElementById('countdownNumber');
    
    countdownElement.classList.remove('hidden');
    
    let count = 5;
    countdownNumber.textContent = count;
    
    const countdownInterval = setInterval(() => {
        count--;
        countdownNumber.textContent = count;
        
        if (count <= 0) {
            clearInterval(countdownInterval);
            countdownElement.classList.add('hidden');
        }
    }, 1000);
}

// Start game
function startGame(data) {
    lobbyView.classList.add('hidden');
    gameView.classList.remove('hidden');
    
    updateGame(data);
}

// Update game state
function updateGame(data) {
    // Update turn indicator
    if (data.turn === playerId) {
        turnIndicator.style.background = 'linear-gradient(135deg, #4cc9f0 0%, #4361ee 100%)';
        currentPlayer.textContent = 'Anda';
        currentPlayer.style.color = '#72efdd';
    } else {
        const player = currentRoom.players.find(p => p.id === data.turn);
        turnIndicator.style.background = 'linear-gradient(135deg, #f72585 0%, #b5179e 100%)';
        currentPlayer.textContent = player ? player.name : 'Pemain lain';
        currentPlayer.style.color = '#f72585';
    }
    
    // Update scores
    scoreDisplay.innerHTML = '';
    currentRoom.players.forEach(player => {
        const scoreItem = document.createElement('div');
        scoreItem.className = 'player-score';
        scoreItem.innerHTML = `
            <span>${player.name}:</span>
            <span>${data.scores[player.id] || 0}</span>
        `;
        scoreDisplay.appendChild(scoreItem);
    });
    
    // Update game board (for tic-tac-toe)
    if (data.board) {
        data.board.forEach((cell, index) => {
            const cellElement = document.querySelector(`.cell[data-index="${index}"]`);
            if (cellElement) {
                cellElement.textContent = cell || '';
                cellElement.className = `cell ${cell ? (cell === 'X' ? 'x' : 'o') : ''}`;
                
                // Enable/disable click based on turn
                if (cell || data.turn !== playerId || data.gameState === 'finished') {
                    cellElement.style.pointerEvents = 'none';
                } else {
                    cellElement.style.pointerEvents = 'auto';
                }
            }
        });
    }
}

// Handle cell click (for tic-tac-toe)
function handleCellClick(e) {
    if (!gameData || gameData.turn !== playerId || gameData.gameState === 'finished') {
        return;
    }
    
    const index = parseInt(e.target.getAttribute('data-index'));
    
    // Send move to server
    socket.emit('game-action', {
        roomId,
        action: 'move',
        data: { position: index }
    });
}

// Show game end
function showGameEnd(data) {
    gameView.classList.add('hidden');
    gameEndView.classList.remove('hidden');
    
    const gameResult = document.getElementById('gameResult');
    const finalScores = document.getElementById('finalScores');
    
    if (data.winner === playerId) {
        gameResult.textContent = '🎉 Anda Menang! 🎉';
        gameResult.style.color = '#4cc9f0';
    } else if (data.winner) {
        const winner = currentRoom.players.find(p => p.id === data.winner);
        gameResult.textContent = `🎯 ${winner?.name} Menang!`;
        gameResult.style.color = '#f72585';
    } else {
        gameResult.textContent = '🤝 Seri!';
        gameResult.style.color = '#72efdd';
    }
    
    // Show final scores
    finalScores.innerHTML = '<h3>Skor Akhir:</h3>';
    currentRoom.players.forEach(player => {
        const scoreItem = document.createElement('div');
        scoreItem.className = 'final-score-item';
        scoreItem.innerHTML = `
            <span>${player.name}</span>
            <span>${data.scores[player.id] || 0}</span>
        `;
        finalScores.appendChild(scoreItem);
    });
}

// Send chat message
function sendChat() {
    const message = chatInput.value.trim();
    
    if (message && playerName) {
        socket.emit('send-message', {
            roomId,
            message,
            playerName
        });
        
        chatInput.value = '';
        chatInput.focus();
    }
}

// Add chat message to UI
function addChatMessage(sender, message, timestamp = '') {
    const messageElement = document.createElement('div');
    messageElement.className = 'chat-message';
    
    if (!timestamp) {
        timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    
    messageElement.innerHTML = `
        <span class="chat-sender">${sender}:</span>
        <span class="chat-text">${message}</span>
        <span class="chat-time">${timestamp}</span>
    `;
    
    chatMessages.appendChild(messageElement);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Leave room
function leaveRoom() {
    if (confirm('Apakah Anda yakin ingin keluar dari room?')) {
        socket.emit('leave-room', { roomId });
        window.location.href = '/';
    }
}

// Game controls
document.getElementById('playAgainBtn')?.addEventListener('click', () => {
    // Reset game
    socket.emit('game-action', {
        roomId,
        action: 'restart',
        data: {}
    });
    
    gameEndView.classList.add('hidden');
    lobbyView.classList.remove('hidden');
    
    // Reset ready status
    readyBtn.disabled = false;
    readyBtn.innerHTML = '<i class="fas fa-check"></i> Ready';
});

document.getElementById('backToLobbyBtn')?.addEventListener('click', () => {
    window.location.href = '/';
});
