import { Link, Outlet } from 'react-router-dom'
import './App.css'

export default function App() {
  return (
    <div className="app">
      <header className="app-header">
        <Link to="/" className="brand">
          🎸 Band Scheduler
        </Link>
      </header>
      <main className="app-main">
        <Outlet />
      </main>
      <footer className="app-footer">
        <span>社内バンド部用</span>
      </footer>
    </div>
  )
}
