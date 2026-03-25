const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));

// ===== All Available Roles =====
const ALL_ROLES = {
    king:     { emoji: '👑', name: 'Raja',      tamil: 'ராஜா',          points: 1000 },
    queen:    { emoji: '💎', name: 'Rani',      tamil: 'ராணி',          points: 500  },
    minister: { emoji: '📜', name: 'Minister',  tamil: 'மந்திரி',      points: 400  },
    police:   { emoji: '🛡️', name: 'Police',    tamil: 'போலீஸ்',       points: 0    },
    thief:    { emoji: '🦹', name: 'Thirudan',  tamil: 'திருடன்',   points: 0    },
    doctor:   { emoji: '👨‍⚕️', name: 'Doctor',    tamil: 'மருத்துவர்', points: 350  },
    teacher:  { emoji: '👨‍🏫', name: 'Teacher',   tamil: 'ஆசிரியர்',   points: 300  },
    milkman:  { emoji: '🥛', name: 'Milkman',   tamil: 'பால்காரன்',  points: 200  },
    gardener: { emoji: '🌺', name: 'Gardener',  tamil: 'தோட்டக்காரன்', points: 250  },
    farmer:   { emoji: '👨‍🌾', name: 'Farmer',    tamil: 'விவசாயி',     points: 200  }
};

// Order of roles to pick (king, police, thief always first, then fill)
const ROLE_PRIORITY = ['king', 'police', 'thief', 'queen', 'minister', 'doctor', 'teacher', 'gardener', 'milkman', 'farmer'];

// ===== Rooms =====
const rooms = {};

function generateRoomCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 5; i++) code += chars[Math.floor(Math.random() * chars.length)];
    return code;
}

function shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

function getRolesForPlayerCount(count) {
    return ROLE_PRIORITY.slice(0, count);
}

io.on('connection', (socket) => {
    console.log(`Player connected: ${socket.id}`);

    // ===== CREATE ROOM =====
    socket.on('create-room', ({ playerName, totalRounds }) => {
        const code = generateRoomCode();
        rooms[code] = {
            host: socket.id,
            players: [{ id: socket.id, name: playerName, score: 0 }],
            totalRounds: totalRounds || 10,
            currentRound: 0,
            roles: {},
            started: false,
            phase: 'lobby' // lobby | viewing | guessing | result
        };
        socket.join(code);
        socket.roomCode = code;
        socket.playerName = playerName;
        socket.emit('room-created', { code, players: rooms[code].players.map(p => p.name) });
        console.log(`Room ${code} created by ${playerName}`);
    });

    // ===== JOIN ROOM =====
    socket.on('join-room', ({ roomCode, playerName }) => {
        const code = roomCode.toUpperCase();
        const room = rooms[code];

        if (!room) {
            socket.emit('join-error', 'Room not found! Check the code.');
            return;
        }
        if (room.started) {
            socket.emit('join-error', 'Game already in progress!');
            return;
        }
        if (room.players.length >= 10) {
            socket.emit('join-error', 'Room is full (max 10 players).');
            return;
        }
        if (room.players.some(p => p.name.toLowerCase() === playerName.toLowerCase())) {
            socket.emit('join-error', 'Name already taken in this room!');
            return;
        }

        room.players.push({ id: socket.id, name: playerName, score: 0 });
        socket.join(code);
        socket.roomCode = code;
        socket.playerName = playerName;

        const playerNames = room.players.map(p => p.name);
        io.to(code).emit('player-joined', { players: playerNames, newPlayer: playerName });
        console.log(`${playerName} joined room ${code} (${room.players.length} players)`);
    });

    // ===== START GAME =====
    socket.on('start-game', () => {
        const room = rooms[socket.roomCode];
        if (!room || socket.id !== room.host) return;
        if (room.players.length < 4) {
            socket.emit('join-error', 'Need at least 4 players to start!');
            return;
        }

        room.started = true;
        room.currentRound = 0;
        room.players.forEach(p => p.score = 0);
        io.to(socket.roomCode).emit('game-started', { totalRounds: room.totalRounds });
        startNewRound(socket.roomCode);
    });

    // ===== POLICE GUESS =====
    socket.on('police-guess', ({ suspectName }) => {
        const room = rooms[socket.roomCode];
        if (!room || room.phase !== 'guessing') return;

        const policePlayer = room.players.find(p => room.roles[p.name] === 'police');
        if (!policePlayer || policePlayer.id !== socket.id) return;

        const thiefPlayer = room.players.find(p => room.roles[p.name] === 'thief');
        const correct = suspectName === thiefPlayer.name;

        // Calculate round points
        const roundPoints = {};
        room.players.forEach(p => {
            const role = room.roles[p.name];
            if (role === 'police') {
                roundPoints[p.name] = correct ? 800 : 0;
            } else if (role === 'thief') {
                roundPoints[p.name] = correct ? 0 : 800;
            } else {
                roundPoints[p.name] = ALL_ROLES[role].points;
            }
            p.score += roundPoints[p.name];
        });

        room.phase = 'result';

        // Build reveal data
        const revealData = {};
        room.players.forEach(p => {
            const roleKey = room.roles[p.name];
            revealData[p.name] = {
                role: roleKey,
                ...ALL_ROLES[roleKey],
                roundPoints: roundPoints[p.name]
            };
        });

        const scores = room.players.map(p => ({ name: p.name, score: p.score }))
                                    .sort((a, b) => b.score - a.score);

        const isLastRound = room.currentRound >= room.totalRounds;

        io.to(socket.roomCode).emit('round-result', {
            correct,
            policeName: policePlayer.name,
            thiefName: thiefPlayer.name,
            guessedName: suspectName,
            revealData,
            scores,
            isLastRound
        });
    });

    // ===== NEXT ROUND =====
    socket.on('next-round', () => {
        const room = rooms[socket.roomCode];
        if (!room || socket.id !== room.host) return;

        if (room.currentRound >= room.totalRounds) {
            // Game Over
            const scores = room.players.map(p => ({ name: p.name, score: p.score }))
                                        .sort((a, b) => b.score - a.score);
            io.to(socket.roomCode).emit('game-over', { scores });
        } else {
            startNewRound(socket.roomCode);
        }
    });

    // ===== PLAY AGAIN =====
    socket.on('play-again', () => {
        const room = rooms[socket.roomCode];
        if (!room || socket.id !== room.host) return;
        room.players.forEach(p => p.score = 0);
        room.currentRound = 0;
        room.phase = 'lobby';
        io.to(socket.roomCode).emit('game-started', { totalRounds: room.totalRounds });
        startNewRound(socket.roomCode);
    });

    // ===== DISCONNECT =====
    socket.on('disconnect', () => {
        console.log(`Player disconnected: ${socket.id}`);
        const code = socket.roomCode;
        if (!code || !rooms[code]) return;

        const room = rooms[code];
        room.players = room.players.filter(p => p.id !== socket.id);

        if (room.players.length === 0) {
            delete rooms[code];
            console.log(`Room ${code} deleted (empty)`);
            return;
        }

        // If host left, assign new host
        if (room.host === socket.id) {
            room.host = room.players[0].id;
            io.to(room.players[0].id).emit('you-are-host');
        }

        io.to(code).emit('player-left', {
            players: room.players.map(p => p.name),
            leftPlayer: socket.playerName
        });
    });
});

function startNewRound(roomCode) {
    const room = rooms[roomCode];
    if (!room) return;

    room.currentRound++;
    room.phase = 'viewing';

    // Pick roles for player count
    const roleKeys = getRolesForPlayerCount(room.players.length);
    const shuffledRoles = shuffle(roleKeys);

    room.roles = {};
    room.players.forEach((p, i) => {
        room.roles[p.name] = shuffledRoles[i];
    });

    const policePlayer = room.players.find(p => room.roles[p.name] === 'police');

    // Send each player their own role privately
    room.players.forEach(p => {
        const roleKey = room.roles[p.name];
        const role = ALL_ROLES[roleKey];
        io.to(p.id).emit('new-round', {
            round: room.currentRound,
            totalRounds: room.totalRounds,
            yourRole: roleKey,
            yourRoleData: role,
            policeName: policePlayer.name,
            isPolice: roleKey === 'police',
            players: room.players.map(pl => pl.name)
        });
    });

    // After a brief delay, move to guessing phase
    setTimeout(() => {
        room.phase = 'guessing';
        io.to(roomCode).emit('police-turn', {
            policeName: policePlayer.name,
            suspects: room.players.filter(p => room.roles[p.name] !== 'police').map(p => p.name)
        });
    }, 6000); // 6 seconds to view your role
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`\n🎮 Thirudan Police Server running!`);
    console.log(`🌐 Open in browser: http://localhost:${PORT}`);
    console.log(`📱 Share your local IP to play with friends on the same network\n`);
});
