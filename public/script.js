// ===== Socket.IO Connection =====
const BACKEND_URL = ''; // Leave blank to use host origin, or update to your Render URL
const socket = io(BACKEND_URL);


let myName = '';
let roomCode = '';
let isHost = false;
let selectedSuspect = null;
let totalRounds = 10;

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
    if (!code || code.length < 5) { $('join-code').focus(); return; }
    myName = name;
    roomCode = code;
    socket.emit('join-room', { roomCode: code, playerName: name });
});

// ===== LOBBY =====
$('btn-copy-code').addEventListener('click', () => {
    navigator.clipboard.writeText(roomCode).then(() => showToast('Room code copied!'));
});

$('btn-start-game').addEventListener('click', () => {
    socket.emit('start-game');
});

// ===== GUESS =====
$('btn-arrest').addEventListener('click', () => {
    if (!selectedSuspect) return;
    $('btn-arrest').disabled = true;
    socket.emit('police-guess', { suspectName: selectedSuspect });
});

// ===== NEXT ROUND =====
$('btn-next-round').addEventListener('click', () => {
    socket.emit('next-round');
});

// ===== PLAY AGAIN & NEW GAME =====
$('btn-play-again').addEventListener('click', () => {
    clearConfetti();
    socket.emit('play-again');
});
$('btn-new-game').addEventListener('click', () => {
    clearConfetti();
    window.location.reload();
});

// ========================================
//         SOCKET EVENT HANDLERS
// ========================================

socket.on('room-created', ({ code, players }) => {
    roomCode = code;
    showScreen('lobby');
    $('lobby-code').textContent = code;
    updateLobbyPlayers(players, true);
});

socket.on('player-joined', ({ players, newPlayer }) => {
    if (!screens.lobby.classList.contains('active') && newPlayer === myName) {
        showScreen('lobby');
        $('lobby-code').textContent = roomCode;
    }
    updateLobbyPlayers(players, isHost);
    if (newPlayer !== myName) showToast(`${newPlayer} joined!`);
});

socket.on('join-error', (msg) => {
    const errEl = $('join-error');
    errEl.textContent = msg;
    errEl.classList.remove('hidden');
    setTimeout(() => errEl.classList.add('hidden'), 4000);
});

socket.on('player-left', ({ players, leftPlayer }) => {
    updateLobbyPlayers(players, isHost);
    showToast(`${leftPlayer} left the room`);
});

socket.on('you-are-host', () => {
    isHost = true;
    showToast('You are now the host!');
    // Update lobby if visible
    const playerEls = $('lobby-players');
    if (playerEls.children.length > 0) {
        const lobbyPlayers = Array.from(playerEls.children).map(el => el.querySelector('.player-name').textContent);
        updateLobbyPlayers(lobbyPlayers, true);
    }
    // Show start button if on appropriate screen
    updateHostButtons();
});

socket.on('game-started', ({ totalRounds: tr }) => {
    totalRounds = tr;
    showToast('Game started! 🎮');
});

socket.on('new-round', ({ round, totalRounds: tr, yourRole, yourRoleData, policeName, isPolice, players }) => {
    showScreen('role');
    $('round-display').textContent = `${round} / ${tr}`;

    // Show your role card
    $('chit-emoji').textContent = yourRoleData.emoji;
    $('chit-role').textContent = yourRoleData.name;
    $('chit-role-tamil').textContent = yourRoleData.tamil;

    if (yourRole === 'police') {
        $('chit-points').textContent = 'Catch the Thief!';
        $('role-hint').textContent = 'You are the Police! Get ready to guess... 🕵️';
    } else if (yourRole === 'thief') {
        $('chit-points').textContent = "Don't get caught!";
        $('role-hint').textContent = 'You are the Thief! Stay cool... 😈';
    } else {
        $('chit-points').textContent = yourRoleData.points + ' Points';
        $('role-hint').textContent = 'Keep it secret! 🤫';
    }

    const card = $('chit-card');
    card.className = 'glass-panel chit-card ' + yourRole + '-card';
    card.style.animation = 'none';
    card.offsetHeight;
    card.style.animation = '';
});

socket.on('police-turn', ({ policeName, suspects }) => {
    if (myName === policeName) {
        // I am the police — show guess screen
        showScreen('guess');
        $('guess-title').textContent = 'You are the Police!';
        $('guess-instruction').textContent = 'Who is the Thirudan? Choose wisely!';
        renderSuspects(suspects);
    } else {
        // Others wait — update hint on role screen
        $('role-hint').textContent = `🛡️ ${policeName} is the Police! Waiting for their guess...`;
    }
});

socket.on('round-result', ({ correct, policeName, thiefName, guessedName, revealData, scores, isLastRound }) => {
    showScreen('result');

    const header = $('result-header');
    header.className = 'result-header ' + (correct ? 'correct' : 'wrong');

    $('result-icon').textContent = correct ? '✅' : '❌';
    $('result-title').textContent = correct ? 'Thief Caught!' : 'Thief Escaped!';
    $('result-subtitle').textContent = correct
        ? `${policeName} caught ${thiefName}!`
        : `${thiefName} escaped! ${policeName} arrested ${guessedName} instead!`;

    // Result cards
    const cardsContainer = $('result-cards');
    cardsContainer.innerHTML = '';
    Object.entries(revealData).forEach(([name, data]) => {
        const card = document.createElement('div');
        card.className = 'result-role-card ' + data.role;
        card.innerHTML = `
            <div class="rr-emoji">${data.emoji}</div>
            <div class="rr-name">${name}</div>
            <div class="rr-role">${data.name} (${data.tamil})</div>
            <div class="rr-pts">+${data.roundPoints} pts</div>
        `;
        cardsContainer.appendChild(card);
    });

    // Scoreboard
    const scoreTable = $('score-table');
    scoreTable.innerHTML = '';
    scores.forEach((s, i) => {
        const row = document.createElement('div');
        row.className = 'score-row';
        row.innerHTML = `
            <span class="sr-rank">#${i + 1}</span>
            <span class="sr-name">${s.name}</span>
            <span class="sr-score">${s.score} pts</span>
        `;
        scoreTable.appendChild(row);
    });

    // Show buttons based on host
    const nextBtn = $('btn-next-round');
    const waitingEl = $('waiting-next');
    if (isHost) {
        nextBtn.classList.remove('hidden');
        nextBtn.textContent = isLastRound ? '🏆 Final Results' : 'Next Round →';
        waitingEl.classList.add('hidden');
    } else {
        nextBtn.classList.add('hidden');
        waitingEl.classList.remove('hidden');
        waitingEl.textContent = isLastRound
            ? 'Waiting for host to show final results...'
            : 'Waiting for host to start next round...';
    }
});

socket.on('game-over', ({ scores }) => {
    showScreen('final');
    $('winner-text').textContent = `${scores[0].name} Wins! 🎉`;

    const container = $('final-scores');
    container.innerHTML = '';
    const medals = ['🥇', '🥈', '🥉'];
    scores.forEach((s, i) => {
        const row = document.createElement('div');
        row.className = 'final-row';
        row.innerHTML = `
            <div class="final-rank">${medals[i] || (i + 1)}</div>
            <div class="final-name">${s.name}</div>
            <div class="final-score">${s.score} pts</div>
        `;
        container.appendChild(row);
    });

    if (isHost) {
        $('btn-play-again').classList.remove('hidden');
    }

    fireConfetti();
});

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
