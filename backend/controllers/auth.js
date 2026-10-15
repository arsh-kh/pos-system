const db = require('../db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

exports.login = async (req, res) => {
    const { username, password } = req.body;

    try {
        const [users] = await db.query('SELECT * FROM Users WHERE username = ?', [username]);
        if (users.length === 0) {
            return res.status(401).json({ status: 'ERROR', message: 'Invalid credentials' });
        }

        const user = users[0];
        const isMatch = await bcrypt.compare(password, user.password);

        if (!isMatch) {
            return res.status(401).json({ status: 'ERROR', message: 'Invalid credentials' });
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
        res.status(500).json({ status: 'ERROR', message: 'Server error during login' });
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
        
        res.status(201).json({ status: 'SUCCESS', message: 'User registered successfully' });
    } catch (error) {
        console.error('Register Error:', error);
        res.status(500).json({ status: 'ERROR', message: 'Could not register user' });
    }
};
