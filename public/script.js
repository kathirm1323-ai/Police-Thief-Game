// ===== Socket.IO Connection =====
const socket = io();

// ===== Game State =====
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
let autoPickTimeout = null;

// ===== UI Helpers =====
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
    socket.emit('create-room', { playerName: name, totalRounds });
});

// ===== JOIN ROOM =====
$('btn-back-join').addEventListener('click', () => showScreen('welcome'));
$('btn-join-room').addEventListener('click', () => {
    const name = $('join-name').value.trim();
    const code = $('join-code').value.trim().toUpperCase();
    if (!name) { $('join-name').focus(); return; }
    if (!code) { $('join-code').focus(); return; }
    
    myName = name;
    roomCode = code;
    socket.emit('join-room', { playerName: name, roomCode: code });
});

// ===== LOBBY =====
$('btn-copy-code').addEventListener('click', () => {
    navigator.clipboard.writeText(roomCode).then(() => showToast('Room code copied!'));
});

$('btn-start-game').addEventListener('click', () => {
    if (isHost) socket.emit('start-game');
});

// ===== GUESS =====
$('btn-arrest').addEventListener('click', () => {
    if (!selectedSuspect) return;
    $('btn-arrest').disabled = true;
    socket.emit('police-guess', { suspectName: selectedSuspect });
});

// ===== NEXT ROUND =====
$('btn-next-round').addEventListener('click', () => {
    if (isHost) socket.emit('next-round');
});

// ===== PLAY AGAIN & NEW GAME =====
$('btn-play-again').addEventListener('click', () => {
    clearConfetti();
    if (isHost) socket.emit('play-again');
});
$('btn-new-game').addEventListener('click', () => {
    clearConfetti();
    window.location.reload();
});

// ========================================
//         SOCKET EVENT LISTENERS
// ========================================

socket.on('room-created', (data) => {
    roomCode = data.code;
    showScreen('lobby');
    $('lobby-code').textContent = data.code;
    updateLobbyPlayers(data.players, true);
});

socket.on('player-joined', (data) => {
    if (!screens.lobby.classList.contains('active') && data.newPlayer === myName) {
        showScreen('lobby');
        $('lobby-code').textContent = roomCode;
    }
    updateLobbyPlayers(data.players, isHost);
    if (data.newPlayer !== myName) showToast(`${data.newPlayer} joined!`);
});

socket.on('join-error', (msg) => {
    const errEl = $('join-error');
    errEl.textContent = msg;
    errEl.classList.remove('hidden');
    setTimeout(() => errEl.classList.add('hidden'), 4000);
});

socket.on('player-left', (data) => {
    updateLobbyPlayers(data.players, isHost);
    showToast(`${data.leftPlayer} left the room`);
});

socket.on('game-started', (data) => {
    totalRounds = data.totalRounds;
    showToast('Game started! 🎮');
});

socket.on('new-round', (data) => {
    showScreen('role');
    
    // Clear any existing autopick timer
    if (autoPickTimeout) clearTimeout(autoPickTimeout);

    $('round-display').textContent = `${data.round} / ${data.totalRounds}`;
    
    // Setup Picking Phase
    $('picking-phase').classList.remove('hidden');
    $('reveal-phase').classList.add('hidden');
    renderChitPicker(data.players.length, data);

    // Setup Reveal Phase (for later)
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
});

function renderChitPicker(count, gameData) {
    const grid = $('chit-grid');
    grid.innerHTML = '';
    
    for (let i = 0; i < count; i++) {
        const chit = document.createElement('div');
        chit.className = 'selectable-chit';
        chit.innerHTML = '❓';
        chit.style.animationDelay = (i * 0.1) + 's';
        chit.onclick = () => pickChit(i, gameData);
        grid.appendChild(chit);
    }

    // Auto-pick the first one after 3 seconds
    autoPickTimeout = setTimeout(() => {
        const firstChit = grid.querySelector('.selectable-chit');
        if (firstChit) pickChit(0, gameData);
    }, 3000);
}

function pickChit(index, data) {
    if (autoPickTimeout) clearTimeout(autoPickTimeout);
    autoPickTimeout = null;

    const chits = document.querySelectorAll('.selectable-chit');
    if (chits[index]) chits[index].classList.add('picked');

    // Small delay for the "picking" animation
    setTimeout(() => {
        $('picking-phase').classList.add('hidden');
        $('reveal-phase').classList.remove('hidden');
        
        const card = $('chit-card');
        card.offsetHeight; // Reset animation
        card.style.animation = '';
        
        showToast('Role Revealed! 🕵️');
    }, 400);
}

socket.on('police-turn', (data) => {
    if (myName === data.policeName) {
        showScreen('guess');
        $('guess-title').textContent = 'You are the Police!';
        renderSuspects(data.suspects);
    } else {
        $('role-hint').textContent = `🛡️ ${data.policeName} is the Police! Waiting...`;
    }
});

socket.on('round-result', (data) => {
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
        row.innerHTML = `<span class="sr-rank">#${i + i}</span><span class="sr-name">${s.name}</span><span class="sr-score">${s.score} pts</span>`;
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
});

socket.on('game-over', (data) => {
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
});

socket.on('you-are-host', () => {
    isHost = true;
    showToast('The host left. You are now the new host!');
    updateHostButtons();
});

// ===== Helpers =====
function updateLobbyPlayers(playerNames, showStartBtn) {
    const container = $('lobby-players');
    container.innerHTML = '';
    playerNames.forEach((name, i) => {
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

    $('player-count').textContent = `${playerNames.length} / 10 players`;

    if (playerNames.length < 4) {
        $('lobby-status').textContent = `Waiting for players... (need ${4 - playerNames.length} more)`;
    } else {
        $('lobby-status').textContent = `✅ Ready to play! (${playerNames.length} players)`;
    }

    if (showStartBtn && playerNames.length >= 4) {
        $('btn-start-game').classList.remove('hidden');
        $('lobby-note').textContent = '';
    } else if (showStartBtn && playerNames.length < 4) {
        $('btn-start-game').classList.add('hidden');
        $('lobby-note').textContent = 'Need at least 4 players to start';
    } else {
        $('btn-start-game').classList.add('hidden');
        $('lobby-note').textContent = 'Only the host can start the game';
    }
}

function updateHostButtons() {
    if (screens.result.classList.contains('active')) {
        $('btn-next-round').classList.remove('hidden');
        $('waiting-next').classList.add('hidden');
    }
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
    if (!canvas) return;
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
    if (canvas) {
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    confettiPieces = [];
}
