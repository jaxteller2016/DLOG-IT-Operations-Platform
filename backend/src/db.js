const path = require('path');
const Database = require('better-sqlite3');
const { DATA_DIR, ensureDataDirectory } = require('./migrate');

ensureDataDirectory();

const DB_FILE = path.join(DATA_DIR, 'dlog.sqlite');
const db = new Database(DB_FILE);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

module.exports = {
  DB_FILE,
  db
};