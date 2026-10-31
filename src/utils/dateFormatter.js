/**
 * Standard Kurdish (Sorani) & Kurdistan Date/Time/Currency Formatting Engine
 * Enforces DD/MM/YYYY and Sorani Kurdish localization standards everywhere.
 */

/**
 * Format any date/timestamp into standard DD/MM/YYYY
 * Example: 2026-10-18 -> 18/10/2026
 * Handles Date objects, ISO strings, MySQL datetime strings, timestamps.
 */
export function formatDate(input) {
  if (!input) return '-';
  try {
    if (input instanceof Date) {
      if (isNaN(input.getTime())) return '-';
      const day = String(input.getDate()).padStart(2, '0');
      const month = String(input.getMonth() + 1).padStart(2, '0');
      const year = input.getFullYear();
      return `${day}/${month}/${year}`;
    }

    const str = String(input).trim();
    // Check if matching YYYY-MM-DD or YYYY/MM/DD
    const match = str.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
    if (match) {
      const [, y, m, d] = match;
      return `${d.padStart(2, '0')}/${m.padStart(2, '0')}/${y}`;
    }

    // Check if already matching DD/MM/YYYY or DD-MM-YYYY
    const dmyMatch = str.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
    if (dmyMatch) {
      const [, d, m, y] = dmyMatch;
      return `${d.padStart(2, '0')}/${m.padStart(2, '0')}/${y}`;
    }

    const d = new Date(input);
    if (isNaN(d.getTime())) return str;
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  } catch {
    return '-';
  }
}

/**
 * Format date and time into DD/MM/YYYY - HH:mm or 12-hour format with Sorani markers
 * Example: 18/10/2026 - 14:30
 */
export function formatDateTime(input, options = {}) {
  if (!input) return '-';
  try {
    const d = new Date(input);
    if (isNaN(d.getTime())) return formatDate(input);

    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    const datePart = `${day}/${month}/${year}`;

    let hours = d.getHours();
    const minutes = String(d.getMinutes()).padStart(2, '0');

    if (options.twelveHour) {
      const period = hours >= 12 ? 'د.ن' : 'پ.ن'; // د.ن = دوای نیوەڕۆ, پ.ن = پێش نیوەڕۆ
      hours = hours % 12 || 12;
      const hoursStr = String(hours).padStart(2, '0');
      return `${datePart} ${hoursStr}:${minutes} ${period}`;
    }

    const hoursStr = String(hours).padStart(2, '0');
    return `${datePart} - ${hoursStr}:${minutes}`;
  } catch {
    return '-';
  }
}

/**
 * Format time only (HH:mm or HH:mm:ss)
 */
export function formatTime(input, withSeconds = false) {
  if (!input) return '00:00';
  try {
    const d = new Date(input);
    if (isNaN(d.getTime())) return '00:00';
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    if (withSeconds) {
      const seconds = String(d.getSeconds()).padStart(2, '0');
      return `${hours}:${minutes}:${seconds}`;
    }
    return `${hours}:${minutes}`;
  } catch {
    return '00:00';
  }
}

/**
 * Format amount as Iraqi Dinar with comma separators and Kurdish currency symbol
 * Example: 25000 -> "25,000 د.ع"
 */
export function formatCurrency(amount, symbol = 'د.ع') {
  if (amount === null || amount === undefined || isNaN(Number(amount))) {
    return `0 ${symbol}`;
  }
  const num = Math.round(Number(amount));
  return `${num.toLocaleString('en-US')} ${symbol}`;
}

/**
 * Relative or localized date string in Sorani Kurdish
 * e.g. "ئەمڕۆ", "دوێنێ", or "18/10/2026"
 */
export function formatRelativeDate(input) {
  if (!input) return '-';
  try {
    const d = new Date(input);
    if (isNaN(d.getTime())) return formatDate(input);
    const today = new Date();
    const yesterday = new Date(Date.now() - 86400000);

    const isSameDay = (d1, d2) => 
      d1.getDate() === d2.getDate() && 
      d1.getMonth() === d2.getMonth() && 
      d1.getFullYear() === d2.getFullYear();

    if (isSameDay(d, today)) return 'ئەمڕۆ';
    if (isSameDay(d, yesterday)) return 'دوێنێ';
    return formatDate(d);
  } catch {
    return formatDate(input);
  }
}

export function getLocalDateString(d = new Date()) {
  const dateObj = d instanceof Date ? d : new Date(d);
  if (isNaN(dateObj.getTime())) return '';
  const year = dateObj.getFullYear();
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const day = String(dateObj.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export default {
  formatDate,
  formatDateTime,
  formatTime,
  formatCurrency,
  formatRelativeDate,
  getLocalDateString
};
