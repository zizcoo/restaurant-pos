import { useState, useEffect, useRef } from 'react'
import { categories, getRecommended, formatMMK, calcExtras, type MenuItem } from './data/menu'
import { addOrder, setTableStatus, updateOrderStatus, useOutOfStock, getOrders, type Order, type OrderItem } from './data/store'

type CartItem = {
  item: MenuItem
  qty: number
  singleOpts: Record<string, string>
  multiOpts: Record<string, string[]>
  notes: string
  unitTotal: number // base price + extras per 1 item
}
type Screen = 'menu' | 'cart' | 'confirm' | 'payment' | 'cash_pending' | 'waiting'

const GEOFENCE_RADIUS_M = 200 // 200 meters from restaurant
const GEO_CHECK_INTERVAL = 30000 // check every 30 seconds
const GEO_KEY = 'pos_origin_location'

function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000 // Earth radius in meters
  const toRad = (d: number) => d * Math.PI / 180
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a = Math.sin(dLat/2)**2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon/2)**2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

type GeoStatus = 'checking' | 'active' | 'left' | 'denied' | 'unsupported'

function App() {
  const params = new URLSearchParams(window.location.search)
  const tableId = params.get('table') || '1'

  // ─── LOCATION-BASED SESSION ──────────────────────────────────
  const [geoStatus, setGeoStatus] = useState<GeoStatus>('checking')
  const [expired, setExpired] = useState(false)

  useEffect(() => {
    if (!navigator.geolocation) {
      setGeoStatus('unsupported')
      return // allow ordering if GPS unsupported (desktop demo)
    }

    // Step 1: Capture origin location on first visit (QR scan at table)
    const captureOrigin = (pos: GeolocationPosition) => {
      const origin = { lat: pos.coords.latitude, lng: pos.coords.longitude }
      const stored = sessionStorage.getItem(GEO_KEY)
      if (!stored) {
        sessionStorage.setItem(GEO_KEY, JSON.stringify(origin))
      }
      setGeoStatus('active')
    }

    const onError = () => {
      setGeoStatus('denied')
      // If GPS denied, still allow ordering (fallback: sessionStorage only)
    }

    navigator.geolocation.getCurrentPosition(captureOrigin, onError, { enableHighAccuracy: true, timeout: 10000 })

    // Step 2: Periodically check if user left the area
    const checkId = setInterval(() => {
      const stored = sessionStorage.getItem(GEO_KEY)
      if (!stored) return
      const origin = JSON.parse(stored)

      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const dist = haversineDistance(origin.lat, origin.lng, pos.coords.latitude, pos.coords.longitude)
          if (dist > GEOFENCE_RADIUS_M) {
            setGeoStatus('left')
            setExpired(true)
            sessionStorage.removeItem(GEO_KEY)
          } else {
            setGeoStatus('active')
          }
        },
        () => { /* ignore check errors, keep session alive */ },
        { enableHighAccuracy: false, timeout: 5000 }
      )
    }, GEO_CHECK_INTERVAL)

    return () => clearInterval(checkId)
  }, [])

  // Set table to 'ordering' when customer scans QR
  useEffect(() => { setTableStatus(tableId, 'ordering') }, [tableId])

  // Request notification permission + register Service Worker
  const swRef = useRef<ServiceWorkerRegistration | null>(null)
  useEffect(() => {
    // Request notification permission
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission()
    }
    // Register service worker for background notifications
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').then(reg => {
        swRef.current = reg
      }).catch(() => {})
    }
  }, [])

  const [lang, setLang] = useState<'en' | 'mm'>('en')
  const [activeCat, setActiveCat] = useState(categories[0].id)
  const [cart, setCart] = useState<CartItem[]>([])
  // Recover screen & orderNo from localStorage (survives cache clear)
  const [screen, setScreen] = useState<Screen>(() => {
    const saved = localStorage.getItem(`pos_screen_${tableId}`)
    return (saved === 'waiting' || saved === 'cash_pending') ? saved as Screen : 'menu'
  })
  const [payMethod, setPayMethod] = useState<'QR_PAY' | 'CASH'>('QR_PAY')
  const [orderNo, setOrderNo] = useState(() => {
    const saved = localStorage.getItem(`pos_order_${tableId}`)
    return saved || 'ORD-' + Date.now().toString().slice(-6)
  })

  // Save screen & orderNo to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem(`pos_screen_${tableId}`, screen)
    localStorage.setItem(`pos_order_${tableId}`, orderNo)
  }, [screen, orderNo, tableId])

  // Auto-recover: on load, check DB for active orders for this table
  useEffect(() => {
    const recover = async () => {
      try {
        const orders = await getOrders()
        const active = orders.find((o: any) => o.table_id === tableId && ['pending', 'approved', 'preparing', 'cooked'].includes(o.status))
        if (active) {
          setOrderNo(active.id)
          setSavedTotal(active.total || 0)
          localStorage.setItem(`pos_total_${tableId}`, String(active.total || 0))
          if (active.status === 'pending') setScreen('cash_pending')
          else setScreen('waiting')
          setLiveStatus(active.status)
        }
      } catch(e) {}
    }
    recover()
  }, [tableId])

  // Detail modal state
  const [detailItem, setDetailItem] = useState<MenuItem | null>(null)
  const [dSingle, setDSingle] = useState<Record<string, string>>({})
  const [dMulti, setDMulti] = useState<Record<string, string[]>>({})
  const [dNotes, setDNotes] = useState('')
  const [dQty, setDQty] = useState(1)

  const totalItems = cart.reduce((s, c) => s + c.qty, 0)
  const totalAmount = cart.reduce((s, c) => s + c.unitTotal * c.qty, 0)
  const cartQty = (id: number) => cart.filter(c => c.item.id === id).reduce((s, c) => s + c.qty, 0)
  const n = (en: string, mm: string) => lang === 'en' ? en : mm

  // Saved total for recovery (survives page reload/cache clear)
  const [savedTotal, setSavedTotal] = useState(() => {
    const s = localStorage.getItem(`pos_total_${tableId}`)
    return s ? parseInt(s) : 0
  })
  // The display total: use cart total if cart has items, otherwise use saved total from DB
  const displayTotal = totalAmount > 0 ? totalAmount : savedTotal

  // Save total when it changes
  useEffect(() => {
    if (totalAmount > 0) {
      setSavedTotal(totalAmount)
      localStorage.setItem(`pos_total_${tableId}`, String(totalAmount))
    }
  }, [totalAmount, tableId])

  // Out of stock items (synced from admin)
  const outOfStock = useOutOfStock()

  // Live order status (for tracking screen)
  const [liveStatus, setLiveStatus] = useState<string>('pending')
  const [alarmPlaying, setAlarmPlaying] = useState(false)
  const alarmRef = useRef<any>(null)

  // Start alarm when food is ready
  const startAlarm = () => {
    if (alarmRef.current) return
    setAlarmPlaying(true)
    const playBeep = () => {
      try {
        const ctx = new AudioContext()
        // Beep 1
        const o1 = ctx.createOscillator(); const g1 = ctx.createGain()
        o1.connect(g1); g1.connect(ctx.destination)
        o1.frequency.value = 1047; g1.gain.value = 0.5; o1.start()
        g1.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3)
        o1.stop(ctx.currentTime + 0.3)
        // Beep 2
        setTimeout(() => {
          const o2 = ctx.createOscillator(); const g2 = ctx.createGain()
          o2.connect(g2); g2.connect(ctx.destination)
          o2.frequency.value = 1319; g2.gain.value = 0.5; o2.start()
          g2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3)
          o2.stop(ctx.currentTime + 0.3)
        }, 250)
        // Beep 3
        setTimeout(() => {
          const o3 = ctx.createOscillator(); const g3 = ctx.createGain()
          o3.connect(g3); g3.connect(ctx.destination)
          o3.frequency.value = 1568; g3.gain.value = 0.5; o3.start()
          g3.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4)
          o3.stop(ctx.currentTime + 0.4)
        }, 500)
      } catch(e) {}
    }
    playBeep()
    alarmRef.current = setInterval(playBeep, 2000) // repeat every 2s
  }

  const stopAlarm = async () => {
    if (alarmRef.current) { clearInterval(alarmRef.current); alarmRef.current = null }
    setAlarmPlaying(false)
    setLiveStatus('served')
    localStorage.setItem(`pos_status_${tableId}`, 'served')
    if (navigator.vibrate) navigator.vibrate(0) // stop vibration
    try {
      await updateOrderStatus(orderNo, 'served')
      await setTableStatus(tableId, 'free')
    } catch(e) {}
  }

  // Restart alarm when user comes back to the app (after pressing home key)
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && screen === 'waiting') {
        const s = localStorage.getItem(`pos_status_${tableId}`)
        if (s === 'cooked' || s === 'ready') {
          if (!alarmRef.current) startAlarm()
        }
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [screen, tableId])

  useEffect(() => {
    if (screen !== 'waiting') return
    let prevStatus = ''
    const poll = async () => { try {
      const orders = await getOrders()
      const my = orders.find((o: any) => o.id === orderNo)
      if (my) {
        setLiveStatus(my.status)
        // Save status to localStorage (for alarm restart on visibility change)
        localStorage.setItem(`pos_status_${tableId}`, my.status)

        // Send notification when food is ready
        if ((my.status === 'cooked' || my.status === 'ready') && prevStatus !== my.status) {
          // Vibrate phone
          if (navigator.vibrate) navigator.vibrate([300, 100, 300, 100, 300, 100, 300])

          // Use Service Worker notification (works in background!)
          if (swRef.current && Notification.permission === 'granted') {
            swRef.current.showNotification('🍽️ Your food is ready!', {
              body: `Table ${tableId} — Order ${orderNo} is ready for pickup!`,
              tag: 'food-ready-' + orderNo,
              requireInteraction: true,
              vibrate: [300, 100, 300, 100, 300, 100, 300],
            })
          }
        }
        prevStatus = my.status
      }
    } catch(e) {} }
    poll()
    const id = setInterval(poll, 1500)
    return () => clearInterval(id)
  }, [screen, orderNo])

  // Listen for admin approval of cash orders
  useEffect(() => {
    if (screen !== 'cash_pending') return
    const checkApproval = async () => { try {
      const orders = await getOrders()
      const myOrder = orders.find((o: any) => o.id === orderNo)
      if (myOrder && myOrder.status === 'approved') {
        setScreen('waiting')
      } else if (myOrder && myOrder.status === 'rejected') {
        setScreen('menu')
        setCart([])
      }
    } catch(e) { console.error(e) } }
    const id = setInterval(checkApproval, 1500)
    return () => clearInterval(id)
  }, [screen, orderNo])

  // ─── LEFT RESTAURANT SCREEN ───────────────────────────────────
  if (expired && screen !== 'waiting' && screen !== 'cash_pending') return (
    <div style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', padding: 24,
      textAlign: 'center', background: 'linear-gradient(135deg, #FEF2F2, #FEE2E2)',
    }}>
      <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div style={{
          width: 96, height: 96, borderRadius: '50%',
          background: 'linear-gradient(135deg, #EF4444, #DC2626)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          marginBottom: 24, boxShadow: '0 12px 40px rgba(239,68,68,0.3)',
        }}>
          <span style={{ fontSize: 44 }}>📍</span>
        </div>
        <h1 style={{ fontSize: 24, fontWeight: 900, color: '#DC2626', marginBottom: 8 }}>
          {n('You left the restaurant', 'စားသောက်ဆိုင်မှ ထွက်သွားပါပြီ')}
        </h1>
        <p style={{ fontSize: 14, color: '#9CA3AF', marginBottom: 32, maxWidth: 300, lineHeight: 1.6 }}>
          {n(
            'Your ordering session has ended because you moved away from the restaurant. Please return and scan the QR code on your table to order again.',
            'စားသောက်ဆိုင်မှ ဝေးသွားသောကြောင့် session ပိတ်သွားပါပြီ။ ပြန်လာ၍ QR code ကို ထပ်ဖတ်ပါ'
          )}
        </p>
        <div className="card" style={{ padding: 20, width: '100%', maxWidth: 300 }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🚶‍♂️➡️🍽️</div>
          <p style={{ fontWeight: 800, color: '#111827', marginBottom: 4 }}>
            {n('Return & Scan Again', 'ပြန်လာပြီး ထပ်ဖတ်ပါ')}
          </p>
          <p style={{ fontSize: 13, color: '#6B7280' }}>
            {n('Come back to your table and scan the QR code', 'စားပွဲသို့ ပြန်လာ၍ QR code ဖတ်ပါ')}
          </p>
        </div>
        <p style={{ fontSize: 12, color: '#D1D5DB', marginTop: 24, fontStyle: 'italic', maxWidth: 280 }}>
          {n('Ordering is only available inside the restaurant to prevent pre-orders from outside', 'စားသောက်ဆိုင်အတွင်းမှသာ မှာယူနိုင်ပါသည်')}
        </p>
      </div>
    </div>
  )

  const openDetail = (item: MenuItem) => {
    setDetailItem(item)
    setDQty(1)
    setDNotes('')
    const singles: Record<string, string> = {}
    const multis: Record<string, string[]> = {}
    item.options?.forEach(opt => {
      if (opt.type === 'single') singles[opt.id] = opt.choices[0]?.value || ''
      else multis[opt.id] = []
    })
    setDSingle(singles)
    setDMulti(multis)
  }

  const toggleMulti = (optId: string, value: string) => {
    setDMulti(prev => {
      const arr = prev[optId] || []
      return { ...prev, [optId]: arr.includes(value) ? arr.filter(v => v !== value) : [...arr, value] }
    })
  }

  const detailExtras = detailItem ? calcExtras(detailItem, dSingle, dMulti) : 0
  const detailUnitPrice = detailItem ? detailItem.price + detailExtras : 0

  const addFromDetail = () => {
    if (!detailItem) return
    setCart(prev => [...prev, {
      item: detailItem, qty: dQty,
      singleOpts: { ...dSingle }, multiOpts: { ...dMulti },
      notes: dNotes, unitTotal: detailUnitPrice,
    }])
    setDetailItem(null)
  }

  const changeQty = (idx: number, delta: number) => {
    setCart(prev => prev.map((c, i) => i === idx ? { ...c, qty: c.qty + delta } : c).filter(c => c.qty > 0))
  }

  const removeItem = (idx: number) => setCart(prev => prev.filter((_, i) => i !== idx))

  const spiceDots = (level?: number) => level ? <span style={{ fontSize: 10 }}>{'🌶️'.repeat(level)}</span> : null

  // Format option labels for display
  const formatOpts = (c: CartItem) => {
    const parts: string[] = []
    c.item.options?.forEach(opt => {
      if (opt.type === 'single' && c.singleOpts[opt.id]) {
        const ch = opt.choices.find(x => x.value === c.singleOpts[opt.id])
        if (ch) parts.push(`${ch.emoji} ${n(ch.label, ch.labelMm)}`)
      } else {
        (c.multiOpts[opt.id] || []).forEach(val => {
          const ch = opt.choices.find(x => x.value === val)
          if (ch) parts.push(`${ch.emoji} ${n(ch.label, ch.labelMm)}${ch.extraPrice > 0 ? ` +${formatMMK(ch.extraPrice)}` : ''}`)
        })
      }
    })
    return parts
  }

  const recommended = getRecommended()

  // ─── DETAIL MODAL ─────────────────────────────────────────────
  const DetailModal = () => {
    if (!detailItem) return null
    const cat = categories.find(c => c.id === detailItem.categoryId)
    return (
      <div onClick={() => setDetailItem(null)} style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 100,
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
        backdropFilter: 'blur(4px)',
      }}>
        <div onClick={e => e.stopPropagation()} className="slide-up" style={{
          background: 'white', borderRadius: '24px 24px 0 0', width: '100%', maxWidth: 480,
          maxHeight: '92vh', overflowY: 'auto', paddingBottom: 'max(16px, env(safe-area-inset-bottom))',
        }}>
          <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 4px' }}>
            <div style={{ width: 40, height: 4, borderRadius: 4, background: '#D1D5DB' }} />
          </div>

          <div style={{
            height: 150, margin: '0 16px', borderRadius: 16, display: 'flex',
            alignItems: 'center', justifyContent: 'center', fontSize: 60,
            background: 'linear-gradient(135deg, #F0FDF4, #DCFCE7)', border: '2px solid #BBF7D0',
          }}>
            {cat?.emoji || '🍽'}
          </div>

          <div style={{ padding: '16px 20px 0' }}>
            {/* Title */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <h2 style={{ fontSize: 22, fontWeight: 900 }}>{n(detailItem.name, detailItem.nameMm)}</h2>
                  {detailItem.isRecommended && (
                    <span style={{ fontSize: 10, fontWeight: 800, padding: '3px 8px', borderRadius: 999, background: '#FEF9C3', color: '#92400E', border: '1px solid #FDE68A' }}>⭐ {n('Recommended', 'အကြံပြု')}</span>
                  )}
                </div>
                <p className="myanmar" style={{ fontSize: 13, color: '#6B7280', marginTop: 2 }}>
                  {lang === 'en' ? detailItem.nameMm : detailItem.name}
                </p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 20, fontWeight: 900, color: '#15803D' }}>{formatMMK(detailItem.price)}</div>
                <p style={{ fontSize: 11, color: '#9CA3AF' }}>{n('base price', 'အခြေခံဈေး')}</p>
              </div>
            </div>

            {detailItem.spiceLevel && (
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 8, padding: '4px 10px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                background: detailItem.spiceLevel >= 3 ? '#FEE2E2' : detailItem.spiceLevel >= 2 ? '#FEF9C3' : '#F0FDF4',
                color: detailItem.spiceLevel >= 3 ? '#DC2626' : detailItem.spiceLevel >= 2 ? '#92400E' : '#16A34A',
              }}>
                {spiceDots(detailItem.spiceLevel)}
                <span>{detailItem.spiceLevel === 1 ? n('Mild', 'အနည်းငယ်') : detailItem.spiceLevel === 2 ? n('Medium', 'အလယ်') : n('Spicy', 'အစပ်')}</span>
              </div>
            )}

            <p style={{ marginTop: 12, fontSize: 14, lineHeight: 1.7, color: '#4B5563' }}>
              {n(detailItem.description, detailItem.descMm)}
            </p>

            {/* Options */}
            {detailItem.options && detailItem.options.length > 0 && (
              <div style={{ marginTop: 20 }}>
                {detailItem.options.map(opt => (
                  <div key={opt.id} style={{ marginBottom: 16 }}>
                    <p style={{ fontSize: 13, fontWeight: 800, color: '#374151', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                      {n(opt.label, opt.labelMm)}
                      {opt.type === 'multi' && <span style={{ fontSize: 11, fontWeight: 500, color: '#9CA3AF' }}>({n('pick any', 'ရွေးချယ်ပါ')})</span>}
                      {opt.required && <span style={{ fontSize: 10, color: '#DC2626' }}>*</span>}
                    </p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      {opt.choices.map(ch => {
                        const isSelected = opt.type === 'single'
                          ? dSingle[opt.id] === ch.value
                          : (dMulti[opt.id] || []).includes(ch.value)
                        return (
                          <button key={ch.value}
                            onClick={() => opt.type === 'single'
                              ? setDSingle(p => ({ ...p, [opt.id]: ch.value }))
                              : toggleMulti(opt.id, ch.value)
                            }
                            style={{
                              padding: '8px 14px', borderRadius: 10, fontSize: 13, fontWeight: 600,
                              display: 'flex', alignItems: 'center', gap: 6,
                              border: `2px solid ${isSelected ? '#16A34A' : '#E5E7EB'}`,
                              background: isSelected ? '#F0FDF4' : 'white',
                              color: isSelected ? '#15803D' : '#6B7280',
                            }}>
                            {opt.type === 'multi' && (
                              <span style={{
                                width: 16, height: 16, borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center',
                                background: isSelected ? '#16A34A' : 'white',
                                border: `1.5px solid ${isSelected ? '#16A34A' : '#D1D5DB'}`,
                                color: 'white', fontSize: 10, fontWeight: 900,
                              }}>{isSelected ? '✓' : ''}</span>
                            )}
                            <span>{ch.emoji}</span>
                            <span>{n(ch.label, ch.labelMm)}</span>
                            {ch.extraPrice > 0 && (
                              <span style={{
                                fontSize: 11, fontWeight: 700, color: isSelected ? '#16A34A' : '#9CA3AF',
                                marginLeft: 2,
                              }}>+{formatMMK(ch.extraPrice)}</span>
                            )}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Notes */}
            <div style={{ marginTop: 4 }}>
              <p style={{ fontSize: 13, fontWeight: 800, color: '#374151', marginBottom: 8 }}>📝 {n('Special Notes', 'မှတ်ချက်')}</p>
              <textarea value={dNotes} onChange={e => setDNotes(e.target.value)}
                placeholder={n('e.g. No onions, extra sauce...', 'ဥပမာ - ကြက်သွန်မပါ...')}
                rows={2} style={{ width: '100%', padding: '10px 12px', borderRadius: 10, fontSize: 13, border: '1.5px solid #E5E7EB', background: '#F9FAFB', resize: 'none', fontFamily: 'inherit', color: '#374151' }}
              />
            </div>

            {/* Price breakdown (if extras) */}
            {detailExtras > 0 && (
              <div style={{ marginTop: 12, padding: 12, borderRadius: 12, background: '#F0FDF4', border: '1px solid #BBF7D0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#6B7280', marginBottom: 4 }}>
                  <span>{n('Base price', 'အခြေခံ')}</span>
                  <span>{formatMMK(detailItem.price)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#16A34A', marginBottom: 4 }}>
                  <span>{n('Add-ons', 'ထပ်ထည့်')}</span>
                  <span>+{formatMMK(detailExtras)}</span>
                </div>
                <div style={{ borderTop: '1px dashed #BBF7D0', margin: '6px 0' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 15, fontWeight: 900, color: '#15803D' }}>
                  <span>{n('Per item', 'တစ်ခုလျှင်')}</span>
                  <span>{formatMMK(detailUnitPrice)}</span>
                </div>
              </div>
            )}

            {/* Qty + Add */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 16, paddingBottom: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', border: '1.5px solid #E5E7EB', borderRadius: 12, overflow: 'hidden' }}>
                <button onClick={() => setDQty(q => Math.max(1, q - 1))} style={{ width: 40, height: 40, background: 'white', fontSize: 18, color: dQty <= 1 ? '#D1D5DB' : '#6B7280', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>−</button>
                <span style={{ width: 36, textAlign: 'center', fontWeight: 900, fontSize: 16 }}>{dQty}</span>
                <button onClick={() => setDQty(q => q + 1)} style={{ width: 40, height: 40, background: 'white', fontSize: 18, color: '#16A34A', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
              </div>
              <button onClick={addFromDetail} className="btn-green" style={{ flex: 1, padding: '13px 16px', fontSize: 15, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                🛒 {n('Add', 'ထည့်')} • {formatMMK(detailUnitPrice * dQty)}
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ─── CASH PENDING SCREEN (waiting for manager approval) ─────
  if (screen === 'cash_pending') return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, textAlign: 'center', background: 'linear-gradient(135deg, #FFFBEB, #FEF3C7)' }}>
      <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        {/* Pulsing clock animation */}
        <div style={{
          width: 96, height: 96, borderRadius: '50%',
          background: 'linear-gradient(135deg, #F59E0B, #D97706)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          marginBottom: 24, boxShadow: '0 12px 40px rgba(245,158,11,0.3)',
          animation: 'pulse 2s ease-in-out infinite',
        }}>
          <span style={{ fontSize: 44 }}>⏳</span>
        </div>
        <h1 style={{ fontSize: 24, fontWeight: 900, color: '#92400E', marginBottom: 8 }}>
          {n('Waiting for Confirmation', 'အတည်ပြုရန် စောင့်နေသည်')}
        </h1>
        <p style={{ color: '#6B7280', marginBottom: 6, fontSize: 14, maxWidth: 300, lineHeight: 1.6 }}>
          {n(
            'Our staff will come to your table to collect cash payment and confirm your order.',
            'ဝန်ထမ်းသည် ငွေသားလက်ခံ၍ အော်ဒါအတည်ပြုရန် သင့်စားပွဲသို့ လာပါမည်'
          )}
        </p>
        <p style={{ color: '#9CA3AF', fontSize: 13, marginBottom: 24 }}>
          {n('Please stay at your table', 'သင့်စားပွဲတွင် ဆက်ထိုင်ပါ')}
        </p>

        <div className="card" style={{ padding: 20, width: '100%', maxWidth: 320 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, marginBottom: 8 }}>
            <span style={{ color: '#6B7280' }}>{n('Order No.', 'အော်ဒါနံပါတ်')}</span>
            <span style={{ fontWeight: 800, color: '#D97706' }}>{orderNo}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, marginBottom: 8 }}>
            <span style={{ color: '#6B7280' }}>{n('Table', 'စားပွဲ')}</span>
            <span style={{ fontWeight: 800 }}>#{tableId}</span>
          </div>
          <div style={{ borderTop: '1px dashed #E5E7EB', margin: '8px 0' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
            <span style={{ color: '#6B7280', fontSize: 14 }}>{n('Total (Cash)', 'စုစုပေါင်း (ငွေသား)')}</span>
            <span style={{ fontWeight: 900, color: '#D97706', fontSize: 22 }}>{formatMMK(displayTotal)}</span>
          </div>
        </div>

        {/* Status indicator */}
        <div style={{ marginTop: 24, display: 'flex', flexDirection: 'column', gap: 12, width: '100%', maxWidth: 320 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderRadius: 12, background: 'white', border: '1px solid #FDE68A' }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#F59E0B', animation: 'pulse 1.5s ease-in-out infinite' }} />
            <span style={{ fontSize: 13, fontWeight: 600, color: '#92400E' }}>
              💵 {n('Staff is on the way...', 'ဝန်ထမ်း လာနေပါပြီ...')}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderRadius: 12, background: 'white', border: '1px solid #E5E7EB', opacity: 0.4 }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#D1D5DB' }} />
            <span style={{ fontSize: 13, color: '#9CA3AF' }}>
              ✅ {n('Payment received & order confirmed', 'ငွေလက်ခံပြီး အော်ဒါအတည်ပြုပြီး')}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderRadius: 12, background: 'white', border: '1px solid #E5E7EB', opacity: 0.4 }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#D1D5DB' }} />
            <span style={{ fontSize: 13, color: '#9CA3AF' }}>
              👨‍🍳 {n('Kitchen starts preparing', 'မီးဖိုချောင် စတင်ပြင်ဆင်')}
            </span>
          </div>
        </div>

        <p style={{ color: '#D1D5DB', fontSize: 12, marginTop: 24, fontStyle: 'italic' }}>
          {n('(Demo: auto-confirms in ~15 seconds)', '(Demo: ၁၅ စက္ကန့်အတွင်း အလိုအလျောက် အတည်ပြုပါမည်)')}
        </p>
      </div>
    </div>
  )


  // ─── LIVE ORDER TRACKER ──────────────────────────────────────
  if (screen === 'waiting') {
    // Start alarm when food is ready for pickup
    if ((liveStatus === 'ready' || liveStatus === 'cooked') && !alarmPlaying) { startAlarm() }

    // PICKUP SCREEN — alarm ringing, customer picks up food
    if (liveStatus === 'ready' || liveStatus === 'cooked') {
      return (
        <div style={{
          minHeight: '100vh', display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', padding: 24, textAlign: 'center',
          background: 'linear-gradient(135deg, #FEF9C3, #FDE68A)',
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', maxWidth: 360 }}>
            <div style={{
              width: 120, height: 120, borderRadius: '50%',
              background: 'linear-gradient(135deg, #F59E0B, #D97706)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              marginBottom: 24, boxShadow: '0 12px 40px rgba(245,158,11,0.4)',
              animation: 'pulse 0.8s ease-in-out infinite',
            }}>
              <span style={{ fontSize: 56 }}>🔔</span>
            </div>
            <h1 style={{ fontSize: 28, fontWeight: 900, color: '#92400E', marginBottom: 8 }}>
              {n('Your food is ready!', 'အစားအစာ အဆင်သင့်ဖြစ်ပြီ!')}
            </h1>
            <p style={{ fontSize: 16, fontWeight: 700, color: '#B45309', marginBottom: 32 }}>
              {n('Please pick up your food at the counter', 'ကောင်တာတွင် အစားအစာကို လာယူပါ')}
            </p>
            <div className="card" style={{ padding: 16, width: '100%', marginBottom: 24 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
                <span style={{ color: '#6B7280' }}>{n('Table', 'စားပွဲ')}</span>
                <span style={{ fontWeight: 800 }}>#{tableId}</span>
              </div>
            </div>
            <button onClick={stopAlarm} style={{
              width: '100%', padding: 20, borderRadius: 16, fontSize: 20, fontWeight: 900,
              background: 'linear-gradient(135deg, #16A34A, #15803D)', color: 'white',
              cursor: 'pointer', border: 'none',
              boxShadow: '0 8px 30px rgba(22,163,74,0.4)',
            }}>
              ✅ {n('GOT IT', 'ရပြီ')}
            </button>
            <p style={{ fontSize: 12, color: '#B45309', marginTop: 16 }}>
              {n('Press to stop alarm', 'Alarm ရပ်ရန် နှိပ်ပါ')}
            </p>
          </div>
        </div>
      )
    }

    // SERVED SCREEN — customer picked up food
    if (liveStatus === 'served') {
      return (
        <div style={{
          minHeight: '100vh', display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', padding: 24, textAlign: 'center',
          background: 'linear-gradient(135deg, #F0FDF4, #DCFCE7)',
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', maxWidth: 360 }}>
            <div style={{
              width: 96, height: 96, borderRadius: '50%',
              background: 'linear-gradient(135deg, #22C55E, #15803D)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              marginBottom: 24, boxShadow: '0 12px 40px rgba(22,163,74,0.3)',
            }}>
              <span style={{ fontSize: 44 }}>😋</span>
            </div>
            <h1 style={{ fontSize: 28, fontWeight: 900, color: '#15803D', marginBottom: 8 }}>
              {n('Enjoy your meal!', 'အစားအစာကို သုံးဆောင်ပါ!')}
            </h1>
            <p style={{ color: '#6B7280', marginBottom: 32 }}>{n('Thank you for ordering', 'မှာယူပေးသည့်အတွက် ကျေးဇူးတင်ပါသည်')}</p>
            <button onClick={() => {
              setCart([])
              const newId = 'ORD-' + Math.random().toString().slice(2, 8)
              setOrderNo(newId)
              setLiveStatus('pending')
              setScreen('menu')
              // Clear saved order state
              localStorage.removeItem(`pos_screen_${tableId}`)
              localStorage.removeItem(`pos_order_${tableId}`)
              localStorage.removeItem(`pos_total_${tableId}`)
              setSavedTotal(0)
            }} style={{
              width: '100%', padding: 16, borderRadius: 14, fontSize: 16, fontWeight: 800,
              background: 'linear-gradient(135deg, #22C55E, #15803D)', color: 'white',
              cursor: 'pointer', border: 'none',
              boxShadow: '0 4px 20px rgba(22,163,74,0.3)',
            }}>
              🍽️ {n('Order More', 'နောက်ထပ် မှာယူမည်')}
            </button>
          </div>
        </div>
      )
    }

    // TRACKING SCREEN — order confirmed, cooking
    const steps = [
      { key: 'pending', emoji: '📋', label: n('Order Placed', 'အော်ဒါ တင်ပြီး') },
      { key: 'approved', emoji: '✅', label: n('Order Confirmed', 'အော်ဒါ အတည်ပြုပြီး') },
      { key: 'preparing', emoji: '👨‍🍳', label: n('Chef is Cooking', 'ချက်ပြုတ်နေသည်') },
    ]
    const statusOrder = ['pending', 'approved', 'preparing', 'cooked']
    const currentIdx = Math.min(statusOrder.indexOf(liveStatus), steps.length - 1)

    return (
      <div style={{
        minHeight: '100vh', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', padding: 24, textAlign: 'center',
        background: 'linear-gradient(135deg, #F0FDF4, #DCFCE7)',
      }}>
        <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', maxWidth: 360 }}>
          <div style={{
            width: 96, height: 96, borderRadius: '50%',
            background: 'linear-gradient(135deg, #22C55E, #15803D)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            marginBottom: 20, boxShadow: '0 12px 40px rgba(22,163,74,0.3)',
          }}>
            <span style={{ fontSize: 44 }}>{steps[currentIdx]?.emoji || '✅'}</span>
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 900, color: '#15803D', marginBottom: 4 }}>
            {steps[currentIdx]?.label || n('Processing...', 'လုပ်ဆောင်နေ...')}
          </h1>
          <p style={{ color: '#6B7280', marginBottom: 20, fontSize: 14 }}>
            {n('We will notify you when food is ready', 'အစားအစာ အဆင်သင့်ဖြစ်ရင် အကြောင်းကြားပါမည်')}
          </p>

          <div className="card" style={{ padding: 20, width: '100%', marginBottom: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, marginBottom: 8 }}>
              <span style={{ color: '#6B7280' }}>{n('Order', 'အော်ဒါ')}</span>
              <span style={{ fontWeight: 800 }}>{orderNo}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, marginBottom: 8 }}>
              <span style={{ color: '#6B7280' }}>{n('Table', 'စားပွဲ')}</span>
              <span style={{ fontWeight: 800 }}>#{tableId}</span>
            </div>
            <div style={{ borderTop: '1px dashed #E5E7EB', margin: '8px 0' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: '#6B7280', fontSize: 14 }}>{n('Total', 'စုစုပေါင်း')}</span>
              <span style={{ fontWeight: 900, color: '#15803D', fontSize: 20 }}>{formatMMK(totalAmount)}</span>
            </div>
          </div>

          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 0 }}>
            {steps.map((step, i) => {
              const done = i <= currentIdx
              const active = i === currentIdx
              return (
                <div key={step.key}>
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px',
                    borderRadius: 12, background: active ? 'white' : 'transparent',
                    border: active ? '2px solid #16A34A' : '2px solid transparent',
                    opacity: done ? 1 : 0.35, transition: 'all 0.3s ease',
                  }}>
                    <div style={{
                      width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                      background: done ? '#16A34A' : '#E5E7EB',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 16, color: 'white', fontWeight: 800,
                    }}>
                      {done ? (active ? step.emoji : '✓') : i + 1}
                    </div>
                    <span style={{ fontSize: 14, fontWeight: active ? 800 : 600, color: done ? '#111827' : '#9CA3AF' }}>
                      {step.label}
                    </span>
                    {active && <div style={{ marginLeft: 'auto', width: 8, height: 8, borderRadius: '50%', background: '#16A34A', animation: 'pulse 1.5s infinite' }} />}
                  </div>
                  {i < steps.length - 1 && (
                    <div style={{ marginLeft: 31, width: 2, height: 16, background: i < currentIdx ? '#16A34A' : '#E5E7EB' }} />
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    )
  }


  // ─── PAYMENT SCREEN ──────────────────────────────────────────
  if (screen === 'payment') return (
    <div style={{ minHeight: '100vh', padding: 16, maxWidth: 480, margin: '0 auto', background: '#F8FAFB' }}>
      <div className="fade-in">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 16, marginBottom: 24 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg, #22C55E, #15803D)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>🍽</div>
          <div><p style={{ fontWeight: 800 }}>{n('Payment', 'ငွေပေးချေမှု')}</p><p style={{ fontSize: 12, color: '#9CA3AF' }}>{orderNo}</p></div>
        </div>
        <div className="card" style={{ padding: 20, marginBottom: 16 }}>
          <h3 style={{ fontWeight: 700, marginBottom: 16 }}>{n('Order Summary', 'အော်ဒါ')}</h3>
          {cart.map((c, i) => (
            <div key={i} style={{ marginBottom: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
                <span>{n(c.item.name, c.item.nameMm)} ×{c.qty}</span>
                <span style={{ fontWeight: 600 }}>{formatMMK(c.unitTotal * c.qty)}</span>
              </div>
              {formatOpts(c).length > 0 && <p style={{ fontSize: 11, color: '#9CA3AF' }}>{formatOpts(c).join(' · ')}</p>}
            </div>
          ))}
          <div style={{ borderTop: '1px dashed #E5E7EB', margin: '12px 0' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: '#6B7280' }}>{n('Total', 'စုစုပေါင်း')}</span>
            <span style={{ fontSize: 24, fontWeight: 900, color: '#15803D' }}>{formatMMK(totalAmount)}</span>
          </div>
        </div>
        <div className="card" style={{ padding: 20, marginBottom: 20 }}>
          <h3 style={{ fontWeight: 700, marginBottom: 12, fontSize: 14 }}>{n('Payment Method', 'ငွေပေးချေနည်း')}</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {(['QR_PAY', 'CASH'] as const).map(m => (
              <button key={m} onClick={() => setPayMethod(m)} style={{ padding: 12, borderRadius: 12, fontSize: 14, fontWeight: 700, border: `2px solid ${payMethod === m ? '#16A34A' : '#E5E7EB'}`, background: payMethod === m ? '#F0FDF4' : 'white', color: payMethod === m ? '#15803D' : '#6B7280' }}>
                {m === 'QR_PAY' ? n('📱 Mobile Pay', '📱 မိုဘိုင်းပေး') : n('💵 Cash', '💵 ငွေသား')}
              </button>
            ))}
          </div>
          {payMethod === 'QR_PAY' && (
            <div style={{ marginTop: 16, padding: 20, borderRadius: 12, textAlign: 'center', background: '#F9FAFB', border: '1px solid #E5E7EB' }}>
              <div style={{ width: 120, height: 120, margin: '0 auto 8px', borderRadius: 12, background: 'white', border: '2px solid #DCFCE7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 48 }}>📲</div>
              <p style={{ fontSize: 12, color: '#6B7280' }}>{n('Scan with KBZPay / AYAPay / Wave', 'KBZPay / AYAPay / Wave ဖြင့် scan ဖတ်ပါ')}</p>
            </div>
          )}
          {payMethod === 'CASH' && (
            <div style={{ marginTop: 16, padding: 16, borderRadius: 12, background: '#FFFBEB', border: '1.5px solid #FDE68A' }}>
              <p style={{ fontSize: 14, fontWeight: 700, color: '#92400E', marginBottom: 4 }}>
                💵 {n('Cash Payment', 'ငွေသားပေးချေ')}
              </p>
              <p style={{ fontSize: 13, color: '#92400E', lineHeight: 1.5 }}>
                {n(
                  'After placing order, a staff member will come to your table to collect payment and confirm your order.',
                  'အော်ဒါတင်ပြီးနောက် ဝန်ထမ်းသည် ငွေလက်ခံ၍ အတည်ပြုရန် လာပါမည်'
                )}
              </p>
            </div>
          )}
        </div>
        <button onClick={async () => {
          // Save order to PostgreSQL
          try {
            const orderItems: OrderItem[] = cart.map(c => ({
              itemId: c.item.id, name: c.item.name, nameMm: c.item.nameMm,
              qty: c.qty, unitPrice: c.item.price, unitTotal: c.unitTotal,
              options: formatOpts(c).join(' · '), notes: c.notes,
            }))
            await addOrder({
              id: orderNo, table_id: tableId, items: orderItems, total: totalAmount,
              pay_method: payMethod, status: 'pending',
            })
            await setTableStatus(tableId, 'occupied')
          } catch (err) { console.error('Order save error:', err) }

          if (payMethod === 'QR_PAY') {
            setScreen('waiting')
          } else {
            setScreen('cash_pending')
          }
        }} className="btn-green" style={{ width: '100%', padding: 16, fontSize: 16 }}>
          {payMethod === 'QR_PAY' ? n('✓ I Have Paid', '✓ ငွေပေးပြီး') : n('📋 Submit Order (Pay at Table)', '📋 အော်ဒါတင် (စားပွဲတွင်ပေး)')}
        </button>
      </div>
    </div>
  )

  // ─── CONFIRM SCREEN ──────────────────────────────────────────
  if (screen === 'confirm') return (
    <div style={{ minHeight: '100vh', padding: 16, maxWidth: 480, margin: '0 auto', background: '#F8FAFB' }} className="fade-in">
      <button onClick={() => setScreen('cart')} style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#6B7280', fontSize: 14, marginTop: 16, marginBottom: 24, background: 'none' }}>‹ {n('Back', 'နောက်သို့')}</button>
      <div className="card" style={{ padding: 24, marginBottom: 16 }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🍽️</div>
          <h2 style={{ fontSize: 20, fontWeight: 900 }}>{n('Confirm Order?', 'အတည်ပြုမည်လား?')}</h2>
          <p style={{ color: '#9CA3AF', fontSize: 14, marginTop: 4 }}>{n('Once placed, cannot be changed', 'ပြောင်းလဲ၍မရပါ')}</p>
        </div>
        <div style={{ maxHeight: 260, overflowY: 'auto', marginBottom: 20 }}>
          {cart.map((c, i) => (
            <div key={i} style={{ fontSize: 14, padding: '10px 12px', marginBottom: 6, borderRadius: 12, background: '#F8FAFB', border: '1px solid #E5E7EB' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>{n(c.item.name, c.item.nameMm)} ×{c.qty}</span>
                <span style={{ fontWeight: 600 }}>{formatMMK(c.unitTotal * c.qty)}</span>
              </div>
              {formatOpts(c).length > 0 && <p style={{ fontSize: 11, color: '#9CA3AF', marginTop: 2 }}>🏷 {formatOpts(c).join(' · ')}</p>}
              {c.notes && <p style={{ fontSize: 11, color: '#9CA3AF', marginTop: 2 }}>📝 {c.notes}</p>}
              {c.unitTotal > c.item.price && <p style={{ fontSize: 11, color: '#16A34A', marginTop: 2 }}>+{formatMMK(c.unitTotal - c.item.price)} {n('add-ons', 'ထပ်ထည့်')}</p>}
            </div>
          ))}
        </div>
        <div style={{ borderTop: '1px dashed #E5E7EB', margin: '8px 0' }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
          <span style={{ color: '#6B7280' }}>{n('Total', 'စုစုပေါင်း')}</span>
          <span style={{ fontSize: 24, fontWeight: 900, color: '#15803D' }}>{formatMMK(totalAmount)}</span>
        </div>
      </div>
      <button onClick={() => setScreen('payment')} className="btn-green" style={{ width: '100%', padding: 16, fontSize: 16, marginBottom: 10 }}>{n('✓ Place Order', '✓ အတည်ပြုမည်')}</button>
      <button onClick={() => setScreen('cart')} className="btn-outline" style={{ width: '100%', padding: 12 }}>{n('← Back', '← ပြန်')}</button>
    </div>
  )

  // ─── CART SCREEN ─────────────────────────────────────────────
  if (screen === 'cart') return (
    <div style={{ minHeight: '100vh', padding: 16, maxWidth: 480, margin: '0 auto', paddingBottom: 100, background: '#F8FAFB' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 16, marginBottom: 24 }}>
        <button onClick={() => setScreen('menu')} style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#6B7280', fontSize: 14, background: 'none' }}>‹ {n('Menu', 'မီနူး')}</button>
        <h1 style={{ fontWeight: 800, fontSize: 18 }}>{n('Your Cart', 'သင့်ဆန်းကင်')}</h1>
        <span style={{ fontSize: 12, color: '#9CA3AF' }}>{totalItems} {n('items', 'ခု')}</span>
      </div>
      {cart.length === 0 ? (
        <div style={{ textAlign: 'center', paddingTop: 80 }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🛒</div>
          <p style={{ color: '#9CA3AF' }}>{n('Cart is empty', 'ဗလာဖြစ်နေသည်')}</p>
          <button onClick={() => setScreen('menu')} className="btn-green" style={{ marginTop: 16, padding: '10px 24px' }}>{n('Browse Menu', 'မီနူး ကြည့်ရန်')}</button>
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
            {cart.map((c, idx) => (
              <div key={idx} className="card" style={{ padding: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 44, height: 44, borderRadius: 10, background: '#F0FDF4', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>
                    {categories.find(cat => cat.id === c.item.categoryId)?.emoji || '🍽'}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontWeight: 700, fontSize: 14 }}>{n(c.item.name, c.item.nameMm)}</p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ color: '#16A34A', fontWeight: 700, fontSize: 14 }}>{formatMMK(c.unitTotal)}</span>
                      {c.unitTotal > c.item.price && (
                        <span style={{ fontSize: 11, color: '#9CA3AF', textDecoration: 'line-through' }}>{formatMMK(c.item.price)}</span>
                      )}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <button onClick={() => changeQty(idx, -1)} style={{ width: 28, height: 28, borderRadius: '50%', border: '1px solid #E5E7EB', background: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, color: '#6B7280' }}>−</button>
                    <span style={{ width: 24, textAlign: 'center', fontWeight: 800, fontSize: 14 }}>{c.qty}</span>
                    <button onClick={() => changeQty(idx, 1)} style={{ width: 28, height: 28, borderRadius: '50%', background: '#16A34A', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>+</button>
                    <button onClick={() => removeItem(idx)} style={{ marginLeft: 4, color: '#D1D5DB', background: 'none', fontSize: 16 }}>✕</button>
                  </div>
                </div>
                {(formatOpts(c).length > 0 || c.notes) && (
                  <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid #F3F4F6', fontSize: 12, color: '#9CA3AF' }}>
                    {formatOpts(c).length > 0 && <p>{formatOpts(c).join(' · ')}</p>}
                    {c.notes && <p style={{ marginTop: 2 }}>📝 {c.notes}</p>}
                  </div>
                )}
              </div>
            ))}
          </div>
          <div className="card" style={{ padding: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <p style={{ color: '#6B7280', fontSize: 14 }}>{n('Total', 'စုစုပေါင်း')} ({totalItems} {n('items', 'ခု')})</p>
                <p style={{ fontSize: 24, fontWeight: 900, color: '#15803D' }}>{formatMMK(totalAmount)}</p>
              </div>
              <button onClick={() => setScreen('confirm')} className="btn-green" style={{ padding: '12px 20px' }}>{n('Order Now →', 'အော်ဒါ →')}</button>
            </div>
          </div>
        </>
      )}
    </div>
  )

  // ─── MENU SCREEN ─────────────────────────────────────────────
  const currentCat = categories.find(c => c.id === activeCat)!

  return (
    <div style={{ minHeight: '100vh', maxWidth: 480, margin: '0 auto', paddingBottom: totalItems > 0 ? 100 : 16, background: '#F8FAFB' }}>
      {DetailModal()}
      <div style={{ position: 'sticky', top: 0, zIndex: 40, background: 'white', borderBottom: '1px solid #F3F4F6', padding: '16px 16px 0', boxShadow: '0 1px 8px rgba(0,0,0,0.04)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: 'linear-gradient(135deg, #22C55E, #15803D)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>🍽</div>
            <div>
              <p style={{ fontWeight: 800, fontSize: 15, lineHeight: 1 }}>{n('Our Menu', 'ကျွန်ုပ်တို့၏ မီနူး')}</p>
              <p style={{ color: '#9CA3AF', fontSize: 12 }}>{n('Tap any dish for details', 'နှိပ်၍ အသေးစိတ်ကြည့်ပါ')}</p>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {/* Location status badge */}
            <div style={{
              padding: '4px 10px', borderRadius: 8, fontSize: 11, fontWeight: 800,
              display: 'flex', alignItems: 'center', gap: 4,
              background: geoStatus === 'active' ? '#F0FDF4' : geoStatus === 'checking' ? '#F9FAFB' : '#FEF9C3',
              color: geoStatus === 'active' ? '#16A34A' : geoStatus === 'checking' ? '#9CA3AF' : '#92400E',
              border: `1px solid ${geoStatus === 'active' ? '#BBF7D0' : geoStatus === 'checking' ? '#E5E7EB' : '#FDE68A'}`,
            }}>
              {geoStatus === 'active' ? '📍' : geoStatus === 'checking' ? '⏳' : geoStatus === 'denied' ? '📍' : '📍'}
              {geoStatus === 'active' ? n(' In Restaurant', ' ဆိုင်တွင်း') : geoStatus === 'checking' ? n(' Locating...', ' ရှာနေသည်...') : n(' Table ' + tableId, ' စားပွဲ ' + tableId)}
            </div>
            <button onClick={() => setLang(l => l === 'en' ? 'mm' : 'en')} style={{ padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 700, border: '1.5px solid #BBF7D0', color: '#16A34A', background: '#F0FDF4' }}>
              {lang === 'en' ? 'မြန်မာ' : 'EN'}
            </button>
          </div>
        </div>
        <div className="category-tabs">
          {categories.map(cat => (
            <button key={cat.id} onClick={() => setActiveCat(cat.id)} style={{
              flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6,
              padding: '6px 14px', borderRadius: 999, fontSize: 12, fontWeight: 700,
              background: activeCat === cat.id ? 'linear-gradient(135deg, #22C55E, #15803D)' : 'white',
              color: activeCat === cat.id ? 'white' : '#6B7280',
              border: activeCat === cat.id ? 'none' : '1px solid #E5E7EB',
              boxShadow: activeCat === cat.id ? '0 2px 8px rgba(22,163,74,0.25)' : 'none',
            }}>
              <span>{cat.emoji}</span>
              <span>{n(cat.name, cat.nameMm)}</span>
            </button>
          ))}
        </div>
      </div>

      {activeCat === categories[0].id && (
        <div style={{ padding: '16px 16px 0' }}>
          <p style={{ fontSize: 13, fontWeight: 800, color: '#92400E', marginBottom: 10 }}>⭐ {n('Recommended', 'အကြံပြု')}</p>
          <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 12, scrollbarWidth: 'none' }}>
            {recommended.slice(0, 6).map(item => {
              const cat = categories.find(c => c.id === item.categoryId)
              return (
                <button key={item.id} onClick={() => openDetail(item)} style={{
                  flexShrink: 0, width: 130, background: 'white', borderRadius: 14,
                  border: '1.5px solid #FDE68A', padding: 10, textAlign: 'center',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                }}>
                  <div style={{ fontSize: 28 }}>{cat?.emoji}</div>
                  <p style={{ fontSize: 12, fontWeight: 700, lineHeight: 1.3 }}>{n(item.name, item.nameMm)}</p>
                  <p style={{ fontSize: 12, fontWeight: 800, color: '#16A34A' }}>{formatMMK(item.price)}</p>
                </button>
              )
            })}
          </div>
        </div>
      )}

      <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <p style={{ fontSize: 12, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          {n(currentCat.name, currentCat.nameMm)} ({currentCat.items.length})
        </p>
        {currentCat.items.map((item, idx) => {
          const q = cartQty(item.id)
          const soldOut = outOfStock.includes(item.id)
          return (
            <div key={item.id} className={`menu-card ${q > 0 ? 'in-cart' : ''} fade-in`}
              onClick={() => !soldOut && openDetail(item)}
              style={{ padding: 14, display: 'flex', gap: 12, animationDelay: `${idx * 0.05}s`, cursor: soldOut ? 'not-allowed' : 'pointer', opacity: soldOut ? 0.45 : 1 }}>
              <div style={{ width: 72, height: 72, borderRadius: 12, flexShrink: 0, fontSize: 28, background: '#F0FDF4', border: '1.5px solid #DCFCE7', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                {currentCat.emoji}
                {item.isRecommended && <span style={{ position: 'absolute', top: -4, right: -4, fontSize: 14 }}>⭐</span>}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <h3 style={{ fontWeight: 800, fontSize: 14 }}>{n(item.name, item.nameMm)}</h3>
                  {spiceDots(item.spiceLevel)}
                </div>
                <p className="line-clamp-2" style={{ color: '#9CA3AF', fontSize: 12, marginTop: 2, lineHeight: 1.5 }}>{n(item.description, item.descMm)}</p>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
                  <span style={{ color: soldOut ? '#D1D5DB' : '#16A34A', fontWeight: 900, fontSize: 14 }}>{formatMMK(item.price)}</span>
                  {soldOut ? (
                    <span style={{ fontSize: 11, fontWeight: 800, padding: '3px 10px', borderRadius: 999, background: '#FEE2E2', color: '#DC2626' }}>
                      {n('Sold Out', 'ကုန်သွားပြီ')}
                    </span>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      {q > 0 && <span style={{ width: 22, height: 22, borderRadius: '50%', background: '#16A34A', color: 'white', fontSize: 11, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{q}</span>}
                      <div style={{ width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #22C55E, #15803D)', color: 'white', fontSize: 18, fontWeight: 700, boxShadow: '0 2px 8px rgba(22,163,74,0.3)' }}>+</div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {totalItems > 0 && (
        <div className="cart-bar slide-up">
          <button onClick={() => setScreen('cart')} className="btn-green" style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800 }}>{totalItems}</div>
              <span>{n('View Cart', 'ဆန်းကင်')}</span>
            </div>
            <span style={{ fontWeight: 900 }}>{formatMMK(totalAmount)}</span>
          </button>
        </div>
      )}
    </div>
  )
}

export default App
