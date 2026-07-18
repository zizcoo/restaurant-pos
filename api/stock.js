const { getPool, setupDB } = require('./_db')

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()

  try {
    await setupDB()
    const pool = getPool()
    const { rows } = await pool.query('SELECT item_id FROM stock_out')
    res.json(rows.map(r => r.item_id))
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}
