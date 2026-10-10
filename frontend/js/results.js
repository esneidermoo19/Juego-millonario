/**
 * Controlador de la Pantalla de Resultados (results.html)
 */

document.addEventListener('DOMContentLoaded', () => {
  const resultDataStr = sessionStorage.getItem('game_result');
  const resultIcon = document.getElementById('result-icon');
  const resultTitle = document.getElementById('result-title');
  const resultMessage = document.getElementById('result-message');
  const finalPrizeEl = document.getElementById('final-prize');
  const resultPlayerEl = document.getElementById('result-player');

  if (!resultDataStr) {
    // Si entran sin partida previa, mostrar estado por defecto
    if (resultPlayerEl) resultPlayerEl.textContent = 'Invitado';
    if (finalPrizeEl) finalPrizeEl.textContent = '$0';
    return;
  }

  try {
    const result = JSON.parse(resultDataStr);

    if (resultPlayerEl) {
      resultPlayerEl.textContent = result.player || 'Jugador';
    }

    if (finalPrizeEl) {
      finalPrizeEl.textContent = result.prize || '$0';
    }

    // Configuración según el desenlace (Victoria, Derrota, Retirada)
    if (result.type === 'win') {
      if (resultIcon) resultIcon.textContent = '👑';
      if (resultTitle) {
        resultTitle.innerHTML = '<span class="logo-gold">¡ERES MILLONARIO!</span>';
      }
      if (resultMessage) {
        resultMessage.textContent = `¡Felicitaciones! Respondiste correctamente las 15 preguntas y conquistaste el juego.`;
      }
    } else if (result.type === 'quit') {
      if (resultIcon) resultIcon.textContent = '💰';
      if (resultTitle) {
        resultTitle.innerHTML = '<span class="logo-pink">TE HAS RETIRADO</span>';
      }
      if (resultMessage) {
        resultMessage.textContent = `Tomaste una sabia decisión y aseguraste tu dinero acumulado.`;
      }
    } else {
      // Pérdida / Derrota
      if (resultIcon) resultIcon.textContent = '💥';
      if (resultTitle) {
        resultTitle.textContent = 'FIN DEL JUEGO';
      }
      if (resultMessage) {
        resultMessage.textContent = result.reason === 'timeout'
          ? `Se agotó el tiempo. Llegaste hasta la pregunta ${result.cleared || 0}. ¡Inténtalo de nuevo!`
          : `Respuesta incorrecta. Llegaste hasta la pregunta ${result.cleared || 0}. ¡Inténtalo de nuevo!`;
      }
    }

  } catch (err) {
    console.error('Error al procesar resultados:', err);
  }
});
