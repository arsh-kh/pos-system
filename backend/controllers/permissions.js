const db = require('../db');
const { logAuditAction } = require('../middleware/auditLogger');

/**
 * GET /api/permissions/cashier
 * Retrieves all cashier permissions as both an array and a convenient key-boolean dictionary.
 */
exports.getCashierPermissions = async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT id, permission_key, category, is_enabled, label_ku, description_ku FROM Cashier_Permissions ORDER BY category ASC, id ASC'
    );

    const permissionMap = {};
    rows.forEach(r => {
      permissionMap[r.permission_key] = Boolean(r.is_enabled);
    });

    res.json({
      status: 'SUCCESS',
      data: {
        permissions: rows.map(r => ({ ...r, is_enabled: Boolean(r.is_enabled) })),
        map: permissionMap
      }
    });
  } catch (error) {
    console.error('Error fetching cashier permissions:', error);
    res.status(500).json({
      status: 'ERROR',
      message: 'هەڵە ڕوویدا لە هێنانی دەسەڵاتەکانی کاشێر: ' + error.message
    });
  }
};

/**
 * PUT /api/permissions/cashier
 * Admin updates one or multiple cashier permissions.
 * Expects body: { updates: { [permission_key]: boolean } } or array of { permission_key, is_enabled }
 */
exports.updateCashierPermissions = async (req, res) => {
  const { updates } = req.body;

  if (!updates || (typeof updates !== 'object')) {
    return res.status(400).json({
      status: 'ERROR',
      message: 'تکایە داتای دەسەڵاتەکان بە دروستی بنێرە'
    });
  }

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    let itemsToUpdate = [];
    if (Array.isArray(updates)) {
      itemsToUpdate = updates;
    } else {
      itemsToUpdate = Object.entries(updates).map(([key, val]) => ({
        permission_key: key,
        is_enabled: Boolean(val)
      }));
    }

    const changedKeys = [];
    for (const item of itemsToUpdate) {
      if (!item.permission_key) continue;
      const enabledVal = item.is_enabled ? 1 : 0;
      await connection.query(
        'UPDATE Cashier_Permissions SET is_enabled = ? WHERE permission_key = ?',
        [enabledVal, item.permission_key]
      );
      changedKeys.push(`${item.permission_key}=${item.is_enabled}`);
    }

    await connection.commit();

    // Log the change to audit logs
    await logAuditAction({
      req,
      action_type: 'UPDATE',
      entity_name: 'Cashier_Permissions',
      entity_id: 0,
      details: `دەستکاریکردنی دەسەڵاتەکانی کاشێر: [${changedKeys.join(', ')}]`
    });

    // Return the updated full list
    const [rows] = await db.query(
      'SELECT id, permission_key, category, is_enabled, label_ku, description_ku FROM Cashier_Permissions ORDER BY category ASC, id ASC'
    );
    const permissionMap = {};
    rows.forEach(r => {
      permissionMap[r.permission_key] = Boolean(r.is_enabled);
    });

    res.json({
      status: 'SUCCESS',
      message: 'دەسەڵاتەکانی کاشێر بە سەرکەوتوویی نوێکرانەوە',
      data: {
        permissions: rows.map(r => ({ ...r, is_enabled: Boolean(r.is_enabled) })),
        map: permissionMap
      }
    });
  } catch (error) {
    await connection.rollback();
    console.error('Error updating cashier permissions:', error);
    res.status(500).json({
      status: 'ERROR',
      message: 'هەڵە لە پاشەکەوتکردنی دەسەڵاتەکان: ' + error.message
    });
  } finally {
    connection.release();
  }
};
