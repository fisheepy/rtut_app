import { NavLink, Route, Routes } from 'react-router-dom'
import { ArrowUpRight, LayoutGrid, ReceiptText, UsersRound } from 'lucide-react'
import Dashboard from './pages/Dashboard'
import Employees from './pages/Employees'
import PayrollVerification from './pages/PayrollVerification'

const navItems = [
  { label: 'Tool Hub', to: '/', icon: LayoutGrid },
  { label: 'Payroll Verification', to: '/payroll-verification', icon: ReceiptText },
  { label: 'Employees', to: '/employees', icon: UsersRound },
]

function Shell({ children }: { children: React.ReactNode }) {
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

          <a
            className="ml-auto inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-blue-200 hover:text-blue-700"
            href="/old"
          >
            Classic Admin
            <ArrowUpRight className="h-4 w-4" />
          </a>
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
        </nav>
      </header>

      <main className="mx-auto max-w-7xl px-5 py-7">{children}</main>
    </div>
  )
}

export default function App() {
  return (
    <Shell>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/employees" element={<Employees />} />
        <Route path="/payroll-verification" element={<PayrollVerification />} />
      </Routes>
    </Shell>
  )
}
