const { getPool, setupDB } = require('../../_db')

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()

  try {
    await setupDB()
    const pool = getPool()
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
}
