const db = require('../db');

/**
 * Log an audit action to the Audit_Logs table.
 * Does not throw errors so it won't break the main business transaction.
 */
const logAuditAction = async ({
  req,
  action_type,
  entity_name,
  entity_id = null,
  old_value = null,
  new_value = null,
  details = '',
  username: explicitUsername = null,
  user_role: explicitUserRole = null,
  user_id: explicitUserId = null
}) => {
  try {
    // 1. Resolve user info from explicit params, JWT req.user, or custom headers
    let userId = explicitUserId || req?.user?.id || null;
    let username = explicitUsername || req?.user?.username || req?.headers?.['x-user-name'] || 'کاشێری گشتی';
    let userRole = explicitUserRole || req?.user?.role || req?.headers?.['x-user-role'] || 'CASHIER';

    // 2. Resolve IP Address
    const ipAddress = req?.headers?.['x-forwarded-for'] || req?.socket?.remoteAddress || req?.ip || '127.0.0.1';

    // 3. Serialize JSON values safely
    const oldValJson = old_value !== null ? JSON.stringify(old_value) : null;
    const newValJson = new_value !== null ? JSON.stringify(new_value) : null;

    // 4. Insert into database
    await db.query(
      `INSERT INTO Audit_Logs 
        (user_id, username, user_role, action_type, entity_name, entity_id, old_value, new_value, details, ip_address) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userId,
        username,
        userRole,
        action_type,
        entity_name,
        entity_id ? String(entity_id) : null,
        oldValJson,
        newValJson,
        details,
        ipAddress
      ]
    );
  } catch (err) {
    console.error('Audit Logging Error (non-fatal):', err.message);
  }
};

module.exports = { logAuditAction };
