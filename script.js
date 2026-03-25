// ===== Game State =====
const gameState = {
    players: [],
    totalRounds: 10,
    currentRound: 0,
    scores: {},
    roles: {},         // { playerName: 'king' | 'queen' | 'police' | 'thief' }
    currentViewIndex: 0,
    selectedSuspect: null,
    policePlayer: null,
    thiefPlayer: null
};

const ROLES = {
    king:   { emoji: '👑', name: 'Raja',     tamil: 'ராஜா',       points: 1000, cssClass: 'king-card',   resultClass: 'king'   },
    queen:  { emoji: '💎', name: 'Rani',     tamil: 'ராணி',       points: 500,  cssClass: 'queen-card',  resultClass: 'queen'  },
    police: { emoji: '🛡️', name: 'Police',   tamil: 'போலீஸ்',     points: 800,  cssClass: 'police-card', resultClass: 'police' },
    thief:  { emoji: '🦹', name: 'Thirudan', tamil: 'திருடன்', points: 0,    cssClass: 'thief-card',  resultClass: 'thief'  }
};

// ===== DOM Helpers =====
const $ = id => document.getElementById(id);
const screens = {
    welcome:    $('screen-welcome'),
    setup:      $('screen-setup'),
    distribute: $('screen-distribute'),
    guess:      $('screen-guess'),
    result:     $('screen-result'),
    final:      $('screen-final')
};

function showScreen(name) {
    Object.values(screens).forEach(s => s.classList.remove('active'));
    screens[name].classList.add('active');
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

// ===== Shuffle =====
function shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

// ===== WELCOME SCREEN =====
$('btn-start').addEventListener('click', () => showScreen('setup'));
$('btn-rules').addEventListener('click', () => $('modal-rules').classList.add('active'));
$('btn-close-rules').addEventListener('click', () => $('modal-rules').classList.remove('active'));
$('modal-rules').addEventListener('click', e => {
    if (e.target === $('modal-rules')) $('modal-rules').classList.remove('active');
});

// ===== SETUP SCREEN =====
$('btn-back-setup').addEventListener('click', () => showScreen('welcome'));

document.querySelectorAll('.round-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.round-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        gameState.totalRounds = parseInt(btn.dataset.rounds);
    });
});

$('btn-play').addEventListener('click', () => {
    const names = [];
    for (let i = 1; i <= 4; i++) {
        const name = $('player' + i).value.trim();
        if (!name) {
            $('player' + i).focus();
            $('player' + i).style.borderColor = 'var(--error-color)';
            setTimeout(() => $('player' + i).style.borderColor = '', 1500);
            return;
        }
        names.push(name);
    }

    // Check for duplicate names
    const uniqueNames = new Set(names);
    if (uniqueNames.size < 4) {
        alert('All player names must be unique!');
        return;
    }

    gameState.players = names;
    gameState.scores = {};
    names.forEach(n => gameState.scores[n] = 0);
    gameState.currentRound = 0;
    startNewRound();
});

// ===== ROUND LOGIC =====
function startNewRound() {
    gameState.currentRound++;
    $('round-display').textContent = `${gameState.currentRound} / ${gameState.totalRounds}`;

    // Assign roles
    const roleKeys = shuffle(['king', 'queen', 'police', 'thief']);
    gameState.roles = {};
    gameState.players.forEach((p, i) => {
        gameState.roles[p] = roleKeys[i];
    });

    // Find police and thief
    gameState.policePlayer = gameState.players.find(p => gameState.roles[p] === 'police');
    gameState.thiefPlayer = gameState.players.find(p => gameState.roles[p] === 'thief');
    gameState.selectedSuspect = null;
    gameState.currentViewIndex = 0;

    showDistributeScreen();
}

function showDistributeScreen() {
    showScreen('distribute');
    showPassPrompt();
}

function showPassPrompt() {
    const player = gameState.players[gameState.currentViewIndex];
    $('current-player-name').textContent = player;
    $('pass-prompt').style.display = 'block';
    $('chit-reveal').classList.add('hidden');
}

$('btn-view-chit').addEventListener('click', () => {
    const player = gameState.players[gameState.currentViewIndex];
    const roleKey = gameState.roles[player];
    const role = ROLES[roleKey];

    // Show the chit
    $('chit-emoji').textContent = role.emoji;
    $('chit-role').textContent = role.name;
    $('chit-role-tamil').textContent = role.tamil;
    $('chit-points').textContent = roleKey === 'police' ? 'Catch the Thief!' :
                                   roleKey === 'thief'  ? 'Don\'t get caught!' :
                                   role.points + ' Points';

    // Style the card
    const card = $('chit-card');
    card.className = 'glass-panel chit-card ' + role.cssClass;

    // Force re-animation
    card.style.animation = 'none';
    card.offsetHeight; // trigger reflow
    card.style.animation = '';

    $('pass-prompt').style.display = 'none';
    $('chit-reveal').classList.remove('hidden');
});

$('btn-hide-chit').addEventListener('click', () => {
    gameState.currentViewIndex++;
    if (gameState.currentViewIndex < 4) {
        showPassPrompt();
    } else {
        // All players have seen their chits — police guesses
        showGuessScreen();
    }
});

// ===== GUESS SCREEN =====
function showGuessScreen() {
    showScreen('guess');
    $('police-name').textContent = gameState.policePlayer;

    const suspectList = $('suspect-list');
    suspectList.innerHTML = '';
    gameState.selectedSuspect = null;
    $('btn-arrest').disabled = true;

    // The suspects are all players except the police
    const suspects = gameState.players.filter(p => p !== gameState.policePlayer);
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
            gameState.selectedSuspect = name;
            $('btn-arrest').disabled = false;
        });
        suspectList.appendChild(btn);
    });
}

$('btn-arrest').addEventListener('click', () => {
    if (!gameState.selectedSuspect) return;
    resolveRound();
});

// ===== RESOLVE ROUND =====
function resolveRound() {
    const correct = gameState.selectedSuspect === gameState.thiefPlayer;

    // Calculate points
    const roundPoints = {};
    gameState.players.forEach(p => {
        const role = gameState.roles[p];
        if (role === 'king') {
            roundPoints[p] = 1000;
        } else if (role === 'queen') {
            roundPoints[p] = 500;
        } else if (role === 'police') {
            roundPoints[p] = correct ? 800 : 0;
        } else if (role === 'thief') {
            roundPoints[p] = correct ? 0 : 800;
        }
    });

    // Add to total scores
    gameState.players.forEach(p => {
        gameState.scores[p] += roundPoints[p];
    });

    // Show result
    showResultScreen(correct, roundPoints);
}

function showResultScreen(correct, roundPoints) {
    showScreen('result');

    const header = $('result-header');
    header.className = 'result-header ' + (correct ? 'correct' : 'wrong');

    $('result-icon').textContent = correct ? '✅' : '❌';
    $('result-title').textContent = correct ? 'Correct Guess!' : 'Wrong Guess!';
    $('result-subtitle').textContent = correct
        ? `${gameState.policePlayer} caught ${gameState.thiefPlayer}!`
        : `${gameState.thiefPlayer} escaped! ${gameState.policePlayer} arrested ${gameState.selectedSuspect} (${ROLES[gameState.roles[gameState.selectedSuspect]].name}) instead!`;

    // Result role cards
    const cardsContainer = $('result-cards');
    cardsContainer.innerHTML = '';
    gameState.players.forEach(p => {
        const roleKey = gameState.roles[p];
        const role = ROLES[roleKey];
        const card = document.createElement('div');
        card.className = 'result-role-card ' + role.resultClass;
        card.innerHTML = `
            <div class="rr-emoji">${role.emoji}</div>
            <div class="rr-name">${p}</div>
            <div class="rr-role">${role.name} (${role.tamil})</div>
            <div class="rr-pts">+${roundPoints[p]} pts</div>
        `;
        cardsContainer.appendChild(card);
    });

    // Score table
    const scoreTable = $('score-table');
    scoreTable.innerHTML = '';
    const sorted = [...gameState.players].sort((a, b) => gameState.scores[b] - gameState.scores[a]);
    sorted.forEach((p, i) => {
        const row = document.createElement('div');
        row.className = 'score-row';
        row.innerHTML = `
            <span class="sr-rank">#${i + 1}</span>
            <span class="sr-name">${p}</span>
            <span class="sr-score">${gameState.scores[p]} pts</span>
        `;
        scoreTable.appendChild(row);
    });

    // Update button text
    const isLastRound = gameState.currentRound >= gameState.totalRounds;
    $('btn-next-round').textContent = isLastRound ? '🏆 Final Results' : 'Next Round →';
}

$('btn-next-round').addEventListener('click', () => {
    if (gameState.currentRound >= gameState.totalRounds) {
        showFinalScreen();
    } else {
        startNewRound();
    }
});

// ===== FINAL SCREEN =====
function showFinalScreen() {
    showScreen('final');

    const sorted = [...gameState.players].sort((a, b) => gameState.scores[b] - gameState.scores[a]);
    $('winner-text').textContent = `${sorted[0]} Wins! 🎉`;

    const container = $('final-scores');
    container.innerHTML = '';
    sorted.forEach((p, i) => {
        const row = document.createElement('div');
        row.className = 'final-row';
        const medals = ['🥇', '🥈', '🥉', '  '];
        row.innerHTML = `
            <div class="final-rank">${medals[i] || (i + 1)}</div>
            <div class="final-name">${p}</div>
            <div class="final-score">${gameState.scores[p]} pts</div>
        `;
        container.appendChild(row);
    });

    // Fire confetti
    fireConfetti();
}

$('btn-play-again').addEventListener('click', () => {
    // Reset scores, keep same players and settings
    gameState.players.forEach(p => gameState.scores[p] = 0);
    gameState.currentRound = 0;
    clearConfetti();
    startNewRound();
});

$('btn-new-game').addEventListener('click', () => {
    clearConfetti();
    // Clear inputs
    for (let i = 1; i <= 4; i++) {
        $('player' + i).value = '';
    }
    showScreen('welcome');
});

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
            w: 6 + Math.random() * 6,
            h: 4 + Math.random() * 4,
            color: colors[Math.floor(Math.random() * colors.length)],
            vx: (Math.random() - 0.5) * 3,
            vy: 2 + Math.random() * 4,
            rot: Math.random() * 360,
            rotSpeed: (Math.random() - 0.5) * 10,
            opacity: 1
        });
    }

    function animate() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        let alive = false;
        confettiPieces.forEach(p => {
            p.x += p.vx;
            p.y += p.vy;
            p.rot += p.rotSpeed;
            p.vy += 0.05;

            if (p.y > canvas.height + 20) {
                p.opacity -= 0.02;
            }

            if (p.opacity > 0) {
                alive = true;
                ctx.save();
                ctx.globalAlpha = Math.max(0, p.opacity);
                ctx.translate(p.x, p.y);
                ctx.rotate(p.rot * Math.PI / 180);
                ctx.fillStyle = p.color;
                ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
                ctx.restore();
            }
        });

        if (alive) {
            confettiAnimId = requestAnimationFrame(animate);
        }
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

// ===== Init =====
createParticles();
window.addEventListener('resize', () => {
    createParticles();
});
