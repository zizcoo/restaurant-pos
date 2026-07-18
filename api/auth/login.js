const { getPool, setupDB } = require('../../_db')

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  try {
    await setupDB()
    const pool = getPool()
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
}
