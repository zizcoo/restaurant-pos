const { getPool, setupDB } = require('./_db')

module.exports = async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,PUT,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()

  try {
    await setupDB()
    const pool = getPool()

    if (req.method === 'GET') {
      let query = 'SELECT * FROM orders ORDER BY created_at DESC'
      if (req.query.today === 'true') {
        query = "SELECT * FROM orders WHERE created_at::date = CURRENT_DATE ORDER BY created_at DESC"
      }
      const { rows } = await pool.query(query)
      return res.json(rows)
    }

    if (req.method === 'POST') {
      const { id, table_id, items, total, pay_method, status } = req.body
      const { rows } = await pool.query(
        `INSERT INTO orders (id, table_id, items, total, pay_method, status) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
        [id, table_id, JSON.stringify(items), total, pay_method, status]
      )
      return res.json(rows[0])
    }

    res.status(405).json({ error: 'Method not allowed' })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}
