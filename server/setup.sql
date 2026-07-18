-- Restaurant POS Database Schema
-- Run this in pgAdmin 4 or via psql to set up tables

-- Orders table
CREATE TABLE IF NOT EXISTS orders (
  id VARCHAR(20) PRIMARY KEY,
  table_id VARCHAR(5) NOT NULL,
  items JSONB NOT NULL DEFAULT '[]',
  total INTEGER NOT NULL DEFAULT 0,
  pay_method VARCHAR(10) NOT NULL DEFAULT 'CASH',
  status VARCHAR(15) NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Tables (8 tables)
CREATE TABLE IF NOT EXISTS tables (
  id VARCHAR(5) PRIMARY KEY,
  status VARCHAR(15) NOT NULL DEFAULT 'free'
);

-- Insert default 8 tables if not exists
INSERT INTO tables (id, status) VALUES
  ('1', 'free'), ('2', 'free'), ('3', 'free'), ('4', 'free'),
  ('5', 'free'), ('6', 'free'), ('7', 'free'), ('8', 'free')
ON CONFLICT (id) DO NOTHING;

-- Out of stock items
CREATE TABLE IF NOT EXISTS stock_out (
  item_id INTEGER PRIMARY KEY
);

-- Admin users
CREATE TABLE IF NOT EXISTS admin_users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  password VARCHAR(100) NOT NULL
);

-- Insert default admin user
INSERT INTO admin_users (username, password) VALUES ('admin', 'admin123')
ON CONFLICT (username) DO NOTHING;

-- Index for faster order queries
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_table ON orders(table_id);
CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at);

-- Menu price overrides (admin can change prices)
CREATE TABLE IF NOT EXISTS menu_prices (
  item_id INTEGER PRIMARY KEY,
  price INTEGER NOT NULL
);
