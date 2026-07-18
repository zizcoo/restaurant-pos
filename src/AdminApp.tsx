import { useState, useEffect, useRef } from 'react'
import { categories, formatMMK } from './data/menu'
import {
  adminLogin, adminLogout, isAdminLoggedIn,
  useOrders, useTables, useOutOfStock, useMenuPrices,
  updateOrderStatus, setTableStatus, toggleStock, setMenuPrice,
  getTodayOrders, getTodayRevenue, getOrders,
  type Order, type TableStatus,
} from './data/store'

type AdminPage = 'dashboard' | 'tables' | 'orders' | 'menu' | 'stock' | 'billing' | 'kitchen' | 'notifications'

export default function AdminApp() {
  const [loggedIn, setLoggedIn] = useState(isAdminLoggedIn)
  const [user, setUser] = useState('')
  const [pass, setPass] = useState('')
  const [loginErr, setLoginErr] = useState(false)
  const [page, setPage] = useState<AdminPage>('dashboard')

  const orders = useOrders()
  const tables = useTables()
  const outOfStock = useOutOfStock()

  const todayOrders = orders.filter(o => new Date(o.created_at).toDateString() === new Date().toDateString())
  const pendingOrders = orders.filter(o => o.status === 'pending')
  const cookedOrders2 = orders.filter(o => o.status === 'cooked')
  const activeOrders = orders.filter(o => ['approved', 'preparing', 'cooked'].includes(o.status))
  const needsAction = pendingOrders.length + cookedOrders2.length // total items needing staff action
  const [revenue, setRevenue] = useState({ total: 0, cash: 0, qr: 0, count: 0 })
  useEffect(() => { getTodayRevenue().then(setRevenue).catch(() => {}) }, [orders])

  // 🔔 Notification when new order arrives (pending)
  const prevPendingCount = useRef(pendingOrders.length)
  useEffect(() => {
    if (pendingOrders.length > prevPendingCount.current) {
      setNotification('📋 New order from Table ' + (pendingOrders[pendingOrders.length - 1]?.table_id || '?') + '!')
      try {
        const ctx = new AudioContext()
        const o = ctx.createOscillator(); const g = ctx.createGain()
        o.connect(g); g.connect(ctx.destination)
        o.frequency.value = 800; g.gain.value = 0.4; o.start()
        g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3)
        o.stop(ctx.currentTime + 0.3)
        setTimeout(() => {
          const o2 = ctx.createOscillator(); const g2 = ctx.createGain()
          o2.connect(g2); g2.connect(ctx.destination)
          o2.frequency.value = 1000; g2.gain.value = 0.4; o2.start()
          g2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3)
          o2.stop(ctx.currentTime + 0.3)
        }, 200)
      } catch(e) {}
      setTimeout(() => setNotification(''), 8000)
    }
    prevPendingCount.current = pendingOrders.length
  }, [pendingOrders.length])

  // 🔔 Notification when chef marks food ready
  const cookedOrders = orders.filter(o => o.status === 'cooked')
  const prevReadyCount = useRef(cookedOrders.length)
  const [notification, setNotification] = useState('')
  useEffect(() => {
    if (cookedOrders.length > prevReadyCount.current) {
      // Chef marked something as ready — DING!
      const newReady = cookedOrders.find(o => !notification)
      setNotification('👨‍🍳 Chef finished Table ' + (newReady?.table_id || '?') + '!')
      // Play sound
      try {
        const ctx = new AudioContext()
        // Ding 1
        const osc = ctx.createOscillator(); const g = ctx.createGain()
        osc.connect(g); g.connect(ctx.destination)
        osc.frequency.value = 1047; g.gain.value = 0.4; osc.start()
        g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4)
        osc.stop(ctx.currentTime + 0.4)
        // Ding 2
        setTimeout(() => {
          const o2 = ctx.createOscillator(); const g2 = ctx.createGain()
          o2.connect(g2); g2.connect(ctx.destination)
          o2.frequency.value = 1319; g2.gain.value = 0.4; o2.start()
          g2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4)
          o2.stop(ctx.currentTime + 0.4)
        }, 150)
        // Ding 3
        setTimeout(() => {
          const o3 = ctx.createOscillator(); const g3 = ctx.createGain()
          o3.connect(g3); g3.connect(ctx.destination)
          o3.frequency.value = 1568; g3.gain.value = 0.4; o3.start()
          g3.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5)
          o3.stop(ctx.currentTime + 0.5)
        }, 300)
      } catch(e) {}
      // Auto-dismiss after 8 seconds
      setTimeout(() => setNotification(''), 8000)
    }
    prevReadyCount.current = cookedOrders.length
  }, [cookedOrders.length])

  // 🛎️ Notification when customer picks up food
  const servedOrders = orders.filter(o => o.status === 'served')
  const prevServedCount = useRef(servedOrders.length)
  useEffect(() => {
    if (servedOrders.length > prevServedCount.current) {
      const latest = servedOrders[servedOrders.length - 1]
      setNotification('✅ Table ' + (latest?.table_id || '?') + ' picked up their food!')
      setTimeout(() => setNotification(''), 6000)
    }
    prevServedCount.current = servedOrders.length
  }, [servedOrders.length])

  const doLogin = async () => {
    if (await adminLogin(user, pass)) { setLoggedIn(true); setLoginErr(false) }
    else setLoginErr(true)
  }

  const doLogout = () => { adminLogout(); setLoggedIn(false) }

  // ─── LOGIN SCREEN ──────────────────────────────────────────────
  if (!loggedIn) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #0F172A, #1E293B)' }}>
      <div style={{ width: '100%', maxWidth: 380, padding: 32 }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ width: 64, height: 64, borderRadius: 16, background: 'linear-gradient(135deg, #22C55E, #15803D)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32, margin: '0 auto 16px', boxShadow: '0 8px 32px rgba(22,163,74,0.3)' }}>🍽</div>
          <h1 style={{ fontSize: 24, fontWeight: 900, color: 'white' }}>Manager Dashboard</h1>
          <p style={{ color: '#64748B', fontSize: 14, marginTop: 4 }}>Restaurant POS Admin</p>
        </div>
        <div style={{ background: '#1E293B', border: '1px solid #334155', borderRadius: 16, padding: 24 }}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 12, fontWeight: 700, color: '#94A3B8', display: 'block', marginBottom: 6 }}>Username</label>
            <input value={user} onChange={e => setUser(e.target.value)} onKeyDown={e => e.key === 'Enter' && doLogin()}
              placeholder="admin" style={{ width: '100%', padding: '12px 14px', borderRadius: 10, border: '1.5px solid #334155', background: '#0F172A', color: 'white', fontSize: 14 }} />
          </div>
          <div style={{ marginBottom: 20 }}>
            <label style={{ fontSize: 12, fontWeight: 700, color: '#94A3B8', display: 'block', marginBottom: 6 }}>Password</label>
            <input type="password" value={pass} onChange={e => setPass(e.target.value)} onKeyDown={e => e.key === 'Enter' && doLogin()}
              placeholder="••••••••" style={{ width: '100%', padding: '12px 14px', borderRadius: 10, border: '1.5px solid #334155', background: '#0F172A', color: 'white', fontSize: 14 }} />
          </div>
          {loginErr && <p style={{ color: '#EF4444', fontSize: 13, marginBottom: 12, textAlign: 'center' }}>❌ Invalid credentials</p>}
          <button onClick={doLogin} style={{ width: '100%', padding: 14, borderRadius: 12, background: 'linear-gradient(135deg, #22C55E, #15803D)', color: 'white', fontSize: 15, fontWeight: 800, cursor: 'pointer', border: 'none' }}>
            🔐 Sign In
          </button>
          <p style={{ color: '#475569', fontSize: 11, textAlign: 'center', marginTop: 12 }}>Default: admin / admin123</p>
        </div>
      </div>
    </div>
  )

  // ─── NAV ITEMS ─────────────────────────────────────────────────
  const navItems: { id: AdminPage; label: string; emoji: string; badge?: number }[] = [
    { id: 'dashboard', label: 'Dashboard', emoji: '📊' },
    { id: 'tables', label: 'Tables', emoji: '🪑' },
    { id: 'orders', label: 'Orders', emoji: '✅', badge: pendingOrders.length + cookedOrders2.length },
    { id: 'menu', label: 'Menu', emoji: '📋' },
    { id: 'stock', label: 'Stock', emoji: '📦', badge: outOfStock.length },
    { id: 'billing', label: 'Billing', emoji: '💰' },
    { id: 'kitchen', label: 'Kitchen', emoji: '👨‍🍳', badge: activeOrders.length },
  ]

  // ─── DASHBOARD PAGE ────────────────────────────────────────────
  const DashboardPage = () => (
    <div>
      <h2 style={{ fontSize: 20, fontWeight: 900, marginBottom: 20 }}>📊 Today's Overview</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 24 }}>
        {[
          { label: 'Total Revenue', value: formatMMK(revenue.total), color: '#16A34A', bg: '#F0FDF4', icon: '💰' },
          { label: 'Orders Today', value: String(revenue.count), color: '#2563EB', bg: '#EFF6FF', icon: '📋' },
          { label: 'Cash Revenue', value: formatMMK(revenue.cash), color: '#D97706', bg: '#FFFBEB', icon: '💵' },
          { label: 'QR Revenue', value: formatMMK(revenue.qr), color: '#7C3AED', bg: '#F5F3FF', icon: '📱' },
          { label: 'Pending Approval', value: String(pendingOrders.length), color: '#DC2626', bg: '#FEF2F2', icon: '⏳' },
          { label: 'Tables Busy', value: `${Object.values(tables).filter(s => s !== 'free').length} / 8`, color: '#0891B2', bg: '#ECFEFF', icon: '🪑' },
        ].map(card => (
          <div key={card.label} style={{ padding: 20, borderRadius: 16, background: card.bg, border: `1.5px solid ${card.color}22` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontSize: 24 }}>{card.icon}</span>
            </div>
            <p style={{ fontSize: 24, fontWeight: 900, color: card.color }}>{card.value}</p>
            <p style={{ fontSize: 12, color: '#6B7280', fontWeight: 600 }}>{card.label}</p>
          </div>
        ))}
      </div>
      {pendingOrders.length > 0 && (
        <div style={{ padding: 16, borderRadius: 12, background: '#FEF9C3', border: '1px solid #FDE68A', marginBottom: 16 }}>
          <p style={{ fontWeight: 800, color: '#92400E' }}>⚠️ {pendingOrders.length} cash order(s) waiting for approval!</p>
          <button onClick={() => setPage('orders')} style={{ marginTop: 8, padding: '6px 16px', borderRadius: 8, background: '#D97706', color: 'white', fontWeight: 700, fontSize: 13, cursor: 'pointer', border: 'none' }}>
            Go to Orders →
          </button>
        </div>
      )}
    </div>
  )

  // ─── TABLES PAGE ───────────────────────────────────────────────
  const TablesPage = () => {
    const statusColors: Record<TableStatus, { bg: string; border: string; text: string; label: string }> = {
      free: { bg: '#F0FDF4', border: '#BBF7D0', text: '#16A34A', label: '🟢 Free' },
      occupied: { bg: '#FEF2F2', border: '#FECACA', text: '#DC2626', label: '🔴 Occupied' },
      ordering: { bg: '#FEF9C3', border: '#FDE68A', text: '#92400E', label: '🟡 Ordering' },
    }
    return (
      <div>
        <h2 style={{ fontSize: 20, fontWeight: 900, marginBottom: 20 }}>🪑 Table Status</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 16 }}>
          {Object.entries(tables).map(([id, status]) => {
            const s = statusColors[status]
            const tableOrders = orders.filter(o => o.table_id === id && (o.status === 'approved' || o.status === 'preparing'))
            return (
              <div key={id} style={{ padding: 20, borderRadius: 16, background: s.bg, border: `2px solid ${s.border}`, textAlign: 'center' }}>
                <div style={{ fontSize: 36, marginBottom: 8 }}>🪑</div>
                <h3 style={{ fontSize: 18, fontWeight: 900 }}>Table {id}</h3>
                <p style={{ fontSize: 13, fontWeight: 700, color: s.text, marginTop: 4 }}>{s.label}</p>
                {tableOrders.length > 0 && (
                  <p style={{ fontSize: 12, color: '#6B7280', marginTop: 8 }}>
                    {tableOrders.length} active order(s) • {formatMMK(tableOrders.reduce((s, o) => s + o.total, 0))}
                  </p>
                )}
                <div style={{ display: 'flex', gap: 6, marginTop: 12, justifyContent: 'center' }}>
                  {(['free', 'occupied'] as TableStatus[]).map(st => (
                    <button key={st} onClick={() => setTableStatus(id, st)}
                      style={{ padding: '4px 12px', borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: 'pointer',
                        background: status === st ? s.text : 'white', color: status === st ? 'white' : '#6B7280',
                        border: `1px solid ${status === st ? s.text : '#E5E7EB'}`,
                      }}>{st === 'free' ? 'Set Free' : 'Set Busy'}</button>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  // ─── ORDERS PAGE ───────────────────────────────────────────────
  const printKitchenTicket = (order: Order) => {
    const w = window.open('', '_blank', 'width=300,height=500')
    if (!w) return
    w.document.write(`<html><head><title>Kitchen Ticket</title>
      <style>body{font-family:monospace;width:260px;margin:0 auto;padding:10px}
      h2{text-align:center;margin:0;border-bottom:2px dashed #000;padding-bottom:8px}
      .item{margin:6px 0;font-size:14px}.opts{font-size:11px;color:#666}
      .notes{font-size:12px;font-weight:bold;color:#333}
      .footer{border-top:2px dashed #000;margin-top:10px;padding-top:8px;text-align:center;font-size:11px}
      </style></head><body>
      <h2>🍳 KITCHEN ORDER</h2>
      <p style="text-align:center;font-size:18px;font-weight:bold;margin:8px 0">TABLE ${order.table_id}</p>
      <p style="text-align:center;font-size:11px;color:#666">${order.id} • ${new Date(order.created_at).toLocaleTimeString()}</p>
      <hr style="border:1px dashed #000">
      ${order.items.map(i => `
        <div class="item"><b>${i.qty}× ${i.name}</b>
        ${i.options ? `<div class="opts">${i.options}</div>` : ''}
        ${i.notes ? `<div class="notes">📝 ${i.notes}</div>` : ''}</div>
      `).join('')}
      <div class="footer">
        <p>Printed: ${new Date().toLocaleTimeString()}</p>
      </div>
      </body></html>`)
    w.document.close()
    w.print()
  }

  const OrdersPage = () => {
    const [filter, setFilter] = useState<'pending' | 'active' | 'all'>('pending')
    const activeList = todayOrders.filter(o => ['approved', 'preparing', 'ready'].includes(o.status))
    const filtered = filter === 'all' ? todayOrders
      : filter === 'pending' ? todayOrders.filter(o => o.status === 'pending')
      : activeList

    const statusBadge = (status: string) => {
      const map: Record<string, { bg: string; color: string; label: string }> = {
        pending: { bg: '#FEF9C3', color: '#92400E', label: '⏳ Pending' },
        approved: { bg: '#DBEAFE', color: '#1E40AF', label: '✅ Approved' },
        preparing: { bg: '#FEF3C7', color: '#92400E', label: '🔥 Cooking' },
        ready: { bg: '#D1FAE5', color: '#065F46', label: '🍽️ Ready' },
        served: { bg: '#F0FDF4', color: '#16A34A', label: '😋 Served' },
        rejected: { bg: '#FEE2E2', color: '#DC2626', label: '✕ Rejected' },
      }
      const s = map[status] || map.pending
      return <span style={{ fontSize: 12, fontWeight: 700, padding: '3px 10px', borderRadius: 999, background: s.bg, color: s.color }}>{s.label}</span>
    }

    return (
      <div>
        <h2 style={{ fontSize: 20, fontWeight: 900, marginBottom: 16 }}>✅ Order Management</h2>
        <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
          {([
            ['pending', `⏳ Pending (${pendingOrders.length})`],
            ['active', `🔥 Active (${activeList.length})`],
            ['all', '📋 All'],
          ] as const).map(([f, label]) => (
            <button key={f} onClick={() => setFilter(f as any)} style={{
              padding: '6px 16px', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer',
              background: filter === f ? '#111827' : 'white', color: filter === f ? 'white' : '#6B7280',
              border: `1px solid ${filter === f ? '#111827' : '#E5E7EB'}`,
            }}>{label}</button>
          ))}
        </div>
        {filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40, color: '#9CA3AF' }}>
            <p style={{ fontSize: 48, marginBottom: 8 }}>📭</p>
            <p>No orders {filter === 'pending' ? 'to approve' : 'found'}</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {filtered.map(order => (
              <div key={order.id} style={{ padding: 20, borderRadius: 16, background: 'white', border: `2px solid ${order.status === 'pending' ? '#FDE68A' : order.status === 'ready' ? '#A7F3D0' : '#E5E7EB'}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <div>
                    <span style={{ fontWeight: 900, fontSize: 16 }}>Table #{order.table_id}</span>
                    <span style={{ marginLeft: 8, fontSize: 12, color: '#9CA3AF' }}>{order.id}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, padding: '3px 10px', borderRadius: 999,
                      background: order.pay_method === 'CASH' ? '#FEF9C3' : '#F0FDF4',
                      color: order.pay_method === 'CASH' ? '#92400E' : '#16A34A',
                    }}>{order.pay_method === 'CASH' ? '💵 Cash' : '📱 QR'}</span>
                    {statusBadge(order.status)}
                  </div>
                </div>
                <div style={{ fontSize: 13, color: '#4B5563', marginBottom: 12 }}>
                  {order.items.map((item, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span>{item.name} ×{item.qty} {item.options && <span style={{ color: '#9CA3AF', fontSize: 11 }}>({item.options})</span>}</span>
                      <span style={{ fontWeight: 600 }}>{formatMMK(item.unitTotal * item.qty)}</span>
                    </div>
                  ))}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px dashed #E5E7EB', paddingTop: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontWeight: 900, fontSize: 18, color: '#15803D' }}>{formatMMK(order.total)}</span>
                    <span style={{ fontSize: 11, color: '#9CA3AF' }}>{new Date(order.created_at).toLocaleTimeString()}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {/* PENDING → Approve + Print ticket for chef */}
                    {order.status === 'pending' && (<>
                      <button onClick={() => updateOrderStatus(order.id, 'rejected')} style={{ padding: '7px 14px', borderRadius: 8, fontWeight: 700, fontSize: 12, cursor: 'pointer', background: '#FEE2E2', color: '#DC2626', border: '1px solid #FECACA' }}>
                        ✕ Reject
                      </button>
                      <button onClick={() => { updateOrderStatus(order.id, 'approved'); printKitchenTicket(order) }} style={{ padding: '7px 14px', borderRadius: 8, fontWeight: 700, fontSize: 12, cursor: 'pointer', background: '#16A34A', color: 'white', border: 'none' }}>
                        ✓ Approve + 🖨 Print
                      </button>
                    </>)}
                    {/* APPROVED → reprint or mark cooking */}
                    {order.status === 'approved' && (<>
                      <button onClick={() => printKitchenTicket(order)} style={{ padding: '7px 14px', borderRadius: 8, fontWeight: 700, fontSize: 12, cursor: 'pointer', background: '#F3F4F6', color: '#4B5563', border: '1px solid #E5E7EB' }}>
                        🖨 Reprint
                      </button>
                      <button onClick={() => updateOrderStatus(order.id, 'preparing')} style={{ padding: '7px 14px', borderRadius: 8, fontWeight: 700, fontSize: 12, cursor: 'pointer', background: '#2563EB', color: 'white', border: 'none' }}>
                        🔥 Cooking
                      </button>
                    </>)}
                    {/* PREPARING → Food ready (chef is done) */}
                    {order.status === 'preparing' && (
                      <button onClick={() => updateOrderStatus(order.id, 'ready')} style={{ padding: '7px 14px', borderRadius: 8, fontWeight: 700, fontSize: 12, cursor: 'pointer', background: '#D97706', color: 'white', border: 'none' }}>
                        🍽️ Food Ready
                      </button>
                    )}
                    {/* READY → Served (waiter delivered to table) */}
                    {order.status === 'ready' && (
                      <button onClick={() => { updateOrderStatus(order.id, 'served'); setTableStatus(order.table_id, 'free') }} style={{ padding: '7px 14px', borderRadius: 8, fontWeight: 700, fontSize: 12, cursor: 'pointer', background: '#16A34A', color: 'white', border: 'none' }}>
                        ✅ Served
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  // ─── MENU MANAGEMENT PAGE ──────────────────────────────────────
  const priceOverrides = useMenuPrices()

  const MenuPage = () => {
    const [editingId, setEditingId] = useState<number | null>(null)
    const [editPrice, setEditPrice] = useState('')

    const savePrice = async (itemId: number) => {
      const p = parseInt(editPrice)
      if (!p || p < 0) return
      await setMenuPrice(itemId, p)
      setEditingId(null)
    }

    return (
      <div>
        <h2 style={{ fontSize: 20, fontWeight: 900, marginBottom: 20 }}>📋 Menu Items</h2>
        {categories.map(cat => (
          <div key={cat.id} style={{ marginBottom: 24 }}>
            <h3 style={{ fontSize: 16, fontWeight: 800, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
              {cat.emoji} {cat.name} <span style={{ fontSize: 12, color: '#9CA3AF', fontWeight: 500 }}>({cat.items.length} items)</span>
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {cat.items.map(item => {
                const soldOut = outOfStock.includes(item.id)
                const currentPrice = priceOverrides[item.id] ?? item.price
                const isEditing = editingId === item.id
                return (
                  <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderRadius: 12, background: soldOut ? '#FEF2F2' : 'white', border: `1.5px solid ${soldOut ? '#FECACA' : '#E5E7EB'}` }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontWeight: 700, fontSize: 14 }}>{item.name}</span>
                        {soldOut && <span style={{ fontSize: 10, fontWeight: 800, padding: '2px 8px', borderRadius: 999, background: '#FEE2E2', color: '#DC2626' }}>OUT OF STOCK</span>}
                        {priceOverrides[item.id] && priceOverrides[item.id] !== item.price && (
                          <span style={{ fontSize: 10, fontWeight: 800, padding: '2px 8px', borderRadius: 999, background: '#DBEAFE', color: '#1E40AF' }}>PRICE CHANGED</span>
                        )}
                      </div>
                      <p style={{ fontSize: 12, color: '#9CA3AF' }}>{item.nameMm}</p>
                    </div>
                    {isEditing ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <input
                          type="number" value={editPrice}
                          onChange={e => setEditPrice(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && savePrice(item.id)}
                          autoFocus
                          style={{ width: 90, padding: '6px 10px', borderRadius: 8, border: '2px solid #2563EB', fontSize: 14, fontWeight: 700, textAlign: 'right' }}
                        />
                        <button onClick={() => savePrice(item.id)} style={{ padding: '6px 10px', borderRadius: 8, background: '#16A34A', color: 'white', fontWeight: 700, fontSize: 12, cursor: 'pointer', border: 'none' }}>✓</button>
                        <button onClick={() => setEditingId(null)} style={{ padding: '6px 10px', borderRadius: 8, background: '#F3F4F6', color: '#6B7280', fontWeight: 700, fontSize: 12, cursor: 'pointer', border: 'none' }}>✕</button>
                      </div>
                    ) : (
                      <span onClick={() => { setEditingId(item.id); setEditPrice(String(currentPrice)) }}
                        style={{ fontWeight: 800, color: '#16A34A', fontSize: 14, cursor: 'pointer', padding: '4px 8px', borderRadius: 6, background: '#F0FDF4' }}
                        title="Click to edit price">
                        {formatMMK(currentPrice)} ✏️
                      </span>
                    )}
                    <button onClick={() => toggleStock(item.id)} style={{
                      padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer',
                      background: soldOut ? '#16A34A' : '#FEE2E2', color: soldOut ? 'white' : '#DC2626',
                      border: 'none',
                    }}>{soldOut ? '✓ Restock' : '✕ Mark Out'}</button>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    )
  }

  // ─── STOCK CONTROL PAGE ────────────────────────────────────────
  const StockPage = () => {
    const outItems = categories.flatMap(c => c.items).filter(i => outOfStock.includes(i.id))
    const getReport = () => `🚨 OUT OF STOCK REPORT (${new Date().toLocaleDateString()})\n\n` +
      outItems.map(i => `❌ ${i.name} (${i.nameMm})`).join('\n') +
      `\n\n${outItems.length} item(s) need restocking.\n🕐 ${new Date().toLocaleTimeString()}`
    const copyReport = () => {
      navigator.clipboard.writeText(getReport())
      alert('📋 Report copied! Paste to Viber/Telegram.')
    }
    const whatsappReport = () => {
      window.open('https://wa.me/?text=' + encodeURIComponent(getReport()), '_blank')
    }
    return (
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ fontSize: 20, fontWeight: 900 }}>📦 Stock Control</h2>
          {outItems.length > 0 && (
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={whatsappReport} style={{ padding: '8px 16px', borderRadius: 10, background: '#25D366', color: 'white', fontWeight: 700, fontSize: 13, cursor: 'pointer', border: 'none' }}>
                💬 WhatsApp Boss
              </button>
              <button onClick={copyReport} style={{ padding: '8px 16px', borderRadius: 10, background: '#DC2626', color: 'white', fontWeight: 700, fontSize: 13, cursor: 'pointer', border: 'none' }}>
                📋 Copy Report
              </button>
            </div>
          )}
        </div>
        {outItems.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40, color: '#9CA3AF' }}>
            <p style={{ fontSize: 48, marginBottom: 8 }}>✅</p>
            <p style={{ fontWeight: 700 }}>All items are in stock!</p>
            <p style={{ fontSize: 13, marginTop: 4 }}>Go to Menu page to mark items as out of stock.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ padding: 16, borderRadius: 12, background: '#FEF2F2', border: '1.5px solid #FECACA', marginBottom: 8 }}>
              <p style={{ fontWeight: 800, color: '#DC2626' }}>🚨 {outItems.length} item(s) out of stock</p>
              <p style={{ fontSize: 13, color: '#6B7280', marginTop: 4 }}>These items are hidden from customer menu. Click "Restock" to make available again.</p>
            </div>
            {outItems.map(item => {
              const cat = categories.find(c => c.id === item.categoryId)
              return (
                <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', borderRadius: 12, background: 'white', border: '1.5px solid #FECACA' }}>
                  <span style={{ fontSize: 24 }}>{cat?.emoji}</span>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontWeight: 700 }}>{item.name}</p>
                    <p style={{ fontSize: 12, color: '#9CA3AF' }}>{item.nameMm} • {formatMMK(item.price)}</p>
                  </div>
                  <button onClick={() => toggleStock(item.id)} style={{ padding: '8px 16px', borderRadius: 8, background: '#16A34A', color: 'white', fontWeight: 700, fontSize: 13, cursor: 'pointer', border: 'none' }}>
                    ✓ Restock
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  // ─── BILLING PAGE ──────────────────────────────────────────────
  const BillingPage = () => {
    const completedOrders = todayOrders.filter(o => o.status !== 'pending' && o.status !== 'rejected')
    const byTable: Record<string, number> = {}
    completedOrders.forEach(o => { byTable[o.table_id] = (byTable[o.table_id] || 0) + o.total })
    const rejectedCount = todayOrders.filter(o => o.status === 'rejected').length
    const outItems = categories.flatMap(c => c.items).filter(i => outOfStock.includes(i.id))

    const getDailyReport = () =>
      `📊 DAILY REPORT — ${new Date().toLocaleDateString()}\n` +
      `━━━━━━━━━━━━━━━━━\n` +
      `💰 Total Revenue: ${formatMMK(revenue.total)}\n` +
      `💵 Cash: ${formatMMK(revenue.cash)}\n` +
      `📱 QR Pay: ${formatMMK(revenue.qr)}\n` +
      `📋 Orders: ${revenue.count}\n` +
      (rejectedCount > 0 ? `❌ Rejected: ${rejectedCount}\n` : '') +
      `━━━━━━━━━━━━━━━━━\n` +
      `📊 Revenue by Table:\n` +
      Object.entries(byTable).sort((a, b) => b[1] - a[1]).map(([t, v]) => `  Table ${t}: ${formatMMK(v)}`).join('\n') +
      (outItems.length > 0 ? `\n━━━━━━━━━━━━━━━━━\n🚨 Out of Stock: ${outItems.map(i => i.name).join(', ')}` : '') +
      `\n\n🕐 Report time: ${new Date().toLocaleTimeString()}`

    const printDailyReport = () => {
      const w = window.open('', '_blank', 'width=400,height=600')
      if (!w) return
      w.document.write(`<html><head><title>Daily Report</title>
        <style>body{font-family:monospace;width:350px;margin:0 auto;padding:20px}
        h2{text-align:center;border-bottom:2px dashed #000;padding-bottom:10px}
        .row{display:flex;justify-content:space-between;padding:6px 0}
        .line{border-top:1px dashed #000;margin:12px 0}
        .big{font-size:24px;font-weight:bold;text-align:center;margin:10px 0}
        </style></head><body>
        <h2>📊 DAILY REPORT</h2>
        <p style="text-align:center">${new Date().toLocaleDateString()} • ${new Date().toLocaleTimeString()}</p>
        <div class="line"></div>
        <div class="big">${formatMMK(revenue.total)}</div>
        <p style="text-align:center;color:#666">Total Revenue</p>
        <div class="line"></div>
        <div class="row"><span>💵 Cash</span><b>${formatMMK(revenue.cash)}</b></div>
        <div class="row"><span>📱 QR Pay</span><b>${formatMMK(revenue.qr)}</b></div>
        <div class="row"><span>📋 Total Orders</span><b>${revenue.count}</b></div>
        ${rejectedCount > 0 ? `<div class="row"><span>❌ Rejected</span><b>${rejectedCount}</b></div>` : ''}
        <div class="line"></div>
        <p><b>Revenue by Table:</b></p>
        ${Object.entries(byTable).sort((a, b) => b[1] - a[1]).map(([t, v]) =>
          `<div class="row"><span>Table ${t}</span><b>${formatMMK(v)}</b></div>`
        ).join('')}
        ${outItems.length > 0 ? `<div class="line"></div><p><b>🚨 Out of Stock:</b></p><p>${outItems.map(i => i.name).join(', ')}</p>` : ''}
        <div class="line"></div>
        <p style="text-align:center;font-size:11px">End of Day Report</p>
        </body></html>`)
      w.document.close()
      w.print()
    }

    return (
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ fontSize: 20, fontWeight: 900 }}>💰 Today's Billing</h2>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => { navigator.clipboard.writeText(getDailyReport()); alert('📋 Daily report copied!') }} style={{ padding: '8px 14px', borderRadius: 10, background: '#25D366', color: 'white', fontWeight: 700, fontSize: 12, cursor: 'pointer', border: 'none' }}>
              💬 Send to Boss
            </button>
            <button onClick={printDailyReport} style={{ padding: '8px 14px', borderRadius: 10, background: '#2563EB', color: 'white', fontWeight: 700, fontSize: 12, cursor: 'pointer', border: 'none' }}>
              🖨️ Print Report
            </button>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 24 }}>
          <div style={{ padding: 20, borderRadius: 16, background: '#F0FDF4', border: '2px solid #BBF7D0' }}>
            <p style={{ fontSize: 28, fontWeight: 900, color: '#15803D' }}>{formatMMK(revenue.total)}</p>
            <p style={{ fontSize: 13, color: '#6B7280', fontWeight: 600 }}>💰 Total Revenue</p>
          </div>
          <div style={{ padding: 20, borderRadius: 16, background: '#FEF9C3', border: '2px solid #FDE68A' }}>
            <p style={{ fontSize: 28, fontWeight: 900, color: '#D97706' }}>{formatMMK(revenue.cash)}</p>
            <p style={{ fontSize: 13, color: '#6B7280', fontWeight: 600 }}>💵 Cash</p>
          </div>
          <div style={{ padding: 20, borderRadius: 16, background: '#F5F3FF', border: '2px solid #DDD6FE' }}>
            <p style={{ fontSize: 28, fontWeight: 900, color: '#7C3AED' }}>{formatMMK(revenue.qr)}</p>
            <p style={{ fontSize: 13, color: '#6B7280', fontWeight: 600 }}>📱 QR Pay</p>
          </div>
          <div style={{ padding: 20, borderRadius: 16, background: '#EFF6FF', border: '2px solid #BFDBFE' }}>
            <p style={{ fontSize: 28, fontWeight: 900, color: '#2563EB' }}>{revenue.count}</p>
            <p style={{ fontSize: 13, color: '#6B7280', fontWeight: 600 }}>📋 Orders</p>
          </div>
        </div>

        {/* By Table */}
        <h3 style={{ fontSize: 16, fontWeight: 800, marginBottom: 12 }}>Revenue by Table</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 10, marginBottom: 24 }}>
          {Object.entries(byTable).sort((a, b) => b[1] - a[1]).map(([tableId, total]) => (
            <div key={tableId} style={{ padding: 14, borderRadius: 12, background: 'white', border: '1px solid #E5E7EB', textAlign: 'center' }}>
              <p style={{ fontWeight: 900, color: '#111827' }}>Table {tableId}</p>
              <p style={{ fontWeight: 800, color: '#16A34A', fontSize: 14, marginTop: 4 }}>{formatMMK(total)}</p>
            </div>
          ))}
        </div>

        {/* Order history */}
        <h3 style={{ fontSize: 16, fontWeight: 800, marginBottom: 12 }}>Order History</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {completedOrders.slice().reverse().map(order => (
            <div key={order.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderRadius: 12, background: 'white', border: '1px solid #E5E7EB' }}>
              <span style={{ fontWeight: 800 }}>T{order.table_id}</span>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 13 }}>{order.items.map(i => `${i.name} ×${i.qty}`).join(', ')}</p>
                <p style={{ fontSize: 11, color: '#9CA3AF' }}>{new Date(order.created_at).toLocaleTimeString()} • {order.pay_method}</p>
              </div>
              <span style={{ fontWeight: 900, color: '#15803D' }}>{formatMMK(order.total)}</span>
            </div>
          ))}
        </div>
      </div>
    )
  }

  // ─── KITCHEN PAGE ──────────────────────────────────────────────
  const KitchenPage = () => {
    const kitchenOrders = orders.filter(o => ['approved', 'preparing', 'cooked', 'ready'].includes(o.status))
    return (
      <div>
        <h2 style={{ fontSize: 20, fontWeight: 900, marginBottom: 20 }}>👨‍🍳 Kitchen Orders</h2>
        {kitchenOrders.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40, color: '#9CA3AF' }}>
            <p style={{ fontSize: 48, marginBottom: 8 }}>👨‍🍳</p>
            <p style={{ fontWeight: 700 }}>No active orders!</p>
            <p style={{ fontSize: 13, marginTop: 4 }}>Orders will appear here once approved.</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
            {kitchenOrders.map(order => {
              const elapsed = Math.floor((Date.now() - new Date(order.created_at).getTime()) / 60000)
              return (
                <div key={order.id} style={{ padding: 20, borderRadius: 16, background: elapsed > 15 ? '#FEF2F2' : 'white', border: `2px solid ${elapsed > 15 ? '#FECACA' : elapsed > 10 ? '#FDE68A' : '#BBF7D0'}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <span style={{ fontWeight: 900, fontSize: 20, background: '#111827', color: 'white', padding: '4px 12px', borderRadius: 8 }}>T{order.table_id}</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: elapsed > 15 ? '#DC2626' : '#6B7280' }}>⏱ {elapsed} min</span>
                  </div>
                  <div style={{ fontSize: 14, marginBottom: 16 }}>
                    {order.items.map((item, i) => (
                      <div key={i} style={{ padding: '6px 0', borderBottom: i < order.items.length - 1 ? '1px solid #F3F4F6' : 'none' }}>
                        <span style={{ fontWeight: 700 }}>{item.qty}× {item.name}</span>
                        {item.options && <p style={{ fontSize: 11, color: '#9CA3AF', marginTop: 2 }}>{item.options}</p>}
                        {item.notes && <p style={{ fontSize: 11, color: '#D97706', marginTop: 2 }}>📝 {item.notes}</p>}
                      </div>
                    ))}
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {order.status === 'approved' && (
                      <button onClick={() => updateOrderStatus(order.id, 'preparing')} style={{ flex: 1, padding: '10px 14px', borderRadius: 10, background: '#2563EB', color: 'white', fontWeight: 700, fontSize: 13, cursor: 'pointer', border: 'none' }}>
                        🔥 Start Cooking
                      </button>
                    )}
                    {order.status === 'preparing' && (
                      <button onClick={() => updateOrderStatus(order.id, 'ready')} style={{ flex: 1, padding: '10px 14px', borderRadius: 10, background: '#D97706', color: 'white', fontWeight: 700, fontSize: 13, cursor: 'pointer', border: 'none' }}>
                        🍽️ Food Ready
                      </button>
                    )}
                    {order.status === 'cooked' && (
                      <button onClick={() => updateOrderStatus(order.id, 'ready')} style={{ flex: 1, padding: '10px 14px', borderRadius: 10, background: '#F59E0B', color: 'white', fontWeight: 700, fontSize: 13, cursor: 'pointer', border: 'none' }}>
                        🔔 Approve Pickup
                      </button>
                    )}
                    {order.status === 'ready' && (
                      <div style={{ flex: 1, padding: '10px 14px', borderRadius: 10, background: '#FEF9C3', border: '2px solid #F59E0B', textAlign: 'center', fontWeight: 700, fontSize: 13, color: '#92400E', animation: 'pulse 1.5s infinite' }}>
                        🔔 Waiting for customer pickup...
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  // ─── NOTIFICATIONS PAGE ────────────────────────────────────────
  const NotificationsPage = () => {
    const notiItems: { emoji: string; title: string; desc: string; time: string; action: string; onClick: () => void; color: string }[] = []

    // Pending orders need approval
    pendingOrders.forEach(o => {
      notiItems.push({
        emoji: '📋', title: `New order from Table ${o.table_id}`,
        desc: `${o.items.length} items • ${formatMMK(o.total)} • ${o.pay_method === 'CASH' ? 'Cash' : 'QR Pay'}`,
        time: new Date(o.created_at).toLocaleTimeString(),
        action: 'Approve', onClick: () => setPage('orders'), color: '#2563EB',
      })
    })

    // Cooked orders need pickup approval
    cookedOrders2.forEach(o => {
      notiItems.push({
        emoji: '👨\u200D🍳', title: `Chef finished Table ${o.table_id}`,
        desc: `${o.items.length} items ready — approve for customer pickup`,
        time: new Date(o.created_at).toLocaleTimeString(),
        action: 'Approve Pickup', onClick: () => { updateOrderStatus(o.id, 'ready'); },  color: '#F59E0B',
      })
    })

    // Ready orders waiting for customer
    const readyNow = orders.filter(o => o.status === 'ready')
    readyNow.forEach(o => {
      notiItems.push({
        emoji: '🔔', title: `Table ${o.table_id} waiting to pick up`,
        desc: 'Customer has been notified',
        time: new Date(o.created_at).toLocaleTimeString(),
        action: 'View', onClick: () => setPage('orders'), color: '#D97706',
      })
    })

    // Out of stock items
    if (outOfStock.length > 0) {
      const names = categories.flatMap(c => c.items).filter(i => outOfStock.includes(i.id)).map(i => i.name)
      notiItems.push({
        emoji: '📦', title: `${outOfStock.length} items out of stock`,
        desc: names.join(', '),
        time: '', action: 'Manage Stock', onClick: () => setPage('stock'), color: '#DC2626',
      })
    }

    return (
      <div>
        <h2 style={{ fontSize: 20, fontWeight: 900, marginBottom: 20 }}>🔔 Notifications</h2>
        {notiItems.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 60, color: '#9CA3AF' }}>
            <p style={{ fontSize: 48, marginBottom: 8 }}>✅</p>
            <p style={{ fontWeight: 700 }}>All clear! No notifications</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {notiItems.map((n, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: 16, borderRadius: 14, background: 'white', border: '1px solid #F3F4F6', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: n.color + '15', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>
                  {n.emoji}
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ fontWeight: 700, fontSize: 14, color: '#111827' }}>{n.title}</p>
                  <p style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>{n.desc}</p>
                  {n.time && <p style={{ fontSize: 11, color: '#9CA3AF', marginTop: 2 }}>{n.time}</p>}
                </div>
                <button onClick={n.onClick} style={{
                  padding: '8px 16px', borderRadius: 10, fontWeight: 700, fontSize: 12,
                  background: n.color, color: 'white', border: 'none', cursor: 'pointer', whiteSpace: 'nowrap',
                }}>
                  {n.action}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  // ─── RENDER ACTIVE PAGE ────────────────────────────────────────
  const renderPage = () => {
    switch (page) {
      case 'dashboard': return <DashboardPage />
      case 'tables': return <TablesPage />
      case 'orders': return <OrdersPage />
      case 'menu': return <MenuPage />
      case 'stock': return <StockPage />
      case 'billing': return <BillingPage />
      case 'kitchen': return <KitchenPage />
      case 'notifications': return <NotificationsPage />
    }
  }

  // ─── ADMIN SHELL ───────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#F8FAFB', fontFamily: "'Inter', system-ui, sans-serif" }}>
      {/* Sidebar */}
      <div style={{ width: 220, background: '#0F172A', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
        <div style={{ padding: '20px 16px', borderBottom: '1px solid #1E293B' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg, #22C55E, #15803D)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>🍽</div>
            <div style={{ flex: 1 }}>
              <p style={{ fontWeight: 800, fontSize: 14, color: 'white' }}>Restaurant POS</p>
              <p style={{ fontSize: 11, color: '#64748B' }}>Manager Panel</p>
            </div>
            <button onClick={() => setPage('notifications')} style={{ position: 'relative', background: 'none', border: 'none', cursor: 'pointer', fontSize: 22, padding: 4 }}>
              🔔
              {needsAction > 0 && (
                <span style={{ position: 'absolute', top: -4, right: -4, minWidth: 18, height: 18, borderRadius: 9, background: '#DC2626', color: 'white', fontSize: 10, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px', animation: 'pulse 1.5s infinite' }}>
                  {needsAction}
                </span>
              )}
            </button>
          </div>
        </div>
        <nav style={{ flex: 1, padding: '12px 8px' }}>
          {navItems.map(item => (
            <button key={item.id} onClick={() => setPage(item.id)} style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 10,
              padding: '10px 12px', borderRadius: 10, marginBottom: 4,
              background: page === item.id ? '#1E293B' : 'transparent',
              color: page === item.id ? 'white' : '#94A3B8',
              border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
              textAlign: 'left',
            }}>
              <span style={{ fontSize: 16 }}>{item.emoji}</span>
              <span style={{ flex: 1 }}>{item.label}</span>
              {item.badge && item.badge > 0 && (
                <span style={{ minWidth: 20, height: 20, borderRadius: 10, background: '#DC2626', color: 'white', fontSize: 11, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 6px' }}>
                  {item.badge}
                </span>
              )}
            </button>
          ))}
        </nav>
        <div style={{ padding: 12, borderTop: '1px solid #1E293B' }}>
          <button onClick={doLogout} style={{ width: '100%', padding: '8px 12px', borderRadius: 8, background: '#1E293B', color: '#94A3B8', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
            🚪 Logout
          </button>
        </div>
      </div>
      {/* Main content */}
      <div style={{ flex: 1, padding: 32, overflowY: 'auto' }}>
        {/* 🔔 Food Ready Notification Banner */}
        {notification && (
          <div onClick={() => { setNotification(''); setPage('orders') }} style={{
            padding: '14px 20px', borderRadius: 14, marginBottom: 20, cursor: 'pointer',
            background: 'linear-gradient(135deg, #FEF9C3, #FDE68A)',
            border: '2px solid #F59E0B',
            display: 'flex', alignItems: 'center', gap: 12,
            animation: 'pulse 1.5s infinite',
            boxShadow: '0 4px 20px rgba(245,158,11,0.3)',
          }}>
            <span style={{ fontSize: 28 }}>🔔</span>
            <div style={{ flex: 1 }}>
              <p style={{ fontWeight: 900, color: '#92400E', fontSize: 16 }}>{notification}</p>
              <p style={{ fontSize: 12, color: '#B45309' }}>Click to go to orders and mark as served</p>
            </div>
            <span style={{ fontSize: 20 }}>→</span>
          </div>
        )}
        {renderPage()}
      </div>
    </div>
  )
}
