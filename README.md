# GOOGLY - Hand Cricket Game

A real-time multiplayer hand cricket game where players select numbers simultaneously. If both players choose the same number, the batsman is out!

## How to Play

### Game Rules
1. **Two players** join a room using a room code
2. **Coin toss** determines who bats first
3. **Simultaneous selection**: Both players select numbers 1-10 at the same time
4. **Scoring**: If numbers are different, batsman gets runs equal to their number
5. **Out condition**: If both players select the same number, batsman is out
6. **Innings**: After first player is out, second player bats
7. **Winner**: Player with higher score wins

### Game Flow
1. **Create/Join Room** - Share room code with friend
2. **Coin Toss** - Winner chooses to bat first
3. **Round Start** - 3-second countdown begins
4. **Number Selection** - Both players pick 1-10 simultaneously
5. **Result** - Show both choices and outcome
6. **Continue** - Repeat until batsman is out
7. **Switch Innings** - Other player bats
8. **Game Over** - Compare final scores

## Features

### 🎯 Real-time Synchronization
- **Simultaneous selection** - Both players choose at exactly the same time
- **3-second countdown** - Builds excitement and ensures sync
- **Instant results** - See both choices immediately
- **Live scoring** - Scores update in real-time

### 📱 Simple Interface
- **Number grid** - Easy 1-10 selection
- **Clean scoreboard** - Current scores always visible
- **Visual feedback** - Selected numbers highlighted
- **Mobile optimized** - Works perfectly on phones

### 🏏 Cricket Experience
- **Batting/Bowling roles** - Clear player roles
- **Innings system** - Two innings like real cricket
- **Target chasing** - Second batsman knows target
- **Win conditions** - Highest score wins

## Quick Start

### Installation
```bash
npm install
```

### Run Game
```bash
npm start
```

Open `http://localhost:3000` in two browser windows to test multiplayer.

## Technical Features

### Backend (Node.js + Socket.IO)
- **Room management** - Unique room codes for games
- **Real-time sync** - Countdown and selection synchronization
- **Game state** - Tracks scores, innings, and player roles
- **Disconnect handling** - Graceful player disconnection

### Frontend (Vanilla JS)
- **Responsive design** - Works on all devices
- **Smooth animations** - Countdown and result animations
- **Touch friendly** - Large buttons for mobile
- **Real-time updates** - Instant UI updates via WebSocket

### Game Logic
- **Simultaneous input** - Prevents cheating with timing
- **State validation** - Server validates all moves
- **Fair gameplay** - Equal opportunity for both players
- **Clear feedback** - Always shows what happened

## Browser Support
- Chrome/Edge 80+
- Firefox 75+
- Safari 13+
- Mobile browsers

Perfect for quick games with friends - no complex rules, just pick numbers and have fun!