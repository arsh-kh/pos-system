require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const db = require('../db');

async function migrate() {
  try {
    const [cols] = await db.query("SHOW COLUMNS FROM Users LIKE 'permissions'");
    if (cols.length === 0) {
      await db.query("ALTER TABLE Users ADD COLUMN permissions JSON NULL AFTER is_active");
      console.log("Added permissions column to Users table");
    }

    // Initialize default permissions for any cashier with NULL permissions
    const [currentPerms] = await db.query('SELECT permission_key, is_enabled FROM Cashier_Permissions');
    const permMap = {};
    for (const p of currentPerms) {
      permMap[p.permission_key] = Boolean(p.is_enabled);
    }

    const [cashiers] = await db.query("SELECT id, username, permissions FROM Users WHERE role = 'CASHIER'");
    for (const c of cashiers) {
      if (!c.permissions) {
        await db.query('UPDATE Users SET permissions = ? WHERE id = ?', [JSON.stringify(permMap), c.id]);
      }
    }

    console.log('Cashier user permissions migration completed successfully.');
    if (require.main === module) process.exit(0);
  } catch (err) {
    console.error('Migration error:', err);
    if (require.main === module) process.exit(1);
    throw err;
  }
}

if (require.main === module) {
  migrate();
}

module.exports = migrate;

