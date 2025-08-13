const express = require('express');
const http = require('http');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: { origin: "*" },
  pingTimeout: 60000,
  pingInterval: 25000
});


// Serve landing page as default
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/public/landingpage.html');
});

// Serve game at /game route
app.get('/game', (req, res) => {
  res.sendFile(__dirname + '/public/game.html');
});

app.use(express.static('public'));

const rooms = new Map();

class HandCricketGame {
  constructor() {
    this.players = [];
    this.currentBatsman = 0;
    this.scores = [0, 0];
    this.gamePhase = 'waiting'; // waiting, toss, playing, finished
    this.currentRound = { selections: {}, countdown: 0 };
    this.countdownTimer = null;
  }

  addPlayer(playerId, playerName) {
    if (this.players.length < 2) {
      this.players.push({ id: playerId, name: playerName });
      return true;
    }
    return false;
  }

  removePlayer(playerId) {
    this.players = this.players.filter(p => p.id !== playerId);
    
    // Clean up timers if no players left
    if (this.players.length === 0) {
      if (this.countdownTimer) {
        clearInterval(this.countdownTimer);
        this.countdownTimer = null;
      }
      if (this.selectionTimeout) {
        clearTimeout(this.selectionTimeout);
        this.selectionTimeout = null;
      }
    }
  }

  startCountdown(io, roomCode) {
    // Clear any existing timers
    if (this.countdownTimer) {
      clearInterval(this.countdownTimer);
    }
    if (this.selectionTimeout) {
      clearTimeout(this.selectionTimeout);
    }
    
    this.currentRound = { selections: {}, countdown: 3 };
    this.gamePhase = 'countdown';
    
    this.countdownTimer = setInterval(() => {
      io.to(roomCode).emit('countdown', this.currentRound.countdown);
      this.currentRound.countdown--;
      
      if (this.currentRound.countdown < 0) {
        clearInterval(this.countdownTimer);
        this.countdownTimer = null;
        this.gamePhase = 'selecting';
        io.to(roomCode).emit('selectPhase');
        
        // Auto-timeout after 4 seconds if no selection
        this.selectionTimeout = setTimeout(() => {
          if (this.gamePhase === 'selecting') {
            // Fill missing selections and process
            const playerIds = this.players.map(p => p.id);
            playerIds.forEach(playerId => {
              if (!this.currentRound.selections[playerId]) {
                this.currentRound.selections[playerId] = 0;
              }
            });
            
            const result = this.processRound();
            if (result) {
              io.to(roomCode).emit('roundResult', { result, game: this, timeout: true });
              
              if (this.gamePhase === 'finished') {
                const matchSummary = this.getMatchSummary();
                io.to(roomCode).emit('gameFinished', { matchSummary, game: this });
              } else if (this.gamePhase === 'innings_break') {
                io.to(roomCode).emit('inningsBreak', this);
              }
            }
          }
          this.selectionTimeout = null;
        }, 4000);
      }
    }, 1000);
  }

  makeSelection(playerId, number) {
    if (this.gamePhase !== 'selecting') return false;
    
    this.currentRound.selections[playerId] = number;
    
    // Don't process immediately - wait for timeout to ensure fairness
    return null;
  }

  processRound() {
    const playerIds = this.players.map(p => p.id);
    const batsmanId = playerIds[this.currentBatsman];
    const bowlerId = playerIds[1 - this.currentBatsman];
    
    const batsmanChoice = this.currentRound.selections[batsmanId] || 0;
    const bowlerChoice = this.currentRound.selections[bowlerId] || 0;
    
    // If bowler didn't select, batsman gets their runs
    let runs = batsmanChoice;
    let isOut = false;
    
    // Only out if both selected same number (and bowler actually selected)
    if (bowlerChoice > 0 && batsmanChoice === bowlerChoice) {
      isOut = true;
      runs = 0;
    }
    
    const result = {
      batsmanChoice,
      bowlerChoice,
      isOut,
      runs
    };

    if (result.isOut) {
      if (this.currentBatsman === 0) {
        // First innings over, switch batsman
        this.currentBatsman = 1;
        this.gamePhase = 'innings_break';
      } else {
        // Second innings over, game finished
        this.gamePhase = 'finished';
      }
    } else {
      this.scores[this.currentBatsman] += result.runs;
      
      // Check if second innings target is achieved (need to beat first innings score)
      if (this.currentBatsman === 1 && this.scores[1] > this.scores[0]) {
        this.gamePhase = 'finished';
        result.targetAchieved = true;
      } else {
        // Continue playing - batsman keeps batting until out
        this.gamePhase = 'playing';
      }
    }

    return result;
  }

  getWinner() {
    if (this.scores[0] > this.scores[1]) return 0;
    if (this.scores[1] > this.scores[0]) return 1;
    return -1; // tie
  }

  getMatchSummary() {
    const winner = this.getWinner();
    const target = this.scores[0] + 1;
    const margin = Math.abs(this.scores[0] - this.scores[1]);
    
    // Determine who batted first based on tossWinner choice
    const firstBatsman = this.players[0];
    const secondBatsman = this.players[1];
    
    let summary = {
      winner,
      firstInnings: {
        batsman: firstBatsman.name,
        score: this.scores[0]
      },
      secondInnings: {
        batsman: secondBatsman.name,
        score: this.scores[1],
        target
      },
      result: ''
    };
    
    if (winner === -1) {
      summary.result = 'Match Tied!';
    } else if (winner === 0) {
      summary.result = `${this.players[0].name} won by ${margin} runs`;
    } else {
      summary.result = `${this.players[1].name} won by chasing the target`;
    }
    
    return summary;
  }
}

io.on('connection', (socket) => {

  socket.on('createRoom', (playerName) => {
    const roomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    const game = new HandCricketGame();
    game.addPlayer(socket.id, playerName);
    
    rooms.set(roomCode, game);
    socket.join(roomCode);
    socket.roomCode = roomCode;
    
    socket.emit('roomCreated', { roomCode, game });
  });

  socket.on('joinRoom', ({ roomCode, playerName }) => {
    const game = rooms.get(roomCode);
    if (!game) {
      socket.emit('error', 'Room not found');
      return;
    }

    if (!game.addPlayer(socket.id, playerName)) {
      socket.emit('error', 'Room is full');
      return;
    }

    socket.join(roomCode);
    socket.roomCode = roomCode;
    
    if (game.players.length === 2) {
      game.gamePhase = 'toss';
    }
    
    io.to(roomCode).emit('gameUpdate', game);
  });

  socket.on('toss', ({ choice }) => {
    const game = rooms.get(socket.roomCode);
    if (!game || game.gamePhase !== 'toss') return;

    const result = Math.random() < 0.5 ? 'heads' : 'tails';
    const playerIndex = game.players.findIndex(p => p.id === socket.id);
    
    if (choice === result) {
      game.tossWinner = playerIndex;
      game.gamePhase = 'toss_choice';
      io.to(socket.roomCode).emit('tossWon', { result, winner: playerIndex, game });
    } else {
      game.tossWinner = 1 - playerIndex;
      game.gamePhase = 'toss_choice';
      io.to(socket.roomCode).emit('tossWon', { result, winner: 1 - playerIndex, game });
    }
  });

  socket.on('chooseBatBowl', ({ choice }) => {
    const game = rooms.get(socket.roomCode);
    if (!game || game.gamePhase !== 'toss_choice') return;

    const playerIndex = game.players.findIndex(p => p.id === socket.id);
    if (playerIndex !== game.tossWinner) return;

    if (choice === 'bat') {
      game.currentBatsman = playerIndex;
    } else {
      game.currentBatsman = 1 - playerIndex;
    }
    
    game.gamePhase = 'playing';
    io.to(socket.roomCode).emit('gameUpdate', game);
  });

  socket.on('startRound', () => {
    const game = rooms.get(socket.roomCode);
    if (!game || game.gamePhase !== 'playing') return;
    
    game.startCountdown(io, socket.roomCode);
  });

  socket.on('selectNumber', ({ number }) => {
    const game = rooms.get(socket.roomCode);
    if (!game) return;

    game.makeSelection(socket.id, number);
    // Round will be processed automatically after 4-second timeout
  });

  socket.on('nextInnings', () => {
    const game = rooms.get(socket.roomCode);
    if (!game || game.gamePhase !== 'innings_break') return;
    
    game.gamePhase = 'playing';
    io.to(socket.roomCode).emit('gameUpdate', game);
  });



  socket.on('disconnect', () => {
    if (socket.roomCode) {
      const game = rooms.get(socket.roomCode);
      if (game) {
        game.removePlayer(socket.id);
        if (game.players.length === 0) {
          rooms.delete(socket.roomCode);
        } else {
          io.to(socket.roomCode).emit('playerDisconnected', game);
        }
      }
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT);