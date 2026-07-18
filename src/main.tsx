import React, { useState, useEffect } from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import QRPage from './QRPage'
import AdminApp from './AdminApp'
import KitchenApp from './KitchenApp'
import './index.css'

function Router() {
  const [page, setPage] = useState(window.location.hash)

  useEffect(() => {
    const handler = () => setPage(window.location.hash)
    window.addEventListener('hashchange', handler)
    return () => window.removeEventListener('hashchange', handler)
  }, [])

  if (page === '#qr') return <QRPage />
  if (page === '#admin') return <AdminApp />
  if (page === '#kitchen') return <KitchenApp />
  return <App />
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Router />
  </React.StrictMode>,
)
