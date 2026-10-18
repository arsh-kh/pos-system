const db = require('../db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { logAuditAction } = require('../middleware/auditLogger');

exports.login = async (req, res) => {
    const { username, password } = req.body;

    try {
        const [users] = await db.query('SELECT * FROM Users WHERE username = ?', [username]);
        if (users.length === 0) {
            return res.status(401).json({ status: 'ERROR', message: 'ناوی بەکارهێنەر یان وشەی نهێنی هەڵەیە' });
        }

        const user = users[0];
        const isMatch = await bcrypt.compare(password, user.password);

        if (!isMatch) {
            return res.status(401).json({ status: 'ERROR', message: 'ناوی بەکارهێنەر یان وشەی نهێنی هەڵەیە' });
        }

        const token = jwt.sign(
            { id: user.id, username: user.username, role: user.role },
            process.env.JWT_SECRET || 'fallback_secret',
            { expiresIn: '12h' }
        );

        res.json({
            status: 'SUCCESS',
            token,
            user: { id: user.id, username: user.username, role: user.role }
        });
    } catch (error) {
        console.error('Login Error:', error);
        res.status(500).json({ status: 'ERROR', message: 'هەڵەیەک لە سێرڤەر ڕوویدا لە کاتی چوونەژوورەوەدا' });
    }
};

exports.changePassword = async (req, res) => {
    const { username, oldPassword, newPassword } = req.body;

    if (!username || !oldPassword || !newPassword) {
        return res.status(400).json({ status: 'ERROR', message: 'تکایە هەموو خانەکان پڕبکەرەوە' });
    }

    if (newPassword.length < 4) {
        return res.status(400).json({ status: 'ERROR', message: 'وشەی نهێنی نوێ نابێت لە ٤ پیت کەمتر بێت' });
    }

    try {
        const [users] = await db.query('SELECT * FROM Users WHERE username = ?', [username]);
        if (users.length === 0) {
            return res.status(404).json({ status: 'ERROR', message: 'بەکارهێنەر نەدۆزرایەوە' });
        }

        const user = users[0];
        const isMatch = await bcrypt.compare(oldPassword, user.password);

        if (!isMatch) {
            return res.status(401).json({ status: 'ERROR', message: 'وشەی نهێنی کۆن هەڵەیە' });
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(newPassword, salt);

        await db.query('UPDATE Users SET password = ? WHERE id = ?', [hashedPassword, user.id]);

        await logAuditAction({
            req,
            action_type: 'UPDATE',
            entity_name: 'Users',
            entity_id: user.id,
            details: `گۆڕینی وشەی نهێنی بۆ بەکارهێنەر: ${user.username}`
        });

        res.json({
            status: 'SUCCESS',
            message: 'وشەی نهێنی بە سەرکەوتوویی نوێکرایەوە'
        });
    } catch (error) {
        console.error('Change Password Error:', error);
        res.status(500).json({ status: 'ERROR', message: 'هەڵەیەک لە سێرڤەر ڕوویدا لە کاتی نوێکردنەوەی وشەی نهێنی' });
    }
};

exports.register = async (req, res) => {
    const { username, password, role } = req.body;
    
    // In production, limit registration to Admin only via middleware in routes
    try {
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);
        
        await db.query(
            'INSERT INTO Users (username, password, role) VALUES (?, ?, ?)',
            [username, hashedPassword, role || 'CASHIER']
        );
        
        res.status(201).json({ status: 'SUCCESS', message: 'بەکارهێنەر بە سەرکەوتوویی تۆمارکرا' });
    } catch (error) {
        console.error('Register Error:', error);
        res.status(500).json({ status: 'ERROR', message: 'نەتوانرا بەکارهێنەر تۆمار بکرێت' });
    }
};

