import { neon } from '@neondatabase/serverless'
function getSQL() { return neon(process.env.DATABASE_URL) }
async function setupDB() {
  const sql = getSQL()
  await sql`CREATE TABLE IF NOT EXISTS orders (id VARCHAR(20) PRIMARY KEY, table_id VARCHAR(5) NOT NULL, items JSONB NOT NULL DEFAULT '[]', total INTEGER NOT NULL DEFAULT 0, pay_method VARCHAR(10) NOT NULL DEFAULT 'CASH', status VARCHAR(15) NOT NULL DEFAULT 'pending', created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`
  await sql`CREATE TABLE IF NOT EXISTS tables (id VARCHAR(5) PRIMARY KEY, status VARCHAR(15) NOT NULL DEFAULT 'free')`
  await sql`INSERT INTO tables (id,status) VALUES ('1','free'),('2','free'),('3','free'),('4','free'),('5','free'),('6','free'),('7','free'),('8','free') ON CONFLICT (id) DO NOTHING`
  await sql`CREATE TABLE IF NOT EXISTS stock_out (item_id INTEGER PRIMARY KEY)`
  await sql`CREATE TABLE IF NOT EXISTS admin_users (id SERIAL PRIMARY KEY, username VARCHAR(50) UNIQUE NOT NULL, password VARCHAR(100) NOT NULL)`
  await sql`INSERT INTO admin_users (username,password) VALUES ('admin','admin123') ON CONFLICT (username) DO NOTHING`
  await sql`CREATE TABLE IF NOT EXISTS menu_prices (item_id INTEGER PRIMARY KEY, price INTEGER NOT NULL)`
}
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()
  try {
    await setupDB()
    const sql = getSQL()
    const rows = await sql`SELECT * FROM menu_prices`
    const map = {}; rows.forEach(r => { map[r.item_id] = r.price })
    res.json(map)
  } catch (err) { res.status(500).json({ error: err.message }) }
}