const { Pool } = require('pg')

let pool

function getPool() {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
    })
  }
  return pool
}

// Auto-setup tables
async function setupDB() {
  const p = getPool()
  await p.query(`
    CREATE TABLE IF NOT EXISTS orders (
      id VARCHAR(20) PRIMARY KEY,
      table_id VARCHAR(5) NOT NULL,
      items JSONB NOT NULL DEFAULT '[]',
      total INTEGER NOT NULL DEFAULT 0,
      pay_method VARCHAR(10) NOT NULL DEFAULT 'CASH',
      status VARCHAR(15) NOT NULL DEFAULT 'pending',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS tables (
      id VARCHAR(5) PRIMARY KEY,
      status VARCHAR(15) NOT NULL DEFAULT 'free'
    );
    INSERT INTO tables (id, status) VALUES
      ('1','free'),('2','free'),('3','free'),('4','free'),
      ('5','free'),('6','free'),('7','free'),('8','free')
    ON CONFLICT (id) DO NOTHING;
    CREATE TABLE IF NOT EXISTS stock_out (item_id INTEGER PRIMARY KEY);
    CREATE TABLE IF NOT EXISTS admin_users (
      id SERIAL PRIMARY KEY,
      username VARCHAR(50) UNIQUE NOT NULL,
      password VARCHAR(100) NOT NULL
    );
    INSERT INTO admin_users (username, password) VALUES ('admin', 'admin123')
    ON CONFLICT (username) DO NOTHING;
    CREATE TABLE IF NOT EXISTS menu_prices (
      item_id INTEGER PRIMARY KEY,
      price INTEGER NOT NULL
    );
  `)
}

let dbReady = false

module.exports = { getPool, setupDB, isReady: () => dbReady, setReady: () => { dbReady = true } }
