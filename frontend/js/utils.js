/**
 * Utilidades compartidas del frontend (Millionaire Game)
 * showToast y formatCurrency — importar ANTES de los demás scripts.
 *
 * TAREA 1 (XSS): showToast usa textContent en lugar de innerHTML
 * para que los mensajes del servidor nunca se interpreten como HTML.
 */

/**
 * Muestra una notificación flotante (toast) segura contra XSS.
 * @param {string} message - Texto a mostrar (se inserta como textContent, no HTML).
 * @param {'error'|'success'|'warning'} type - Tipo visual del toast.
 */
function showToast(message, type = 'error') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const icons = { error: '⚠️', success: '✅', warning: 'ℹ️' };

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;

  const iconSpan = document.createElement('span');
  iconSpan.textContent = icons[type] || icons.error;

  const msgSpan = document.createElement('span');
  msgSpan.textContent = message; // textContent evita inyección XSS

  toast.appendChild(iconSpan);
  toast.appendChild(msgSpan);
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

/**
 * Formatea un valor numérico como moneda colombiana.
 * Si ya es un string con '$', lo devuelve tal cual.
 * @param {number|string} val
 * @returns {string}
 */
function formatCurrency(val) {
  if (typeof val === 'string' && val.startsWith('$')) return val;
  const num = Number(val) || 0;
  const locale = (window.getLanguage && window.getLanguage() === 'en') ? 'en-US' : 'es-CO';
  return `$${num.toLocaleString(locale)}`;
}
