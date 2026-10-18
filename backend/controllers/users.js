const db = require('../db');
const bcrypt = require('bcryptjs');
const { logAuditAction } = require('../middleware/auditLogger');

/**
 * Get all cashier users (role = 'CASHIER')
 */
exports.getCashiers = async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT id, username, full_name, role, is_active, created_at FROM Users WHERE role = ? ORDER BY id ASC',
      ['CASHIER']
    );
    res.json({
      status: 'SUCCESS',
      data: rows
    });
  } catch (error) {
    console.error('Error fetching cashiers:', error);
    res.status(500).json({ status: 'ERROR', message: 'هەڵە لە وەرگرتنی لیستی کاشێرەکان' });
  }
};

/**
 * Get all users (Admin only)
 */
exports.getAllUsers = async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT id, username, full_name, role, is_active, created_at FROM Users ORDER BY role ASC, id ASC'
    );
    res.json({
      status: 'SUCCESS',
      data: rows
    });
  } catch (error) {
    console.error('Error fetching all users:', error);
    res.status(500).json({ status: 'ERROR', message: 'هەڵە لە وەرگرتنی لیستی بەکارهێنەران' });
  }
};

/**
 * Create a new cashier account
 */
exports.createCashier = async (req, res) => {
  const { username, full_name, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ status: 'ERROR', message: 'تکایە ناوی بەکارهێنەر و وشەی نهێنی بنووسە' });
  }

  const cleanUsername = username.trim().toLowerCase();
  if (cleanUsername.length < 3) {
    return res.status(400).json({ status: 'ERROR', message: 'ناوی بەکارهێنەر نابێت لە ۳ پیت کەمتر بێت' });
  }

  if (password.length < 3) {
    return res.status(400).json({ status: 'ERROR', message: 'وشەی نهێنی نابێت لە ۳ پیت کەمتر بێت' });
  }

  try {
    // Check if username already exists
    const [existing] = await db.query('SELECT id FROM Users WHERE username = ?', [cleanUsername]);
    if (existing.length > 0) {
      return res.status(409).json({ status: 'ERROR', message: 'ئەم ناوی بەکارهێنەرە پێشتر بەکارهاتووە' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    const displayName = full_name ? full_name.trim() : cleanUsername;

    const [result] = await db.query(
      'INSERT INTO Users (username, full_name, password, role, is_active) VALUES (?, ?, ?, ?, ?)',
      [cleanUsername, displayName, hashedPassword, 'CASHIER', 1]
    );

    await logAuditAction({
      req,
      action_type: 'USER_CREATE',
      entity_name: 'Users',
      entity_id: result.insertId,
      new_value: { username: cleanUsername, full_name: displayName, role: 'CASHIER' },
      details: `دروستکردنی کاشێری نوێ: ${displayName} (${cleanUsername})`
    });

    res.status(201).json({
      status: 'SUCCESS',
      message: 'کاشێری نوێ بە سەرکەوتوویی زیادکرا',
      data: {
        id: result.insertId,
        username: cleanUsername,
        full_name: displayName,
        role: 'CASHIER',
        is_active: 1
      }
    });
  } catch (error) {
    console.error('Error creating cashier:', error);
    res.status(500).json({ status: 'ERROR', message: 'هەڵە لە دروستکردنی کاشێری نوێ' });
  }
};

/**
 * Update an existing cashier (change password, name, or active status)
 */
exports.updateCashier = async (req, res) => {
  const { id } = req.params;
  const { full_name, password, is_active } = req.body;

  try {
    const [users] = await db.query('SELECT * FROM Users WHERE id = ?', [id]);
    if (users.length === 0) {
      return res.status(404).json({ status: 'ERROR', message: 'بەکارهێنەر نەدۆزرایەوە' });
    }

    const user = users[0];

    // Build update query dynamically
    const updates = [];
    const params = [];
    const oldState = { full_name: user.full_name, is_active: user.is_active };
    const newState = {};

    if (full_name !== undefined) {
      updates.push('full_name = ?');
      params.push(full_name.trim());
      newState.full_name = full_name.trim();
    }

    if (is_active !== undefined) {
      // Prevent deactivating the main admin
      if (user.role === 'ADMIN' && Number(is_active) === 0) {
        return res.status(400).json({ status: 'ERROR', message: 'ناتوانیت هەژماری بەڕێوەبەری سەرەکی ناچالاک بکەیت' });
      }
      updates.push('is_active = ?');
      params.push(Number(is_active) ? 1 : 0);
      newState.is_active = Number(is_active) ? 1 : 0;
    }

    if (password && password.trim().length >= 3) {
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password.trim(), salt);
      updates.push('password = ?');
      params.push(hashedPassword);
      newState.password_changed = true;
    }

    if (updates.length === 0) {
      return res.json({ status: 'SUCCESS', message: 'هیچ گۆڕانکارییەک نەکرا' });
    }

    params.push(id);
    await db.query(`UPDATE Users SET ${updates.join(', ')} WHERE id = ?`, params);

    await logAuditAction({
      req,
      action_type: 'USER_UPDATE',
      entity_name: 'Users',
      entity_id: id,
      old_value: oldState,
      new_value: newState,
      details: `دەستکاریکردنی هەژماری کاشێر: ${user.username} (${user.full_name})`
    });

    res.json({
      status: 'SUCCESS',
      message: 'زانیارییەکانی کاشێر بە سەرکەوتوویی نوێکرانەوە'
    });
  } catch (error) {
    console.error('Error updating cashier:', error);
    res.status(500).json({ status: 'ERROR', message: 'هەڵە لە نوێکردنەوەی زانیارییەکانی کاشێر' });
  }
};

/**
 * Delete a cashier (safe deletion / soft deletion)
 */
exports.deleteCashier = async (req, res) => {
  const { id } = req.params;

  try {
    const [users] = await db.query('SELECT * FROM Users WHERE id = ?', [id]);
    if (users.length === 0) {
      return res.status(404).json({ status: 'ERROR', message: 'بەکارهێنەر نەدۆزرایەوە' });
    }

    const user = users[0];
    if (user.role === 'ADMIN') {
      return res.status(403).json({ status: 'ERROR', message: 'سڕینەوەی بەڕێوەبەری سەرەکی ڕێگەپێنەدراوە' });
    }

    // Check if other cashiers exist so we don't delete the last cashier
    const [cashierCount] = await db.query("SELECT COUNT(*) as count FROM Users WHERE role = 'CASHIER' AND is_active = 1");
    if (cashierCount[0].count <= 1 && user.is_active === 1) {
      return res.status(400).json({ status: 'ERROR', message: 'ناتوانیت دوا کاشێر بسڕیتەوە، دەبێت لانیکەم یەک کاشێر هەبێت' });
    }

    // Delete user
    await db.query('DELETE FROM Users WHERE id = ?', [id]);

    await logAuditAction({
      req,
      action_type: 'USER_DELETE',
      entity_name: 'Users',
      entity_id: id,
      old_value: { username: user.username, full_name: user.full_name },
      details: `سڕینەوەی هەژماری کاشێر: ${user.username} (${user.full_name})`
    });

    res.json({
      status: 'SUCCESS',
      message: 'هەژماری کاشێر بە سەرکەوتوویی سڕایەوە'
    });
  } catch (error) {
    console.error('Error deleting cashier:', error);
    res.status(500).json({ status: 'ERROR', message: 'هەڵە لە کاتی سڕینەوەی کاشێردا' });
  }
};
