const { getPool, setupDB } = require('../../_db')

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
    await pool.query('UPDATE tables SET status = $1 WHERE id = $2', [status, id])
    res.json({ id, status })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}
