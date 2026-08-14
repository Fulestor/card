// Snake game — loaded only after the user presses the snake button.
// Firebase and game audio are intentionally kept in this lazy-loaded module.

const firebaseConfig = {
        apiKey: "AIzaSyBqEHY1U4JZAohw7cJNhPciJGrh6mgIHVk",
        authDomain: "delmysnakeleader.firebaseapp.com",
        projectId: "delmysnakeleader",
        storageBucket: "delmysnakeleader.firebasestorage.app",
        messagingSenderId: "1083442947791",
        appId: "1:1083442947791:web:3b380e10d12ead7d5c39ba",
        measurementId: "G-RXTZ4504M0"
    };

const VOL_EAT = 0.075;
const VOL_POWERUP = 0.05;
const VOL_DIE = 0.075;
const VOL_RECORD = 0.035;

const adjs = ['Redstone', 'Iron', 'Quantum', 'Blox', 'Epic', 'Brave', 'Gamer', 'Golden', 'Dark', 'Cosmic', 'Marvelous', 'Fabric', 'Spider', 'delmy', 'Rock', 'beautiful', 'BIG_', 'Gay', 'Фармацевт', 'Uzbek'];
const nouns = ['Creeper', 'Batman', 'Shinobi', 'Avenger', 'Jedi', 'Noob', 'Titan', 'Hokage', 'ChickenFarmer', 'Spider', 'Witcher', 'Miner', 'doggie', 'man', '_Chpoker', 'Operator', 'Vandal', 'Узбек'];

const makeGameSound = (src, volume) => {
    const audio = new Audio(src);
    audio.preload = 'none';
    audio.volume = volume;
    return audio;
};

const gameSounds = {
    eat: makeGameSound('eat.mp3', VOL_EAT),
    powerup: makeGameSound('powerup.mp3', VOL_POWERUP),
    die: makeGameSound('die.mp3', VOL_DIE),
    record: makeGameSound('record.mp3', VOL_RECORD)
};

function playGameSound(type) {
    const baseSound = gameSounds[type];
    if (!baseSound || document.hidden) return;
    const clone = baseSound.cloneNode();
    clone.volume = baseSound.volume;
    clone.play().catch(() => {});
}

let firebaseDB = null;
let firebaseCollection = null;
let firebaseDoc = null;
let firebaseSetDoc = null;
let firebaseGetDocs = null;
let firebaseQuery = null;
let firebaseOrderBy = null;
let firebaseLimit = null;


let initialized = false;
let openSnakeInternal = null;

function initSnake() {
    let localUsername = localStorage.getItem('delmyname_snakeUser');
    if (!localUsername) {
        localUsername = adjs[Math.floor(Math.random() * adjs.length)] + nouns[Math.floor(Math.random() * nouns.length)];
        localStorage.setItem('delmyname_snakeUser', localUsername);
    }
    document.getElementById('snake-username-display').innerText = localUsername;

    let localBestScore = parseInt(localStorage.getItem('delmyname_snakeBestScore')) || 0;
    document.getElementById('snake-best-score').innerText = localBestScore;

    const snakeOverlay = document.getElementById('snake-overlay');
    const closeSnakeBtn = document.getElementById('close-snake-btn');
    const wrapper = document.getElementById('snake-canvas-wrapper');
    const canvas = document.getElementById('snake-canvas');
    const ctx = canvas.getContext('2d');
    const scoreEl = document.getElementById('snake-score');
    const finalScoreEl = document.getElementById('snake-final-score');

    const startScreen = document.getElementById('snake-start-screen');
    const startGameBtn = document.getElementById('start-snake-btn');
    const pauseScreen = document.getElementById('snake-pause-screen');
    const pauseBtn = document.getElementById('pause-snake-btn');
    const gameOverScreen = document.getElementById('snake-game-over');

    const restartBtn = document.getElementById('restart-snake-btn');
    const leaderboardBtn = document.getElementById('leaderboard-btn');
    const closeLeaderboardBtn = document.getElementById('close-leaderboard-btn');
    const leaderboardScreen = document.getElementById('snake-leaderboard');
    const activeBuffUI = document.getElementById('active-buff-ui');
    const buffTimerBar = document.getElementById('buff-timer-bar');

    canvas.width = 400;
    canvas.height = 400;
    const gridSize = 20;
    const tileCount = canvas.width / gridSize;

    let snake = [];
    let dx = 0, dy = 0;
    let foodX, foodY;
    let score = 0;

    let gameActive = false;
    let isPaused = false;
    let inputQueue = []; 

    let lastLogicUpdate = 0;
    let currentSpeed = 150; 
    let animationFrameId;

    const BUFF_TYPES = [
        { id: 'SLOW', color: '#a855f7', name: 'ЗАМЕДЛЕНИЕ', icon: 'fa-solid fa-stopwatch' },
        { id: 'MAGNET', color: '#eab308', name: 'МАГНИТ', icon: 'fa-solid fa-magnet' },
        { id: 'DOUBLE', color: '#3b82f6', name: 'X2 ОЧКИ', icon: 'fa-solid fa-gem' },
        { id: 'GHOST', color: '#ffffff', name: 'ПРИЗРАК', icon: 'fa-solid fa-ghost' }
    ];

    let buffItem = null;
    let activeBuff = null;
    let buffTimer = null;
    let buffStartTime = 0;
    const buffDuration = 8000;
    let pauseStartTime = 0;

    function resetGameData() {
        snake = [
            {x: 10, y: 10, oldX: 10, oldY: 10},
            {x: 10, y: 11, oldX: 10, oldY: 11},
            {x: 10, y: 12, oldX: 10, oldY: 12}
        ];
        dx = 0; dy = -1; 
        inputQueue = [];
        score = 0;
        currentSpeed = 150;
        scoreEl.innerText = score;
        buffItem = null;
        clearBuff();
        
        ctx.fillStyle = '#0a021c';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        placeFood();
    }

    function initGame() {
        resetGameData();
        startScreen.classList.add('hidden');
        gameOverScreen.classList.add('hidden');
        gameOverScreen.classList.remove('flex');
        gameActive = true;
        isPaused = false;
        
        cancelAnimationFrame(animationFrameId);
        lastLogicUpdate = performance.now();
        requestAnimationFrame(gameLoop);
    }

    function placeFood() {
        foodX = Math.floor(Math.random() * tileCount);
        foodY = Math.floor(Math.random() * tileCount);
        for (let part of snake) {
            if (part.x === foodX && part.y === foodY) return placeFood();
        }
        if (buffItem && buffItem.x === foodX && buffItem.y === foodY) return placeFood();

        if (!buffItem && !activeBuff && Math.random() < 0.20) placeBuff();
    }

    function placeBuff() {
        let bx = Math.floor(Math.random() * tileCount);
        let by = Math.floor(Math.random() * tileCount);
        for (let part of snake) {
            if (part.x === bx && part.y === by) return placeBuff();
        }
        if (bx === foodX && by === foodY) return placeBuff();

        const randomBuff = BUFF_TYPES[Math.floor(Math.random() * BUFF_TYPES.length)];
        buffItem = { x: bx, y: by, type: randomBuff, spawnTime: performance.now() };
    }

    function activateBuff(buffType) {
        activeBuff = buffType;
        buffStartTime = performance.now();
        
        const iconEl = document.getElementById('buff-icon');
        const nameEl = document.getElementById('buff-name');
        nameEl.innerText = buffType.name;
        iconEl.className = buffType.icon;
        
        activeBuffUI.style.backgroundColor = buffType.color + '30'; 
        activeBuffUI.style.borderColor = buffType.color + '80';
        activeBuffUI.style.color = buffType.color;
        buffTimerBar.style.backgroundColor = buffType.color;
        activeBuffUI.classList.remove('hidden');

        if (buffTimer) clearTimeout(buffTimer);
        buffTimer = setTimeout(clearBuff, buffDuration);
    }

    function clearBuff() {
        activeBuff = null;
        activeBuffUI.classList.add('hidden');
        if (buffTimer) clearTimeout(buffTimer);
    }

    function togglePause() {
        if (!gameActive) return;
        isPaused = !isPaused;
        if (isPaused) {
            pauseScreen.classList.remove('hidden');
            pauseScreen.classList.add('flex');
            pauseBtn.innerHTML = '<i class="fa-solid fa-play text-xl"></i>';
            pauseStartTime = performance.now();
            if (buffTimer) clearTimeout(buffTimer);
        } else {
            pauseScreen.classList.add('hidden');
            pauseScreen.classList.remove('flex');
            pauseBtn.innerHTML = '<i class="fa-solid fa-pause text-xl"></i>';
            
            const pauseDuration = performance.now() - pauseStartTime;
            lastLogicUpdate += pauseDuration;
            if (buffItem) buffItem.spawnTime += pauseDuration;
            
            if (activeBuff) {
                buffStartTime += pauseDuration;
                const remainingTime = buffDuration - (performance.now() - buffStartTime);
                buffTimer = setTimeout(clearBuff, remainingTime);
            }
            requestAnimationFrame(gameLoop);
        }
    }

    function addInput(newDx, newDy) {
        let lastDir = inputQueue.length > 0 ? inputQueue[inputQueue.length - 1] : {dx: dx, dy: dy};
        if (newDx === -lastDir.dx && newDy === -lastDir.dy) return; 
        if (newDx === lastDir.dx && newDy === lastDir.dy) return; 
        if (inputQueue.length < 2) {
            inputQueue.push({dx: newDx, dy: newDy});
        }
    }

    function updateSnakeLogic() {
        if (inputQueue.length > 0) {
            const nextDir = inputQueue.shift();
            dx = nextDir.dx; dy = nextDir.dy;
        }

        snake.forEach(part => { part.oldX = part.x; part.oldY = part.y; });

        const nx = snake[0].x + dx;
        const ny = snake[0].y + dy;

        if (nx < 0 || nx >= tileCount || ny < 0 || ny >= tileCount) return gameOver();
        for (let i = 0; i < snake.length; i++) {
            if (nx === snake[i].x && ny === snake[i].y) {
                if (activeBuff && activeBuff.id === 'GHOST') continue;
                return gameOver();
            }
        }

        if (buffItem && nx === buffItem.x && ny === buffItem.y) {
            playGameSound('powerup');
            activateBuff(buffItem.type);
            buffItem = null;
        } else if (buffItem && performance.now() - buffItem.spawnTime > 10000) {
            buffItem = null;
        }

        let isEating = false;
        if (nx === foodX && ny === foodY) {
            isEating = true;
        } else if (activeBuff && activeBuff.id === 'MAGNET') {
            const dist = Math.abs(nx - foodX) + Math.abs(ny - foodY);
            if (dist <= 2) isEating = true;
        }

        if (isEating) {
            let scoreMultiplier = (activeBuff && activeBuff.id === 'DOUBLE') ? 20 : 10;
            score += scoreMultiplier;
            scoreEl.innerText = score;
            playGameSound('eat'); 
            placeFood();
            snake.unshift({ x: nx, y: ny, oldX: snake[0].x, oldY: snake[0].y });
        } else {
            let tail = snake.pop();
            tail.x = nx; tail.y = ny;
            tail.oldX = snake[0].x; tail.oldY = snake[0].y;
            snake.unshift(tail);
        }

        let baseSpeed = Math.max(60, 150 - (score * 0.4));
        if (activeBuff && activeBuff.id === 'SLOW') baseSpeed *= 1.7;
        currentSpeed = baseSpeed;
    }

    function drawSmoothSnake(progress) {
        ctx.fillStyle = '#0a021c';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        if (buffItem) {
            ctx.fillStyle = buffItem.type.color;
            ctx.shadowBlur = 15;
            ctx.shadowColor = buffItem.type.color;
            
            const scale = 1 + Math.sin(performance.now() / 150) * 0.15;
            const size = (gridSize - 4) * scale;
            const offset = (gridSize - size) / 2;
            ctx.fillRect(buffItem.x * gridSize + offset, buffItem.y * gridSize + offset, size, size);
            ctx.shadowBlur = 0;
        }

        ctx.fillStyle = '#22c55e';
        ctx.shadowBlur = 15;
        ctx.shadowColor = '#22c55e';
        ctx.fillRect(foodX * gridSize + 2, foodY * gridSize + 2, gridSize - 4, gridSize - 4);
        ctx.shadowBlur = 0;
        
        const isGhost = (activeBuff && activeBuff.id === 'GHOST');
        if (isGhost) ctx.globalAlpha = 0.5;

        snake.forEach((part, index) => {
            if (isGhost) {
                ctx.fillStyle = index === 0 ? '#ffffff' : '#cbd5e1';
            } else {
                ctx.fillStyle = index === 0 ? '#a78bfa' : '#8b5cf6'; 
            }
            
            if(index === 0) {
                ctx.shadowBlur = 15;
                ctx.shadowColor = isGhost ? '#ffffff' : '#8b5cf6';
            } else {
                ctx.shadowBlur = 0;
            }
            
            let renderX = part.oldX + (part.x - part.oldX) * progress;
            let renderY = part.oldY + (part.y - part.oldY) * progress;
            
            ctx.fillRect(renderX * gridSize + 1, renderY * gridSize + 1, gridSize - 2, gridSize - 2);
        });
        ctx.shadowBlur = 0;
        ctx.globalAlpha = 1.0;
    }

    function updateUI(time) {
        if (activeBuff && !isPaused) {
            const elapsed = time - buffStartTime;
            const remaining = Math.max(0, 1 - (elapsed / buffDuration));
            buffTimerBar.style.width = (remaining * 100) + '%';
        }
    }

    function gameLoop(time) {
        if (!gameActive || isPaused) return;
        updateUI(time);

        let elapsed = time - lastLogicUpdate;
        if (elapsed >= currentSpeed) {
            updateSnakeLogic();
            lastLogicUpdate = time;
            elapsed = 0;
        }

        if (gameActive && !isPaused) {
            let progress = Math.min(elapsed / currentSpeed, 1);
            drawSmoothSnake(progress);
            animationFrameId = requestAnimationFrame(gameLoop);
        }
    }

    function gameOver() {
        gameActive = false;
        finalScoreEl.innerText = score;
        gameOverScreen.classList.remove('hidden');
        gameOverScreen.classList.add('flex');
        clearBuff();
        
        wrapper.classList.add('is-shaking');
        wrapper.style.borderColor = '#ef4444';
        wrapper.style.boxShadow = '0 0 40px rgba(239, 68, 68, 0.4)';
        setTimeout(() => {
            wrapper.classList.remove('is-shaking');
            wrapper.style.borderColor = 'rgba(255, 255, 255, 0.1)';
            wrapper.style.boxShadow = '0 0 30px rgba(34,197,94,0.15)';
        }, 400);
        
        if (score > localBestScore && score > 0) {
            playGameSound('record');
            localBestScore = score;
            localStorage.setItem('delmyname_snakeBestScore', localBestScore);
            document.getElementById('snake-best-score').innerText = localBestScore;
            
            // Заставляем инициализироваться перед попыткой сохранения
            ensureFirebase().then(() => {
                if (firebaseDB && firebaseSetDoc && firebaseDoc) {
                    firebaseSetDoc(firebaseDoc(firebaseDB, "leaderboard", localUsername), {
                        name: localUsername,
                        score: localBestScore,
                        timestamp: Date.now()
                    }).then(() => updateLeaderboardUI()).catch(err => console.error(err));
                } else {
                    updateLeaderboardUI();
                }
            });
        } else {
            playGameSound('die');
            updateLeaderboardUI();
        }
    }

    document.addEventListener('keydown', (e) => {
        if (gameActive && (e.code === 'Space' || e.code === 'Escape')) {
            e.preventDefault();
            togglePause();
            return;
        }
        if (!gameActive || isPaused) return;
        
        if(["ArrowUp","ArrowDown","ArrowLeft","ArrowRight","w","a","s","d"].includes(e.key)) {
            e.preventDefault();
        }
        
        if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') addInput(0, -1);
        if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') addInput(0, 1);
        if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') addInput(-1, 0);
        if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') addInput(1, 0);
    }, {passive: false});

    let touchStartX = 0, touchStartY = 0, lastSwipeTime = 0;
    snakeOverlay.addEventListener('touchstart', (e) => {
        if (!gameActive || isPaused) return;
        if (e.target.closest('button')) return;
        
        touchStartX = e.changedTouches[0].screenX;
        touchStartY = e.changedTouches[0].screenY;
    }, {passive: false});

    snakeOverlay.addEventListener('touchmove', (e) => {
        if (!gameActive || isPaused) return;
        if (e.target.closest('button')) return;
        
        e.preventDefault(); 

        let touchX = e.changedTouches[0].screenX;
        let touchY = e.changedTouches[0].screenY;
        let deltaX = touchX - touchStartX;
        let deltaY = touchY - touchStartY;

        if (Math.abs(deltaX) > 15 || Math.abs(deltaY) > 15) {
            const now = performance.now();
            if (now - lastSwipeTime < 50) return;
            lastSwipeTime = now;

            if (Math.abs(deltaX) > Math.abs(deltaY)) {
                if (deltaX > 0) addInput(1, 0); else addInput(-1, 0);
            } else {
                if (deltaY > 0) addInput(0, 1); else addInput(0, -1);
            }
            
            touchStartX = touchX; touchStartY = touchY;
        }
    }, {passive: false});

    closeSnakeBtn.addEventListener('click', () => {
        gameActive = false;
        cancelAnimationFrame(animationFrameId);
        snakeOverlay.style.opacity = '0';
        
        document.body.style.overflow = '';

        setTimeout(() => {
            snakeOverlay.classList.remove('flex');
            snakeOverlay.classList.add('hidden');
        }, 300);
    });

    startGameBtn.addEventListener('click', initGame);
    restartBtn.addEventListener('click', initGame);
    pauseBtn.addEventListener('click', togglePause);

    async function updateLeaderboardUI() {
        const listEl = document.getElementById('leaderboard-list');
        if (!listEl) return;
        
        if (!firebaseDB) {
            listEl.innerHTML = '<div class="text-center text-red-400 mt-10">БД недоступна (возможно, блокировщик трекинга рубит скрипты)</div>';
            return;
        }

        listEl.innerHTML = '<div class="text-center text-gray-400 mt-10">Загрузка данных...</div>';

        try {
            const leaders = [];
            const q = firebaseQuery(firebaseCollection(firebaseDB, "leaderboard"), firebaseOrderBy("score", "desc"), firebaseLimit(10));
            const querySnapshot = await firebaseGetDocs(q);
            
            querySnapshot.forEach((doc) => leaders.push(doc.data()));
            listEl.innerHTML = ''; 
            
            if (leaders.length === 0) {
                listEl.innerHTML = '<div class="text-center text-gray-400 mt-10">Пока никого нет. Стань первым!</div>';
                return;
            }

            leaders.forEach((player, index) => {
                const row = document.createElement('div');
                row.className = 'leaderboard-row';
                const isMe = player.name === localUsername;
                if (isMe) row.style.backgroundColor = 'rgba(139, 92, 246, 0.1)'; 
                
                let rankClass = index === 0 ? 'leaderboard-rank-1' : index === 1 ? 'leaderboard-rank-2' : index === 2 ? 'leaderboard-rank-3' : '';
                
                row.innerHTML = `
                    <div class="flex items-center gap-3">
                        <span class="w-4 text-left ${rankClass}">${index + 1}</span>
                        <span class="${isMe ? 'text-[var(--color-accent)] font-bold' : 'text-gray-300'}">${player.name}</span>
                    </div>
                    <span class="${isMe ? 'text-[#22c55e] font-bold' : 'text-white font-bold'}">${player.score}</span>
                `;
                listEl.appendChild(row);
            });
        } catch (err) {
            listEl.innerHTML = '<div class="text-center text-red-400 mt-10">Ошибка загрузки таблицы</div>';
        }
    }

    leaderboardBtn.addEventListener('click', async () => {
        const originalContent = leaderboardBtn.innerHTML;
        leaderboardBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Загрузка...';
        
        await ensureFirebase();
        await updateLeaderboardUI();
        
        leaderboardBtn.innerHTML = originalContent;
        leaderboardScreen.style.zIndex = '50';
        leaderboardScreen.classList.remove('hidden');
        leaderboardScreen.classList.add('flex');
    });

    closeLeaderboardBtn.addEventListener('click', () => {
        leaderboardScreen.classList.add('hidden');
        leaderboardScreen.classList.remove('flex');
    });

    let firebaseInitPromise = null;
    async function ensureFirebase() {
        if (firebaseDB) return true;
        if (firebaseInitPromise) return firebaseInitPromise;

        firebaseInitPromise = (async () => {
            try {
                // Используем актуальную стабильную версию Firebase v10
                const firebaseApp = await import("https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js");
                const firestore = await import("https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js");

                const app = firebaseApp.initializeApp(firebaseConfig);
                firebaseDB = firestore.getFirestore(app);

                firebaseCollection = firestore.collection;
                firebaseDoc = firestore.doc;
                firebaseSetDoc = firestore.setDoc;
                firebaseGetDocs = firestore.getDocs;
                firebaseQuery = firestore.query;
                firebaseOrderBy = firestore.orderBy;
                firebaseLimit = firestore.limit;
                return true;
            } catch (err) {
                console.warn("Firebase заблокирован расширением. Лидерборд отключен, но сайт работает.", err);
                return false;
            }
        })();

        return firebaseInitPromise;
    }
    openSnakeInternal = () => {
        snakeOverlay.classList.remove('hidden');
        snakeOverlay.classList.add('flex');
        document.body.style.overflow = 'hidden';
        requestAnimationFrame(() => { snakeOverlay.style.opacity = '1'; });
        resetGameData();
        startScreen.classList.remove('hidden');
    };
}

export function openSnake() {
    if (!initialized) {
        initSnake();
        initialized = true;
    }
    openSnakeInternal();
}