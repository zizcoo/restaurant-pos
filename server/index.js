const express = require('express')
const cors = require('cors')
const fs = require('fs')
const path = require('path')
const pool = require('./db')

const app = express()
const PORT = process.env.PORT || 3001

app.use(cors())
app.use(express.json())

// ─── AUTO-SETUP DATABASE SCHEMA ─────────────────────────────────
async function setupDB() {
  try {
    const sql = fs.readFileSync(path.join(__dirname, 'setup.sql'), 'utf8')
    await pool.query(sql)
    console.log('✅ Database schema ready')
  } catch (err) {
    console.error('❌ Schema setup failed:', err.message)
  }
}

// ─── ORDERS API ─────────────────────────────────────────────────

// GET /api/orders — get all orders (optional ?today=true)
app.get('/api/orders', async (req, res) => {
  try {
    let query = 'SELECT * FROM orders ORDER BY created_at DESC'
    if (req.query.today === 'true') {
      query = "SELECT * FROM orders WHERE created_at::date = CURRENT_DATE ORDER BY created_at DESC"
    }
    const { rows } = await pool.query(query)
    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/orders — create new order
app.post('/api/orders', async (req, res) => {
  try {
    const { id, table_id, items, total, pay_method, status } = req.body
    const { rows } = await pool.query(
      `INSERT INTO orders (id, table_id, items, total, pay_method, status)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [id, table_id, JSON.stringify(items), total, pay_method, status]
    )
    res.json(rows[0])
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// PATCH /api/orders/:id/status — update order status
app.patch('/api/orders/:id/status', async (req, res) => {
  try {
    const { status } = req.body
    const { rows } = await pool.query(
      'UPDATE orders SET status = $1 WHERE id = $2 RETURNING *',
      [status, req.params.id]
    )
    if (rows.length === 0) return res.status(404).json({ error: 'Order not found' })
    res.json(rows[0])
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ─── TABLES API ─────────────────────────────────────────────────

// GET /api/tables — get all table statuses
app.get('/api/tables', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM tables ORDER BY id::int')
    const map = {}
    rows.forEach(r => { map[r.id] = r.status })
    res.json(map)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// PATCH /api/tables/:id — update table status
app.patch('/api/tables/:id', async (req, res) => {
  try {
    const { status } = req.body
    await pool.query('UPDATE tables SET status = $1 WHERE id = $2', [status, req.params.id])
    res.json({ id: req.params.id, status })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ─── STOCK API ──────────────────────────────────────────────────

// GET /api/stock — get out-of-stock item IDs
app.get('/api/stock', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT item_id FROM stock_out')
    res.json(rows.map(r => r.item_id))
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/stock/toggle — toggle item stock status
app.post('/api/stock/toggle', async (req, res) => {
  try {
    const { item_id } = req.body
    // Check if item is currently out of stock
    const { rows } = await pool.query('SELECT item_id FROM stock_out WHERE item_id = $1', [item_id])
    if (rows.length > 0) {
      // Item is out of stock → restock it
      await pool.query('DELETE FROM stock_out WHERE item_id = $1', [item_id])
    } else {
      // Item is in stock → mark out
      await pool.query('INSERT INTO stock_out (item_id) VALUES ($1) ON CONFLICT DO NOTHING', [item_id])
    }
    // Return updated list
    const updated = await pool.query('SELECT item_id FROM stock_out')
    res.json(updated.rows.map(r => r.item_id))
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ─── AUTH API ───────────────────────────────────────────────────

// POST /api/auth/login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body
    const { rows } = await pool.query(
      'SELECT * FROM admin_users WHERE username = $1 AND password = $2',
      [username, password]
    )
    if (rows.length > 0) {
      res.json({ success: true, username: rows[0].username })
    } else {
      res.status(401).json({ success: false, error: 'Invalid credentials' })
    }
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ─── REVENUE API ────────────────────────────────────────────────

// GET /api/revenue/today — get today's revenue summary
app.get('/api/revenue/today', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        COALESCE(SUM(total), 0) as total,
        COALESCE(SUM(CASE WHEN pay_method = 'CASH' THEN total ELSE 0 END), 0) as cash,
        COALESCE(SUM(CASE WHEN pay_method = 'QR_PAY' THEN total ELSE 0 END), 0) as qr,
        COUNT(*)::int as count
      FROM orders
      WHERE created_at::date = CURRENT_DATE
        AND status NOT IN ('rejected', 'pending')
    `)
    res.json(rows[0])
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ─── MENU PRICES API ───────────────────────────────────────────

// GET /api/menu/prices — get all price overrides
app.get('/api/menu/prices', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM menu_prices')
    const map = {}
    rows.forEach(r => { map[r.item_id] = r.price })
    res.json(map)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// PUT /api/menu/prices/:itemId — set price for an item
app.put('/api/menu/prices/:itemId', async (req, res) => {
  try {
    const { price } = req.body
    await pool.query(
      'INSERT INTO menu_prices (item_id, price) VALUES ($1, $2) ON CONFLICT (item_id) DO UPDATE SET price = $2',
      [req.params.itemId, price]
    )
    res.json({ item_id: parseInt(req.params.itemId), price })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ─── START SERVER ───────────────────────────────────────────────


setupDB().then(() => {
  app.listen(PORT, () => {
    console.log(`\n🚀 Restaurant POS API running on http://localhost:${PORT}`)
    console.log(`\n📌 Endpoints:`)
    console.log(`   GET    /api/orders          — list orders`)
    console.log(`   POST   /api/orders          — create order`)
    console.log(`   PATCH  /api/orders/:id/status — update status`)
    console.log(`   GET    /api/tables          — table statuses`)
    console.log(`   PATCH  /api/tables/:id      — update table`)
    console.log(`   GET    /api/stock           — out of stock`)
    console.log(`   POST   /api/stock/toggle    — toggle stock`)
    console.log(`   POST   /api/auth/login      — admin login`)
    console.log(`   GET    /api/revenue/today   — today's revenue\n`)
  })
})
