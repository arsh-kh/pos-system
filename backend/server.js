const express = require('express');
const cors = require('cors');
const db = require('./db');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Basic health check endpoint
app.get('/api/health', async (req, res) => {
    try {
        const [rows] = await db.query('SELECT 1 as val');
        res.json({ status: 'OK', db: rows[0].val === 1 ? 'Connected' : 'Error' });
    } catch (error) {
        res.status(500).json({ status: 'ERROR', message: error.message });
    }
});

// Auth API
const authRoutes = require('./routes/auth');
app.use('/api/auth', authRoutes);

// Customers API
const customersRoutes = require('./routes/customers');
app.use('/api/customers', customersRoutes);

// Suppliers API
const suppliersRoutes = require('./routes/suppliers');
app.use('/api/suppliers', suppliersRoutes);

// Categories API
const categoriesRoutes = require('./routes/categories');
app.use('/api/categories', categoriesRoutes);

// Products API
const productsRoutes = require('./routes/products');
app.use('/api/products', productsRoutes);

// Checkout & Sales API
const checkoutRoutes = require('./routes/checkout');
app.use('/api/checkout', checkoutRoutes);
app.use('/api/sales', checkoutRoutes);

// Purchase Invoices API
const purchaseInvoicesRoutes = require('./routes/purchase_invoices');
app.use('/api/purchases', purchaseInvoicesRoutes);
app.use('/api/purchase-invoices', purchaseInvoicesRoutes);

// Purchase Returns API (Returns to Suppliers)
const purchaseReturnsRoutes = require('./routes/purchase_returns');
app.use('/api/purchase-returns', purchaseReturnsRoutes);

// Expenses API (Store Expenses / مەساریف)
const expensesRoutes = require('./routes/expenses');
app.use('/api/expenses', expensesRoutes);

// Shifts & Cash Drawer API (قاسە و داخستنی شیفت)
const shiftsRoutes = require('./routes/shifts');
app.use('/api/shifts', shiftsRoutes);

// Promotions & Offers API (ئۆفەرەکان و داشکاندنی گشتی)
const promotionsRoutes = require('./routes/promotions');
app.use('/api/promotions', promotionsRoutes);

// Returns API
const returnsRoutes = require('./routes/returns');
app.use('/api/returns', returnsRoutes);

// Needs API
const needsRoutes = require('./routes/needs');
app.use('/api/needs', needsRoutes);

// Analytics API
const analyticsRoutes = require('./routes/analytics');
app.use('/api/analytics', analyticsRoutes);

// Database Backup API
app.get('/api/backup', async (req, res) => {
    try {
        const tables = ['Categories', 'Products', 'Customers', 'Customer_Debts', 'Suppliers', 'Purchase_Invoices', 'Purchase_Invoice_Items', 'Purchase_Returns', 'Expenses', 'Shifts', 'Promotions', 'Sales', 'Sale_Items', 'Needs'];
        const backupData = { exported_at: new Date().toISOString() };
        for (const tbl of tables) {
            try {
                const [rows] = await db.query(`SELECT * FROM ${tbl}`);
                backupData[tbl] = rows;
            } catch (err) {
                backupData[tbl] = [];
            }
        }
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename=pos_backup_${new Date().toISOString().split('T')[0]}.json`);
        res.json(backupData);
    } catch (error) {
        res.status(500).json({ status: 'ERROR', message: error.message });
    }
});

app.listen(port, () => {
    console.log(`Backend server running on port ${port}`);
});
