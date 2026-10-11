/**
 * Controlador de la Pantalla Principal (index.html)
 * Requiere: utils.js (showToast), api.js
 */

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('start-game-form');
  const nameInput = document.getElementById('player-name');
  const btnPlay = document.getElementById('btn-play');
  const playerModal = document.getElementById('player-modal');
  const settingsModal = document.getElementById('settings-modal');
  const btnOpenPlayer = document.getElementById('btn-open-player-modal');
  const btnOpenSettings = document.getElementById('btn-open-settings');

  const openModal = (modal, focusTarget) => {
    if (!modal) return;
    modal.classList.add('active');
    modal.setAttribute('aria-hidden', 'false');
    if (focusTarget) window.setTimeout(() => focusTarget.focus(), 80);
  };

  const closeModal = (modal) => {
    if (!modal) return;
    modal.classList.remove('active');
    modal.setAttribute('aria-hidden', 'true');
  };

  if (btnOpenPlayer) {
    btnOpenPlayer.addEventListener('click', () => openModal(playerModal, nameInput));
  }
  if (btnOpenSettings) {
    btnOpenSettings.addEventListener('click', () => openModal(settingsModal, document.getElementById('language-toggle')));
  }

  document.querySelectorAll('[data-modal-close]').forEach((button) => {
    button.addEventListener('click', () => closeModal(document.getElementById(button.dataset.modalClose)));
  });
  [playerModal, settingsModal].forEach((modal) => {
    if (modal) {
      modal.addEventListener('click', (event) => {
        if (event.target === modal) closeModal(modal);
      });
    }
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      closeModal(playerModal);
      closeModal(settingsModal);
    }
  });

  // Alternar sonido (preferencia persistente en localStorage)
  const btnSound = document.getElementById('btn-sound');
  const soundIcon = btnSound && btnSound.querySelector('.settings-sound-icon');
  const updateSoundIcon = () => {
    if (!btnSound) return;
    const muted = localStorage.getItem('mute_audio') === '1';
    if (soundIcon) soundIcon.textContent = muted ? '🔇' : '🔊';
    const isEnglish = window.getLanguage && window.getLanguage() === 'en';
    btnSound.setAttribute('aria-label', muted
      ? (isEnglish ? 'Enable sound' : 'Activar sonido')
      : (isEnglish ? 'Mute sound' : 'Silenciar sonido'));
  };
  if (btnSound) {
    updateSoundIcon();
    window.addEventListener('languagechange', updateSoundIcon);
    btnSound.addEventListener('click', () => {
      const muted = localStorage.getItem('mute_audio') === '1';
      localStorage.setItem('mute_audio', muted ? '0' : '1');
      updateSoundIcon();
    });
  }

  // Iniciar Juego (Validación + Llamadas a API)
  if (form && nameInput) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      const playerName = nameInput.value.trim();

      // Validación de frontend según Fronted.md
      if (!playerName) {
        showToast('Por favor, ingresa un nombre para jugar.', 'warning');
        nameInput.focus();
        return;
      }

      if (playerName.length < 2) {
        showToast('El nombre debe tener al menos 2 caracteres.', 'warning');
        nameInput.focus();
        return;
      }

      if (playerName.length > 25) {
        showToast('El nombre es demasiado largo (máximo 25 caracteres).', 'warning');
        nameInput.focus();
        return;
      }

      try {
        btnPlay.disabled = true;
        btnPlay.textContent = '⏳ Creando partida...';

        // 1. Crear Jugador
        const playerData = await window.api.createPlayer(playerName);
        const playerId = playerData.player ? playerData.player.id : playerData.id;
        const confirmedName = playerData.player ? playerData.player.name : playerName;

        if (!playerId) {
          throw new Error('No se recibió el identificador del jugador.');
        }

        // 2. Crear Partida
        const gameData = await window.api.createGame(playerId);
        const gameId = gameData.game ? gameData.game.id : gameData.id;

        if (!gameId) {
          throw new Error('No se recibió el identificador de la partida.');
        }

        // 3. Guardar en SessionStorage para uso del juego y resultados
        sessionStorage.setItem('player_id', playerId);
        sessionStorage.setItem('player_name', confirmedName);
        sessionStorage.setItem('game_id', gameId);

        // 4. Redirigir a la arena de juego
        window.location.href = 'game.html';

      } catch (error) {
        console.error('Error al iniciar el juego:', error);
        if (error.status === undefined) {
          showToast('⚠️ No se pudo conectar con el servidor. Verifica que el backend esté ejecutándose en http://127.0.0.1:5000.', 'error');
        } else {
          showToast(`Error: ${error.message}`, 'error');
        }
      } finally {
        btnPlay.disabled = false;
        btnPlay.textContent = 'COMENZAR';
      }
    });
  }
});
