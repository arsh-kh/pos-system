require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const assert = require('assert');
const db = require('../db');

const CUSTOMERS_API = 'http://localhost:3001/api/customers';
const SUPPLIERS_API = 'http://localhost:3001/api/suppliers';

async function runCreditDebtEngineTests() {
    console.log('=== دەستپێکردنی تاقیکردنەوەی بزوێنەری قەرز و حساباتی کڕیار و بازرگان (Module 4 Tests) ===\n');

    let customerId = null;
    let supplierId = null;

    try {
        // --- 1. Customer Creation & Initial Balance ---
        console.log('--- ١. دروستکردنی کڕیاری نوێ و پشکنینی باڵانسی سەرەتایی ---');
        const custRes = await fetch(CUSTOMERS_API, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: 'ئاسۆ کڕیاری نموونەیی',
                phone: '07501234567'
            })
        });
        assert.strictEqual(custRes.status, 201, 'Customer creation must return 201');
        const custData = await custRes.json();
        customerId = custData.data.id;
        assert.strictEqual(custData.data.total_debt, 0, 'New customer initial debt must be 0');
        console.log('✓ کڕیار دروستکرا بە باڵانسی قەرزی سەرەتایی ٠ دینار، ID:', customerId);

        // --- 2. Adding Manual Debt (ADD) ---
        console.log('\n--- ٢. زیادکردنی قەرزی نوێ بۆ کڕیار (ADD Debt) ---');
        const addDebtRes = await fetch(`${CUSTOMERS_API}/${customerId}/debts`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                amount: 50000,
                transaction_type: 'ADD',
                note: 'قەرزی سەرەتایی پسووڵە'
            })
        });
        assert.strictEqual(addDebtRes.status, 201, 'Adding debt must return 201');

        // Check updated profile
        const profRes1 = await fetch(`${CUSTOMERS_API}/${customerId}`);
        const profData1 = await profRes1.json();
        assert.strictEqual(Number(profData1.data.total_debt), 50000, 'Customer debt must be 50000');
        console.log('✓ قەرزی کڕیار بە سەرکەوتوویی بوو بە ٥٠,٠٠٠ دینار');

        // --- 3. Repaying Partial Debt (PAY) ---
        console.log('\n--- ٣. دانەوەی بەشێک لە قەرز بە نەقد (PAY Debt) ---');
        const payDebtRes = await fetch(`${CUSTOMERS_API}/${customerId}/debts`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                amount: 20000,
                transaction_type: 'PAY',
                note: 'دانەوەی بەشێک لە قەرز'
            })
        });
        assert.strictEqual(payDebtRes.status, 201, 'Repaying debt must return 201');

        // Check updated profile (50000 - 20000 = 30000)
        const profRes2 = await fetch(`${CUSTOMERS_API}/${customerId}`);
        const profData2 = await profRes2.json();
        assert.strictEqual(Number(profData2.data.total_debt), 30000, 'Remaining debt must be 30000');
        console.log('✓ باڵانسی قەرز بە دروستی دابەزی بۆ ٣٠,٠٠٠ دینار (٥٠,٠٠٠ - ٢٠,٠٠٠)');

        // --- 4. Input Validation & Security Guards ---
        console.log('\n--- ٤. تاقیکردنەوەی پاراستنی سیستم لە ژمارەی نێگەتیڤ و جۆری نادروست ---');
        // Negative amount test
        const negRes = await fetch(`${CUSTOMERS_API}/${customerId}/debts`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                amount: -10000,
                transaction_type: 'PAY'
            })
        });
        assert.strictEqual(negRes.status, 400, 'Negative amount must be rejected with 400');
        console.log('✓ ژمارەی نێگەتیڤ بە سەرکەوتوویی ڕەتکرایەوە');

        // Invalid transaction type test
        const invalidTypeRes = await fetch(`${CUSTOMERS_API}/${customerId}/debts`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                amount: 10000,
                transaction_type: 'HACK_DELETE'
            })
        });
        assert.strictEqual(invalidTypeRes.status, 400, 'Invalid transaction type must be rejected with 400');
        console.log('✓ جۆری نادروستی مامەڵە بە سەرکەوتوویی ڕەتکرایەوە');

        // --- 5. Supplier Debt Lifecycle & Repayment ---
        console.log('\n--- ٥. تاقیکردنەوەی قەرزی کۆمپانیا و دانەوەی قیست ---');
        const supRes = await fetch(SUPPLIERS_API, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: 'کۆمپانیای عەلی بۆ هەناردە',
                phone: '07709876543'
            })
        });
        const supData = await supRes.json();
        supplierId = supData.data.id;

        // Manually simulate a credit purchase remaining balance
        await db.query('UPDATE Suppliers SET total_remaining = 100000 WHERE id = ?', [supplierId]);

        // Pay 40,000 IQD to supplier
        const paySupRes = await fetch(`${SUPPLIERS_API}/${supplierId}/pay`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ amount: 40000 })
        });
        assert.strictEqual(paySupRes.status, 200, 'Supplier payment must return 200');
        const paySupData = await paySupRes.json();
        assert.strictEqual(paySupData.data.new_remaining, 60000, 'Supplier remaining debt must be 60000');
        console.log('✓ قەرزی کۆمپانیا بە سەرکەوتوویی دابەزی بۆ ٦٠,٠٠٠ دینار (١٠٠,٠٠٠ - ٤٠,٠٠٠)');

        // Test Overpayment clamping to 0 (paying 80,000 when debt is 60,000)
        const overpayRes = await fetch(`${SUPPLIERS_API}/${supplierId}/pay`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ amount: 80000 })
        });
        const overpayData = await overpayRes.json();
        assert.strictEqual(overpayData.data.new_remaining, 0, 'Supplier remaining debt must clamp to 0 without going negative');
        console.log('✓ پارەدانی زیاتر بە دروستی باڵانسی سفر کرد و نەبووە نێگەتیڤ');

        console.log('\n================================================================');
        console.log('🎉 هەموو تاقیکردنەوەکانی مۆدیوڵی ٤ (Credit & Debt Engine) ١٠٠٪ سەرکەوتوون!');
        console.log('================================================================');
        process.exit(0);
    } catch (err) {
        console.error('❌ تاقیکردنەوە سەرکەوتوو نەبوو:', err);
        process.exit(1);
    } finally {
        // Clean up
        if (customerId) {
            try {
                await db.query('DELETE FROM Customer_Debts WHERE customer_id = ?', [customerId]);
                await db.query('DELETE FROM Customers WHERE id = ?', [customerId]);
            } catch (_) {}
        }
        if (supplierId) {
            try { await db.query('DELETE FROM Suppliers WHERE id = ?', [supplierId]); } catch (_) {}
        }
    }
}

runCreditDebtEngineTests();
