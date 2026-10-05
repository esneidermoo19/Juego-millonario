/**
 * Controlador de la Tabla de Clasificación (ranking.html)
 *
 * Requiere: utils.js (showToast, formatCurrency), api.js
 *
 * TAREA 1 (XSS): Las filas del ranking se construyen con createElement
 * y textContent en vez de innerHTML, para que un nombre de jugador
 * malicioso (ej. "<img onerror=alert(1)>") nunca se interprete como HTML.
 */

document.addEventListener('DOMContentLoaded', async () => {
  const tableBody = document.getElementById('ranking-body');
  if (!tableBody) return;

  try {
    const data = await window.api.getRanking();
    const rankingList = data.ranking || [];

    if (!rankingList.length) {
      tableBody.innerHTML = '';
      const tr = document.createElement('tr');
      const td = document.createElement('td');
      td.colSpan = 3;
      td.className = 'empty-ranking';
      td.textContent = '🎮 Aún no hay puntuaciones registradas en el ranking. ¡Sé el primer jugador en llevarte el premio millonario!';
      tr.appendChild(td);
      tableBody.appendChild(tr);
      return;
    }

    tableBody.innerHTML = '';

    rankingList.slice(0, 10).forEach((row, index) => {
      const position = row.position || (index + 1);
      const player = row.player || 'Anónimo';
      const prize = row.prize !== undefined ? row.prize : 0;

      let badgeClass = 'rank-other';
      let badgeText = String(position);
      if (position === 1) { badgeClass = 'rank-top-1'; badgeText = '🥇'; }
      else if (position === 2) { badgeClass = 'rank-top-2'; badgeText = '🥈'; }
      else if (position === 3) { badgeClass = 'rank-top-3'; badgeText = '🥉'; }

      const tr = document.createElement('tr');

      // Celda: Posición
      const tdPos = document.createElement('td');
      tdPos.style.textAlign = 'center';
      const badge = document.createElement('span');
      badge.className = `rank-badge ${badgeClass}`;
      badge.textContent = badgeText;
      tdPos.appendChild(badge);
      tr.appendChild(tdPos);

      // Celda: Nombre del jugador (XSS-safe via textContent)
      const tdName = document.createElement('td');
      const nameSpan = document.createElement('span');
      nameSpan.style.fontWeight = '700';
      nameSpan.textContent = player;  // SEGURO: textContent, no innerHTML
      tdName.appendChild(nameSpan);
      tr.appendChild(tdName);

      // Celda: Premio
      const tdPrize = document.createElement('td');
      tdPrize.style.textAlign = 'right';
      const prizeSpan = document.createElement('span');
      prizeSpan.className = 'prize-highlight';
      prizeSpan.textContent = formatCurrency(prize);
      tdPrize.appendChild(prizeSpan);
      tr.appendChild(tdPrize);

      tableBody.appendChild(tr);
    });

  } catch (error) {
    console.error('Error al cargar ranking:', error);
    if (error.status === undefined) {
      showToast('No se pudo conectar con el servidor para obtener el ranking.', 'error');
    } else {
      showToast(`Error: ${error.message}`, 'error');
    }

    tableBody.innerHTML = '';
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = 3;
    td.className = 'empty-ranking';
    td.style.color = 'var(--danger-red)';
    td.textContent = '⚠️ No se pudo cargar el ranking. Verifica que el servidor backend esté encendido en http://127.0.0.1:5000.';
    tr.appendChild(td);
    tableBody.appendChild(tr);
  }
});
