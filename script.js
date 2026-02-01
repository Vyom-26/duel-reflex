// Configuration
const API_URL = 'http://localhost:3000';
const WS_URL = 'ws://localhost:3000';

// Game State
let ws = null;
let playerId = null;
let playerNumber = null;
let playerName = null;
let isActivePlayer = false;
let gameState = 'joining';
let playerTimes = {
  player1: { times: [], name: '' },
  player2: { times: [], name: '' }
};

// DOM Elements
const screens = {
  join: document.getElementById('join-screen'),
  lobby: document.getElementById('lobby-screen'),
  game: document.getElementById('game-screen'),
  result: document.getElementById('result-screen')
};

const elements = {
  playerNameInput: document.getElementById('player-name'),
  joinBtn: document.getElementById('join-btn'),
  joinStatus: document.getElementById('join-status'),
  playerList: document.getElementById('player-list'),
  lobbyStatus: document.getElementById('lobby-status'),
  startBtn: document.getElementById('start-btn'),
  roundNumber: document.getElementById('round-number'),
  totalRounds: document.getElementById('total-rounds'),
  activePlayerDisplay: document.getElementById('active-player-display'),
  gameArea: document.getElementById('game-area'),
  gameMessage: document.getElementById('game-message'),
  reactionButtonContainer: document.getElementById('reaction-button-container'),
  reactionBtn: document.getElementById('reaction-btn'),
  reactionTimeDisplay: document.getElementById('reaction-time-display'),
  player1Card: document.getElementById('player1-card'),
  player1Name: document.getElementById('player1-name'),
  player1LastTime: document.getElementById('player1-last-time'),
  player1AvgTime: document.getElementById('player1-avg-time'),
  player2Card: document.getElementById('player2-card'),
  player2Name: document.getElementById('player2-name'),
  player2LastTime: document.getElementById('player2-last-time'),
  player2AvgTime: document.getElementById('player2-avg-time'),
  winnerName: document.getElementById('winner-name'),
  winnerTime: document.getElementById('winner-time'),
  finalPlayer1Name: document.getElementById('final-player1-name'),
  finalPlayer1Avg: document.getElementById('final-player1-avg'),
  finalPlayer2Name: document.getElementById('final-player2-name'),
  finalPlayer2Avg: document.getElementById('final-player2-avg'),
  playAgainBtn: document.getElementById('play-again-btn'),
  connectionStatus: document.getElementById('connection-status'),
  connectionText: document.getElementById('connection-text')
};

// Initialize WebSocket connection
function connectWebSocket() {
  updateConnectionStatus('connecting');
  
  ws = new WebSocket(WS_URL);

  ws.onopen = () => {
    console.log('Connected to server');
    updateConnectionStatus('connected');
  };

  ws.onclose = () => {
    console.log('Disconnected from server');
    updateConnectionStatus('disconnected');
    setTimeout(connectWebSocket, 3000);
  };

  ws.onerror = (error) => {
    console.error('WebSocket error:', error);
    updateConnectionStatus('disconnected');
  };

  ws.onmessage = (event) => {
    const message = JSON.parse(event.data);
    handleServerMessage(message);
  };
}

// Handle messages from server
function handleServerMessage(message) {
  console.log('Received:', message.type, message);

  switch (message.type) {
    case 'joined':
      playerId = message.playerId;
      playerNumber = message.playerNumber;
      elements.joinStatus.textContent = message.message;
      elements.joinStatus.className = 'mt-4 text-center text-green-600';
      showScreen('lobby');
      break;

    case 'error':
      elements.joinStatus.textContent = message.message;
      elements.joinStatus.className = 'mt-4 text-center text-red-600';
      break;

    case 'player_joined':
      updateLobbyPlayers(message.state);
      break;

    case 'ready_to_start':
      elements.lobbyStatus.textContent = message.message;
      elements.lobbyStatus.className = 'text-center text-green-600 font-semibold mb-6';
      elements.startBtn.classList.remove('hidden');
      break;

    case 'game_started':
      showScreen('game');
      updateGameState(message.state);
      elements.gameMessage.textContent = 'Get ready...';
      elements.gameMessage.className = 'text-xl text-gray-700 text-center mb-6 message-waiting';
      break;

    case 'round_starting':
      handleRoundStarting(message);
      break;

    case 'button_appear':
      handleButtonAppear(message);
      break;

    case 'player_clicked':
      handlePlayerClicked(message);
      break;

    case 'round_result':
      handleRoundResult(message);
      break;

    case 'too_early':
      handleTooEarly(message);
      break;

    case 'wrong_player':
      showTemporaryMessage('Not your turn!', 'text-red-600');
      break;

    case 'game_over':
      handleGameOver(message);
      break;

    case 'player_left':
      handlePlayerLeft(message);
      break;

    case 'game_reset':
      resetGame();
      break;

    case 'state_update':
      updateGameState(message.state);
      break;
  }
}

// Screen management
function showScreen(screenName) {
  Object.values(screens).forEach(screen => {
    screen.classList.add('hidden');
  });
  screens[screenName].classList.remove('hidden');
  gameState = screenName;
}

// Update connection status indicator
function updateConnectionStatus(status) {
  elements.connectionStatus.className = `fixed bottom-4 right-4 px-4 py-2 rounded-full text-sm font-medium ${status}`;
  
  const statusTexts = {
    connecting: 'Connecting...',
    connected: 'Connected',
    disconnected: 'Disconnected'
  };
  
  elements.connectionText.textContent = statusTexts[status];
}

// Update lobby player list
function updateLobbyPlayers(state) {
  elements.playerList.innerHTML = '';
  
  state.players.forEach(player => {
    const div = document.createElement('div');
    div.className = 'flex items-center justify-between p-4 bg-gray-50 rounded-lg';
    div.innerHTML = `
      <span class="font-medium text-gray-800">${player.name}</span>
      <span class="text-sm text-gray-500">Player ${player.playerNumber}</span>
    `;
    elements.playerList.appendChild(div);
  });

  if (state.players.length < 2) {
    elements.lobbyStatus.textContent = `Waiting for ${2 - state.players.length} more player(s)...`;
    elements.lobbyStatus.className = 'text-center text-gray-600 mb-6 waiting-text';
    elements.startBtn.classList.add('hidden');
  }
}

// Update game state
function updateGameState(state) {
  elements.roundNumber.textContent = state.currentRound || 1;
  elements.totalRounds.textContent = state.totalRounds;

  if (state.players.length >= 2) {
    const p1 = state.players[0];
    const p2 = state.players[1];

    elements.player1Name.textContent = p1.name;
    elements.player2Name.textContent = p2.name;
    playerTimes.player1.name = p1.name;
    playerTimes.player2.name = p2.name;
  }
}

// Handle round starting
function handleRoundStarting(message) {
  elements.roundNumber.textContent = message.round;
  elements.totalRounds.textContent = message.totalRounds;
  
  isActivePlayer = message.activePlayerId === playerId;
  
  elements.activePlayerDisplay.textContent = `${message.activePlayerName}'s turn`;
  elements.activePlayerDisplay.className = isActivePlayer 
    ? 'text-lg font-semibold text-green-600' 
    : 'text-lg font-semibold text-gray-500';

  // Update player cards
  updatePlayerCardActive(message.activePlayerId);

  // Hide button and show waiting message
  elements.reactionButtonContainer.classList.add('hidden');
  elements.reactionTimeDisplay.classList.add('hidden');
  
  if (isActivePlayer) {
    elements.gameMessage.textContent = 'Wait for the button...';
    elements.gameMessage.className = 'text-xl text-gray-700 text-center mb-6 message-waiting waiting-text';
  } else {
    elements.gameMessage.textContent = `Waiting for ${message.activePlayerName}...`;
    elements.gameMessage.className = 'text-xl text-gray-500 text-center mb-6';
  }

  elements.gameArea.classList.remove('too-early-warning');
}

// Handle button appear
function handleButtonAppear(message) {
  isActivePlayer = message.activePlayerId === playerId;
  
  elements.gameMessage.textContent = isActivePlayer ? 'CLICK NOW!' : 'Watch...';
  elements.gameMessage.className = isActivePlayer 
    ? 'text-xl text-center mb-6 message-ready' 
    : 'text-xl text-gray-500 text-center mb-6';

  elements.reactionButtonContainer.classList.remove('hidden');
  
  if (isActivePlayer) {
    elements.reactionBtn.classList.remove('locked');
    elements.reactionBtn.disabled = false;
  } else {
    elements.reactionBtn.classList.add('locked');
    elements.reactionBtn.disabled = true;
  }
}

// Handle player clicked
function handlePlayerClicked(message) {
  const isPlayer1 = message.playerId === playerId && playerNumber === 1 || 
                    message.playerId !== playerId && playerNumber === 2;
  
  // Update times display
  if (isPlayer1) {
    updatePlayerTime(1, message.reactionTime);
  } else {
    updatePlayerTime(2, message.reactionTime);
  }

  elements.reactionButtonContainer.classList.add('hidden');
  elements.reactionTimeDisplay.textContent = `${message.reactionTime} ms`;
  elements.reactionTimeDisplay.classList.remove('hidden');
  
  elements.gameMessage.textContent = `Next: ${message.nextPlayerName}`;
  elements.gameMessage.className = 'text-xl text-blue-600 text-center mb-6';
}

// Handle round result
function handleRoundResult(message) {
  // Update both players' times
  message.roundData.forEach(data => {
    if (data.playerNumber === 1) {
      updatePlayerTime(1, data.reactionTime);
    } else {
      updatePlayerTime(2, data.reactionTime);
    }
  });

  elements.reactionButtonContainer.classList.add('hidden');
  elements.reactionTimeDisplay.textContent = `${message.reactionTime} ms`;
  elements.reactionTimeDisplay.classList.remove('hidden');
  
  elements.gameMessage.innerHTML = `
    <span class="block text-2xl font-bold text-green-600">${message.roundWinner} wins!</span>
    <span class="block text-lg text-gray-600 mt-2">${message.roundWinnerTime} ms</span>
  `;
  elements.gameMessage.className = 'text-center mb-6 round-winner';
}

// Handle too early click
function handleTooEarly(message) {
  elements.gameArea.classList.add('too-early-warning');
  elements.gameMessage.textContent = 'Too early! Wait for the button...';
  elements.gameMessage.className = 'text-xl text-red-600 text-center mb-6 font-semibold';
  
  setTimeout(() => {
    elements.gameArea.classList.remove('too-early-warning');
  }, 500);
}

// Handle game over
function handleGameOver(message) {
  showScreen('result');
  
  elements.winnerName.textContent = message.winner;
  elements.winnerTime.textContent = `Average: ${message.winnerAvg} ms`;
  
  elements.finalPlayer1Name.textContent = message.player1.name;
  elements.finalPlayer1Avg.textContent = message.player1.avgTime;
  
  elements.finalPlayer2Name.textContent = message.player2.name;
  elements.finalPlayer2Avg.textContent = message.player2.avgTime;

  // Highlight winner
  if (message.winner === message.player1.name) {
    elements.finalPlayer1Name.parentElement.classList.add('winner-highlight');
  } else if (message.winner === message.player2.name) {
    elements.finalPlayer2Name.parentElement.classList.add('winner-highlight');
  }
}

// Handle player left
function handlePlayerLeft(message) {
  if (message.message) {
    alert(message.message);
    resetGame();
  } else {
    updateLobbyPlayers(message.state);
  }
}

// Update player card active state
function updatePlayerCardActive(activePlayerId) {
  const state = getGameStateFromDOM();
  
  elements.player1Card.className = 'bg-white rounded-xl shadow-lg p-4';
  elements.player2Card.className = 'bg-white rounded-xl shadow-lg p-4';
  
  // Determine which card to highlight based on active player
  if (playerNumber === 1) {
    if (isActivePlayer) {
      elements.player1Card.classList.add('player-card-active');
    } else {
      elements.player2Card.classList.add('player-card-active');
    }
  } else {
    if (isActivePlayer) {
      elements.player2Card.classList.add('player-card-active');
    } else {
      elements.player1Card.classList.add('player-card-active');
    }
  }
}

// Update player time display
function updatePlayerTime(playerNum, time) {
  const times = playerNum === 1 ? playerTimes.player1.times : playerTimes.player2.times;
  times.push(time);
  
  const lastTimeEl = playerNum === 1 ? elements.player1LastTime : elements.player2LastTime;
  const avgTimeEl = playerNum === 1 ? elements.player1AvgTime : elements.player2AvgTime;
  
  lastTimeEl.textContent = time;
  
  const avg = Math.round(times.reduce((a, b) => a + b, 0) / times.length);
  avgTimeEl.textContent = avg;
}

// Show temporary message
function showTemporaryMessage(text, className) {
  const originalText = elements.gameMessage.textContent;
  const originalClass = elements.gameMessage.className;
  
  elements.gameMessage.textContent = text;
  elements.gameMessage.className = `text-xl text-center mb-6 ${className}`;
  
  setTimeout(() => {
    elements.gameMessage.textContent = originalText;
    elements.gameMessage.className = originalClass;
  }, 1000);
}

// Get game state from DOM (helper)
function getGameStateFromDOM() {
  return {
    round: parseInt(elements.roundNumber.textContent),
    totalRounds: parseInt(elements.totalRounds.textContent)
  };
}

// Reset game
function resetGame() {
  playerId = null;
  playerNumber = null;
  playerName = null;
  isActivePlayer = false;
  playerTimes = {
    player1: { times: [], name: '' },
    player2: { times: [], name: '' }
  };
  
  elements.player1LastTime.textContent = '--';
  elements.player1AvgTime.textContent = '--';
  elements.player2LastTime.textContent = '--';
  elements.player2AvgTime.textContent = '--';
  
  elements.finalPlayer1Name.parentElement.classList.remove('winner-highlight');
  elements.finalPlayer2Name.parentElement.classList.remove('winner-highlight');
  
  showScreen('join');
  elements.joinStatus.textContent = '';
  elements.playerNameInput.value = '';
}

// Event Listeners
elements.joinBtn.addEventListener('click', () => {
  playerName = elements.playerNameInput.value.trim();
  
  if (!playerName) {
    elements.joinStatus.textContent = 'Please enter your name';
    elements.joinStatus.className = 'mt-4 text-center text-red-600';
    return;
  }

  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({
      type: 'join',
      name: playerName
    }));
  } else {
    elements.joinStatus.textContent = 'Not connected to server';
    elements.joinStatus.className = 'mt-4 text-center text-red-600';
  }
});

elements.playerNameInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    elements.joinBtn.click();
  }
});

elements.startBtn.addEventListener('click', () => {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({
      type: 'start_game'
    }));
  }
});

elements.reactionBtn.addEventListener('click', () => {
  if (ws && ws.readyState === WebSocket.OPEN && playerId) {
    ws.send(JSON.stringify({
      type: 'click',
      playerId: playerId
    }));
  }
});

elements.playAgainBtn.addEventListener('click', () => {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({
      type: 'reset'
    }));
  }
  resetGame();
});

// Handle click on game area (for early clicks)
elements.gameArea.addEventListener('click', (e) => {
  if (e.target !== elements.reactionBtn && isActivePlayer && gameState === 'game') {
    // Check if we're in waiting_for_button state
    const messageText = elements.gameMessage.textContent;
    if (messageText.includes('Wait for the button')) {
      if (ws && ws.readyState === WebSocket.OPEN && playerId) {
        ws.send(JSON.stringify({
          type: 'click',
          playerId: playerId
        }));
      }
    }
  }
});

// Initialize
connectWebSocket();