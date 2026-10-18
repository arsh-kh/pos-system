const express = require('express');
const cors = require('cors');
const db = require('./db');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3001;

// Global BigInt Serialization Guard for JSON responses
BigInt.prototype.toJSON = function () {
    return this.toString();
};

app.use(cors());
app.use(express.json());

// Process guards against unexpected background worker crashes
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});
process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception thrown:', err);
});

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

// Purchase Returns API (Returns to Suppliers / RTV)
const purchaseReturnsRoutes = require('./routes/purchase_returns');
app.use('/api/purchase-returns', purchaseReturnsRoutes);
app.use('/api/rtv', purchaseReturnsRoutes);

// Expenses API (Store Expenses / خەرجییەکان)
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

// Damages & Wastage API (تۆمارکردنی زیان و فەوتانی کاڵا)
const damagesRoutes = require('./routes/damages');
app.use('/api/damages', damagesRoutes);
app.use('/api/wastage', damagesRoutes);

// Needs API
const needsRoutes = require('./routes/needs');
app.use('/api/needs', needsRoutes);

// Analytics API
const analyticsRoutes = require('./routes/analytics');
app.use('/api/analytics', analyticsRoutes);

// Audit Logs API (چاودێری و تۆماری چالاکییەکان بۆ ئەدمین)
const auditRoutes = require('./routes/audit');
app.use('/api/audit-logs', auditRoutes);

// Smart Inventory Audit API (جەردکردنی زیرەکی کۆگا)
const inventoryAuditRoutes = require('./routes/inventory_audit');
app.use('/api/inventory-audit', inventoryAuditRoutes);

// Database Backup & Restore API
const backupRoutes = require('./routes/backup');
app.use('/api/backup', backupRoutes);

// Offline & Online Sync API (سیستەمی هاوکاتکردنی کلاود و ئۆفلاین)
const syncRoutes = require('./routes/sync');
app.use('/api/sync', syncRoutes);
app.use('/api/cloud-sync', syncRoutes);

// Global Express Error Handler Middleware
app.use((err, req, res, next) => {
    console.error('Global Express Error Caught:', err);
    res.status(err.status || 500).json({
        status: 'ERROR',
        message: err.message || 'هەڵەیەکی چاوەڕواننەکراو لە باکئەند ڕوویدا'
    });
});

const { initDb } = require('./init-db');

app.listen(port, () => {
    console.log(`Backend server running on port ${port}`);
    // Non-blocking auto-verification of schema and migrations
    initDb({ noExit: true }).catch(err => {
        console.warn('⚠️ Auto-init notice:', err.message);
    });
});

