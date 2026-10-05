/**
 * Controlador de la Pantalla Principal (index.html)
 * Requiere: utils.js (showToast), api.js
 */

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('start-game-form');
  const nameInput = document.getElementById('player-name');
  const btnPlay = document.getElementById('btn-play');

  // Modal de Instrucciones
  const instructionsModal = document.getElementById('instructions-modal');
  const btnOpenInstructions = document.getElementById('btn-open-instructions');
  const btnCloseInstructions = document.getElementById('btn-close-instructions');
  const btnGotIt = document.getElementById('btn-got-it');

  if (btnOpenInstructions && instructionsModal) {
    btnOpenInstructions.addEventListener('click', () => {
      instructionsModal.classList.add('active');
    });
  }

  const closeModal = () => {
    if (instructionsModal) instructionsModal.classList.remove('active');
  };

  if (btnCloseInstructions) btnCloseInstructions.addEventListener('click', closeModal);
  if (btnGotIt) btnGotIt.addEventListener('click', closeModal);

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
        btnPlay.textContent = '🎮 JUGAR AHORA';
      }
    });
  }
});
