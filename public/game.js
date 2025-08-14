class HandCricketGame {
    constructor() {
        this.socket = io();
        this.game = null;
        this.playerId = null;
        this.playerIndex = -1;
        this.selectedNumber = null;
        
        this.initializeEventListeners();
        this.setupSocketListeners();
    }

    initializeEventListeners() {
        // Main menu
        document.getElementById('createRoomBtn').onclick = () => this.showRoomSetup(true);
        document.getElementById('joinRoomBtn').onclick = () => this.showRoomSetup(false);
        document.getElementById('backBtn').onclick = () => this.showScreen('mainMenu');
        
        // Room setup
        document.getElementById('confirmRoomBtn').onclick = () => this.handleRoomAction();
        document.getElementById('copyCodeBtn').onclick = () => this.copyRoomCode();
        
        // Toss
        document.getElementById('headsBtn').onclick = () => this.makeToss('heads');
        document.getElementById('tailsBtn').onclick = () => this.makeToss('tails');
        document.getElementById('batBtn').onclick = () => this.chooseBatBowl('bat');
        document.getElementById('bowlBtn').onclick = () => this.chooseBatBowl('bowl');
        
        // Game controls
        document.getElementById('startRoundBtn').onclick = () => this.startRound();
        document.getElementById('nextInningsBtn').onclick = () => this.nextInnings();
        
        // Number selection
        document.querySelectorAll('.number-btn').forEach(btn => {
            btn.onclick = () => this.selectNumber(parseInt(btn.dataset.number));
        });
        
        // Game over
        document.getElementById('playAgainBtn').onclick = () => this.showScreen('mainMenu');
        document.getElementById('mainMenuBtn').onclick = () => this.showScreen('mainMenu');
    }

    setupSocketListeners() {
        this.socket.on('connect', () => {
            this.playerId = this.socket.id;
        });

        this.socket.on('roomCreated', (data) => {
            this.game = data.game;
            this.updatePlayerIndex();
            document.getElementById('roomCodeDisplay').textContent = data.roomCode;
            this.showScreen('waitingRoom');
            this.updateWaitingRoom();
        });

        this.socket.on('gameUpdate', (game) => {
            this.game = game;
            this.updatePlayerIndex();
            
            if (game.gamePhase === 'toss') {
                this.showScreen('tossScreen');
            } else if (game.gamePhase === 'playing') {
                this.showScreen('gameScreen');
                this.updateGameScreen();
            }
            
            this.updateWaitingRoom();
        });

        this.socket.on('tossWon', (data) => {
            const result = data.result;
            const winner = data.winner;
            const isWinner = winner === this.playerIndex;
            
            document.getElementById('tossResult').innerHTML = `
                <div>Result: ${result.toUpperCase()}</div>
                <div>${isWinner ? 'You won the toss!' : 'You lost the toss!'}</div>
            `;
            document.getElementById('tossResult').style.display = 'block';
            
            setTimeout(() => {
                this.game = data.game;
                if (isWinner) {
                    this.showScreen('tossChoiceScreen');
                } else {
                    document.getElementById('tossMessage').textContent = 'Waiting for toss winner to choose...';
                }
            }, 2000);
        });

        this.socket.on('countdown', (count) => {
            document.getElementById('countdownScreen').style.display = 'flex';
            document.getElementById('countdownNumber').textContent = count;
            document.getElementById('startRoundBtn').style.display = 'none';
            document.getElementById('roundResult').style.display = 'none';
        });

        this.socket.on('selectPhase', () => {
            document.getElementById('countdownScreen').style.display = 'none';
            document.getElementById('numberSelection').style.display = 'block';
            this.selectedNumber = null;
            document.querySelectorAll('.number-btn').forEach(btn => {
                btn.classList.remove('selected');
            });
            
            // Clear any existing timer
            if (this.selectionTimer) {
                clearInterval(this.selectionTimer);
            }
            
            // Start 4-second selection timer
            let timeLeft = 4;
            const statusElement = document.getElementById('selectionStatus');
            statusElement.textContent = `Select quickly! ${timeLeft}s remaining`;
            statusElement.classList.remove('urgent');
            
            this.selectionTimer = setInterval(() => {
                timeLeft--;
                if (timeLeft > 0) {
                    statusElement.textContent = `Select quickly! ${timeLeft}s remaining`;
                    if (timeLeft <= 2) {
                        statusElement.classList.add('urgent');
                    }
                } else {
                    clearInterval(this.selectionTimer);
                    this.selectionTimer = null;
                    statusElement.classList.remove('urgent');
                    if (this.selectedNumber === null) {
                        statusElement.textContent = 'Time up!';
                    }
                }
            }, 1000);
        });

        this.socket.on('roundResult', (data) => {
            this.game = data.game;
            this.showRoundResult(data.result);
            
            // Check if game should transition to innings break or game over
            setTimeout(() => {
                if (this.game.gamePhase === 'innings_break') {
                    this.showInningsBreak();
                } else if (this.game.gamePhase === 'finished') {
                    // Game over will be handled by gameFinished event
                } else {
                    this.updateGameScreen();
                }
            }, 3000); // Wait for result display to finish
        });

        this.socket.on('inningsBreak', (game) => {
            this.game = game;
            this.showInningsBreak();
        });

        this.socket.on('gameFinished', (data) => {
            this.showGameOver(data);
        });

        // Remove selectionTimeout handler as it's now handled server-side

        this.socket.on('error', (message) => {
            alert(message);
        });

        this.socket.on('playerDisconnected', () => {
            alert('Other player disconnected');
            this.showScreen('mainMenu');
        });
    }

    showScreen(screenId) {
        document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
        document.getElementById(screenId).classList.add('active');
    }

    showRoomSetup(isCreate) {
        const title = isCreate ? 'Create Room' : 'Join Room';
        const buttonText = isCreate ? 'Create' : 'Join';
        
        document.getElementById('roomTitle').textContent = title;
        document.getElementById('confirmRoomBtn').textContent = buttonText;
        document.getElementById('roomCodeInput').style.display = isCreate ? 'none' : 'block';
        
        this.showScreen('roomSetup');
    }

    handleRoomAction() {
        const playerName = document.getElementById('playerName').value.trim();
        if (!playerName) {
            alert('Please enter your name');
            return;
        }

        const isCreate = document.getElementById('confirmRoomBtn').textContent === 'Create';
        
        if (isCreate) {
            this.socket.emit('createRoom', playerName);
        } else {
            const roomCode = document.getElementById('roomCodeInput').value.trim().toUpperCase();
            if (!roomCode) {
                alert('Please enter room code');
                return;
            }
            this.socket.emit('joinRoom', { roomCode, playerName });
        }
    }

    copyRoomCode() {
        const roomCode = document.getElementById('roomCodeDisplay').textContent;
        if (navigator.clipboard) {
            navigator.clipboard.writeText(roomCode);
        } else {
            const textArea = document.createElement('textarea');
            textArea.value = roomCode;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
        }
        
        const btn = document.getElementById('copyCodeBtn');
        const originalText = btn.textContent;
        btn.textContent = '✓ Copied!';
        setTimeout(() => {
            btn.textContent = originalText;
        }, 2000);
    }

    updatePlayerIndex() {
        if (this.game && this.playerId) {
            this.playerIndex = this.game.players.findIndex(p => p.id === this.playerId);
        }
    }

    updateWaitingRoom() {
        if (!this.game) return;
        
        const playersList = document.getElementById('playersList');
        playersList.innerHTML = this.game.players.map(p => 
            `<div class="player-item ${p.id === this.playerId ? 'player-you' : ''}">
                <span>${p.id === this.playerId ? '👤' : '👥'}</span>
                ${p.name} ${p.id === this.playerId ? '(You)' : ''}
            </div>`
        ).join('');
        
        document.getElementById('waitingMessage').style.display = 
            this.game.players.length < 2 ? 'block' : 'none';
    }

    makeToss(choice) {
        this.socket.emit('toss', { choice });
        document.querySelector('.toss-buttons').style.display = 'none';
        document.getElementById('tossMessage').textContent = 'Flipping coin...';
    }

    chooseBatBowl(choice) {
        this.socket.emit('chooseBatBowl', { choice });
        document.getElementById('choiceMessage').textContent = `You chose to ${choice} first!`;
        document.querySelector('#tossChoiceScreen .toss-buttons').style.display = 'none';
    }

    updateGameScreen() {
        if (!this.game) return;
        
        // Update scoreboard
        document.getElementById('team1Name').textContent = this.game.players[0]?.name || 'Player 1';
        document.getElementById('team2Name').textContent = this.game.players[1]?.name || 'Player 2';
        document.getElementById('team1Score').textContent = this.game.scores[0];
        document.getElementById('team2Score').textContent = this.game.scores[1];
        
        // Update current player status
        const isBatting = this.playerIndex === this.game.currentBatsman;
        const currentPlayerText = isBatting ? 'Your turn to bat' : 'Your turn to bowl';
        document.getElementById('currentPlayer').textContent = currentPlayerText;
        
        // Update game status with target info for second innings
        let statusText = 'Ready for next round!';
        if (this.game.currentBatsman === 1 && this.game.scores[0] > 0) {
            const target = this.game.scores[0] + 1;
            const needed = target - this.game.scores[1];
            statusText = `Target: ${target} | Need: ${needed} runs to win`;
        }
        document.getElementById('gameStatus').textContent = statusText;
        
        // Reset UI elements
        document.getElementById('numberSelection').style.display = 'none';
        document.getElementById('countdownScreen').style.display = 'none';
        
        // Show start button only if game is in playing state and no other UI is showing
        const isResultShowing = document.getElementById('roundResult').style.display === 'block';
        if (this.game.gamePhase === 'playing' && !isResultShowing) {
            document.getElementById('startRoundBtn').style.display = 'block';
        } else {
            document.getElementById('startRoundBtn').style.display = 'none';
        }
    }

    startRound() {
        this.socket.emit('startRound');
    }

    selectNumber(number) {
        if (this.selectedNumber !== null) return;
        
        this.selectedNumber = number;
        document.querySelector(`[data-number="${number}"]`).classList.add('selected');
        const statusElement = document.getElementById('selectionStatus');
        statusElement.textContent = 'Number selected! Waiting for other player...';
        statusElement.classList.remove('urgent');
        
        this.socket.emit('selectNumber', { number });
    }

    showRoundResult(result) {
        document.getElementById('numberSelection').style.display = 'none';
        document.getElementById('roundResult').style.display = 'block';
        document.getElementById('startRoundBtn').style.display = 'none';
        
        document.getElementById('batsmanChoice').textContent = result.batsmanChoice;
        document.getElementById('bowlerChoice').textContent = result.bowlerChoice;
        
        const resultMessage = document.getElementById('resultMessage');
        if (result.isOut) {
            resultMessage.textContent = 'OUT! Same numbers selected!';
            resultMessage.className = 'result-message out';
        } else if (result.targetAchieved) {
            resultMessage.textContent = `${result.runs} runs! TARGET ACHIEVED! 🎉`;
            resultMessage.className = 'result-message runs';
        } else {
            resultMessage.textContent = `${result.runs} runs scored!`;
            resultMessage.className = 'result-message runs';
        }
        
        // Don't auto-hide if transitioning to innings break or game over
        if (!result.isOut && !result.targetAchieved) {
            setTimeout(() => {
                document.getElementById('roundResult').style.display = 'none';
                if (this.game && this.game.gamePhase === 'playing') {
                    document.getElementById('startRoundBtn').style.display = 'block';
                }
            }, 3000);
        }
    }

    showInningsBreak() {
        document.getElementById('inningsMessage').textContent = 
            `${this.game.players[0].name} scored ${this.game.scores[0]} runs`;
        document.getElementById('target').textContent = this.game.scores[0] + 1;
        this.showScreen('inningsBreak');
    }

    nextInnings() {
        this.socket.emit('nextInnings');
    }

    showGameOver(data) {
        const resultDiv = document.getElementById('gameResult');
        const scoresDiv = document.getElementById('finalScores');
        const summary = data.matchSummary;
        
        // Show winner message
        let message = '';
        if (summary.winner === -1) {
            message = "🤝 It's a tie!";
        } else if (summary.winner === this.playerIndex) {
            message = '🎉 You won!';
        } else {
            message = '😔 You lost!';
        }
        
        resultDiv.innerHTML = `
            <div class="winner-message">${message}</div>
            <div class="match-result">${summary.result}</div>
        `;
        
        // Show detailed match summary
        scoresDiv.innerHTML = `
            <div class="match-summary">
                <h3>📊 Match Summary</h3>
                <div class="innings-summary">
                    <div class="innings">
                        <strong>First Innings</strong><br>
                        ${summary.firstInnings.batsman}: ${summary.firstInnings.score} runs
                    </div>
                    <div class="innings">
                        <strong>Second Innings</strong><br>
                        ${summary.secondInnings.batsman}: ${summary.secondInnings.score} runs<br>
                        <small>Target: ${summary.secondInnings.target}</small>
                    </div>
                </div>
            </div>
        `;
        
        this.showScreen('gameOverScreen');
    }
}

// Initialize game when page loads
document.addEventListener('DOMContentLoaded', () => {
    new HandCricketGame();
});