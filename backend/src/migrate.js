const fs = require('fs');
const path = require('path');

const DATA_DIR = path.resolve(__dirname, '../data');
const MIGRATIONS_DIR = path.resolve(__dirname, '../migrations');

function ensureDataDirectory() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function listMigrationFiles() {
  if (!fs.existsSync(MIGRATIONS_DIR)) return [];

  return fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((fileName) => fileName.endsWith('.sql'))
    .sort();
}

function runMigrations(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL
    );
  `);

  const insertMigration = db.prepare(`
    INSERT INTO schema_migrations (version, name, applied_at)
    VALUES (?, ?, ?)
  `);
  const migrationApplied = db.prepare('SELECT 1 FROM schema_migrations WHERE version = ? LIMIT 1');

  const files = listMigrationFiles();
  const applied = [];

  files.forEach((fileName) => {
    const version = fileName.split('_')[0];
    const alreadyApplied = migrationApplied.get(version);
    if (alreadyApplied) return;

    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, fileName), 'utf8');
    const tx = db.transaction(() => {
      db.exec(sql);
      insertMigration.run(version, fileName, new Date().toISOString());
    });

    tx();
    applied.push(fileName);
  });

  return applied;
}

module.exports = {
  DATA_DIR,
  MIGRATIONS_DIR,
  ensureDataDirectory,
  listMigrationFiles,
  runMigrations
};

if (require.main === module) {
  const Database = require('better-sqlite3');
  const { DB_FILE } = require('./db');

  ensureDataDirectory();
  const db = new Database(DB_FILE);
  const applied = runMigrations(db);
  db.close();
  if (applied.length === 0) {
    console.log(`No new migrations. Database is up to date: ${DB_FILE}`);
  } else {
    console.log(`Applied migrations to ${DB_FILE}:`);
    applied.forEach((migration) => console.log(`- ${migration}`));
  }
}