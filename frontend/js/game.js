/**
 * Controlador de Partida y Lógica de Juego (game.html)
 *
 * Combina la escena visual 2D (hexágonos, presentador, temporizador cónico)
 * con las características funcionales del backend: preguntas aleatorias,
 * temporizador real con "timeout", comodines y soporte de idioma (i18n).
 *
 * Requiere: i18n.js (window.getLanguage), utils.js (showToast, formatCurrency), api.js
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
      if (localStorage.getItem('mute_audio') === '1') return;
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

// Niveles seguros (milestones) de la escalera de premios
const SAFE_LEVELS = [5, 10, 15];

// Tiempo por pregunta (debe coincidir con el timeout del backend)
const QUESTION_TIME_SECONDS = 30;
const ANSWER_FEEDBACK_MS = 2000;

// Estado Principal de Partida
let gameState = {
  playerId: null,
  playerName: 'Jugador',
  gameId: null,
  questions: [],          // Sin respuestas correctas (las decide el backend)
  questionIndex: 0,
  currentPrize: 0,
  usedLifelines: {
    fiftyFifty: false,
    audience: false,
    friend: false
  },
  answering: false,       // Evita doble envío / clic múltiple
  timerInterval: null,
  timerDeadline: null,
  timerQuestionId: null,
  timerExpired: false,
  timerTenSecondWarningShown: false,
  timerFiveSecondWarningShown: false,
  presenterMessageKey: 'welcome'
};

// Escala estándar de 15 premios
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

// ─── Persistir / restaurar progreso en sessionStorage ─────────────────
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
  sessionStorage.removeItem('game_id');
  sessionStorage.removeItem('game_result');
}

// Proteger la navegación con el botón "Atrás" del navegador (bfcache)
window.addEventListener('pageshow', (event) => {
  if (event.persisted && (!sessionStorage.getItem('game_id') || !sessionStorage.getItem('player_id'))) {
    window.location.href = 'index.html';
  }
});

// ─── Temporizador circular (cuenta regresiva con timeout real) ────────
function startQuestionTimer(questionId) {
  gameState.timerQuestionId = questionId;
  gameState.timerExpired = false;
  gameState.timerTenSecondWarningShown = false;
  gameState.timerFiveSecondWarningShown = false;
  gameState.timerDeadline = Date.now() + QUESTION_TIME_SECONDS * 1000;
  scheduleQuestionTimer(questionId);
}

function scheduleQuestionTimer(questionId) {
  window.clearInterval(gameState.timerInterval);
  const tick = () => {
    if (gameState.answering || gameState.timerExpired) return;
    const remainingMs = gameState.timerDeadline - Date.now();
    const remaining = Math.max(0, Math.ceil(remainingMs / 1000));
    updateQuestionTimer(remaining);
    if (remainingMs <= 0) {
      window.clearInterval(gameState.timerInterval);
      gameState.timerInterval = null;
      handleQuestionTimeout(questionId);
    }
  };
  tick();
  if (!gameState.timerExpired && !gameState.answering) {
    gameState.timerInterval = window.setInterval(tick, 100);
  }
}

function updateQuestionTimer(secondsLeft) {
  const value = document.getElementById('timer-value');
  const ring = document.getElementById('timer-ring');
  if (value) value.textContent = String(Math.max(0, secondsLeft));
  if (ring) {
    const pct = Math.max(0, Math.min(100, (secondsLeft / QUESTION_TIME_SECONDS) * 100));
    ring.style.setProperty('--timer-pct', pct + '%');
    ring.classList.toggle('urgent', secondsLeft <= 10);
  }
  if (secondsLeft <= 5 && !gameState.timerFiveSecondWarningShown) {
    gameState.timerFiveSecondWarningShown = true;
    gameState.timerTenSecondWarningShown = true;
    setPresenterMessage('urgent5');
  } else if (secondsLeft <= 10 && !gameState.timerTenSecondWarningShown) {
    gameState.timerTenSecondWarningShown = true;
    setPresenterMessage('urgent10');
  }
}

async function handleQuestionTimeout(questionId) {
  if (gameState.answering || gameState.timerExpired || gameState.questions[gameState.questionIndex]?.id !== questionId) return;
  gameState.timerExpired = true;
  gameState.answering = true;
  setPresenterMessage('timeout');
  try {
    const result = await window.api.timeout(gameState.gameId, questionId);
    showTimeoutLoss(result.prize);
  } catch (error) {
    console.error('Error al registrar el tiempo agotado:', error);
    showTimeoutLoss(gameState.currentPrize);
  }
}

function showTimeoutLoss(prize) {
  sessionStorage.setItem('game_result', JSON.stringify({
    type: 'loss',
    reason: 'timeout',
    player: gameState.playerName,
    prize: formatCurrency(prize || 0),
    cleared: gameState.questionIndex + 1
  }));
  setTimeout(() => { window.location.href = 'results.html'; }, ANSWER_FEEDBACK_MS);
}

function showLossResult(prize) {
  sessionStorage.setItem('game_result', JSON.stringify({
    type: 'loss',
    player: gameState.playerName,
    prize: formatCurrency(prize || 0),
    cleared: gameState.questionIndex
  }));
  setTimeout(() => { window.location.href = 'results.html'; }, ANSWER_FEEDBACK_MS);
}

function showAnswerFeedback(optionButtons, correctLetter) {
  optionButtons.forEach(option => {
    const isCorrect = option.dataset.option === correctLetter;
    option.classList.remove('selected', 'removed-5050', 'correct', 'incorrect');
    option.classList.add(isCorrect ? 'correct' : 'incorrect');
  });
}

// ─── Selección e Imagen del Presentador ────────────────────────────────
function getSelectedPresenter() {
  return localStorage.getItem('selected_presenter') || 'clasico';
}

function applySelectedPresenter() {
  const charKey = getSelectedPresenter();
  const charImages = {
    clasico: 'assets/images/presentador-clasico.png',
    terminator: 'assets/images/presentador-terminator.png',
    masterchief: 'assets/images/presentador-masterchief.png',
    james: 'assets/images/presentador-james.png'
  };
  const img = document.querySelector('.presenter-art');
  if (img) {
    img.src = charImages[charKey] || charImages.clasico;
    const names = {
      clasico: 'El Anfitrión Clásico',
      terminator: 'Terminator T-800',
      masterchief: 'Master Chief (Spartan 117)',
      james: 'James Rodríguez'
    };
    img.alt = names[charKey] || 'Presentador del concurso';
  }
}

// ─── Bocadillo de diálogo del presentador ─────────────────────────────
function setPresenterMessage(key) {
  gameState.presenterMessageKey = key;
  const el = document.getElementById('presenter-message');
  if (!el) return;

  const name = gameState.playerName;
  const isEnglish = window.getLanguage && window.getLanguage() === 'en';
  const charKey = getSelectedPresenter();

  const characterMessages = {
    clasico: {
      welcome: isEnglish
        ? `Welcome to the show, ${name}! Answer all 15 questions correctly to win.`
        : `¡Bienvenido al concurso, ${name}! Responde las 15 preguntas.`,
      newquestion: isEnglish
        ? `Alright ${name}, here comes your next question. Think carefully!`
        : `Muy bien ${name}, aquí viene tu siguiente pregunta. ¡Piensa con cuidado!`,
      urgent10: isEnglish
        ? `Hurry up, ${name}! Time is running out!`
        : `¡Apúrate ${name}, se agota el tiempo!`,
      urgent5: isEnglish
        ? `Only seconds left, ${name}! Choose now!`
        : `¡Solo quedan segundos, ${name}! ¡Elige ya!`,
      correct: isEnglish
        ? 'Excellent! You move on to the next question.'
        : '¡Excelente! Pasas a la siguiente pregunta.',
      incorrect: isEnglish
        ? 'Unfortunately, that was not the correct option.'
        : 'Lamentablemente esa no era la opción correcta.',
      win: isEnglish
        ? `Incredible, ${name}! You answered all 15 questions. You are a millionaire!`
        : `¡Increíble, ${name}! Has respondido las 15 preguntas. ¡Eres millonario!`,
      timeout: isEnglish
        ? `Time’s up, ${name}! Thanks for playing.`
        : `¡Se acabó el tiempo, ${name}! Gracias por jugar.`,
      fifty: isEnglish
        ? '50:50 activated. I’ve removed two incorrect answers for you.'
        : 'Comodín 50:50 activado. He eliminado dos respuestas incorrectas.',
      audience: isEnglish
        ? 'The audience has voted. Take a look at the results!'
        : 'El público ya ha votado. ¡Observa sus respuestas!',
      friend: isEnglish
        ? 'Let’s call your friend for some help.'
        : 'Vamos a llamar a tu amigo para pedirle ayuda.'
    },
    terminator: {
      welcome: isEnglish
        ? `Target identified: ${name}. Answer all 15 questions to conquer.`
        : `Identificación confirmada: ${name}. Responde las 15 preguntas para vencer.`,
      newquestion: isEnglish
        ? `Next calculation ready, ${name}. Submit your response.`
        : `Siguiente consulta para ${name}. Procesa tu respuesta.`,
      urgent10: isEnglish
        ? `Warning, ${name}! Time is running out!`
        : `¡Apúrate ${name}, se agota el tiempo!`,
      urgent5: isEnglish
        ? `Critical timer, ${name}! Execute command immediately!`
        : `¡Alerta crítica ${name}! ¡Tiempo a punto de expirar!`,
      correct: isEnglish
        ? 'Target achieved! You move on to the next question.'
        : '¡Excelente! Pasas a la siguiente pregunta.',
      incorrect: isEnglish
        ? 'Unfortunately, that was not the correct option. Hasta la vista, baby.'
        : 'Lamentablemente esa no era la opción correcta. Hasta la vista, baby.',
      win: isEnglish
        ? `Mission complete, ${name}. All 15 questions answered. Status: Millionaire.`
        : `¡Misión cumplida, ${name}! 15 respuestas correctas. ¡Eres millonario!`,
      timeout: isEnglish
        ? `Timer expired for ${name}. Operation terminated.`
        : `¡Se acabó el tiempo para ${name}! Operación terminada.`,
      fifty: isEnglish
        ? 'Tactical scan complete: 2 false options terminated.'
        : 'Comodín 50:50: dos respuestas erróneas destruidas.',
      audience: isEnglish
        ? 'Audience consensus scan complete. Review data.'
        : 'Datos de la multitud analizados. Revisa sus porcentajes.',
      friend: isEnglish
        ? 'Encrypted external communication link established.'
        : 'Enlace de comunicación externa establecido con tu aliado.'
    },
    masterchief: {
      welcome: isEnglish
        ? `Chief reporting in, soldier ${name}. Answer all 15 questions to finish the fight.`
        : `Aquí Jefe Maestro, soldado ${name}. Responde las 15 preguntas para ganar.`,
      newquestion: isEnglish
        ? `New waypoint loaded, ${name}. Keep your eyes sharp!`
        : `Nuevo objetivo alcanzado, ${name}. ¡Mantén la concentración!`,
      urgent10: isEnglish
        ? `Move fast, ${name}! Time is running out!`
        : `¡Apúrate ${name}, se agota el tiempo!`,
      urgent5: isEnglish
        ? `Shields depleted, ${name}! Fire your answer now!`
        : `¡Poco tiempo soldado ${name}! ¡Elige tu respuesta ya!`,
      correct: isEnglish
        ? 'Direct hit, Spartan! You move on to the next question.'
        : '¡Excelente! Pasas a la siguiente pregunta.',
      incorrect: isEnglish
        ? 'Unfortunately, that was not the correct option. Regrouping.'
        : 'Lamentablemente esa no era la opción correcta. Misión fallida.',
      win: isEnglish
        ? `War won, ${name}! You completed all 15 objectives. You are a millionaire!`
        : `¡Victoria absoluta, ${name}! Cumpliste los 15 objetivos. ¡Eres millonario!`,
      timeout: isEnglish
        ? `Clock ran out, soldier ${name}. Evac underway.`
        : `¡Se acabó el tiempo, soldado ${name}! Extracción completada.`,
      fifty: isEnglish
        ? 'Targeting beacon activated: 2 incorrect options neutralized.'
        : 'Apoyo táctico 50:50: dos opciones neutralizadas.',
      audience: isEnglish
        ? 'Recon coordinates incoming from audience.'
        : 'Datos de reconocimiento de la audiencia en pantalla.',
      friend: isEnglish
        ? 'Comms channel opened to your squadmate.'
        : 'Abriendo canal seguro de radio con tu aliado.'
    },
    james: {
      welcome: isEnglish
        ? `Welcome to the field, ${name}! Score all 15 questions with class.`
        : `¡Bienvenido al concurso, ${name}! Responde las 15 preguntas con magia.`,
      newquestion: isEnglish
        ? `Here comes the next pass, ${name}. Put it in the top corner!`
        : `¡Va el siguiente pase, ${name}! A definirla con categoría.`,
      urgent10: isEnglish
        ? `Hurry up, ${name}! Time is running out on the clock!`
        : `¡Apúrate ${name}, se agota el tiempo!`,
      urgent5: isEnglish
        ? `Stoppage time, ${name}! Shoot now!`
        : `¡Quedan segundos en el reloj, ${name}! ¡Remata ya!`,
      correct: isEnglish
        ? 'Golazo! You move on to the next question.'
        : '¡Excelente! Pasas a la siguiente pregunta.',
      incorrect: isEnglish
        ? 'Unfortunately, that was not the correct option. Keep your head up!'
        : 'Lamentablemente esa no era la opción correcta. ¡A levantar cabeza!',
      win: isEnglish
        ? `World champion, ${name}! 15 questions scored! You are a millionaire!`
        : `¡Goooool y campeones, ${name}! 15 de 15. ¡Eres millonario!`,
      timeout: isEnglish
        ? `Final whistle, ${name}! Thanks for playing.`
        : `¡Pitazo final, ${name}! Se acabó el tiempo del partido.`,
      fifty: isEnglish
        ? 'Precision play: 2 defenders cleared off the field.'
        : 'Comodín 50:50: dos respuestas erróneas fuera de la cancha.',
      audience: isEnglish
        ? 'The stadium crowd made their call. Check out the results!'
        : 'La hinchada ya se hizo sentir en la tribuna. ¡Mira los votos!',
      friend: isEnglish
        ? 'Passing the ball to your teammate for assistance.'
        : 'Pase al compañero: vamos a llamar a tu amigo.'
    }
  };

  const currentDict = characterMessages[charKey] || characterMessages.clasico;
  const messages = currentDict;

  el.classList.remove('message-update');
  el.textContent = messages[key] || characterMessages.clasico[key] || key;
  void el.offsetWidth;
  el.classList.add('message-update');
}

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

  // Aplicar personaje seleccionado
  applySelectedPresenter();

  // 3. Restaurar progreso previo si el jugador recargó la página
  const restored = restoreProgress();

  // 4. Inicializar Escalera Visual
  renderLadder();

  // 5. Cargar Preguntas del Backend
  try {
    const language = window.getLanguage ? window.getLanguage() : 'es';
    const data = await window.api.getQuestions(gameState.gameId, language);
    gameState.questions = data.questions || [];

    if (!gameState.questions.length) {
      throw new Error('No se recibieron preguntas del servidor.');
    }

    renderCurrentQuestion();
    setPresenterMessage('welcome');

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
  setupLanguageChange();
  setupLifelines();
  setupQuitFlow();
  setupModalCloses();
  setupSettingsInGame();

  // 7. Alternar sonido en la cabecera del juego
  const btnSoundGame = document.getElementById('btn-sound-game');
  if (btnSoundGame) {
    btnSoundGame.textContent = localStorage.getItem('mute_audio') === '1' ? '🔇' : '🔊';
    btnSoundGame.addEventListener('click', () => {
      const muted = localStorage.getItem('mute_audio') === '1';
      localStorage.setItem('mute_audio', muted ? '0' : '1');
      btnSoundGame.textContent = muted ? '🔊' : '🔇';
    });
  }
});

// Restaurar el estado visual de los botones de comodines tras recarga
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
      <span class="step-prize">${formatCurrency(Number(item.prize.replace(/[^0-9]/g, '')))}</span>
    `;
    ladderList.appendChild(stepEl);
  }
}

// Recargar preguntas al cambiar de idioma
function setupLanguageChange() {
  let languageRequest = 0;
  window.addEventListener('languagechange', async (event) => {
    if (!gameState.gameId) return;
    const requestNumber = ++languageRequest;
    try {
      const data = await window.api.getQuestions(gameState.gameId, event.detail.language);
      if (requestNumber !== languageRequest || event.detail.language !== window.getLanguage()) return;
      gameState.questions = data.questions || [];
      renderCurrentQuestion();
      setPresenterMessage(gameState.presenterMessageKey || 'welcome');
    } catch (error) {
      if (requestNumber !== languageRequest) return;
      showToast(error.message || 'Could not load questions in the selected language.', 'error');
    }
  });
}

// Renderizar Pregunta Actual
function renderCurrentQuestion() {
  const q = gameState.questions[gameState.questionIndex];
  if (!q) return;

  gameState.answering = false;
  if (gameState.timerQuestionId !== q.id) {
    startQuestionTimer(q.id);
    setPresenterMessage(gameState.questionIndex === 0 ? 'welcome' : 'newquestion');
  }

  // Actualizar Contador y Premios
  const questionNumDisplay = document.getElementById('question-num-display');
  const prizeDisplay = document.getElementById('prize-display');
  const questionText = document.getElementById('question-text');
  const withdrawPrize = document.getElementById('withdraw-prize');

  if (questionNumDisplay) {
    questionNumDisplay.textContent = `${gameState.questionIndex + 1} / ${gameState.questions.length}`;
  }

  if (prizeDisplay) {
    prizeDisplay.textContent = formatCurrency(gameState.currentPrize);
  }

  if (withdrawPrize) {
    withdrawPrize.textContent = formatCurrency(gameState.currentPrize);
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
      if (gameState.answering || gameState.timerExpired) return; // Evitar doble envío

      const q = gameState.questions[gameState.questionIndex];
      if (Date.now() >= gameState.timerDeadline) {
        handleQuestionTimeout(q.id);
        return;
      }

      gameState.answering = true;
      window.clearInterval(gameState.timerInterval);
      gameState.timerInterval = null;
      SoundFX.click();

      const selectedLetter = btn.getAttribute('data-option');
      btn.classList.add('selected');

      // Deshabilitar todos los botones mientras se valida
      optionButtons.forEach(b => b.disabled = true);

      try {
        // Enviar respuesta al backend según contrato
        const result = await window.api.answer(gameState.gameId, q.id, selectedLetter);
        const correctLetter = result.correct ? selectedLetter : result.correct_answer;
        showAnswerFeedback(optionButtons, correctLetter);

        if (result.correct) {
          SoundFX.correct();

          // Actualizar premio acumulado
          if (result.prize !== undefined) {
            gameState.currentPrize = result.prize;
          }

          if (result.game_finished) {
            // ¡Victoria Total! (el backend ya cierra la partida)
            setPresenterMessage('win');
            clearProgress();

            sessionStorage.setItem('game_result', JSON.stringify({
              type: 'win',
              player: gameState.playerName,
              prize: formatCurrency(result.prize || gameState.currentPrize),
              cleared: gameState.questionIndex + 1
            }));

            setTimeout(() => window.location.href = 'results.html', ANSWER_FEEDBACK_MS);
          } else {
            // Avanzar a la siguiente pregunta (espera para ver el color verde)
            setPresenterMessage('correct');
            setTimeout(() => {
              gameState.questionIndex++;
              saveProgress();
              renderCurrentQuestion();
            }, ANSWER_FEEDBACK_MS);
          }

        } else {
          // Respuesta Incorrecta (Derrota)
          SoundFX.wrong();
          setPresenterMessage('incorrect');
          clearProgress();
          showLossResult(result.prize);
        }

      } catch (error) {
        // Al fallar la red, NO reactivar opciones eliminadas por 50/50
        console.error('Error al enviar respuesta:', error);
        btn.classList.remove('selected');
        optionButtons.forEach(b => {
          // Solo reactivar los botones que NO fueron removidos por el 50/50
          if (!b.classList.contains('removed-5050')) {
            b.disabled = false;
          }
        });
        gameState.answering = false;
        if (!gameState.timerExpired) scheduleQuestionTimer(q.id);

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
        saveProgress();

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
        setPresenterMessage('fifty');
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
        saveProgress();

        renderAudienceChart(res.percentages || { A: 25, B: 25, C: 25, D: 25 });
        setPresenterMessage('audience');
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
        saveProgress();

        const friendMsgEl = document.getElementById('friend-message');
        if (friendMsgEl) {
          friendMsgEl.textContent = `"${res.message || 'Creo que deberías revisar bien las opciones antes de responder.'}"`;
        }
        setPresenterMessage('friend');
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
    saveProgress();
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

  const openQuitModal = () => {
    if (gameState.answering) return;
    if (quitPrizePreview) quitPrizePreview.textContent = formatCurrency(gameState.currentPrize);
    openModal('modal-confirm-quit');
  };

  if (btnQuit) {
    btnQuit.addEventListener('click', openQuitModal);
  }

  const btnWithdraw = document.getElementById('btn-withdraw');
  if (btnWithdraw) {
    btnWithdraw.addEventListener('click', openQuitModal);
  }

  if (btnConfirmQuit) {
    btnConfirmQuit.addEventListener('click', async () => {
      try {
        btnConfirmQuit.disabled = true;
        const res = await window.api.quit(gameState.gameId);

        clearProgress();

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

function setupSettingsInGame() {
  const btnSettings = document.getElementById('btn-settings-game');
  if (btnSettings) {
    btnSettings.addEventListener('click', () => {
      openModal('modal-settings-game');
      const current = getSelectedPresenter();
      document.querySelectorAll('#characters-selector-game .character-card').forEach(card => {
        const isCurrent = card.dataset.char === current;
        card.classList.toggle('active', isCurrent);
        card.setAttribute('aria-checked', isCurrent ? 'true' : 'false');
      });
    });
  }

  document.querySelectorAll('#characters-selector-game .character-card').forEach(card => {
    card.addEventListener('click', () => {
      const selected = card.dataset.char;
      localStorage.setItem('selected_presenter', selected);
      document.querySelectorAll('#characters-selector-game .character-card').forEach(c => {
        const active = c === card;
        c.classList.toggle('active', active);
        c.setAttribute('aria-checked', active ? 'true' : 'false');
      });
      applySelectedPresenter();
      setPresenterMessage(gameState.presenterMessageKey || 'welcome');
      const names = {
        clasico: 'El Anfitrión Clásico',
        terminator: 'Terminator T-800',
        masterchief: 'Master Chief (Spartan 117)',
        james: 'James Rodríguez'
      };
      showToast(`Presentador: ${names[selected] || selected}`, 'info');
    });
  });
}
