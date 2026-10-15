const db = require('../db');

exports.getAuditLogs = async (req, res) => {
  try {
    const { action_type, username, search, start_date, end_date, limit = 100, offset = 0 } = req.query;

    let query = 'SELECT * FROM Audit_Logs WHERE 1=1';
    const params = [];

    if (action_type && action_type !== 'ALL') {
      query += ' AND action_type = ?';
      params.push(action_type);
    }

    if (username && username !== 'ALL') {
      query += ' AND username = ?';
      params.push(username);
    }

    if (start_date) {
      query += ' AND DATE(created_at) >= ?';
      params.push(start_date);
    }

    if (end_date) {
      query += ' AND DATE(created_at) <= ?';
      params.push(end_date);
    }

    if (search) {
      query += ' AND (details LIKE ? OR entity_id LIKE ? OR username LIKE ?)';
      const s = `%${search}%`;
      params.push(s, s, s);
    }

    query += ' ORDER BY id DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit) || 100, parseInt(offset) || 0);

    const [logs] = await db.query(query, params);

    // Fetch quick summary stats for admin dashboard
    const [statsRows] = await db.query(`
      SELECT 
        COUNT(*) as total_logs,
        SUM(CASE WHEN action_type = 'PRICE_CHANGE' THEN 1 ELSE 0 END) as price_changes,
        SUM(CASE WHEN action_type = 'STOCK_ADJUSTMENT' THEN 1 ELSE 0 END) as stock_adjustments,
        SUM(CASE WHEN action_type LIKE '%DELETE%' THEN 1 ELSE 0 END) as deletions,
        SUM(CASE WHEN action_type = 'REFUND_RETURN' THEN 1 ELSE 0 END) as returns_count
      FROM Audit_Logs
    `);

    // Fetch distinct users for filter dropdown
    const [userRows] = await db.query('SELECT DISTINCT username, user_role FROM Audit_Logs ORDER BY username ASC');

    res.json({
      status: 'SUCCESS',
      data: logs,
      stats: statsRows[0] || {},
      users: userRows
    });
  } catch (error) {
    console.error('Failed to get audit logs:', error);
    res.status(500).json({ status: 'ERROR', message: 'Failed to fetch audit logs' });
  }
};
