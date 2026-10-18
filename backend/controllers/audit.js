const db = require('../db');

exports.getAuditLogs = async (req, res) => {
  try {
    const { action_type, username, search, start_date, end_date, preset, limit = 100, offset = 0 } = req.query;

    let query = 'SELECT * FROM Audit_Logs WHERE 1=1';
    const params = [];

    // Filter by action_type
    if (action_type && action_type !== 'ALL') {
      if (action_type === 'DELETIONS') {
        query += " AND action_type LIKE '%DELETE%'";
      } else if (action_type === 'LOGINS') {
        query += " AND action_type LIKE 'LOGIN%'";
      } else {
        query += ' AND action_type = ?';
        params.push(action_type);
      }
    }

    // Filter by username
    if (username && username !== 'ALL') {
      query += ' AND username = ?';
      params.push(username);
    }

    // Filter by Date Presets (today, yesterday, last_7_days, this_month)
    if (preset === 'today') {
      query += ' AND DATE(created_at) = CURDATE()';
    } else if (preset === 'yesterday') {
      query += ' AND DATE(created_at) = SUBDATE(CURDATE(), 1)';
    } else if (preset === 'last_7_days') {
      query += ' AND created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)';
    } else if (preset === 'this_month') {
      query += ' AND MONTH(created_at) = MONTH(CURDATE()) AND YEAR(created_at) = YEAR(CURDATE())';
    } else {
      // Manual custom date range
      if (start_date) {
        query += ' AND DATE(created_at) >= ?';
        params.push(start_date);
      }
      if (end_date) {
        query += ' AND DATE(created_at) <= ?';
        params.push(end_date);
      }
    }

    // Search keyword
    if (search) {
      query += ' AND (details LIKE ? OR entity_id LIKE ? OR username LIKE ? OR action_type LIKE ?)';
      const s = `%${search}%`;
      params.push(s, s, s, s);
    }

    // Clone query for total matching count
    const countQuery = query.replace('SELECT * FROM Audit_Logs', 'SELECT COUNT(*) as count FROM Audit_Logs');
    const [countRows] = await db.query(countQuery, params);
    const totalMatching = countRows[0]?.count || 0;

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
        SUM(CASE WHEN action_type = 'REFUND_RETURN' THEN 1 ELSE 0 END) as returns_count,
        SUM(CASE WHEN action_type LIKE 'LOGIN%' THEN 1 ELSE 0 END) as login_count,
        SUM(CASE WHEN DATE(created_at) = CURDATE() THEN 1 ELSE 0 END) as today_count
      FROM Audit_Logs
    `);

    // Fetch distinct users for filter dropdown
    const [userRows] = await db.query(`
      SELECT DISTINCT username, user_role 
      FROM Audit_Logs 
      WHERE username IS NOT NULL AND username != ''
      ORDER BY username ASC
    `);

    res.json({
      status: 'SUCCESS',
      data: logs,
      total: totalMatching,
      stats: statsRows[0] || {},
      users: userRows
    });
  } catch (error) {
    console.error('Failed to get audit logs:', error);
    res.status(500).json({ status: 'ERROR', message: 'Failed to fetch audit logs' });
  }
};
