import { useState, useEffect } from 'react'
import QRCode from 'qrcode'

const TABLES = [1, 2, 3, 4, 5, 6, 7, 8]

export default function QRPage() {
  const [qrCodes, setQrCodes] = useState<{ table: number; dataUrl: string; menuUrl: string }[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const baseUrl = `${window.location.protocol}//${window.location.host}`
    Promise.all(
      TABLES.map(async (t) => {
        const menuUrl = `${baseUrl}/?table=${t}`
        const dataUrl = await QRCode.toDataURL(menuUrl, {
          width: 280,
          margin: 2,
          color: { dark: '#15803D', light: '#FFFFFF' },
          errorCorrectionLevel: 'M',
        })
        return { table: t, dataUrl, menuUrl }
      })
    ).then(results => {
      setQrCodes(results)
      setLoading(false)
    })
  }, [])

  const printSingle = (qr: typeof qrCodes[0]) => {
    const w = window.open('', '_blank', 'width=420,height=560')
    if (!w) return
    w.document.write(`
      <html><head><title>Table ${qr.table} QR</title>
      <style>
        * { margin:0; padding:0; box-sizing:border-box; }
        body { font-family:Inter,system-ui,sans-serif; display:flex; align-items:center; justify-content:center;
               min-height:100vh; background:#F0FDF4; }
        .card { background:white; border:3px solid #BBF7D0; border-radius:20px; padding:32px 28px;
                text-align:center; box-shadow:0 8px 32px rgba(0,0,0,0.1); max-width:280px; }
        h1 { font-size:30px; font-weight:900; color:#15803D; }
        p  { font-size:13px; color:#6B7280; margin:6px 0 20px; }
        img { width:220px; height:220px; border:3px solid #DCFCE7; border-radius:12px; }
        .foot { font-size:12px; color:#16A34A; margin-top:14px; font-weight:700; }
        @page { margin:8mm; }
      </style></head>
      <body><div class="card">
        <h1>Table ${qr.table}</h1>
        <p>Scan to view menu &amp; order</p>
        <img src="${qr.dataUrl}" />
        <div class="foot">📱 Open camera &amp; scan</div>
      </div></body></html>
    `)
    w.document.close()
    setTimeout(() => { w.focus(); w.print() }, 400)
  }

  const printAll = () => {
    const w = window.open('', '_blank', 'width=900,height=700')
    if (!w) return
    w.document.write(`
      <html><head><title>All Table QR Codes</title>
      <style>
        * { margin:0; padding:0; box-sizing:border-box; }
        body { font-family:Inter,system-ui,sans-serif; background:white; padding:16px; }
        h1 { text-align:center; font-size:18px; font-weight:900; color:#15803D; margin-bottom:16px; }
        .grid { display:grid; grid-template-columns:repeat(4,1fr); gap:14px; }
        .card { border:2px solid #BBF7D0; border-radius:14px; padding:14px; text-align:center; break-inside:avoid; }
        .t { font-size:18px; font-weight:900; color:#15803D; }
        .s { font-size:10px; color:#6B7280; margin:4px 0 8px; }
        img { width:140px; height:140px; }
        .f { font-size:10px; color:#16A34A; margin-top:6px; font-weight:600; }
        @page { margin:8mm; }
      </style></head>
      <body>
        <h1>🍽️ Restaurant POS — Table QR Codes</h1>
        <div class="grid">
          ${qrCodes.map(qr => `
            <div class="card">
              <div class="t">Table ${qr.table}</div>
              <div class="s">Scan to order</div>
              <img src="${qr.dataUrl}" />
              <div class="f">📱 Scan with camera</div>
            </div>
          `).join('')}
        </div>
      </body></html>
    `)
    w.document.close()
    setTimeout(() => { w.focus(); w.print() }, 400)
  }

  return (
    <div style={{ minHeight: '100vh', background: '#F8FAFB' }}>
      {/* Header */}
      <div style={{ background: 'white', borderBottom: '1px solid #E5E7EB', padding: '16px 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', maxWidth: 1200, margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 40, height: 40, borderRadius: 12,
              background: 'linear-gradient(135deg, #22C55E, #15803D)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 20
            }}>🍽</div>
            <div>
              <h1 style={{ fontWeight: 900, fontSize: 18, color: '#111827' }}>Table QR Codes</h1>
              <p style={{ fontSize: 12, color: '#9CA3AF' }}>Print and place on each table for customers to scan</p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <a href="/" style={{ textDecoration: 'none' }}>
              <button className="btn-outline" style={{ padding: '8px 16px', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
                📱 Preview Menu
              </button>
            </a>
            <button onClick={printAll} disabled={loading} className="btn-green"
              style={{ padding: '8px 18px', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
              🖨 Print All 8
            </button>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 1200, margin: '0 auto', padding: 24 }}>
        {/* How to test banner */}
        <div style={{
          background: '#F0FDF4', border: '1.5px solid #BBF7D0', borderRadius: 16,
          padding: 20, marginBottom: 24, display: 'flex', gap: 16, alignItems: 'flex-start'
        }}>
          <div style={{
            width: 44, height: 44, borderRadius: 12, flexShrink: 0,
            background: '#DCFCE7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22
          }}>📶</div>
          <div>
            <p style={{ fontWeight: 800, color: '#15803D', fontSize: 14, marginBottom: 4 }}>📱 How to test on your phone</p>
            <ol style={{ color: '#166534', fontSize: 13, paddingLeft: 18, lineHeight: 1.8 }}>
              <li>Connect your phone to the <b>same Wi-Fi</b> as this PC</li>
              <li>Open your <b>phone camera</b> and point at any QR code below</li>
              <li>Tap the link that appears — the menu opens on your phone!</li>
            </ol>
            <p style={{
              marginTop: 8, fontFamily: 'monospace', fontSize: 12, color: '#16A34A',
              background: '#DCFCE7', padding: '4px 10px', borderRadius: 6, display: 'inline-block'
            }}>
              Network: {window.location.protocol}//{window.location.host}
            </p>
          </div>
        </div>

        {/* QR Grid */}
        {loading ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
            {TABLES.map(t => (
              <div key={t} style={{
                background: 'white', borderRadius: 16, padding: 24,
                border: '1.5px solid #E5E7EB', textAlign: 'center'
              }}>
                <div style={{ width: 180, height: 180, background: '#F3F4F6', borderRadius: 12, margin: '0 auto' }} />
              </div>
            ))}
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16 }}>
            {qrCodes.map((qr, idx) => (
              <div key={qr.table} className="card fade-in" style={{
                padding: 20, textAlign: 'center',
                animationDelay: `${idx * 0.06}s`
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <span style={{ fontWeight: 900, fontSize: 18, color: '#111827' }}>Table {qr.table}</span>
                  <span style={{
                    fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 999,
                    background: '#F0FDF4', color: '#16A34A', border: '1px solid #BBF7D0'
                  }}>Free</span>
                </div>

                <img src={qr.dataUrl} alt={`QR Table ${qr.table}`} style={{
                  width: 180, height: 180, borderRadius: 12, margin: '0 auto',
                  border: '3px solid #DCFCE7'
                }} />

                <p style={{ fontSize: 12, color: '#9CA3AF', margin: '10px 0' }}>📱 Scan to open menu</p>

                <div style={{ display: 'flex', gap: 8 }}>
                  <a href={`/?table=${qr.table}`} target="_blank" rel="noopener noreferrer" style={{ flex: 1, textDecoration: 'none' }}>
                    <button className="btn-outline" style={{ width: '100%', padding: '8px 0', fontSize: 12 }}>
                      👁 Preview
                    </button>
                  </a>
                  <button onClick={() => printSingle(qr)} style={{
                    flex: 1, padding: '8px 0', fontSize: 12, fontWeight: 700,
                    borderRadius: 12, background: '#F0FDF4', color: '#15803D',
                    border: '1.5px solid #BBF7D0'
                  }}>
                    🖨 Print
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
