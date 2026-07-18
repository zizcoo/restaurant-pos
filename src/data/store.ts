import { useState, useEffect, useRef } from 'react'

// ─── TYPES ──────────────────────────────────────────────────────

export type OrderItem = {
  itemId: number
  name: string
  nameMm: string
  qty: number
  unitPrice: number
  unitTotal: number
  options: string
  notes: string
}

export type Order = {
  id: string
  table_id: string
  items: OrderItem[]
  total: number
  pay_method: 'CASH' | 'QR_PAY'
  status: 'pending' | 'approved' | 'preparing' | 'cooked' | 'ready' | 'served' | 'rejected'
  created_at: string
}

export type TableStatus = 'free' | 'occupied' | 'ordering'

// ─── API BASE ───────────────────────────────────────────────────

// For deployment: set VITE_API_URL in Vercel env vars
// For local dev: falls back to localhost:3001
const API = (import.meta as any).env?.VITE_API_URL || 'http://localhost:3001/api'

async function api(path: string, opts?: RequestInit) {
  const res = await fetch(`${API}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...opts,
  })
  return res.json()
}

// ─── ORDERS ─────────────────────────────────────────────────────

export async function getOrders(): Promise<Order[]> {
  return api('/orders')
}

export async function getTodayOrders(): Promise<Order[]> {
  return api('/orders?today=true')
}

export async function addOrder(order: {
  id: string; table_id: string; items: OrderItem[]; total: number;
  pay_method: string; status: string;
}) {
  return api('/orders', { method: 'POST', body: JSON.stringify(order) })
}

export async function updateOrderStatus(orderId: string, status: string) {
  return api(`/orders/${orderId}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  })
}

// ─── TABLES ─────────────────────────────────────────────────────

export async function getTables(): Promise<Record<string, TableStatus>> {
  return api('/tables')
}

export async function setTableStatus(tableId: string, status: TableStatus) {
  return api(`/tables/${tableId}`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  })
}

// ─── STOCK ──────────────────────────────────────────────────────

export async function getOutOfStock(): Promise<number[]> {
  return api('/stock')
}

export async function toggleStock(itemId: number): Promise<number[]> {
  return api('/stock/toggle', {
    method: 'POST',
    body: JSON.stringify({ item_id: itemId }),
  })
}

// ─── REVENUE ────────────────────────────────────────────────────

export async function getTodayRevenue(): Promise<{
  total: number; cash: number; qr: number; count: number
}> {
  return api('/revenue/today')
}

// ─── AUTH ────────────────────────────────────────────────────────

const AUTH_KEY = 'pos_admin_auth'

export async function adminLogin(username: string, password: string): Promise<boolean> {
  try {
    const res = await fetch(`${API}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    })
    if (res.ok) {
      sessionStorage.setItem(AUTH_KEY, 'true')
      return true
    }
    return false
  } catch {
    return false
  }
}

export function isAdminLoggedIn(): boolean {
  return sessionStorage.getItem(AUTH_KEY) === 'true'
}

export function adminLogout() {
  sessionStorage.removeItem(AUTH_KEY)
}

// ─── MENU PRICE OVERRIDES ───────────────────────────────────────

export async function getMenuPrices(): Promise<Record<number, number>> {
  return api('/menu/prices')
}

export async function setMenuPrice(itemId: number, price: number) {
  return api(`/menu/prices/${itemId}`, {
    method: 'PUT',
    body: JSON.stringify({ price }),
  })
}

export function useMenuPrices(): Record<number, number> {
  const [prices, setPrices] = useState<Record<number, number>>({})
  const ref = useRef('')
  useEffect(() => {
    const poll = () => {
      getMenuPrices().then(d => {
        const key = JSON.stringify(d)
        if (key !== ref.current) { ref.current = key; setPrices(d) }
      }).catch(() => {})
    }
    poll()
    const id = setInterval(poll, 5000)
    return () => clearInterval(id)
  }, [])
  return prices
}


// ─── HOOKS (polling for real-time updates) ──────────────────────
// Only update state when data actually changes to prevent flickering

export function useOrders(): Order[] {
  const [orders, setOrders] = useState<Order[]>([])
  const ref = useRef('')

  useEffect(() => {
    const poll = () => {
      getOrders().then(data => {
        const json = JSON.stringify(data)
        if (json !== ref.current) { ref.current = json; setOrders(data) }
      }).catch(() => {})
    }
    poll()
    const id = setInterval(poll, 3000)
    return () => clearInterval(id)
  }, [])

  return orders
}

export function useTables(): Record<string, TableStatus> {
  const [tables, setTables] = useState<Record<string, TableStatus>>({})
  const ref = useRef('')

  useEffect(() => {
    const poll = () => {
      getTables().then(data => {
        const json = JSON.stringify(data)
        if (json !== ref.current) { ref.current = json; setTables(data) }
      }).catch(() => {})
    }
    poll()
    const id = setInterval(poll, 3000)
    return () => clearInterval(id)
  }, [])

  return tables
}

export function useOutOfStock(): number[] {
  const [stock, setStock] = useState<number[]>([])
  const ref = useRef('')

  useEffect(() => {
    const poll = () => {
      getOutOfStock().then(data => {
        const json = JSON.stringify(data)
        if (json !== ref.current) { ref.current = json; setStock(data) }
      }).catch(() => {})
    }
    poll()
    const id = setInterval(poll, 3000)
    return () => clearInterval(id)
  }, [])

  return stock
}
