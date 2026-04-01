// ===== PeerJS Connection =====
let peer = new Peer(); // Initial anonymous peer
let conn = null;
let connections = {};
let myPlayerId = null;

let myName = '';
let roomCode = '';
let isHost = false;
let selectedSuspect = null;
let totalRounds = 10;
let players = [];
let scores = {};
let roles = {};
let currentRound = 0;
let phase = 'lobby';

function generateRoomCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 5; i++) code += chars[Math.floor(Math.random() * chars.length)];
    return code;
}


const $ = id => document.getElementById(id);
const screens = {
    welcome: $('screen-welcome'),
    create:  $('screen-create'),
    join:    $('screen-join'),
    lobby:   $('screen-lobby'),
    role:    $('screen-role'),
    guess:   $('screen-guess'),
    result:  $('screen-result'),
    final:   $('screen-final')
};

function showScreen(name) {
    Object.values(screens).forEach(s => s.classList.remove('active'));
    screens[name].classList.add('active');
}

function showToast(msg) {
    const toast = $('toast');
    toast.textContent = msg;
    toast.classList.remove('hidden');
    setTimeout(() => toast.classList.add('hidden'), 3000);
}

// ===== Particles =====
function createParticles() {
    const container = $('particles');
    container.innerHTML = '';
    const count = Math.min(30, Math.floor(window.innerWidth / 40));
    for (let i = 0; i < count; i++) {
        const p = document.createElement('div');
        p.className = 'particle';
        p.style.left = Math.random() * 100 + '%';
        p.style.animationDuration = (12 + Math.random() * 20) + 's';
        p.style.animationDelay = (Math.random() * 15) + 's';
        p.style.width = p.style.height = (2 + Math.random() * 4) + 'px';
        const colors = ['#7b61ff', '#f72585', '#ffd700', '#4cc9f0', '#c77dff'];
        p.style.background = colors[Math.floor(Math.random() * colors.length)];
        container.appendChild(p);
    }
}
createParticles();
window.addEventListener('resize', createParticles);

// ===== Peer Setup =====
function setupPeerListeners(p) {
    p.on('open', (id) => {
        myPlayerId = id;
        console.log('My Peer ID: ' + id);
    });

    p.on('error', (err) => {
        console.error('Peer error:', err);
        if (err.type === 'peer-unavailable') {
            showToast('Room not found! Check the code.');
        } else if (err.type === 'unavailable-id') {
            if (isHost) tryCreateHostRoom(); // Retry with new code if taken
        } else {
            showToast('Connection error. Please try again.');
        }
    });

    p.on('connection', (c) => {
        c.on('open', () => {
            c.on('data', (payload) => handleHostEvent(payload.type, payload.data, c));
            c.on('close', () => handleHostPlayerDisconnect(c));
        });
    });
}
setupPeerListeners(peer);

// Client listener
function setupClientConnection(c) {
    c.on('data', (payload) => {
        handleClientEvent(payload.type, payload.data);
    });
    c.on('close', () => {
        showToast('Host disconnected.');
        setTimeout(() => window.location.reload(), 3000);
    });
}

// ===== WELCOME SCREEN =====
$('btn-create').addEventListener('click', () => showScreen('create'));
$('btn-join').addEventListener('click', () => showScreen('join'));
$('btn-rules').addEventListener('click', () => $('modal-rules').classList.add('active'));
$('btn-close-rules').addEventListener('click', () => $('modal-rules').classList.remove('active'));
$('modal-rules').addEventListener('click', e => { if (e.target === $('modal-rules')) $('modal-rules').classList.remove('active'); });

// ===== ROUND BUTTONS =====
document.querySelectorAll('.round-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        btn.closest('.rounds-options').querySelectorAll('.round-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        totalRounds = parseInt(btn.dataset.rounds);
    });
});

// ===== CREATE ROOM =====
$('btn-back-create').addEventListener('click', () => showScreen('welcome'));
$('btn-create-room').addEventListener('click', () => {
    const name = $('create-name').value.trim();
    if (!name) { $('create-name').focus(); return; }
    myName = name;
    isHost = true;
    tryCreateHostRoom();
});

function tryCreateHostRoom() {
    const code = generateRoomCode();
    if (peer) peer.destroy();
    peer = new Peer(code);
    setupPeerListeners(peer);
    peer.on('open', (id) => {
        roomCode = id;
        handleHostEvent('create-room', { playerName: myName, totalRounds });
    });
}

// ===== JOIN ROOM =====
$('btn-back-join').addEventListener('click', () => showScreen('welcome'));
$('btn-join-room').addEventListener('click', () => {
    const name = $('join-name').value.trim();
    const code = $('join-code').value.trim().toUpperCase();
    if (!name) { $('join-name').focus(); return; }
    if (!code) { $('join-code').focus(); return; }
    
    myName = name;
    roomCode = code;
    
    conn = peer.connect(code);
    conn.on('open', () => {
        setupClientConnection(conn);
        conn.send({ type: 'join-room', data: { playerName: name } });
    });
});

// ===== LOBBY =====
$('btn-copy-code').addEventListener('click', () => {
    navigator.clipboard.writeText(roomCode).then(() => showToast('Room code copied!'));
});

$('btn-start-game').addEventListener('click', () => {
    if (isHost) handleHostEvent('start-game');
});

// ===== GUESS =====
$('btn-arrest').addEventListener('click', () => {
    if (!selectedSuspect) return;
    $('btn-arrest').disabled = true;
    if (isHost) {
        handleHostEvent('police-guess', { suspectName: selectedSuspect });
    } else {
        conn.send({ type: 'police-guess', data: { suspectName: selectedSuspect } });
    }
});

// ===== NEXT ROUND =====
$('btn-next-round').addEventListener('click', () => {
    if (isHost) handleHostEvent('next-round');
});

// ===== PLAY AGAIN & NEW GAME =====
$('btn-play-again').addEventListener('click', () => {
    clearConfetti();
    if (isHost) handleHostEvent('play-again');
});
$('btn-new-game').addEventListener('click', () => {
    clearConfetti();
    window.location.reload();
});

// ========================================
//         P2P EVENT HANDLERS
// ========================================

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

const ROLE_PRIORITY = ['king', 'police', 'thief', 'queen', 'minister', 'doctor', 'teacher', 'gardener', 'milkman', 'farmer'];

function shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

// --- HOST LOGIC (Central Brain) ---
function handleHostEvent(type, data, clientConn) {
    if (!isHost) return;

    switch (type) {
        case 'create-room':
            players = [{ name: data.playerName, conn: null, id: 'host' }];
            scores = { [data.playerName]: 0 };
            totalRounds = data.totalRounds;
            currentRound = 0;
            phase = 'lobby';
            handleClientEvent('room-created', { code: roomCode, players: [data.playerName] });
            break;

        case 'join-room':
            if (phase !== 'lobby') {
                clientConn.send({ type: 'join-error', data: 'Game already in progress!' });
                return;
            }
            if (players.length >= 10) {
                clientConn.send({ type: 'join-error', data: 'Room is full!' });
                return;
            }
            if (players.some(p => p.name.toLowerCase() === data.playerName.toLowerCase())) {
                clientConn.send({ type: 'join-error', data: 'Name already taken!' });
                return;
            }

            // Register new player
            players.push({ name: data.playerName, conn: clientConn, id: clientConn.peer });
            connections[clientConn.peer] = clientConn;
            scores[data.playerName] = 0;
            
            const playerNames = players.map(p => p.name);
            broadcastToAll('player-joined', { players: playerNames, newPlayer: data.playerName });
            break;

        case 'start-game':
            if (players.length < 4) {
                showToast('Need at least 4 players!');
                return;
            }
            phase = 'playing';
            currentRound = 0;
            players.forEach(p => scores[p.name] = 0);
            broadcastToAll('game-started', { totalRounds });
            startNextRoundP2P();
            break;

        case 'police-guess':
            const policePlayer = players.find(p => roles[p.name] === 'police');
            const thiefPlayer = players.find(p => roles[p.name] === 'thief');
            const correct = data.suspectName === thiefPlayer.name;

            const roundPoints = {};
            players.forEach(p => {
                const role = roles[p.name];
                if (role === 'police') roundPoints[p.name] = correct ? 800 : 0;
                else if (role === 'thief') roundPoints[p.name] = correct ? 0 : 800;
                else roundPoints[p.name] = ALL_ROLES[role].points;
                scores[p.name] += roundPoints[p.name];
            });

            const revealData = {};
            players.forEach(p => {
                const r = roles[p.name];
                revealData[p.name] = { 
                    role: r, 
                    ...ALL_ROLES[r], 
                    roundPoints: roundPoints[p.name] 
                };
            });

            const sortedScores = players.map(p => ({ name: p.name, score: scores[p.name] }))
                                        .sort((a, b) => b.score - a.score);
            
            phase = 'result';
            broadcastToAll('round-result', {
                correct,
                policeName: policePlayer.name,
                thiefName: thiefPlayer.name,
                guessedName: data.suspectName,
                revealData,
                scores: sortedScores,
                isLastRound: currentRound >= totalRounds
            });
            break;

        case 'next-round':
            if (currentRound >= totalRounds) {
                const finalScores = players.map(p => ({ name: p.name, score: scores[p.name] }))
                                            .sort((a, b) => b.score - a.score);
                broadcastToAll('game-over', { scores: finalScores });
            } else {
                startNextRoundP2P();
            }
            break;

        case 'play-again':
            players.forEach(p => scores[p.name] = 0);
            currentRound = 0;
            broadcastToAll('game-started', { totalRounds });
            startNextRoundP2P();
            break;
    }
}

function startNextRoundP2P() {
    currentRound++;
    phase = 'viewing';
    
    const roleKeys = ROLE_PRIORITY.slice(0, players.length);
    const shuffled = shuffle(roleKeys);
    roles = {};
    players.forEach((p, i) => roles[p.name] = shuffled[i]);

    const police = players.find(p => roles[p.name] === 'police');

    // Inform each player individually
    players.forEach(p => {
        const payload = {
            round: currentRound,
            totalRounds,
            yourRole: roles[p.name],
            yourRoleData: ALL_ROLES[roles[p.name]],
            policeName: police.name,
            players: players.map(pl => pl.name)
        };
        if (p.id === 'host') {
            handleClientEvent('new-round', payload);
        } else {
            p.conn.send({ type: 'new-round', data: payload });
        }
    });

    // Transit to guessing after delay
    setTimeout(() => {
        phase = 'guessing';
        broadcastToAll('police-turn', {
            policeName: police.name,
            suspects: players.filter(p => roles[p.name] !== 'police').map(p => p.name)
        });
    }, 6000);
}

function broadcastToAll(type, data) {
    players.forEach(p => {
        if (p.id === 'host') handleClientEvent(type, data);
        else if (p.conn) p.conn.send({ type, data });
    });
}

function handleHostPlayerDisconnect(conn) {
    const p = players.find(player => player.id === conn.peer);
    if (!p) return;
    const leaveName = p.name;
    players = players.filter(player => player.id !== conn.peer);
    delete connections[conn.peer];
    broadcastToAll('player-left', { players: players.map(pl => pl.name), leftPlayer: leaveName });
}

// --- CLIENT LOGIC (UI Updates) ---
function handleClientEvent(type, data) {
    switch (type) {
        case 'room-created':
            roomCode = data.code;
            showScreen('lobby');
            $('lobby-code').textContent = data.code;
            updateLobbyPlayers(data.players, true);
            break;

        case 'player-joined':
            if (!screens.lobby.classList.contains('active') && data.newPlayer === myName) {
                showScreen('lobby');
                $('lobby-code').textContent = roomCode;
            }
            updateLobbyPlayers(data.players, isHost);
            if (data.newPlayer !== myName) showToast(`${data.newPlayer} joined!`);
            break;

        case 'join-error':
            const errEl = $('join-error');
            errEl.textContent = data;
            errEl.classList.remove('hidden');
            setTimeout(() => errEl.classList.add('hidden'), 4000);
            break;

        case 'player-left':
            updateLobbyPlayers(data.players, isHost);
            showToast(`${data.leftPlayer} left the room`);
            break;

        case 'game-started':
            totalRounds = data.totalRounds;
            showToast('Game started! 🎮');
            break;

        case 'new-round':
            showScreen('role');
            $('round-display').textContent = `${data.round} / ${data.totalRounds}`;
            $('chit-emoji').textContent = data.yourRoleData.emoji;
            $('chit-role').textContent = data.yourRoleData.name;
            $('chit-role-tamil').textContent = data.yourRoleData.tamil;

            if (data.yourRole === 'police') {
                $('chit-points').textContent = 'Catch the Thief!';
                $('role-hint').textContent = 'You are the Police! Get ready... 🕵️';
            } else if (data.yourRole === 'thief') {
                $('chit-points').textContent = "Don't get caught!";
                $('role-hint').textContent = 'You are the Thief! Stay cool... 😈';
            } else {
                $('chit-points').textContent = data.yourRoleData.points + ' Points';
                $('role-hint').textContent = 'Keep it secret! 🤫';
            }

            const card = $('chit-card');
            card.className = 'glass-panel chit-card ' + data.yourRole + '-card';
            card.style.animation = 'none';
            card.offsetHeight;
            card.style.animation = '';
            break;

        case 'police-turn':
            if (myName === data.policeName) {
                showScreen('guess');
                $('guess-title').textContent = 'You are the Police!';
                renderSuspects(data.suspects);
            } else {
                $('role-hint').textContent = `🛡️ ${data.policeName} is the Police! Waiting...`;
            }
            break;

        case 'round-result':
            showScreen('result');
            const h = $('result-header');
            h.className = 'result-header ' + (data.correct ? 'correct' : 'wrong');
            $('result-icon').textContent = data.correct ? '✅' : '❌';
            $('result-title').textContent = data.correct ? 'Thief Caught!' : 'Thief Escaped!';
            $('result-subtitle').textContent = data.correct
                ? `${data.policeName} caught ${data.thiefName}!`
                : `${data.thiefName} escaped! ${data.policeName} arrested ${data.guessedName}!`;

            const cardsContainer = $('result-cards');
            cardsContainer.innerHTML = '';
            Object.entries(data.revealData).forEach(([name, d]) => {
                const c = document.createElement('div');
                c.className = 'result-role-card ' + d.role;
                c.innerHTML = `
                    <div class="rr-emoji">${d.emoji}</div>
                    <div class="rr-name">${name}</div>
                    <div class="rr-role">${d.name} (${d.tamil})</div>
                    <div class="rr-pts">+${d.roundPoints} pts</div>
                `;
                cardsContainer.appendChild(c);
            });

            const scoreTable = $('score-table');
            scoreTable.innerHTML = '';
            data.scores.forEach((s, i) => {
                const row = document.createElement('div');
                row.className = 'score-row';
                row.innerHTML = `<span class="sr-rank">#${i + 1}</span><span class="sr-name">${s.name}</span><span class="sr-score">${s.score} pts</span>`;
                scoreTable.appendChild(row);
            });

            const nextBtn = $('btn-next-round');
            const waitingEl = $('waiting-next');
            if (isHost) {
                nextBtn.classList.remove('hidden');
                nextBtn.textContent = data.isLastRound ? '🏆 Final Results' : 'Next Round →';
                waitingEl.classList.add('hidden');
            } else {
                nextBtn.classList.add('hidden');
                waitingEl.classList.remove('hidden');
            }
            break;

        case 'game-over':
            showScreen('final');
            $('winner-text').textContent = `${data.scores[0].name} Wins! 🎉`;
            const container = $('final-scores');
            container.innerHTML = '';
            const medals = ['🥇', '🥈', '🥉'];
            data.scores.forEach((s, i) => {
                const row = document.createElement('div');
                row.className = 'final-row';
                row.innerHTML = `<div class="final-rank">${medals[i] || (i + 1)}</div><div class="final-name">${s.name}</div><div class="final-score">${s.score} pts</div>`;
                container.appendChild(row);
            });
            if (isHost) $('btn-play-again').classList.remove('hidden');
            fireConfetti();
            break;
    }
}

// ===== Helpers =====
function updateLobbyPlayers(players, showStartBtn) {
    const container = $('lobby-players');
    container.innerHTML = '';
    players.forEach((name, i) => {
        const item = document.createElement('div');
        item.className = 'player-item';
        const initial = name.charAt(0).toUpperCase();
        item.innerHTML = `
            <div class="player-avatar">${initial}</div>
            <div class="player-name">${name}</div>
            ${i === 0 ? '<span class="host-badge">HOST</span>' : ''}
        `;
        container.appendChild(item);
    });

    $('player-count').textContent = `${players.length} / 10 players`;

    if (players.length < 4) {
        $('lobby-status').textContent = `Waiting for players... (need ${4 - players.length} more)`;
    } else {
        $('lobby-status').textContent = `✅ Ready to play! (${players.length} players)`;
    }

    // Show/hide start button
    if (showStartBtn && players.length >= 4) {
        $('btn-start-game').classList.remove('hidden');
        $('lobby-note').textContent = '';
    } else if (showStartBtn && players.length < 4) {
        $('btn-start-game').classList.add('hidden');
        $('lobby-note').textContent = 'Need at least 4 players to start';
    } else {
        $('btn-start-game').classList.add('hidden');
        $('lobby-note').textContent = 'Only the host can start the game';
    }
}

function updateHostButtons() {
    // If on result screen, show next button
    if (screens.result.classList.contains('active')) {
        $('btn-next-round').classList.remove('hidden');
        $('waiting-next').classList.add('hidden');
    }
    // If on final screen, show play again
    if (screens.final.classList.contains('active')) {
        $('btn-play-again').classList.remove('hidden');
    }
}

function renderSuspects(suspects) {
    const suspectList = $('suspect-list');
    suspectList.innerHTML = '';
    selectedSuspect = null;
    $('btn-arrest').disabled = true;

    suspects.forEach(name => {
        const btn = document.createElement('button');
        btn.className = 'suspect-btn';
        btn.innerHTML = `
            <span class="suspect-icon">🤔</span>
            <span>${name}</span>
        `;
        btn.addEventListener('click', () => {
            document.querySelectorAll('.suspect-btn').forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
            selectedSuspect = name;
            $('btn-arrest').disabled = false;
        });
        suspectList.appendChild(btn);
    });
}

// ===== CONFETTI =====
let confettiPieces = [];
let confettiAnimId = null;

function fireConfetti() {
    const canvas = $('confetti-canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    const colors = ['#ffd700', '#ff6b6b', '#7b61ff', '#4cc9f0', '#f72585', '#06d6a0', '#c77dff'];
    confettiPieces = [];
    for (let i = 0; i < 150; i++) {
        confettiPieces.push({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height - canvas.height,
            w: 6 + Math.random() * 6, h: 4 + Math.random() * 4,
            color: colors[Math.floor(Math.random() * colors.length)],
            vx: (Math.random() - 0.5) * 3, vy: 2 + Math.random() * 4,
            rot: Math.random() * 360, rotSpeed: (Math.random() - 0.5) * 10, opacity: 1
        });
    }
    function animate() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        let alive = false;
        confettiPieces.forEach(p => {
            p.x += p.vx; p.y += p.vy; p.rot += p.rotSpeed; p.vy += 0.05;
            if (p.y > canvas.height + 20) p.opacity -= 0.02;
            if (p.opacity > 0) {
                alive = true;
                ctx.save(); ctx.globalAlpha = Math.max(0, p.opacity);
                ctx.translate(p.x, p.y); ctx.rotate(p.rot * Math.PI / 180);
                ctx.fillStyle = p.color; ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
                ctx.restore();
            }
        });
        if (alive) confettiAnimId = requestAnimationFrame(animate);
    }
    animate();
}

function clearConfetti() {
    if (confettiAnimId) cancelAnimationFrame(confettiAnimId);
    const canvas = $('confetti-canvas');
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    confettiPieces = [];
}
