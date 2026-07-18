import { useState, useEffect, useRef } from 'react'
import { categories } from './data/menu'
import {
  useOrders, updateOrderStatus, useOutOfStock, toggleStock,
  type Order,
} from './data/store'

export default function KitchenApp() {
  const orders = useOrders()
  const outOfStock = useOutOfStock()
  const [tab, setTab] = useState<'orders' | 'stock'>('orders')

  const kitchenOrders = orders.filter(o => ['approved', 'preparing'].includes(o.status))
  const newOrders = kitchenOrders.filter(o => o.status === 'approved')
  const cookingOrders = kitchenOrders.filter(o => o.status === 'preparing')

  // 🔔 Sound when new order arrives
  const prevCount = useRef(newOrders.length)
  useEffect(() => {
    if (newOrders.length > prevCount.current) {
      try {
        const ctx = new AudioContext()
        const osc = ctx.createOscillator()
        const g = ctx.createGain()
        osc.connect(g); g.connect(ctx.destination)
        osc.frequency.value = 880; g.gain.value = 0.3; osc.start()
        g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5)
        osc.stop(ctx.currentTime + 0.5)
        setTimeout(() => {
          const o2 = ctx.createOscillator(); const g2 = ctx.createGain()
          o2.connect(g2); g2.connect(ctx.destination)
          o2.frequency.value = 1100; g2.gain.value = 0.3; o2.start()
          g2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5)
          o2.stop(ctx.currentTime + 0.5)
        }, 200)
      } catch (e) {}
    }
    // Auto-print kitchen ticket for new orders
      if (newOrders.length > prevCount.current) {
        const latest = newOrders[newOrders.length - 1]
        if (latest) {
          const printWin = window.open('', '_blank', 'width=300,height=500')
          if (printWin) {
            printWin.document.write('<html><head><title>Kitchen Ticket</title><style>body{font-family:monospace;font-size:14px;padding:10px;width:250px}h2{text-align:center;border-bottom:2px dashed #000;padding-bottom:8px}table{width:100%}td{padding:4px 0}.line{border-top:1px dashed #000;margin:8px 0}</style></head><body>')
            printWin.document.write('<h2>🍽️ KITCHEN ORDER</h2>')
            printWin.document.write('<p><b>Table: ' + latest.table_id + '</b></p>')
            printWin.document.write('<p>Order: ' + latest.id + '</p>')
            printWin.document.write('<p>' + new Date(latest.created_at).toLocaleTimeString() + '</p>')
            printWin.document.write('<div class="line"></div>')
            latest.items.forEach((item: any) => {
              printWin.document.write('<p><b>' + item.qty + '× ' + item.name + '</b></p>')
              if (item.options) printWin.document.write('<p style="color:#666;font-size:12px">  ' + item.options + '</p>')
              if (item.notes) printWin.document.write('<p style="color:#666;font-size:12px">  📝 ' + item.notes + '</p>')
            })
            printWin.document.write('<div class="line"></div>')
            printWin.document.write('<p style="text-align:center;font-size:12px">--- END ---</p>')
            printWin.document.write('</body></html>')
            printWin.document.close()
            printWin.print()
          }
        }
      }
    prevCount.current = newOrders.length
  }, [newOrders.length])

  const allItems = categories.flatMap(c => c.items)

  return (
    <div style={{ minHeight: '100vh', background: '#111827', fontFamily: "'Inter', system-ui, sans-serif" }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid #1E293B' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 28 }}>👨‍🍳</span>
          <span style={{ color: 'white', fontSize: 18, fontWeight: 900 }}>Kitchen</span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setTab('orders')} style={{
            padding: '8px 16px', borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: 'pointer', border: 'none',
            background: tab === 'orders' ? '#F59E0B' : '#1E293B', color: tab === 'orders' ? '#111827' : '#94A3B8',
          }}>
            🔥 Orders {kitchenOrders.length > 0 ? `(${kitchenOrders.length})` : ''}
          </button>
          <button onClick={() => setTab('stock')} style={{
            padding: '8px 16px', borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: 'pointer', border: 'none',
            background: tab === 'stock' ? '#EF4444' : '#1E293B', color: tab === 'stock' ? 'white' : '#94A3B8',
          }}>
            📦 Stock {outOfStock.length > 0 ? `(${outOfStock.length})` : ''}
          </button>
        </div>
      </div>

      {/* ─── ORDERS TAB ─────────────────────────────────────── */}
      {tab === 'orders' && (
        <div style={{ padding: 16 }}>
          {kitchenOrders.length === 0 ? (
            <div style={{ textAlign: 'center', paddingTop: 80 }}>
              <p style={{ fontSize: 60, marginBottom: 12 }}>✅</p>
              <p style={{ color: '#6B7280', fontSize: 18, fontWeight: 700 }}>No orders</p>
              <p style={{ color: '#4B5563', fontSize: 13, marginTop: 6 }}>New orders appear with 🔔 sound</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 14 }}>
              {kitchenOrders.map(order => {
                const elapsed = Math.floor((Date.now() - new Date(order.created_at).getTime()) / 60000)
                const isNew = order.status === 'approved'
                const isCooking = order.status === 'preparing'

                return (
                  <div key={order.id} style={{
                    borderRadius: 14, overflow: 'hidden',
                    background: '#1E293B',
                    border: `2px solid ${isNew ? '#F59E0B' : '#3B82F6'}`,
                  }}>
                    {/* Header */}
                    <div style={{
                      padding: '10px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      background: isNew ? '#D97706' : '#2563EB',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontWeight: 900, fontSize: 20, color: 'white' }}>T{order.table_id}</span>
                        <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 8, background: 'rgba(255,255,255,0.2)', color: 'white' }}>
                          {isNew ? '🆕 NEW' : '🔥 COOKING'}
                        </span>
                      </div>
                      <span style={{ color: 'rgba(255,255,255,0.8)', fontWeight: 700, fontSize: 13 }}>⏱ {elapsed}m</span>
                    </div>

                    {/* Items */}
                    <div style={{ padding: '12px 16px' }}>
                      {order.items.map((item, i) => (
                        <div key={i} style={{ padding: '8px 0', borderBottom: i < order.items.length - 1 ? '1px solid #334155' : 'none' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontWeight: 900, fontSize: 18, color: '#F59E0B', minWidth: 36 }}>{item.qty}×</span>
                            <span style={{ fontWeight: 700, fontSize: 15, color: 'white' }}>{item.name}</span>
                          </div>
                          {item.options && <p style={{ fontSize: 12, color: '#94A3B8', marginTop: 2, paddingLeft: 44 }}>{item.options}</p>}
                          {item.notes && <p style={{ fontSize: 12, color: '#F59E0B', marginTop: 2, paddingLeft: 44 }}>📝 {item.notes}</p>}
                        </div>
                      ))}
                    </div>

                    {/* Button */}
                    <div style={{ padding: '8px 16px 16px' }}>
                      {isNew ? (
                        <button onClick={() => updateOrderStatus(order.id, 'preparing')} style={{
                          width: '100%', padding: 14, borderRadius: 12,
                          background: '#2563EB', color: 'white', fontWeight: 900, fontSize: 15,
                          cursor: 'pointer', border: 'none',
                        }}>
                          🔥 START COOKING
                        </button>
                      ) : (
                        <button onClick={() => updateOrderStatus(order.id, 'cooked')} style={{
                          width: '100%', padding: 14, borderRadius: 12,
                          background: '#16A34A', color: 'white', fontWeight: 900, fontSize: 15,
                          cursor: 'pointer', border: 'none',
                        }}>
                          ✅ DONE
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ─── STOCK TAB ──────────────────────────────────────── */}
      {tab === 'stock' && (
        <div style={{ padding: 16 }}>
          <p style={{ color: '#9CA3AF', fontSize: 13, marginBottom: 16 }}>Tap items to mark out of stock. Tap again to restock.</p>
          {categories.map(cat => (
            <div key={cat.id} style={{ marginBottom: 20 }}>
              <p style={{ color: '#64748B', fontSize: 12, fontWeight: 700, marginBottom: 8 }}>{cat.emoji} {cat.name}</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {cat.items.map(item => {
                  const isOut = outOfStock.includes(item.id)
                  return (
                    <button key={item.id} onClick={() => toggleStock(item.id)} style={{
                      padding: '10px 14px', borderRadius: 10, fontSize: 13, fontWeight: 700,
                      cursor: 'pointer', border: 'none',
                      background: isOut ? '#DC2626' : '#1E293B',
                      color: isOut ? 'white' : '#D1D5DB',
                    }}>
                      {isOut ? '❌ ' : ''}{item.name}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
          {outOfStock.length > 0 && (
            <div style={{ marginTop: 16, padding: 14, borderRadius: 12, background: '#7F1D1D', border: '1px solid #DC2626' }}>
              <p style={{ color: '#FCA5A5', fontWeight: 700, fontSize: 13 }}>
                ❌ {outOfStock.length} item(s) out of stock
              </p>
              <p style={{ color: '#F87171', fontSize: 12, marginTop: 4 }}>
                {allItems.filter(i => outOfStock.includes(i.id)).map(i => i.name).join(', ')}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
