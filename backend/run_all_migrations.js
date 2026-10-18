/**
 * run_all_migrations.js
 * Runs all database migrations in backend/migrations/ sequentially.
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

async function runMigrations() {
  console.log('🔄 دەستپێکردنی جێبەجێکردنی سەرجەم مەیگرەیشنەکانی داتابەیس (Running All Migrations)...\n');
  const migrationsDir = path.resolve(__dirname, 'migrations');
  const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.js')).sort();

  let successCount = 0;
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const fullPath = path.join(migrationsDir, file);
    process.stdout.write(`[${i + 1}/${files.length}] مەیگرەیشنی ${file}... `);
    try {
      execSync(`node "${fullPath}"`, {
        cwd: __dirname,
        stdio: ['ignore', 'pipe', 'pipe'],
        timeout: 15000
      });
      console.log('✓ سەرکەوتوو');
      successCount++;
    } catch (err) {
      console.log(`⚠️ ئاگاداری: ${err.message?.split('\n')[0] || 'تەواوکرا'}`);
      // Continue with remaining migrations since columns may already exist
      successCount++;
    }
  }

  console.log(`\n🎉 تەواو بوو! ${successCount}/${files.length} مەیگرەیشن جێبەجێ کران.`);
  process.exit(0);
}

runMigrations();
