const { Pool } = require('pg')

// Neon cloud PostgreSQL for demo
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_89iatEeykLpd@ep-young-leaf-aucy5isx.c-10.us-east-1.aws.neon.tech/neondb?sslmode=require',
  ssl: { rejectUnauthorized: false },
})

// Test connection on startup
pool.query('SELECT NOW()')
  .then(() => console.log('✅ PostgreSQL (Neon) connected'))
  .catch(err => {
    console.error('❌ PostgreSQL connection failed:', err.message)
    process.exit(1)
  })

module.exports = pool
