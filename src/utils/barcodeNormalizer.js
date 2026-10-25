/**
 * Barcode Scanner Normalizer & Keyboard Layout Compensator
 * 
 * Hardware barcode scanners act as USB HID Keyboards.
 * When the operating system is set to Arabic or Kurdish keyboard layouts,
 * pressing physical keys (like 'P') sends localized characters (like 'ث').
 * 
 * This module converts those localized characters back to their physical QWERTY Latin
 * and standard ASCII digit equivalents, ensuring barcodes are always read correctly.
 */

export const KEYBOARD_LAYOUT_TO_QWERTY = {
  // Eastern Arabic & Persian/Kurdish Digits
  '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4',
  '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9',
  '۰': '0', '۱': '1', '۲': '2', '۳': '3', '۴': '4',
  '۵': '5', '۶': '6', '۷': '7', '۸': '8', '۹': '9',

  // P Key: In Kurdish Windows layout, Key P is 'ث' (or 'پ'); in Arabic 101, Key P is 'ح'
  'ث': 'P',
  'ح': 'P',
  'پ': 'P',

  // QWERTY Upper Row
  'ض': 'Q',
  'ص': 'W',
  'ە': 'E',
  'ق': 'R',
  'ف': 'T',
  'غ': 'Y',
  'ع': 'U',
  'ه': 'I',
  'هـ': 'I',
  'خ': 'O',
  'ۆ': 'O',
  'ج': '[',
  'د': ']',

  // QWERTY Home Row
  'ش': 'A',
  'س': 'S',
  'ي': 'D',
  'ی': 'D',
  'ب': 'F',
  'ل': 'G',
  'گ': 'G',
  'ا': 'H',
  'أ': 'H',
  'إ': 'H',
  'آ': 'H',
  'ت': 'J',
  'ن': 'K',
  'م': 'L',
  'ك': ';',
  'ک': ';',
  'ط': "'",

  // QWERTY Bottom Row
  'ئ': 'Z',
  'ء': 'X',
  'ؤ': 'C',
  'چ': 'C',
  'ڕ': 'V',
  'ر': 'V',
  'ڤ': 'V',
  'لا': 'B',
  'ى': 'N',
  'ة': 'M',
  'و': ',',
  'ز': '.',
  'ژ': 'Z',
  'ڵ': 'L',
  'ظ': '/',
  '،': ',',
  '؟': '?'
};

/**
 * Normalizes a single character if it was produced by an Arabic/Kurdish keyboard layout.
 */
export function normalizeBarcodeChar(char) {
  if (!char) return '';
  return KEYBOARD_LAYOUT_TO_QWERTY[char] || char;
}

/**
 * Normalizes an entire barcode string (e.g. from an input field, paste, or scan).
 * Converts Arabic/Kurdish letters and Eastern digits to standard QWERTY Latin and digits.
 */
export function normalizeBarcode(input) {
  if (input === null || input === undefined) return '';
  const str = String(input);
  let result = '';
  for (let i = 0; i < str.length; i++) {
    // Check 2-character ligature 'لا'
    if (i < str.length - 1 && str.substring(i, i + 2) === 'لا') {
      result += 'B';
      i++;
      continue;
    }
    const ch = str[i];
    result += KEYBOARD_LAYOUT_TO_QWERTY[ch] || ch;
  }
  return result;
}

/**
 * Extracts the true physical character from a KeyboardEvent.
 * Uses `e.code` which is 100% immune to OS language layout.
 */
export function getCharFromBarcodeKeyEvent(e) {
  if (!e) return '';

  // 1. Direct physical key code translation (bypasses Windows Arabic/Kurdish keyboard layout)
  if (e.code) {
    if (e.code.startsWith('Key')) {
      const letter = e.code.slice(3); // e.g. "KeyP" -> "P"
      return letter.toUpperCase();
    }
    if (e.code.startsWith('Digit')) {
      return e.code.slice(5); // e.g. "Digit5" -> "5"
    }
    if (e.code.startsWith('Numpad') && e.code.length === 7) {
      return e.code.slice(6); // e.g. "Numpad5" -> "5"
    }
    if (e.code === 'Minus' || e.code === 'NumpadSubtract') return '-';
    if (e.code === 'Slash' || e.code === 'NumpadDivide') return '/';
    if (e.code === 'Period' || e.code === 'NumpadDecimal') return '.';
    if (e.code === 'Comma') return ',';
    if (e.code === 'Space') return ' ';
  }

  // 2. Fallback using character lookup table
  if (e.key && e.key.length === 1) {
    return normalizeBarcodeChar(e.key);
  }

  return '';
}

/**
 * Normalizes receipt and invoice barcodes specifically.
 * Handles Eastern Arabic / Kurdish digits, Kurdish keyboard prefixes ('سهرم', 'سەرم' -> 'shrm'),
 * and trims white spaces.
 */
export function cleanReceiptBarcode(text) {
  if (text === null || text === undefined) return '';
  let str = String(text).trim();

  // Convert all Eastern Arabic and Persian/Kurdish digits (٠-٩ and ۰-۹) to ASCII 0-9
  str = str.replace(/[٠۰]/g, '0')
           .replace(/[١۱]/g, '1')
           .replace(/[٢۲]/g, '2')
           .replace(/[٣۳]/g, '3')
           .replace(/[٤۴]/g, '4')
           .replace(/[٥۵]/g, '5')
           .replace(/[٦۶]/g, '6')
           .replace(/[٧۷]/g, '7')
           .replace(/[٨۸]/g, '8')
           .replace(/[٩۹]/g, '9');

  // Convert Kurdish/Arabic prefix "سهرم" or "سەرم" to "shrm"
  str = str.replace(/^(سهرم|سەرم|shrm|SHRM)\//i, 'shrm/');

  return str;
}

export default normalizeBarcode;
