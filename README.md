# திருடன் போலீஸ் 🛡️🦹 (Thirudan Police)

**Online Multiplayer Tamil Card Game (4-10 Players)**

Thirudan Police is a modern, web-based version of the classic Indian social game "Raja Rani Chor Mantri". Built with **Socket.IO**, it allows friends to play together on their own devices from anywhere in the world.

## 🚀 Live Demo
[**Click here to Play!**](https://police-thief-game-qilrj8rj9-kathir-ms-projects.vercel.app)
---

## ✨ Features
- **🌐 Online Multiplayer**: Play with 4-10 friends on different devices.
- **📱 PWA Support**: Install it on your phone like a native app.
- **🎭 10 Unique Roles**: Raja, Rani, Minister, Police, Thief, and more!
- **🎨 Premium UI**: Dark theme with glassmorphism and character-specific animations.
- **🏆 Global Scoreboard**: Real-time scoring and winner celebrations.

## 📜 How to Play
1. **Create a Room**: One player creates a room and gets a 5-letter code.
2. **Join**: Friends enter the code to join.
3. **Secret Roles**: Each player gets a secret role on their screen.
4. **The Guess**: The Police must identify the Thief (Thirudan) among the players.
5. **Score**: Points are awarded based on roles and the Police's success!

### 💰 Points System
- **Raja (King)**: 1000 pts
- **Rani (Queen)**: 500 pts
- **Minister**: 400 pts
- **Police**: 800 pts (Correct guess) / 0 pts (Wrong)
- **Thief**: 800 pts (Escaped) / 0 pts (Caught)
- *Includes additional roles: Doctor, Teacher, Gardener, Milkman, Farmer.*

## 💻 Installation & Running Locally

### 1. Requirements
Ensure you have [Node.js](https://nodejs.org/) installed.

### 2. Setup
```bash
git clone https://github.com/kathirm1323-ai/Police-Thief-Game.git
cd Police-Thief-Game
npm install
```

### 3. Run
```bash
# Start the server
node server.js

# For Windows Desktop App (Electron)
npm run electron
```

## 🌐 Deployment
You can deploy this game to **Vercel** or **Render**.

### 🔼 Deploy to Vercel (Recommended for Frontend)
1.  **Sign in to [Vercel](https://vercel.com)** with your GitHub.
2.  Import the `Police-Thief-Game` repository.
3.  Vercel will automatically detect the settings and deploy it!

> **Note**: For the multiplayer (Socket.IO) to work perfectly on Vercel, you might need to connect it to a separate backend or use a service like Railway/Render for the server part.

### 🚀 Deploy to Render (Recommended for Backend/Server)
1.  **Sign in to [Render](https://render.com)** with your GitHub.
2.  Connect this repo as a **Web Service**.
3.  **Build Command**: `npm install`
4.  **Start Command**: `node server.js`

---

## 🛠️ Built With
- **Frontend**: HTML5, CSS3 (Vanilla), JavaScript
- **Backend**: Node.js, Express
- **Real-time**: Socket.IO
- **Desktop**: Electron

---
*Created with ❤️ for the classic game fans!*
