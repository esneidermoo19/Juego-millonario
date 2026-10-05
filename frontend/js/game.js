/**
 * Controlador de Partida y Lógica de Juego (game.html)
 * Cumple estrictamente con el contrato y flujo de Fronted.md
 *
 * Requiere: utils.js (showToast, formatCurrency), api.js
 */

// Sintetizador Web Audio API para efectos de sonido
const SoundFX = {
  ctx: null,
  init() {
    if (!this.ctx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) this.ctx = new AudioContext();
    }
  },
  playTone(freq, type, duration, delay = 0) {
    try {
      this.init();
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime + delay);
      gain.gain.setValueAtTime(0.15, this.ctx.currentTime + delay);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + delay + duration);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(this.ctx.currentTime + delay);
      osc.stop(this.ctx.currentTime + delay + duration);
    } catch (_) {}
  },
  click() {
    this.playTone(600, 'sine', 0.05);
  },
  correct() {
    this.playTone(523.25, 'triangle', 0.15, 0);     // C5
    this.playTone(659.25, 'triangle', 0.15, 0.12);  // E5
    this.playTone(783.99, 'triangle', 0.35, 0.24);  // G5
  },
  wrong() {
    this.playTone(220, 'sawtooth', 0.2, 0);         // A3
    this.playTone(196, 'sawtooth', 0.4, 0.15);      // G3
  },
  lifeline() {
    this.playTone(440, 'sine', 0.1, 0);
    this.playTone(880, 'sine', 0.2, 0.1);
  }
};

// ─── TAREA 7: Niveles seguros (constante fácil de cambiar) ─────────────
// El backend aún no confirma esta regla; ajustar si cambia.
const SAFE_LEVELS = [5, 10, 15];

// Estado Principal de Partida
let gameState = {
  playerId: null,
  playerName: 'Jugador',
  gameId: null,
  questions: [],          // Sin respuestas correctas (como dicta Fronted.md)
  questionIndex: 0,
  currentPrize: 0,
  usedLifelines: {
    fiftyFifty: false,
    audience: false,
    friend: false
  },
  answering: false        // Evita doble envío / clic múltiple
};

// Escala estándar de 15 premios — TAREA 7: milestone derivado de SAFE_LEVELS
const PRIZE_LADDER = [
  { level: 1, prize: "$100" },
  { level: 2, prize: "$200" },
  { level: 3, prize: "$300" },
  { level: 4, prize: "$500" },
  { level: 5, prize: "$1.000" },
  { level: 6, prize: "$2.000" },
  { level: 7, prize: "$4.000" },
  { level: 8, prize: "$8.000" },
  { level: 9, prize: "$16.000" },
  { level: 10, prize: "$32.000" },
  { level: 11, prize: "$64.000" },
  { level: 12, prize: "$125.000" },
  { level: 13, prize: "$250.000" },
  { level: 14, prize: "$500.000" },
  { level: 15, prize: "$1.000.000" }
].map(item => ({
  ...item,
  milestone: SAFE_LEVELS.includes(item.level)
}));

// ─── TAREA 2: Persistir / restaurar progreso en sessionStorage ─────────
const PROGRESS_KEY = 'game_progress';

function saveProgress() {
  const progress = {
    questionIndex: gameState.questionIndex,
    currentPrize: gameState.currentPrize,
    usedLifelines: { ...gameState.usedLifelines }
  };
  sessionStorage.setItem(PROGRESS_KEY, JSON.stringify(progress));
}

function restoreProgress() {
  try {
    const raw = sessionStorage.getItem(PROGRESS_KEY);
    if (!raw) return false;
    const progress = JSON.parse(raw);
    if (typeof progress.questionIndex === 'number') {
      gameState.questionIndex = progress.questionIndex;
    }
    if (progress.currentPrize !== undefined) {
      gameState.currentPrize = progress.currentPrize;
    }
    if (progress.usedLifelines) {
      gameState.usedLifelines = { ...gameState.usedLifelines, ...progress.usedLifelines };
    }
    return true;
  } catch (_) {
    return false;
  }
}

function clearProgress() {
  sessionStorage.removeItem(PROGRESS_KEY);
  sessionStorage.removeItem('game_result');
}
// ────────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', async () => {
  // 1. Validar sesión existente
  gameState.playerId = sessionStorage.getItem('player_id');
  gameState.gameId = sessionStorage.getItem('game_id');
  gameState.playerName = sessionStorage.getItem('player_name') || 'Jugador';

  if (!gameState.playerId || !gameState.gameId) {
    showToast('No se encontró una partida activa. Redirigiendo al inicio...', 'warning');
    setTimeout(() => window.location.href = 'index.html', 1500);
    return;
  }

  // 2. Elementos DOM
  const playerDisplay = document.getElementById('player-display');
  if (playerDisplay) playerDisplay.textContent = gameState.playerName;

  // 3. Restaurar progreso previo si el jugador recargó la página (TAREA 2)
  const restored = restoreProgress();

  // 4. Inicializar Escalera Visual
  renderLadder();

  // 5. Cargar Preguntas del Backend
  try {
    const data = await window.api.getQuestions();
    gameState.questions = data.questions || [];

    if (!gameState.questions.length) {
      throw new Error('No se recibieron preguntas del servidor.');
    }

    // TAREA 5: Ordenar por difficulty ascendente y tomar solo las primeras 15.
    // NOTA: El backend debe usar el mismo orden (por difficulty) al procesar comodines.
    gameState.questions.sort((a, b) => (a.difficulty || 0) - (b.difficulty || 0));
    gameState.questions = gameState.questions.slice(0, 15);

    renderCurrentQuestion();

    // Restaurar estado visual de comodines ya usados (TAREA 2)
    if (restored) {
      applyRestoredLifelineState();
    }
  } catch (error) {
    console.error('Error al obtener preguntas:', error);
    if (error.status === undefined) {
      showToast('No se pudo conectar con el servidor. Verifica que el backend esté ejecutándose.', 'error');
    } else {
      showToast(`Error: ${error.message}`, 'error');
    }
  }

  // 6. Configurar Event Listeners de Opciones y Comodines
  setupOptionListeners();
  setupLifelines();
  setupQuitFlow();
  setupModalCloses();
});

// Restaurar el estado visual de los botones de comodines tras recarga (TAREA 2)
function applyRestoredLifelineState() {
  if (gameState.usedLifelines.fiftyFifty) {
    const btn = document.getElementById('lifeline-5050');
    if (btn) { btn.disabled = true; btn.classList.add('used'); }
  }
  if (gameState.usedLifelines.audience) {
    const btn = document.getElementById('lifeline-audience');
    if (btn) { btn.disabled = true; btn.classList.add('used'); }
  }
  if (gameState.usedLifelines.friend) {
    const btn = document.getElementById('lifeline-friend');
    if (btn) { btn.disabled = true; btn.classList.add('used'); }
  }
}

// Renderizar Escalera Lateral
function renderLadder() {
  const ladderList = document.getElementById('ladder-list');
  if (!ladderList) return;

  ladderList.innerHTML = '';
  // Mostramos de la 15 arriba hacia la 1 abajo
  for (let i = PRIZE_LADDER.length - 1; i >= 0; i--) {
    const item = PRIZE_LADDER[i];
    const stepEl = document.createElement('div');
    stepEl.className = `ladder-step ${item.milestone ? 'milestone' : ''}`;
    stepEl.id = `ladder-step-${item.level}`;
    stepEl.innerHTML = `
      <span class="step-num">${item.level}</span>
      <span class="step-prize">${item.prize}</span>
    `;
    ladderList.appendChild(stepEl);
  }
}

// Renderizar Pregunta Actual
function renderCurrentQuestion() {
  const q = gameState.questions[gameState.questionIndex];
  if (!q) return;

  gameState.answering = false;

  // Actualizar Contador y Premios
  const questionNumDisplay = document.getElementById('question-num-display');
  const prizeDisplay = document.getElementById('prize-display');
  const questionText = document.getElementById('question-text');

  if (questionNumDisplay) {
    questionNumDisplay.textContent = `${gameState.questionIndex + 1} / ${gameState.questions.length}`;
  }

  if (prizeDisplay) {
    prizeDisplay.textContent = formatCurrency(gameState.currentPrize);
  }

  if (questionText) {
    questionText.textContent = q.question;
  }

  // Actualizar Escalera
  document.querySelectorAll('.ladder-step').forEach(step => step.classList.remove('active', 'passed'));
  for (let i = 1; i <= gameState.questionIndex; i++) {
    const passedStep = document.getElementById(`ladder-step-${i}`);
    if (passedStep) passedStep.classList.add('passed');
  }
  const currentStep = document.getElementById(`ladder-step-${gameState.questionIndex + 1}`);
  if (currentStep) currentStep.classList.add('active');

  // Renderizar Opciones A, B, C, D
  const optionButtons = document.querySelectorAll('.option-btn');

  optionButtons.forEach(btn => {
    const letter = btn.getAttribute('data-option');
    const textSpan = btn.querySelector('.option-text');
    const optContent = (q.options && q.options[letter]) !== undefined ? q.options[letter] : '';

    if (textSpan) textSpan.textContent = optContent;

    // Resetear estados visuales
    btn.className = 'option-btn';
    btn.disabled = false;
  });
}

// Configurar Respuestas (A–D)
function setupOptionListeners() {
  const optionButtons = document.querySelectorAll('.option-btn');
  
  optionButtons.forEach(btn => {
    btn.addEventListener('click', async () => {
      if (gameState.answering) return; // Evitar doble envío
      gameState.answering = true;
      SoundFX.click();

      const selectedLetter = btn.getAttribute('data-option');
      btn.classList.add('selected');

      // Deshabilitar todos los botones mientras se valida
      optionButtons.forEach(b => b.disabled = true);

      const q = gameState.questions[gameState.questionIndex];

      try {
        // Enviar respuesta al backend según contrato
        const result = await window.api.answer(gameState.gameId, q.id, selectedLetter);

        if (result.correct) {
          SoundFX.correct();
          btn.classList.remove('selected');
          btn.classList.add('correct');

          // Actualizar premio acumulado
          if (result.prize !== undefined) {
            gameState.currentPrize = result.prize;
          }

          if (result.game_finished) {
            // ¡Victoria Total! (Llegó a la última pregunta)
            // TAREA 4: Si finish falla, aún así redirigir como victoria
            clearProgress(); // TAREA 2: limpiar progreso al terminar
            try {
              await window.api.finish(gameState.gameId, true);
            } catch (finishErr) {
              console.warn('api.finish falló tras victoria, redirigiendo igualmente:', finishErr);
            }
            sessionStorage.setItem('game_result', JSON.stringify({
              type: 'win',
              player: gameState.playerName,
              prize: formatCurrency(result.prize || gameState.currentPrize),
              cleared: gameState.questionIndex + 1
            }));
            setTimeout(() => window.location.href = 'results.html', 1400);
          } else {
            // Avanzar a la siguiente pregunta
            setTimeout(() => {
              gameState.questionIndex++;
              saveProgress(); // TAREA 2: persistir progreso
              renderCurrentQuestion();
            }, 1200);
          }

        } else {
          // Respuesta Incorrecta (Derrota)
          SoundFX.wrong();
          btn.classList.remove('selected');
          btn.classList.add('incorrect');

          // Resaltar la respuesta correcta devuelta por el backend
          if (result.correct_answer) {
            const correctBtn = document.querySelector(`.option-btn[data-option="${result.correct_answer}"]`);
            if (correctBtn) correctBtn.classList.add('correct');
          }

          clearProgress(); // TAREA 2: limpiar progreso al terminar

          sessionStorage.setItem('game_result', JSON.stringify({
            type: 'loss',
            player: gameState.playerName,
            prize: formatCurrency(result.prize || 0),
            cleared: gameState.questionIndex
          }));

          setTimeout(() => window.location.href = 'results.html', 1600);
        }

      } catch (error) {
        // TAREA 3: al fallar la red, NO reactivar opciones eliminadas por 50/50
        console.error('Error al enviar respuesta:', error);
        btn.classList.remove('selected');
        optionButtons.forEach(b => {
          // Solo reactivar los botones que NO fueron removidos por el 50/50
          if (!b.classList.contains('removed-5050')) {
            b.disabled = false;
          }
        });
        gameState.answering = false;

        if (error.status === undefined) {
          showToast('No se pudo conectar con el servidor para validar la respuesta.', 'error');
        } else {
          showToast(`Error: ${error.message}`, 'error');
        }
      }
    });
  });
}

// Configurar Comodines (50/50, Público, Amigo)
function setupLifelines() {
  const btn5050 = document.getElementById('lifeline-5050');
  const btnAudience = document.getElementById('lifeline-audience');
  const btnFriend = document.getElementById('lifeline-friend');

  // 1. Comodín 50/50
  if (btn5050) {
    btn5050.addEventListener('click', async () => {
      if (gameState.usedLifelines.fiftyFifty || gameState.answering) return;
      SoundFX.lifeline();

      try {
        const res = await window.api.lifeline(gameState.gameId, '5050');
        gameState.usedLifelines.fiftyFifty = true;
        btn5050.disabled = true;
        btn5050.classList.add('used');
        saveProgress(); // TAREA 2: persistir estado del comodín

        // Ocultar las 2 opciones eliminadas devueltas por el backend
        if (res.removed_options && Array.isArray(res.removed_options)) {
          res.removed_options.forEach(letter => {
            const optBtn = document.querySelector(`.option-btn[data-option="${letter}"]`);
            if (optBtn) {
              optBtn.classList.add('removed-5050');
              optBtn.disabled = true;
            }
          });
        }
      } catch (error) {
        handleLifelineError(error, btn5050, 'fiftyFifty');
      }
    });
  }

  // 2. Comodín Público
  if (btnAudience) {
    btnAudience.addEventListener('click', async () => {
      if (gameState.usedLifelines.audience || gameState.answering) return;
      SoundFX.lifeline();

      try {
        const res = await window.api.lifeline(gameState.gameId, 'audience');
        gameState.usedLifelines.audience = true;
        btnAudience.disabled = true;
        btnAudience.classList.add('used');
        saveProgress(); // TAREA 2: persistir estado del comodín

        renderAudienceChart(res.percentages || { A: 25, B: 25, C: 25, D: 25 });
        openModal('modal-audience');
      } catch (error) {
        handleLifelineError(error, btnAudience, 'audience');
      }
    });
  }

  // 3. Comodín Amigo
  if (btnFriend) {
    btnFriend.addEventListener('click', async () => {
      if (gameState.usedLifelines.friend || gameState.answering) return;
      SoundFX.lifeline();

      try {
        const res = await window.api.lifeline(gameState.gameId, 'friend');
        gameState.usedLifelines.friend = true;
        btnFriend.disabled = true;
        btnFriend.classList.add('used');
        saveProgress(); // TAREA 2: persistir estado del comodín

        const friendMsgEl = document.getElementById('friend-message');
        if (friendMsgEl) {
          friendMsgEl.textContent = `"${res.message || 'Creo que deberías revisar bien las opciones antes de responder.'}"`;
        }
        openModal('modal-friend');
      } catch (error) {
        handleLifelineError(error, btnFriend, 'friend');
      }
    });
  }
}

// Manejo de Error en Comodines (ej: 409 comodín repetido)
function handleLifelineError(error, buttonEl, key) {
  if (error.status === 409) {
    showToast('Este comodín ya fue usado en esta partida.', 'warning');
    gameState.usedLifelines[key] = true;
    buttonEl.disabled = true;
    buttonEl.classList.add('used');
    saveProgress(); // TAREA 2: persistir estado tras 409
  } else if (error.status === undefined) {
    showToast('No se pudo conectar con el servidor.', 'error');
  } else {
    showToast(`Error: ${error.message}`, 'error');
  }
}

// Renderizar Gráfica de Barras para Audiencia
function renderAudienceChart(percentages) {
  const chartContainer = document.getElementById('audience-chart');
  if (!chartContainer) return;

  chartContainer.innerHTML = '';
  const letters = ['A', 'B', 'C', 'D'];

  letters.forEach(letter => {
    const val = percentages[letter] !== undefined ? percentages[letter] : 0;
    const col = document.createElement('div');
    col.className = 'audience-bar-column';
    col.innerHTML = `
      <span class="bar-percentage">${val}%</span>
      <div class="bar-fill-track">
        <div class="bar-fill" style="height: ${val}%;"></div>
      </div>
      <span class="bar-letter">${letter}</span>
    `;
    chartContainer.appendChild(col);
  });
}

// Flujo para Retirarse
function setupQuitFlow() {
  const btnQuit = document.getElementById('btn-quit');
  const quitPrizePreview = document.getElementById('quit-prize-preview');
  const btnConfirmQuit = document.getElementById('btn-confirm-quit-action');

  if (btnQuit) {
    btnQuit.addEventListener('click', () => {
      if (gameState.answering) return;
      if (quitPrizePreview) quitPrizePreview.textContent = formatCurrency(gameState.currentPrize);
      openModal('modal-confirm-quit');
    });
  }

  if (btnConfirmQuit) {
    btnConfirmQuit.addEventListener('click', async () => {
      try {
        btnConfirmQuit.disabled = true;
        const res = await window.api.quit(gameState.gameId);

        clearProgress(); // TAREA 2: limpiar progreso al retirarse

        sessionStorage.setItem('game_result', JSON.stringify({
          type: 'quit',
          player: gameState.playerName,
          prize: formatCurrency(res.final_prize !== undefined ? res.final_prize : gameState.currentPrize),
          cleared: gameState.questionIndex
        }));

        window.location.href = 'results.html';
      } catch (error) {
        console.error('Error al retirarse:', error);
        showToast('No se pudo procesar la retirada con el servidor.', 'error');
        btnConfirmQuit.disabled = false;
      }
    });
  }
}

// Modales Helper
function openModal(id) {
  const modal = document.getElementById(id);
  if (modal) modal.classList.add('active');
}

function setupModalCloses() {
  document.querySelectorAll('[data-close]').forEach(btn => {
    btn.addEventListener('click', () => {
      const modalId = btn.getAttribute('data-close');
      const modal = document.getElementById(modalId);
      if (modal) modal.classList.remove('active');
    });
  });
}
