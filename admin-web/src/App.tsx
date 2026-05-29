import { useEffect, useState } from 'react'
import { Link, Route, Routes } from 'react-router-dom'
import { ArrowRight, FileSpreadsheet, ReceiptText, ShieldCheck, UsersRound } from 'lucide-react'
import { api } from './shared/api'
import AdminLogin from './pages/AdminLogin'
import InsuranceBreakout from './pages/InsuranceBreakout'
import PayrollVerification from './pages/PayrollVerification'
import CommissionRoster from './pages/CommissionRoster'

type AdminUser = {
  firstName?: string
  lastName?: string
  email?: string
  type?: string
  expiresAt?: string
}

function HrToolShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,#dbeafe_0,#f3f6fb_28%,#eef2f7_100%)] text-slate-950">
      <main className="mx-auto max-w-7xl px-5 py-7">{children}</main>
    </div>
  )
}

const hrTools = [
  {
    title: 'Payroll Verification',
    description: 'Compare HR commission references against payroll COM earnings and open issue-first HTML and Excel reports.',
    to: '/payroll-verification',
    icon: ReceiptText,
    tone: 'from-blue-600 to-cyan-500',
    badge: 'Payroll',
  },
  {
    title: 'Insurance Breakout',
    description: 'Cross-check payroll deductions against dental, vision, LTD, life, and supplemental insurance invoices.',
    to: '/insurance-breakout',
    icon: ShieldCheck,
    tone: 'from-violet-600 to-cyan-500',
    badge: 'Benefits',
  },
  {
    title: 'Commission Roster Mapping',
    description: 'Map technician quarterly commissions to the roster and flag departed, missing, duplicate, or ambiguous employees.',
    to: '/commission-roster',
    icon: UsersRound,
    tone: 'from-teal-700 to-blue-500',
    badge: 'Commission',
  },
]

function HrToolsHub() {
  return (
    <div className="space-y-7">
      <section className="relative overflow-hidden rounded-2xl border border-white/70 bg-slate-950 px-6 py-8 text-white shadow-xl md:px-8">
        <div className="absolute inset-y-0 right-0 w-1/2 bg-[radial-gradient(circle_at_center,#22c55e_0,transparent_55%)] opacity-25" />
        <div className="absolute -bottom-20 left-16 h-56 w-56 rounded-full bg-blue-500/25 blur-3xl" />
        <div className="relative max-w-3xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-semibold text-cyan-100">
            <FileSpreadsheet className="h-4 w-4" />
            HR Tools
          </div>
          <h1 className="mt-5 text-4xl font-semibold tracking-normal md:text-5xl">Focused file workflows for HR operations.</h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-slate-300">
            Upload the required Excel files, generate browser-ready reports, and download audit workbooks without an admin login.
          </p>
        </div>
      </section>

      <section className="grid gap-5 md:grid-cols-2">
        {hrTools.map((tool) => {
          const Icon = tool.icon
          return (
            <Link key={tool.title} to={tool.to}>
              <article className="group h-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-lg">
                <div className={`h-2 bg-gradient-to-r ${tool.tone}`} />
                <div className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className={`grid h-12 w-12 place-items-center rounded-lg bg-gradient-to-br ${tool.tone} text-white shadow-sm`}>
                      <Icon className="h-6 w-6" />
                    </div>
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">{tool.badge}</span>
                  </div>
                  <h2 className="mt-5 text-xl font-semibold text-slate-950">{tool.title}</h2>
                  <p className="mt-2 min-h-16 text-sm leading-6 text-slate-600">{tool.description}</p>
                  <div className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-blue-700">
                    Open tool
                    <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
                  </div>
                </div>
              </article>
            </Link>
          )
        })}
      </section>
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

  function enterAppConsole() {
    window.location.replace('/app-console')
  }

  if (isHrTools) {
    return (
      <HrToolShell>
        <Routes>
          <Route path="/" element={<HrToolsHub />} />
          <Route path="/payroll-verification" element={<PayrollVerification />} />
          <Route path="/insurance-breakout" element={<InsuranceBreakout />} />
          <Route path="/commission-roster" element={<CommissionRoster />} />
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
    return <AdminLogin onLogin={enterAppConsole} />
  }

  enterAppConsole()
  return (
    <div className="grid min-h-screen place-items-center bg-slate-100 text-sm font-semibold text-slate-600">
      Opening App Console...
    </div>
  )
}
