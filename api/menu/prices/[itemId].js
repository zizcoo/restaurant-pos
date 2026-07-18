const { getPool, setupDB } = require('../../../_db')

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'PUT,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()

  if (req.method !== 'PUT') return res.status(405).json({ error: 'Method not allowed' })

  try {
    await setupDB()
    const pool = getPool()
    const { itemId } = req.query
    const { price } = req.body
    await pool.query(
      'INSERT INTO menu_prices (item_id, price) VALUES ($1, $2) ON CONFLICT (item_id) DO UPDATE SET price = $2',
      [itemId, price]
    )
    res.json({ item_id: parseInt(itemId), price })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}
