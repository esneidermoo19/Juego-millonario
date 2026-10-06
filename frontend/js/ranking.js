/**
 * Controlador de la Tabla de Clasificación (ranking.html)
 */

function formatCurrency(val) {
  if (typeof val === 'string' && val.startsWith('$')) return val;
  const num = Number(val) || 0;
  const locale = window.getLanguage && window.getLanguage() === 'en' ? 'en-US' : 'es-CO';
  return `$${num.toLocaleString(locale)}`;
}

function showToast(message, type = 'error') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <span>${type === 'error' ? '⚠️' : type === 'success' ? '✅' : 'ℹ️'}</span>
    <span>${message}</span>
  `;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

document.addEventListener('DOMContentLoaded', async () => {
  const tableBody = document.getElementById('ranking-body');
  if (!tableBody) return;

  try {
    const data = await window.api.getRanking();
    const rankingList = data.ranking || [];

    if (!rankingList.length) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="3" class="empty-ranking">
            🎮 Aún no hay puntuaciones registradas en el ranking.<br>
            ¡Sé el primer jugador en llevarte el premio millonario!
          </td>
        </tr>
      `;
      return;
    }

    tableBody.innerHTML = '';

    rankingList.slice(0, 10).forEach((row, index) => {
      const position = row.position || (index + 1);
      const player = row.player || 'Anónimo';
      const prize = row.prize !== undefined ? row.prize : 0;

      let badgeClass = 'rank-other';
      if (position === 1) badgeClass = 'rank-top-1';
      else if (position === 2) badgeClass = 'rank-top-2';
      else if (position === 3) badgeClass = 'rank-top-3';

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td style="text-align: center;">
          <span class="rank-badge ${badgeClass}">
            ${position === 1 ? '🥇' : position === 2 ? '🥈' : position === 3 ? '🥉' : position}
          </span>
        </td>
        <td>
          <span style="font-weight: 700;">${player}</span>
        </td>
        <td style="text-align: right;">
          <span class="prize-highlight">${formatCurrency(prize)}</span>
        </td>
      `;
      tableBody.appendChild(tr);
    });

  } catch (error) {
    console.error('Error al cargar ranking:', error);
    if (error.status === undefined) {
      showToast('⚠️ No se pudo conectar con el servidor para obtener el ranking.', 'error');
    } else {
      showToast(`Error: ${error.message}`, 'error');
    }

    tableBody.innerHTML = `
      <tr>
        <td colspan="3" class="empty-ranking" style="color: var(--danger-red);">
          ⚠️ No se pudo cargar el ranking.<br>
          Verifica que el servidor backend esté encendido en <code>http://127.0.0.1:5000</code>.
        </td>
      </tr>
    `;
  }
});
