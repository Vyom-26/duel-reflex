import { saveGameResult } from './db.js';

class GameManager {
  constructor() {
    this.reset();
  }

  reset() {
    this.players = new Map();
    this.playerOrder = [];
    this.currentPlayerIndex = 0;
    this.gameState = 'waiting';
    this.roundResults = [];
    this.buttonAppearTime = null;
    this.roundDelay = null;
    this.currentRound = 0;
    this.totalRounds = 5;
  }

  addPlayer(ws, name) {
    if (this.players.size >= 2) {
      return { success: false, message: 'Game is full' };
    }

    const playerId = `player_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const playerNumber = this.players.size + 1;

    this.players.set(playerId, {
      ws,
      name,
      playerNumber,
      totalTime: 0,
      rounds: []
    });

    this.playerOrder.push(playerId);

    return {
      success: true,
      playerId,
      playerNumber,
      message: `${name} joined as Player ${playerNumber}`
    };
  }

  removePlayer(playerId) {
    if (this.players.has(playerId)) {
      this.players.delete(playerId);
      this.playerOrder = this.playerOrder.filter(id => id !== playerId);
      
      if (this.gameState !== 'waiting') {
        this.reset();
        return { reset: true };
      }
    }
    return { reset: false };
  }

  getPlayerCount() {
    return this.players.size;
  }

  canStartGame() {
    return this.players.size === 2 && this.gameState === 'waiting';
  }

  startGame() {
    if (!this.canStartGame()) {
      return { success: false, message: 'Cannot start game' };
    }

    this.gameState = 'playing';
    this.currentRound = 1;
    this.currentPlayerIndex = 0;
    this.roundResults = [];

    return {
      success: true,
      message: 'Game started!'
    };
  }

  startRound() {
    const delay = Math.floor(Math.random() * 3000) + 2000;
    this.roundDelay = delay;
    this.buttonAppearTime = null;
    this.gameState = 'waiting_for_button';

    return {
      round: this.currentRound,
      totalRounds: this.totalRounds,
      activePlayerId: this.playerOrder[this.currentPlayerIndex],
      activePlayerName: this.players.get(this.playerOrder[this.currentPlayerIndex]).name,
      delay
    };
  }

  buttonAppeared() {
    this.buttonAppearTime = Date.now();
    this.gameState = 'button_visible';
  }

  handleClick(playerId) {
    const activePlayerId = this.playerOrder[this.currentPlayerIndex];

    if (playerId !== activePlayerId) {
      return {
        success: false,
        message: 'Not your turn!',
        type: 'wrong_player'
      };
    }

    if (this.gameState === 'waiting_for_button') {
      return {
        success: false,
        message: 'Too early! Wait for the button.',
        type: 'too_early',
        penalty: true
      };
    }

    if (this.gameState !== 'button_visible') {
      return {
        success: false,
        message: 'Invalid game state',
        type: 'invalid_state'
      };
    }

    const reactionTime = Date.now() - this.buttonAppearTime;
    const player = this.players.get(playerId);
    player.rounds.push(reactionTime);
    player.totalTime += reactionTime;

    this.roundResults.push({
      round: this.currentRound,
      playerId,
      playerName: player.name,
      playerNumber: player.playerNumber,
      reactionTime
    });

    const isRoundComplete = this.roundResults.filter(r => r.round === this.currentRound).length === 2;

    if (isRoundComplete) {
      const roundData = this.roundResults.filter(r => r.round === this.currentRound);
      const winner = roundData[0].reactionTime < roundData[1].reactionTime ? roundData[0] : roundData[1];
      
      return {
        success: true,
        reactionTime,
        roundComplete: true,
        roundWinner: winner.playerName,
        roundWinnerTime: winner.reactionTime,
        roundData,
        type: 'round_complete'
      };
    }

    this.currentPlayerIndex = (this.currentPlayerIndex + 1) % 2;

    return {
      success: true,
      reactionTime,
      roundComplete: false,
      nextPlayerId: this.playerOrder[this.currentPlayerIndex],
      nextPlayerName: this.players.get(this.playerOrder[this.currentPlayerIndex]).name,
      type: 'player_done'
    };
  }

  nextRound() {
    this.currentRound++;
    this.currentPlayerIndex = (this.currentRound - 1) % 2;

    if (this.currentRound > this.totalRounds) {
      return this.endGame();
    }

    return {
      gameOver: false,
      round: this.currentRound
    };
  }

  async endGame() {
    this.gameState = 'finished';

    const player1 = this.players.get(this.playerOrder[0]);
    const player2 = this.players.get(this.playerOrder[1]);

    const player1Avg = player1.totalTime / player1.rounds.length;
    const player2Avg = player2.totalTime / player2.rounds.length;

    let winner, winnerAvg;
    if (player1Avg < player2Avg) {
      winner = player1.name;
      winnerAvg = player1Avg;
    } else if (player2Avg < player1Avg) {
      winner = player2.name;
      winnerAvg = player2Avg;
    } else {
      winner = 'Tie';
      winnerAvg = player1Avg;
    }

    try {
      await saveGameResult(
        player1.name,
        player2.name,
        Math.round(player1Avg),
        Math.round(player2Avg),
        winner
      );
    } catch (err) {
      console.error('Failed to save game result:', err);
    }

    return {
      gameOver: true,
      winner,
      winnerAvg: Math.round(winnerAvg),
      player1: {
        name: player1.name,
        avgTime: Math.round(player1Avg),
        rounds: player1.rounds
      },
      player2: {
        name: player2.name,
        avgTime: Math.round(player2Avg),
        rounds: player2.rounds
      }
    };
  }

  getState() {
    const playerList = [];
    this.playerOrder.forEach((id, index) => {
      const player = this.players.get(id);
      playerList.push({
        id,
        name: player.name,
        playerNumber: player.playerNumber,
        isActive: index === this.currentPlayerIndex
      });
    });

    return {
      gameState: this.gameState,
      players: playerList,
      currentRound: this.currentRound,
      totalRounds: this.totalRounds,
      activePlayerId: this.playerOrder[this.currentPlayerIndex] || null
    };
  }

  broadcast(message, excludeId = null) {
    const messageStr = JSON.stringify(message);
    this.players.forEach((player, id) => {
      if (id !== excludeId && player.ws.readyState === 1) {
        player.ws.send(messageStr);
      }
    });
  }

  sendToPlayer(playerId, message) {
    const player = this.players.get(playerId);
    if (player && player.ws.readyState === 1) {
      player.ws.send(JSON.stringify(message));
    }
  }
}

export default GameManager;