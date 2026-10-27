const db = require('../db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { logAuditAction } = require('../middleware/auditLogger');

exports.login = async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ status: 'ERROR', message: 'تکایە ناوی بەکارهێنەر و وشەی نهێنی بنووسە' });
    }

    try {
        const [users] = await db.query('SELECT * FROM Users WHERE username = ?', [username.trim()]);
        if (users.length === 0) {
            await logAuditAction({
                req,
                action_type: 'LOGIN_FAILED',
                entity_name: 'Users',
                username: username.trim(),
                user_role: 'CASHIER',
                details: `هەوڵی چوونەژوورەوەی سەرکەوتوونەبوو بە ناوی: ${username}`
            });
            return res.status(401).json({ status: 'ERROR', message: 'ناوی بەکارهێنەر یان وشەی نهێنی هەڵەیە' });
        }

        const user = users[0];

        if (user.is_active === 0) {
            await logAuditAction({
                req,
                action_type: 'LOGIN_FAILED',
                entity_name: 'Users',
                entity_id: user.id,
                username: user.username,
                user_role: user.role,
                user_id: user.id,
                details: `هەوڵی چوونەژوورەوە بۆ هەژماری ناچالاککراو: ${user.username}`
            });
            return res.status(403).json({ status: 'ERROR', message: 'ئەم هەژمارە ناچالاک کراوە لە لایەن بەڕێوەبەرەوە' });
        }

        const isMatch = await bcrypt.compare(password.trim(), user.password);

        if (!isMatch) {
            await logAuditAction({
                req,
                action_type: 'LOGIN_FAILED',
                entity_name: 'Users',
                entity_id: user.id,
                username: user.username,
                user_role: user.role,
                user_id: user.id,
                details: `وشەی نهێنی هەڵە بۆ بەکارهێنەر: ${user.username}`
            });
            return res.status(401).json({ status: 'ERROR', message: 'ناوی بەکارهێنەر یان وشەی نهێنی هەڵەیە' });
        }

        const token = jwt.sign(
            { id: user.id, username: user.username, role: user.role, full_name: user.full_name },
            process.env.JWT_SECRET || 'fallback_secret',
            { expiresIn: '12h' }
        );

        await logAuditAction({
            req,
            action_type: 'LOGIN_SUCCESS',
            entity_name: 'Users',
            entity_id: user.id,
            username: user.username,
            user_role: user.role,
            user_id: user.id,
            details: `چوونەژوورەوەی سەرکەوتوو: ${user.full_name || user.username} (${user.role === 'ADMIN' ? 'ئەدمین' : 'کاشێر'})`
        });

        res.json({
            status: 'SUCCESS',
            token,
            user: { 
                id: user.id, 
                username: user.username, 
                full_name: user.full_name || user.username,
                role: user.role 
            }
        });
    } catch (error) {
        console.error('Login Error:', error);
        res.status(500).json({ status: 'ERROR', message: 'هەڵەیەک لە سێرڤەر ڕوویدا لە کاتی چوونەژوورەوەدا' });
    }
};

exports.changePassword = async (req, res) => {
    const { username, oldPassword, newUsername, newPassword } = req.body;

    if (!username || !oldPassword) {
        return res.status(400).json({ status: 'ERROR', message: 'تکایە ناوی بەکارهێنەر و وشەی نهێنی ئێستا بنووسە' });
    }

    try {
        const [users] = await db.query('SELECT * FROM Users WHERE username = ?', [username.trim()]);
        if (users.length === 0) {
            return res.status(404).json({ status: 'ERROR', message: 'بەکارهێنەر نەدۆزرایەوە' });
        }

        const user = users[0];
        const isMatch = await bcrypt.compare(oldPassword.trim(), user.password);

        if (!isMatch) {
            return res.status(401).json({ status: 'ERROR', message: 'وشەی نهێنی ئێستا (کۆن) هەڵەیە' });
        }

        let updatedUsername = user.username;
        if (newUsername && newUsername.trim() && newUsername.trim() !== user.username) {
            const cleanNewUsername = newUsername.trim();
            const [existing] = await db.query('SELECT id FROM Users WHERE username = ? AND id != ?', [cleanNewUsername, user.id]);
            if (existing.length > 0) {
                return res.status(400).json({ status: 'ERROR', message: 'ئەم ناوی بەکارهێنەرە پێشتر بەکارهاتووە' });
            }
            await db.query('UPDATE Users SET username = ? WHERE id = ?', [cleanNewUsername, user.id]);
            updatedUsername = cleanNewUsername;
        }

        if (newPassword && newPassword.trim()) {
            if (newPassword.trim().length < 4) {
                return res.status(400).json({ status: 'ERROR', message: 'وشەی نهێنی نوێ نابێت لە ٤ پیت کەمتر بێت' });
            }
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(newPassword.trim(), salt);
            await db.query('UPDATE Users SET password = ? WHERE id = ?', [hashedPassword, user.id]);
        }

        await logAuditAction({
            req,
            action_type: 'UPDATE',
            entity_name: 'Users',
            entity_id: user.id,
            details: `نوێکردنەوەی هەژماری بەکارهێنەر: ${user.username} -> ${updatedUsername}`
        });

        res.json({
            status: 'SUCCESS',
            message: 'زانیارییەکانی هەژمار بە سەرکەوتوویی نوێکرانەوە',
            data: {
                id: user.id,
                username: updatedUsername,
                full_name: user.full_name,
                role: user.role
            }
        });
    } catch (error) {
        console.error('Change Password Error:', error);
        res.status(500).json({ status: 'ERROR', message: 'هەڵەیەک لە سێرڤەر ڕوویدا لە کاتی نوێکردنەوەی هەژمار' });
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

