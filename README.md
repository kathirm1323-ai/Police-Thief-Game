# திருடன் போலீஸ் 🛡️🦹 (Thirudan Police)

**Online Multiplayer Tamil Card Game (4-10 Players)**

Thirudan Police is a modern, web-based version of the classic Indian social game "Raja Rani Chor Mantri". Built with **Socket.IO**, it allows friends to play together on their own devices from anywhere in the world.

## 🚀 Live Demo
[**Click here to Play (Netlify)**](https://policethief.netlify.app)

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
The game is optimized for deployment on **Netlify** (Frontend) and **Render** (Backend).

### 🚀 Deploy to Netlify
1.  **Sign in to [Netlify](https://app.netlify.com/start)** with your GitHub.
2.  Select your `Police-Thief-Game` repository.
3.  Netlify will automatically use the `netlify.toml` file to deploy!

### 🧠 Deploy the Brain (Render)
For the multiplayer logic, host the `server.js` on **Render**.
1.  **Sign in to [Render](https://dashboard.render.com)**.
2.  Create a **New Web Service** with this repository.
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
