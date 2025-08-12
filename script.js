// script.js

document.addEventListener('DOMContentLoaded', () => {
    // --- ELEMENTOS DO DOM ---
    const levelSelectionScreen = document.getElementById('level-selection-screen');
    const levelGrid = document.getElementById('level-grid');
    const gameContainer = document.getElementById('game-container');
    const backToLevelsButton = document.getElementById('back-to-levels-button');
    const levelDisplay = document.getElementById('level-display');
    const clapButton = document.getElementById('clap-button');
    const statusDisplay = document.getElementById('status-display');
    const rhythmGuide = document.getElementById('rhythm-guide');
    const modalScreen = document.getElementById('modal-screen');
    const modalTitle = document.getElementById('modal-title');
    const modalRhythmPreview = document.getElementById('modal-rhythm-preview');
    const modalText = document.getElementById('modal-text');
    const modalButton = document.getElementById('modal-button');
    const modalStarsContainer = document.getElementById('modal-stars-container');

    // --- DADOS DO JOGO ---
    const RHYTHM_LEVELS = [
        { tempo: 65, pattern: [{t:0,d:1},{t:1,d:1},{t:2,d:1},{t:3,d:1}] }, { tempo: 65, pattern: [{t:0,d:1},{t:1,d:1, rest:true},{t:2,d:1},{t:3,d:1, rest:true}] },
        { tempo: 65, pattern: [{t:0,d:1},{t:1,d:1},{t:2,d:1, rest:true},{t:3,d:1}] }, { tempo: 65, pattern: [{t:0,d:1, rest:true},{t:1,d:1, rest:true},{t:2,d:1},{t:3,d:1}] },
        { tempo: 65, pattern: [{t:0,d:1},{t:1,d:0.5},{t:1.5,d:0.5},{t:2,d:1},{t:3,d:1}] }, { tempo: 65, pattern: [{t:0,d:1},{t:1,d:1},{t:2,d:0.5},{t:2.5,d:0.5},{t:3,d:0.5},{t:3.5,d:0.5}] },
        { tempo: 65, pattern: [{t:0,d:0.5},{t:0.5,d:0.5},{t:1,d:0.5},{t:1.5,d:0.5},{t:2,d:1},{t:3,d:1}] }, { tempo: 65, pattern: [{t:0,d:0.5},{t:0.5,d:0.5},{t:1,d:1},{t:2,d:0.5},{t:2.5,d:0.5},{t:3,d:1}] },
        { tempo: 65, pattern: [{t:0,d:1},{t:1,d:0.5},{t:1.5,d:0.5},{t:2,d:1, rest:true},{t:3,d:1}] }, { tempo: 65, pattern: [{t:0,d:0.5},{t:0.5,d:0.5},{t:1,d:1, rest:true},{t:2,d:0.5},{t:2.5,d:0.5},{t:3,d:1, rest:true}] },
        { tempo: 65, pattern: [{t:0,d:1, rest:true},{t:1,d:0.5},{t:1.5,d:0.5},{t:2,d:0.5},{t:2.5,d:0.5},{t:3,d:1}] }, { tempo: 65, pattern: [{t:0,d:0.5},{t:0.5,d:0.5},{t:1,d:1, rest:true},{t:2,d:1},{t:3,d:1, rest:true}] }
    ];

    const sounds = {};
    ['clap', 'count', 'level_success', 'level_fail', 'tick'].forEach(sound => { 
        sounds[sound] = new Audio(`sounds/${sound}.mp3`); sounds[sound].load();
    });
    
    let currentLevel = 0, gameState = 'IDLE';
    let beats = [], playerBeats = [];
    let activeTimeouts = [], metronomeInterval;
    let progress;

    function playSound(soundName) {
        if (sounds[soundName]) {
            sounds[soundName].currentTime = 0;
            sounds[soundName].play().catch(e => {});
        }
    }
    
    function clearAllTimers() {
        activeTimeouts.forEach(timeoutId => clearTimeout(timeoutId));
        activeTimeouts = [];
        clearInterval(metronomeInterval);
    }
    
    function showLevelSelection() {
        gameContainer.classList.add('hidden');
        levelSelectionScreen.classList.remove('hidden');
        modalScreen.classList.add('hidden');
        
        try {
            let progressData = JSON.parse(localStorage.getItem('mestreDoRitmoProgress'));
            if (!progressData || typeof progressData.maxLevel !== 'number') {
                progress = { maxLevel: 1, stars: {} };
            } else {
                progress = progressData;
            }
        } catch (e) {
            progress = { maxLevel: 1, stars: {} };
        }

        levelGrid.innerHTML = '';
        for (let i = 0; i < RHYTHM_LEVELS.length; i++) {
            const button = document.createElement('button');
            button.className = 'level-button';
            
            if (i < progress.maxLevel) {
                button.innerHTML = `<span>${i + 1}</span><div class="stars-container">${getStarsHTML(progress.stars[i] || 0)}</div>`;
                button.onclick = () => startLevel(i);
            } else {
                button.innerHTML = '🔒';
                button.classList.add('locked');
                button.disabled = true;
            }
            levelGrid.appendChild(button);
        }
    }

    function getStarsHTML(count) {
        let html = '';
        for (let i = 0; i < 3; i++) {
            html += `<span class="star ${i < count ? 'filled' : ''}">⭐</span>`;
        }
        return html;
    }
    
    function startLevel(levelIndex) {
        levelSelectionScreen.classList.add('hidden');
        gameContainer.classList.remove('hidden');
        clearAllTimers();
        gameState = 'IDLE';
        currentLevel = levelIndex;
        updateHUD();
        showLevelIntro();
    }
    
    function showLevelIntro() {
        const level = RHYTHM_LEVELS[currentLevel];
        modalTitle.textContent = `Nível ${currentLevel + 1}`;
        modalText.innerHTML = "Observe a demonstração e prepare-se.<br>Use a <strong>BARRA DE ESPAÇO</strong> ou <strong>CLIQUE NO BOTÃO</strong>.";
        modalButton.textContent = "Vamos lá!";
        modalRhythmPreview.innerHTML = getRhythmVisual(level.pattern);
        modalStarsContainer.innerHTML = '';
        modalScreen.classList.remove('hidden');
        modalButton.onclick = () => {
            modalScreen.classList.add('hidden');
            playDemonstration();
        };
    }

    function playDemonstration() {
        clearAllTimers();
        gameState = 'DEMO';
        statusDisplay.classList.remove('hidden');
        statusDisplay.textContent = "Observe...";
        clapButton.disabled = true;
        
        const level = RHYTHM_LEVELS[currentLevel];
        if (!level || !level.pattern) { return; }
        
        const secondsPerBeat = 60.0 / level.tempo;
        beats = level.pattern.map(beat => ({...beat, time: beat.t * secondsPerBeat}));
        
        beats.forEach(beat => {
            if (!beat.rest) {
                activeTimeouts.push(setTimeout(() => {
                    playSound('clap');
                    clapButton.classList.add('pulsing-demo');
                    setTimeout(() => clapButton.classList.remove('pulsing-demo'), 200);
                }, beat.time * 1000));
            }
        });

        const totalDuration = (4 * secondsPerBeat + 1) * 1000;
        activeTimeouts.push(setTimeout(runPlayerCountIn, totalDuration));
    }

    function runPlayerCountIn() {
        clearAllTimers();
        gameState = 'COUNT_IN';
        statusDisplay.classList.remove('hidden');
        statusDisplay.textContent = "Sua Vez!";
        const level = RHYTHM_LEVELS[currentLevel];
        const beatDurationMs = (60.0 / level.tempo) * 1000;
        let count = 1;

        metronomeInterval = setInterval(() => {
            if (count <= 4) {
                statusDisplay.textContent = count;
                playSound('tick');
                count++;
            } else {
                clearAllTimers();
                startPlayerTurn();
            }
        }, beatDurationMs);
    }

    function startPlayerTurn() {
        clearAllTimers();
        gameState = 'PLAY';
        statusDisplay.classList.add('hidden');
        rhythmGuide.classList.remove('hidden');
        clapButton.disabled = false;
        playerBeats = [];
        const gameStartTime = performance.now();
        const level = RHYTHM_LEVELS[currentLevel];
        const secondsPerBeat = 60.0 / level.tempo;
        
        rhythmGuide.innerHTML = getRhythmVisual(level.pattern);
        startMetronome(secondsPerBeat);
        
        clapButton.onclick = () => handleClap(gameStartTime);
        document.onkeydown = (e) => {
            if (e.code === 'Space' && gameState === 'PLAY' && !e.repeat) {
                e.preventDefault();
                clapButton.click();
            }
        };
        
        const totalDuration = (4 * secondsPerBeat) * 1000;
        activeTimeouts.push(setTimeout(showResult, totalDuration));
    }

    function handleClap(startTime) {
        if(gameState !== 'PLAY') return;
        const clapTime = (performance.now() - startTime) / 1000;
        playerBeats.push(clapTime);
        playSound('clap');
    }

    function showResult() {
        if (gameState !== 'PLAY') return;
        clearAllTimers();
        rhythmGuide.classList.add('hidden');
        gameState = 'RESULT';
        clapButton.disabled = true;
        
        let levelScore = 0;
        const timingWindow = 0.3;
        const totalNotes = beats.filter(b => !b.rest).length;
        
        beats.forEach(beat => {
            if (!beat.rest) {
                const wasHit = playerBeats.some(pTime => Math.abs(pTime - beat.time) < timingWindow);
                if (wasHit) levelScore++;
            }
        });

        const accuracy = totalNotes > 0 ? levelScore / totalNotes : 0;
        const starsEarned = calculateStars(accuracy);
        
        if (starsEarned > 0) {
            if ((currentLevel + 1) >= progress.maxLevel && progress.maxLevel < RHYTHM_LEVELS.length) {
                progress.maxLevel = currentLevel + 2;
            }
            // Salva a pontuação mais recente, não a maior
            progress.stars[currentLevel] = starsEarned;
            localStorage.setItem('mestreDoRitmoProgress', JSON.stringify(progress));
        }

        modalTitle.textContent = starsEarned > 0 ? "Muito Bem!" : "Quase lá!";
        modalText.innerHTML = `Você acertou ${levelScore} de ${totalNotes}.`;
        modalStarsContainer.innerHTML = getStarsHTML(starsEarned);
        
        if (starsEarned > 0 && currentLevel + 1 < RHYTHM_LEVELS.length) {
            modalButton.textContent = "Próximo Nível";
            modalButton.onclick = () => startLevel(currentLevel + 1);
        } else if (starsEarned > 0 && currentLevel + 1 >= RHYTHM_LEVELS.length) {
             modalTitle.textContent = "Parabéns!";
             modalText.innerHTML = "Você completou todos os níveis!";
             modalButton.textContent = "Voltar ao Menu";
             modalButton.onclick = showLevelSelection;
        } else {
            modalButton.textContent = "Tentar Novamente";
            modalButton.onclick = () => startLevel(currentLevel);
        }
        modalScreen.classList.remove('hidden');
    }

    function calculateStars(accuracy) {
        if (accuracy >= 0.95) return 3;
        if (accuracy >= 0.75) return 2;
        if (accuracy >= 0.60) return 1;
        return 0;
    }
    
    function startMetronome(secondsPerBeat) {
        stopMetronome();
        metronomeInterval = setInterval(() => playSound('tick'), secondsPerBeat * 1000);
    }
    function stopMetronome() { clearInterval(metronomeInterval); }

    function updateHUD() {
        levelDisplay.textContent = currentLevel + 1;
    }

    function getRhythmVisual(pattern) {
        let visualHtml = "";
        for (const beat of pattern) {
            const isColcheia = beat.d === 0.5;
            if (beat.rest) { 
                visualHtml += `<span class="rhythm-guide-icon">🤫</span>`;
            } else {
                visualHtml += `<span class="rhythm-guide-icon ${isColcheia ? 'colcheia' : ''}">✋</span>`;
            }
        }
        return visualHtml;
    }
    
    backToLevelsButton.addEventListener('click', () => {
        clearAllTimers();
        showLevelSelection();
    });
    
    showLevelSelection();
});