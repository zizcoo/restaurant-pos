const { Pool } = require('pg')
let pool, dbReady
function getPool() { if (!pool) pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } }); return pool }
async function setupDB() { if (dbReady) return; await getPool().query(`CREATE TABLE IF NOT EXISTS orders (id VARCHAR(20) PRIMARY KEY, table_id VARCHAR(5) NOT NULL, items JSONB NOT NULL DEFAULT '[]', total INTEGER NOT NULL DEFAULT 0, pay_method VARCHAR(10) NOT NULL DEFAULT 'CASH', status VARCHAR(15) NOT NULL DEFAULT 'pending', created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()); CREATE TABLE IF NOT EXISTS tables (id VARCHAR(5) PRIMARY KEY, status VARCHAR(15) NOT NULL DEFAULT 'free'); INSERT INTO tables (id,status) VALUES ('1','free'),('2','free'),('3','free'),('4','free'),('5','free'),('6','free'),('7','free'),('8','free') ON CONFLICT (id) DO NOTHING; CREATE TABLE IF NOT EXISTS stock_out (item_id INTEGER PRIMARY KEY); CREATE TABLE IF NOT EXISTS admin_users (id SERIAL PRIMARY KEY, username VARCHAR(50) UNIQUE NOT NULL, password VARCHAR(100) NOT NULL); INSERT INTO admin_users (username,password) VALUES ('admin','admin123') ON CONFLICT (username) DO NOTHING; CREATE TABLE IF NOT EXISTS menu_prices (item_id INTEGER PRIMARY KEY, price INTEGER NOT NULL);`); dbReady = true }
const { getPool, setupDB } = require(require('path').resolve(__dirname, '..', '..', 'api', '_db.js'))

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'PATCH,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()

  if (req.method !== 'PATCH') return res.status(405).json({ error: 'Method not allowed' })

  try {
    await setupDB()
    const pool = getPool()
    const { id } = req.query
    const { status } = req.body
    const { rows } = await pool.query('UPDATE orders SET status = $1 WHERE id = $2 RETURNING *', [status, id])
    if (rows.length === 0) return res.status(404).json({ error: 'Not found' })
    res.json(rows[0])
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}
