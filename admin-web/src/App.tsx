import { Route, Routes, Link } from 'react-router-dom'
import Dashboard from './pages/Dashboard'
import Employees from './pages/Employees'

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <header className="border-b bg-white">
        <div className="mx-auto max-w-6xl px-4 py-3 flex items-center gap-6">
          <div className="font-semibold">RTUT Admin Web</div>
          <nav className="flex gap-4 text-sm">
            <Link to="/">Dashboard</Link>
            <Link to="/employees">Employees</Link>
          </nav>
          <a className="ml-auto text-sm underline" href="/old">回到旧版</a>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </div>
  )
}

export default function App() {
  return (
    <Shell>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/employees" element={<Employees />} />
      </Routes>
    </Shell>
  )
}
