import { useEffect, useState } from 'react'
import { NavLink, Route, Routes } from 'react-router-dom'
import { ArrowUpRight, LayoutGrid, LogOut, UsersRound } from 'lucide-react'
import { api } from './shared/api'
import AdminLogin from './pages/AdminLogin'
import Dashboard from './pages/Dashboard'
import Employees from './pages/Employees'
import InsuranceBreakout from './pages/InsuranceBreakout'
import PayrollVerification from './pages/PayrollVerification'

const navItems = [
  { label: 'Tool Hub', to: '/', icon: LayoutGrid },
  { label: 'Employees', to: '/employees', icon: UsersRound },
]

type AdminUser = {
  firstName?: string
  lastName?: string
  email?: string
  type?: string
  expiresAt?: string
}

function Shell({ children, user, onLogout }: { children: React.ReactNode; user: AdminUser | null; onLogout: () => void }) {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,#dbeafe_0,#f3f6fb_28%,#eef2f7_100%)] text-slate-950">
      <header className="sticky top-0 z-20 border-b border-white/70 bg-white/85 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center gap-5 px-5 py-3">
          <NavLink to="/" className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-lg bg-slate-950 text-sm font-black text-white shadow-sm">RT</span>
            <span>
              <span className="block text-sm font-semibold leading-4 text-slate-950">RTUT Admin</span>
              <span className="block text-xs text-slate-500">Tools Workspace</span>
            </span>
          </NavLink>

          <nav className="hidden items-center gap-1 rounded-lg border border-slate-200 bg-slate-100/70 p-1 md:flex">
            {navItems.map((item) => {
              const Icon = item.icon
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === '/'}
                  className={({ isActive }) =>
                    `flex items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold transition ${
                      isActive ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-600 hover:bg-white/70 hover:text-slate-950'
                    }`
                  }
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </NavLink>
              )
            })}
          </nav>

          <div className="ml-auto hidden items-center gap-3 lg:flex">
            {user ? (
              <div className="text-right">
                <div className="text-sm font-semibold text-slate-900">{[user.firstName, user.lastName].filter(Boolean).join(' ') || user.email}</div>
                <div className="text-xs text-slate-500">{user.email || user.type || 'Admin'}</div>
              </div>
            ) : null}
            <a
              className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-blue-200 hover:text-blue-700"
              href="/app-console"
            >
              App Console
              <ArrowUpRight className="h-4 w-4" />
            </a>
            <button
              className="inline-flex items-center gap-2 rounded-md bg-slate-950 px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-600"
              type="button"
              onClick={onLogout}
            >
              <LogOut className="h-4 w-4" />
              Logout
            </button>
          </div>
        </div>

        <nav className="flex gap-2 overflow-x-auto border-t border-slate-200 px-4 py-2 md:hidden">
          {navItems.map((item) => {
            const Icon = item.icon
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) =>
                  `inline-flex shrink-0 items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold ${
                    isActive ? 'bg-blue-600 text-white' : 'bg-white text-slate-700'
                  }`
                }
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </NavLink>
            )
          })}
          <button className="inline-flex shrink-0 items-center gap-2 rounded-md bg-slate-950 px-3 py-2 text-sm font-semibold text-white" type="button" onClick={onLogout}>
            <LogOut className="h-4 w-4" />
            Logout
          </button>
        </nav>
      </header>

      <main className="mx-auto max-w-7xl px-5 py-7">{children}</main>
    </div>
  )
}

function HrToolShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,#dbeafe_0,#f3f6fb_28%,#eef2f7_100%)] text-slate-950">
      <main className="mx-auto max-w-7xl px-5 py-7">{children}</main>
    </div>
  )
}

export default function App() {
  const [user, setUser] = useState<AdminUser | null>(null)
  const [isCheckingAuth, setIsCheckingAuth] = useState(true)
  const isHrTools = window.location.pathname.startsWith('/hr-tools')

  useEffect(() => {
    if (isHrTools) {
      setIsCheckingAuth(false)
      return
    }

    api.get('/admin-auth/me')
      .then((res) => setUser(res.data.user))
      .catch(() => setUser(null))
      .finally(() => setIsCheckingAuth(false))
  }, [isHrTools])

  async function handleLogout() {
    await api.post('/admin-auth/logout').catch(() => {})
    setUser(null)
  }

  if (isHrTools) {
    return (
      <HrToolShell>
        <Routes>
          <Route path="/payroll-verification" element={<PayrollVerification />} />
          <Route path="/insurance-breakout" element={<InsuranceBreakout />} />
        </Routes>
      </HrToolShell>
    )
  }

  if (isCheckingAuth) {
    return (
      <div className="grid min-h-screen place-items-center bg-slate-100 text-sm font-semibold text-slate-600">
        Checking admin session...
      </div>
    )
  }

  if (!user) {
    return <AdminLogin onLogin={setUser} />
  }

  return (
    <Shell user={user} onLogout={handleLogout}>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/employees" element={<Employees />} />
      </Routes>
    </Shell>
  )
}
