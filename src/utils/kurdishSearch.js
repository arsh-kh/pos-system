/**
 * Kurdish & Arabic Text Normalization and Multi-Token Search Engine
 * Specifically designed for Kurdish Sorani POS systems.
 * 
 * Handles:
 * 1. Kurdish Kaf (ک U+06A9) vs Arabic Kaf (ك U+0643)
 * 2. Kurdish Yaa (ی U+06CC) vs Arabic Yaa (ي U+064A), Alif Maqsura (ى U+0649), Presentation Forms
 * 3. Kurdish Hamza/Alef: ئ (U+0626), آ, أ, إ, ٱ -> ا
 * 4. Kurdish Ae (ە U+06D5) vs Arabic Heh (ه U+0647), Ta Marbuta (ة U+0629)
 * 5. Kurdish ێ (U+06CE) vs ی (U+06CC) for resilient fuzzy search
 * 6. Kurdish ۆ (U+06C6) vs و (U+0648)
 * 7. Kurdish ڕ (U+0695) vs ر (U+0631) & ڵ (U+06B5) vs ل (U+0644)
 * 8. Turkish / Azerbaijani / Kurdish Latin 'i' / 'ı' / 'İ' / 'I' / 'î' / 'ê' normalization
 * 9. Eastern/Arabic numerals (٠١٢٣٤٥٦٧٨٩ and ۰۱۲۳۴۵۶۷۸۹) -> ASCII digits (0-9)
 * 10. Removal of Arabic Harakat (Tashdid, Fatha, Damma, Kasra, Tanween)
 * 11. Removal of Tatweel (ـ) and Zero-Width Non-Joiner (ZWNJ \u200C)
 * 12. Multi-token unordered search (e.g. "شیر پەرچەم" matches "پەرچەم شیر")
 * 13. Repeated vowel normalization (وو -> و, یی -> ی) for spelling variations
 * 14. Bidirectional Latin <-> Kurdish phonetic matching (e.g. "shir" matches "شیر", "pepsi" matches "پێپسی")
 */

// Convert Eastern Arabic-Indic and Persian/Kurdish numerals to ASCII 0-9
export function normalizeDigits(input) {
  if (input === null || input === undefined) return '';
  const str = String(input);
  return str
    .replace(/[٠۰]/g, '0')
    .replace(/[١۱]/g, '1')
    .replace(/[٢۲]/g, '2')
    .replace(/[٣۳]/g, '3')
    .replace(/[٤۴]/g, '4')
    .replace(/[٥۵]/g, '5')
    .replace(/[٦۶]/g, '6')
    .replace(/[٧۷]/g, '7')
    .replace(/[٨۸]/g, '8')
    .replace(/[٩۹]/g, '9');
}

/**
 * Phonetic transliteration from Latin script into Kurdish script.
 * Enables cashiers typing on English keyboards (or barcode scanners outputting Latin characters)
 * to instantly match Kurdish inventory names.
 * e.g., 'shir' -> 'شیر', 'mast' -> 'ماست', 'pepsi' -> 'پەپسی', 'chips' -> 'چیپس'
 */
export function latinToKurdish(latin) {
  if (!latin) return '';
  let s = String(latin).toLowerCase()
    .replace(/[ıİIîÎ]/g, 'i')
    .replace(/[êÊé]/g, 'e')
    .replace(/[ûÛ]/g, 'u')
    .replace(/[çÇ]/g, 'ch')
    .replace(/[şŞ]/g, 'sh');

  // Multi-character digraphs
  s = s.replace(/sh/g, 'ش')
       .replace(/ch/g, 'چ')
       .replace(/zh/g, 'ژ')
       .replace(/kh/g, 'خ')
       .replace(/gh/g, 'غ')
       .replace(/ee/g, 'ی')
       .replace(/ea/g, 'ی')
       .replace(/oo/g, 'و');

  const map = {
    'p': 'پ', 'b': 'ب', 't': 'ت', 'j': 'ج', 'h': 'ه', 'd': 'د', 'r': 'ر',
    'z': 'ز', 's': 'س', 'f': 'ف', 'v': 'ڤ', 'q': 'ق', 'k': 'ک', 'g': 'گ',
    'l': 'ل', 'm': 'م', 'n': 'ن', 'w': 'و', 'y': 'ی', 'i': 'ی',
    'u': 'و', 'o': 'ۆ', 'a': 'ا', 'e': 'ە', 'c': 'ک', 'x': 'خ'
  };

  return s.split('').map(ch => map[ch] || ch).join('');
}

/**
 * Phonetic transliteration from Kurdish script into Latin script.
 * Enables cashiers searching in Kurdish to match Latin/English brand names in inventory.
 * e.g. 'پێپسی' -> 'pepsi', 'کۆلا' -> 'kula', 'کیت کات' -> 'kit kat'
 */
export function kurdishToLatin(text) {
  if (!text) return '';
  let s = String(text)
    .replace(/[\u064B-\u065F\u0670\u0617-\u061A]/g, '')
    .replace(/[\u0640\u200C\u200D\uFEFF]/g, '');

  const map = {
    'ش': 'sh', 'چ': 'ch', 'ژ': 'zh', 'خ': 'kh', 'غ': 'gh',
    'پ': 'p', 'ب': 'b', 'ت': 't', 'ج': 'j', 'ح': 'h', 'ه': 'h', 'ھ': 'h', 'ە': 'e',
    'د': 'd', 'ر': 'r', 'ڕ': 'r', 'ز': 'z', 'س': 's', 'ص': 's', 'ث': 's',
    'ف': 'f', 'ڤ': 'v', 'ق': 'q', 'ک': 'k', 'ك': 'k', 'گ': 'g', 'ل': 'l', 'ڵ': 'l',
    'م': 'm', 'ن': 'n', 'و': 'u', 'ۆ': 'o', 'ی': 'i', 'ي': 'i', 'ێ': 'e', 'ى': 'i',
    'ئ': '', 'ا': 'a', 'آ': 'a', 'أ': 'a', 'إ': 'a', 'ط': 't', 'ظ': 'z', 'ض': 'd', 'ذ': 'z'
  };

  return s.split('').map(ch => map[ch] !== undefined ? map[ch] : ch).join('').toLowerCase();
}

/**
 * Normalizes Kurdish / Arabic text for flawless string comparison and search.
 */
export function normalizeKurdishText(input) {
  if (input === null || input === undefined) return '';
  let text = String(input);

  // 1. Unicode NFKC normalization (converts all Arabic Presentation Forms A & B to standard Unicode codepoints)
  try {
    text = text.normalize('NFKC');
  } catch {
    // Fallback if environment lacks NFKC
  }

  // 2. Digits normalization (Eastern Arabic & Persian/Kurdish -> ASCII 0-9)
  text = normalizeDigits(text);

  // 3. Turkish / Kurdish Latin i/e normalization
  text = text
    .replace(/[ıİIîÎ]/g, 'i')
    .replace(/[êÊé]/g, 'e')
    .replace(/[ûÛ]/g, 'u');

  // 4. Remove Arabic Tashkil / Harakat / Diacritics [\u064B-\u065F\u0670\u0617-\u061A]
  text = text.replace(/[\u064B-\u065F\u0670\u0617-\u061A]/g, '');

  // 5. Remove Tatweel (ـ), ZWNJ, ZWJ, BOM, LTR/RTL marks, Non-breaking space
  text = text.replace(/[\u0640\u200C\u200D\uFEFF\u200E\u200F\u00A0]/g, '');

  // 6. Standalone Hamza (ء) removal
  text = text.replace(/\u0621/g, '');

  // 7. Normalize Alef & Hamza variants (آ, أ, إ, ٱ, ئ) -> ا
  text = text.replace(/[آأإٱئ]/g, 'ا');

  // 8. Normalize Kaf variants: Arabic ك (U+0643), Swash ڪ (U+06AA) -> Kurdish ک (U+06A9)
  text = text.replace(/[\u0643\u06AA]/g, '\u06A9');

  // 9. Normalize Yaa variants: Arabic ي (U+064A), ى (U+0649), Kurdish ێ (U+06CE), ۍ (U+06CD), ے (U+06D2) -> Kurdish ی (U+06CC)
  text = text.replace(/[\u064A\u0649\u06CE\u06CD\u06D2]/g, '\u06CC');

  // 10. Normalize Heh / Ae: Arabic ه (U+0647), Ta Marbuta ة (U+0629), Kurdish Doachashmee ھ (U+06BE) -> Kurdish ە (U+06D5)
  text = text.replace(/[\u0647\u0629\u06BE]/g, '\u06D5');

  // 11. Normalize Waw variants: ۆ (U+06C6), ؤ (U+0624), ۇ (U+06C7), ۈ (U+06C8) -> و (U+0648)
  text = text.replace(/[\u06C6\u0624\u06C7\u06C8]/g, '\u0648');

  // 12. Normalize Kurdish Rra & Lla to basic form for keyboard resilience
  text = text.replace(/\u0695/g, '\u0631'); // ڕ -> ر
  text = text.replace(/\u06B5/g, '\u0644'); // ڵ -> ل

  // 13. Normalize double vowels (وو -> و, یی -> ی, اا -> ا, ەە -> ە) for common spelling variations
  text = text.replace(/\u0648{2,}/g, '\u0648'); // و+ -> و
  text = text.replace(/\u06CC{2,}/g, '\u06CC'); // ی+ -> ی
  text = text.replace(/\u0627{2,}/g, '\u0627'); // ا+ -> ا
  text = text.replace(/\u06D5{2,}/g, '\u06D5'); // ە+ -> ە

  // 14. Normalize casing and collapse spaces
  return text.toLowerCase().trim().replace(/\s+/g, ' ');
}

/**
 * Resilient consonant mapper for Arabic vs Kurdish physical keyboards
 * Maps: پ -> ب, چ -> ج, ژ -> ز, گ -> ک, ڤ -> ف
 */
function toKeyboardResilientConsonants(text) {
  if (!text) return '';
  return text
    .replace(/\u067E/g, '\u0628') // پ -> ب
    .replace(/\u0686/g, '\u062C') // چ -> ج
    .replace(/\u0698/g, '\u0632') // ژ -> ز
    .replace(/\u06AF/g, '\u06A9') // گ -> ک
    .replace(/\u06A4/g, '\u0641'); // ڤ -> ف
}

/**
 * Checks if a target object / string matches a Kurdish search query.
 * Supports:
 * 1. Multi-token unordered matching (all tokens must match in target).
 * 2. Colloquial vowel-drop matching (e.g. تەماتە vs تماتە).
 * 3. Keyboard layout transliteration fallback (Arabic keyboard vs Kurdish keyboard).
 * 4. Latin typed query searching Kurdish products (e.g. "shir" -> "شیر").
 * 5. Kurdish typed query searching Latin-named inventory (e.g. "پێپسی" -> "Pepsi").
 * 
 * @param {string|string[]} target - A string or array of strings (e.g. [name, barcode, category])
 * @param {string} query - The search query typed by the user
 * @returns {boolean} True if query matches target
 */
export function kurdishSearchMatch(target, query) {
  if (!query || !String(query).trim()) return true;

  const rawQuery = String(query).trim();
  const normalizedQuery = normalizeKurdishText(rawQuery);
  if (!normalizedQuery) return true;

  // Split query into individual search tokens
  const queryTokens = normalizedQuery.split(' ').filter(Boolean);
  if (queryTokens.length === 0) return true;

  // Build combined normalized text from target
  let combinedTarget = '';
  if (Array.isArray(target)) {
    combinedTarget = target.filter(Boolean).map(t => normalizeKurdishText(t)).join(' ');
  } else {
    combinedTarget = normalizeKurdishText(target);
  }

  // 1. Primary check: All tokens must be present in the normalized target
  const allTokensMatch = queryTokens.every(token => combinedTarget.includes(token));
  if (allTokensMatch) return true;

  // 2. Secondary fuzzy check: stripped Kurdish 'ە' (e.g. تەماتە vs تماتە, پەتاتە vs پتاتە)
  const strippedTarget = combinedTarget.replace(/\u06D5/g, '');
  const strippedTokens = queryTokens.map(t => t.replace(/\u06D5/g, ''));
  if (strippedTokens.every(token => token && strippedTarget.includes(token))) {
    return true;
  }

  // 3. Tertiary keyboard layout resilience check (Arabic keyboard without Kurdish keys: پ/ب, چ/ج, ژ/ز, گ/ک, ڤ/ف)
  const resilientTarget = toKeyboardResilientConsonants(combinedTarget);
  const resilientTokens = queryTokens.map(t => toKeyboardResilientConsonants(t));
  if (resilientTokens.every(token => token && resilientTarget.includes(token))) {
    return true;
  }

  // 4. Combined stripped + resilient check
  const resilientStrippedTarget = toKeyboardResilientConsonants(strippedTarget);
  const resilientStrippedTokens = strippedTokens.map(t => toKeyboardResilientConsonants(t));
  if (resilientStrippedTokens.every(token => token && resilientStrippedTarget.includes(token))) {
    return true;
  }

  // 5. Latin transliterated query vs Kurdish inventory (e.g. typing 'shir' for 'شیر', 'mast' for 'ماست')
  const kurdishTransliterated = latinToKurdish(rawQuery);
  if (kurdishTransliterated && kurdishTransliterated !== rawQuery) {
    const kurdishTransTokens = normalizeKurdishText(kurdishTransliterated).split(' ').filter(Boolean);
    if (kurdishTransTokens.length > 0) {
      if (kurdishTransTokens.every(token => combinedTarget.includes(token) || resilientTarget.includes(toKeyboardResilientConsonants(token)))) {
        return true;
      }
    }
  }

  // 6. Kurdish query vs Latin inventory (e.g. searching 'پێپسی' for 'Pepsi 330ml Can')
  let rawTargetStr = Array.isArray(target) ? target.filter(Boolean).join(' ') : String(target || '');
  const latinTargetNorm = rawTargetStr.toLowerCase().replace(/[ıİIîÎ]/g, 'i').replace(/[\s\-_]+/g, '');
  const queryLatin = kurdishToLatin(rawQuery).replace(/[\s\-_]+/g, '');
  if (queryLatin.length >= 2 && latinTargetNorm.includes(queryLatin)) {
    return true;
  }

  return false;
}

/**
 * Helper to filter an array of objects using Kurdish search.
 * 
 * @param {Array} items - List of items to filter
 * @param {string} query - Search query
 * @param {Function} extractFields - Callback that returns an array of string fields for an item
 * @returns {Array} Filtered list
 */
export function kurdishFilter(items, query, extractFields) {
  if (!Array.isArray(items)) return [];
  if (!query || !String(query).trim()) return items;

  return items.filter(item => {
    try {
      const fields = extractFields(item);
      return kurdishSearchMatch(fields, query);
    } catch {
      return false;
    }
  });
}

export default {
  normalizeDigits,
  latinToKurdish,
  kurdishToLatin,
  normalizeKurdishText,
  kurdishSearchMatch,
  kurdishFilter
};

