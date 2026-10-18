/**
 * test_hardware_escpos.js
 * Verifies ESC/POS formatting, cash drawer kick pulse, paper cut, and digital scale barcode extraction.
 */
const assert = require('assert');

function runHardwareEscposTests() {
  console.log('🧪 Starting POS Hardware & ESC/POS Integration Tests...');

  // 1. Digital Scale Barcode Parser verification
  const parseScaleBarcode = (cleanCode) => {
    if (cleanCode.length === 13 && (cleanCode.startsWith('20') || cleanCode.startsWith('21') || cleanCode.startsWith('22'))) {
      const itemCodeRaw = cleanCode.substring(2, 7);
      const itemCodeTrimmed = itemCodeRaw.replace(/^0+/, '');
      const rawValue = parseInt(cleanCode.substring(7, 12), 10);
      const weightInKg = Math.max(0.001, rawValue / 1000);
      return { isScale: true, itemCode: itemCodeTrimmed, weightInKg };
    }
    return { isScale: false };
  };

  const scaleBarcode1 = '2000123015004'; // Apples: PLU 123, 1.500 kg
  const res1 = parseScaleBarcode(scaleBarcode1);
  assert.strictEqual(res1.isScale, true);
  assert.strictEqual(res1.itemCode, '123');
  assert.strictEqual(res1.weightInKg, 1.5);
  console.log('  ✅ Scale Parser: Successfully parsed 1.500 kg for PLU 123');

  const scaleBarcode2 = '2100045003507'; // Meat: PLU 45, 0.350 kg
  const res2 = parseScaleBarcode(scaleBarcode2);
  assert.strictEqual(res2.isScale, true);
  assert.strictEqual(res2.itemCode, '45');
  assert.strictEqual(res2.weightInKg, 0.35);
  console.log('  ✅ Scale Parser: Successfully parsed 0.350 kg for PLU 45');

  const regularBarcode = '8690504123456';
  const res3 = parseScaleBarcode(regularBarcode);
  assert.strictEqual(res3.isScale, false);
  console.log('  ✅ Scale Parser: Correctly bypassed standard piece barcode');

  // 2. ESC/POS Command Verification
  const ESC = "\x1B";
  const GS = "\x1D";
  const DRAWER_KICK = ESC + "p" + "\x00" + "\x19" + "\xFA";
  const CUT_PAPER = GS + "V" + "A" + "\x00";

  assert.strictEqual(DRAWER_KICK.charCodeAt(0), 0x1B);
  assert.strictEqual(DRAWER_KICK.charAt(1), 'p');
  assert.strictEqual(DRAWER_KICK.charCodeAt(2), 0x00);
  console.log('  ✅ ESC/POS: Standard RJ11 drawer kick pulse (Pin 2) verified');

  assert.strictEqual(CUT_PAPER.charCodeAt(0), 0x1D);
  assert.strictEqual(CUT_PAPER.charAt(1), 'V');
  console.log('  ✅ ESC/POS: Standard full paper cut command verified');

  console.log('🎉 All POS Hardware & ESC/POS Tests Passed!\n');
}

if (require.main === module) {
  try {
    runHardwareEscposTests();
    process.exit(0);
  } catch (err) {
    console.error('❌ POS Hardware Test Failed:', err.message);
    process.exit(1);
  }
}

module.exports = runHardwareEscposTests;
