const { getPool, setupDB } = require('../../_db')

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,PUT,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()

  try {
    await setupDB()
    const pool = getPool()

    if (req.method === 'GET') {
      const { rows } = await pool.query('SELECT * FROM menu_prices')
      const map = {}
      rows.forEach(r => { map[r.item_id] = r.price })
      return res.json(map)
    }

    res.status(405).json({ error: 'Method not allowed' })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}
