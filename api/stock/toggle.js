const { getPool, setupDB } = require('../_db')

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  try {
    await setupDB()
    const pool = getPool()
    const { item_id } = req.body
    const { rows } = await pool.query('SELECT item_id FROM stock_out WHERE item_id = $1', [item_id])
    if (rows.length > 0) {
      await pool.query('DELETE FROM stock_out WHERE item_id = $1', [item_id])
    } else {
      await pool.query('INSERT INTO stock_out (item_id) VALUES ($1) ON CONFLICT DO NOTHING', [item_id])
    }
    const updated = await pool.query('SELECT item_id FROM stock_out')
    res.json(updated.rows.map(r => r.item_id))
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}
