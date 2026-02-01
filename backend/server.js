import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import GameManager from './gameManager.js';
import { getRecentResults } from './db.js';

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });

const PORT = process.env.PORT || 3000;

const corsOptions = {
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['*'],
  credentials: true,
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));
app.use(express.json());

const gameManager = new GameManager();

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', players: gameManager.getPlayerCount() });
});

app.get('/api/results', async (req, res) => {
  try {
    const results = await getRecentResults(10);
    res.json(results);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch results' });
  }
});

wss.on('connection', (ws) => {
  let playerId = null;

  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data.toString());

      switch (message.type) {
        case 'join': {
          const result = gameManager.addPlayer(ws, message.name);
          
          if (result.success) {
            playerId = result.playerId;
            
            ws.send(JSON.stringify({
              type: 'joined',
              playerId: result.playerId,
              playerNumber: result.playerNumber,
              message: result.message
            }));

            gameManager.broadcast({
              type: 'player_joined',
              state: gameManager.getState()
            });

            if (gameManager.canStartGame()) {
              gameManager.broadcast({
                type: 'ready_to_start',
                message: 'Both players joined! Ready to start.'
              });
            }
          } else {
            ws.send(JSON.stringify({
              type: 'error',
              message: result.message
            }));
          }
          break;
        }

        case 'start_game': {
          const result = gameManager.startGame();
          
          if (result.success) {
            gameManager.broadcast({
              type: 'game_started',
              message: result.message,
              state: gameManager.getState()
            });

            setTimeout(() => {
              const roundInfo = gameManager.startRound();
              
              gameManager.broadcast({
                type: 'round_starting',
                ...roundInfo
              });

              setTimeout(() => {
                gameManager.buttonAppeared();
                gameManager.broadcast({
                  type: 'button_appear',
                  activePlayerId: roundInfo.activePlayerId
                });
              }, roundInfo.delay);
            }, 1000);
          }
          break;
        }

        case 'click': {
          const result = gameManager.handleClick(message.playerId);

          if (result.type === 'wrong_player') {
            ws.send(JSON.stringify({
              type: 'wrong_player',
              message: result.message
            }));
            break;
          }

          if (result.type === 'too_early') {
            gameManager.broadcast({
              type: 'too_early',
              playerId: message.playerId,
              message: result.message
            });

            setTimeout(() => {
              const roundInfo = gameManager.startRound();
              
              gameManager.broadcast({
                type: 'round_starting',
                ...roundInfo
              });

              setTimeout(() => {
                gameManager.buttonAppeared();
                gameManager.broadcast({
                  type: 'button_appear',
                  activePlayerId: roundInfo.activePlayerId
                });
              }, roundInfo.delay);
            }, 2000);
            break;
          }

          if (result.success) {
            if (result.roundComplete) {
              gameManager.broadcast({
                type: 'round_result',
                ...result,
                state: gameManager.getState()
              });

              setTimeout(() => {
                const nextResult = gameManager.nextRound();
                
                if (nextResult.gameOver) {
                  gameManager.broadcast({
                    type: 'game_over',
                    ...nextResult
                  });
                } else {
                  const roundInfo = gameManager.startRound();
                  
                  gameManager.broadcast({
                    type: 'round_starting',
                    ...roundInfo
                  });

                  setTimeout(() => {
                    gameManager.buttonAppeared();
                    gameManager.broadcast({
                      type: 'button_appear',
                      activePlayerId: roundInfo.activePlayerId
                    });
                  }, roundInfo.delay);
                }
              }, 3000);
            } else {
              gameManager.broadcast({
                type: 'player_clicked',
                playerId: message.playerId,
                reactionTime: result.reactionTime,
                nextPlayerId: result.nextPlayerId,
                nextPlayerName: result.nextPlayerName
              });

              setTimeout(() => {
                const roundInfo = gameManager.startRound();
                
                gameManager.broadcast({
                  type: 'round_starting',
                  ...roundInfo
                });

                setTimeout(() => {
                  gameManager.buttonAppeared();
                  gameManager.broadcast({
                    type: 'button_appear',
                    activePlayerId: roundInfo.activePlayerId
                  });
                }, roundInfo.delay);
              }, 1500);
            }
          }
          break;
        }

        case 'reset': {
          gameManager.reset();
          gameManager.broadcast({
            type: 'game_reset',
            message: 'Game has been reset'
          });
          break;
        }

        case 'get_state': {
          ws.send(JSON.stringify({
            type: 'state_update',
            state: gameManager.getState()
          }));
          break;
        }
      }
    } catch (err) {
      console.error('Error processing message:', err);
      ws.send(JSON.stringify({
        type: 'error',
        message: 'Invalid message format'
      }));
    }
  });

  ws.on('close', () => {
    if (playerId) {
      const result = gameManager.removePlayer(playerId);
      
      if (result.reset) {
        gameManager.broadcast({
          type: 'player_left',
          message: 'A player left. Game has been reset.',
          state: gameManager.getState()
        });
      } else {
        gameManager.broadcast({
          type: 'player_left',
          state: gameManager.getState()
        });
      }
    }
  });

  ws.on('error', (err) => {
    console.error('WebSocket error:', err);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on http://0.0.0.0:${PORT}`);
});