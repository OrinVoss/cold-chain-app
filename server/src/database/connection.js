const initSqlJs = require('sql.js');
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, '..', '..', 'data', 'cold-chain.db');

let _db = null;

// Statement wrapper that mimics better-sqlite3
class StatementWrapper {
  constructor(sqlDb, sql) {
    this.sqlDb = sqlDb;
    this.sql = sql;
  }

  get(...params) {
    const stmt = this.sqlDb.prepare(this.sql);
    if (params.length > 0) stmt.bind(params);
    if (stmt.step()) {
      const row = stmt.getAsObject();
      stmt.free();
      return row;
    }
    stmt.free();
    return undefined;
  }

  all(...params) {
    const rows = [];
    const stmt = this.sqlDb.prepare(this.sql);
    if (params.length > 0) stmt.bind(params);
    while (stmt.step()) {
      rows.push(stmt.getAsObject());
    }
    stmt.free();
    return rows;
  }

  run(...params) {
    this.sqlDb.run(this.sql, params.length > 0 ? params : undefined);
    const result = this.sqlDb.exec('SELECT last_insert_rowid() as id, changes() as changes');
    const info = result[0]?.values?.[0] || [0, 0];
    return { lastInsertRowid: info[0] || 0, changes: info[1] || 0 };
  }
}

class DatabaseWrapper {
  constructor(sqlDb) {
    this._sqlDb = sqlDb;
  }

  prepare(sql) {
    return new StatementWrapper(this._sqlDb, sql);
  }

  exec(sql) {
    this._sqlDb.run(sql);
  }

  transaction(fn) {
    this.exec('BEGIN');
    try {
      fn();
      this.exec('COMMIT');
    } catch (e) {
      this.exec('ROLLBACK');
      throw e;
    }
  }

  save() {
    const data = this._sqlDb.export();
    fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
    fs.writeFileSync(DB_PATH, Buffer.from(data));
  }
}

async function initDB() {
  if (_db) return _db;

  const SQL = await initSqlJs();
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH);
    const sqlDb = new SQL.Database(fileBuffer);
    _db = new DatabaseWrapper(sqlDb);
    console.log('[DB] Loaded existing database');
  } else {
    const sqlDb = new SQL.Database();
    _db = new DatabaseWrapper(sqlDb);
    console.log('[DB] Created new database');
  }

  _db.exec('PRAGMA foreign_keys = ON');

  // Auto-save every 5 seconds
  setInterval(() => {
    if (_db) _db.save();
  }, 5000);

  return _db;
}

function getDB() {
  if (!_db) throw new Error('Database not initialized. Call initDB() first.');
  return _db;
}

module.exports = { initDB, getDB };
