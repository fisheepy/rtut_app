import { useEffect, useState } from 'react'
import { Link, Route, Routes } from 'react-router-dom'
import { ArrowRight, BriefcaseBusiness, FileSpreadsheet, GraduationCap, KeyRound, LogOut, Mail, ReceiptText, RefreshCw, ShieldCheck, UsersRound } from 'lucide-react'
import { api } from './shared/api'
import AdminLogin from './pages/AdminLogin'
import InsuranceBreakout from './pages/InsuranceBreakout'
import PayrollVerification from './pages/PayrollVerification'
import CommissionRoster from './pages/CommissionRoster'
import TrainingTools from './pages/TrainingTools'
import HRPlatform from './pages/HRPlatform'
import NewHire from './pages/NewHire'
import Termination from './pages/Termination'
import EmploymentChange from './pages/EmploymentChange'

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
  {
    title: 'Training Tools',
    description: 'Review employee details and track Orientation Training and Monthly Training.',
    to: '/training',
    icon: GraduationCap,
    tone: 'from-emerald-600 to-teal-500',
    badge: 'Training',
  },
  {
    title: 'HR Platform',
    description: 'Manage employee lifecycle records for new hires, terminations, employment changes, and protected or medical leave.',
    to: '/hr-platform',
    icon: BriefcaseBusiness,
    tone: 'from-amber-600 to-orange-500',
    badge: 'Employee Records',
  },
]

function HrToolsHubLogin({ onLogin }: { onLogin: () => void }) {
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [codeSent, setCodeSent] = useState(false)
  const [message, setMessage] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [isVerifying, setIsVerifying] = useState(false)

  async function requestCode(event: React.FormEvent) {
    event.preventDefault()
    setIsSending(true)
    setMessage('Sending your one-time code...')
    try {
      await api.post('/hr-tools-auth/request-code', { email: email.trim() })
      setCodeSent(true)
      setMessage('A 6-digit code was sent to your email. It expires in 10 minutes.')
    } catch (error: any) {
      setMessage(error.response?.data?.error || 'The login code could not be sent.')
    } finally {
      setIsSending(false)
    }
  }

  async function verifyCode(event: React.FormEvent) {
    event.preventDefault()
    setIsVerifying(true)
    setMessage('Verifying your code...')
    try {
      await api.post('/hr-tools-auth/verify-code', { email: email.trim(), code: code.trim() })
      onLogin()
    } catch (error: any) {
      setMessage(error.response?.data?.error || 'Invalid or expired login code.')
    } finally {
      setIsVerifying(false)
    }
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-white/70 bg-white shadow-2xl">
      <div className="grid lg:grid-cols-[0.9fr_1.1fr]">
        <div className="relative overflow-hidden bg-slate-950 p-8 text-white md:p-10">
          <div className="absolute -right-20 -top-20 h-72 w-72 rounded-full bg-blue-500/30 blur-3xl" />
          <div className="absolute -bottom-24 left-12 h-64 w-64 rounded-full bg-cyan-400/20 blur-3xl" />
          <div className="relative">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-semibold text-cyan-100">
              <ShieldCheck className="h-4 w-4" />
              Authorized Access Only
            </div>
            <h1 className="mt-5 text-4xl font-semibold">RTUT HR Tools</h1>
            <p className="mt-4 max-w-md text-sm leading-6 text-slate-300">
              HR operational tools are protected. Request a one-time code using an authorized email address.
            </p>
          </div>
        </div>
        <div className="p-6 md:p-10">
          <h2 className="text-2xl font-semibold text-slate-950">Sign in</h2>
          <p className="mt-1 text-sm text-slate-500">The code will be delivered by email and expires after 10 minutes.</p>
          <form className="mt-6 space-y-4" onSubmit={codeSent ? verifyCode : requestCode}>
            <label className="block">
              <span className="text-sm font-semibold text-slate-700">Authorized email</span>
              <span className="relative mt-2 block">
                <Mail className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                <input
                  autoComplete="email"
                  className="w-full rounded-lg border border-slate-200 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="name@royaltrailersales.com"
                  type="email"
                  value={email}
                />
              </span>
            </label>
            {codeSent ? (
              <label className="block">
                <span className="text-sm font-semibold text-slate-700">6-digit code</span>
                <input
                  autoComplete="one-time-code"
                  autoFocus
                  className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-center text-xl font-semibold tracking-[0.35em] outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                  inputMode="numeric"
                  maxLength={6}
                  onChange={(event) => setCode(event.target.value.replace(/\D/g, ''))}
                  placeholder="000000"
                  value={code}
                />
              </label>
            ) : null}
            <button
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={codeSent ? code.length !== 6 || isVerifying : !email.trim() || isSending}
              type="submit"
            >
              <KeyRound className="h-4 w-4" />
              {codeSent ? (isVerifying ? 'Signing in...' : 'Sign in with code') : (isSending ? 'Sending...' : 'Email me a code')}
            </button>
            {codeSent ? (
              <button className="w-full text-sm font-semibold text-blue-700 hover:text-blue-800 disabled:opacity-50" disabled={isSending} onClick={requestCode} type="button">
                {isSending ? 'Sending...' : 'Send a new code'}
              </button>
            ) : null}
          </form>
          {message ? <p className="mt-4 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">{message}</p> : null}
        </div>
      </div>
    </section>
  )
}

function HrToolsHub() {
  const [authState, setAuthState] = useState<'checking' | 'authenticated' | 'signed-out'>('checking')

  useEffect(() => {
    api.get('/hr-tools-auth/me')
      .then(() => setAuthState('authenticated'))
      .catch(() => setAuthState('signed-out'))
  }, [])

  if (authState === 'checking') {
    return (
      <div className="grid min-h-64 place-items-center rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="text-center">
          <RefreshCw className="mx-auto h-7 w-7 animate-spin text-blue-600" />
          <p className="mt-3 text-sm font-semibold text-slate-700">Checking secure access...</p>
        </div>
      </div>
    )
  }

  if (authState === 'signed-out') return <HrToolsHubLogin onLogin={() => setAuthState('authenticated')} />
  return <HrToolsHubContent onLogout={() => setAuthState('signed-out')} />
}

function HrToolsHubContent({ onLogout }: { onLogout: () => void }) {
  async function logout() {
    await api.post('/hr-tools-auth/logout').catch(() => {})
    onLogout()
  }

  return (
    <div className="space-y-7">
      <section className="relative overflow-hidden rounded-2xl border border-white/70 bg-slate-950 px-6 py-8 text-white shadow-xl md:px-8">
        <div className="absolute inset-y-0 right-0 w-1/2 bg-[radial-gradient(circle_at_center,#22c55e_0,transparent_55%)] opacity-25" />
        <div className="absolute -bottom-20 left-16 h-56 w-56 rounded-full bg-blue-500/25 blur-3xl" />
        <div className="relative">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-semibold text-cyan-100">
              <FileSpreadsheet className="h-4 w-4" />
              HR Tools
            </div>
            <button className="inline-flex items-center gap-2 text-sm font-semibold text-slate-300 hover:text-white" onClick={logout} type="button">
              <LogOut className="h-4 w-4" />
              Sign out
            </button>
          </div>
          <div className="max-w-3xl">
            <h1 className="mt-5 text-4xl font-semibold tracking-normal md:text-5xl">Focused file workflows for HR operations.</h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-slate-300">
              Securely access focused workflows for payroll, benefits, commissions, and training operations.
            </p>
          </div>
        </div>
      </section>

      <section className="grid gap-5 md:grid-cols-2">
        {hrTools.map((tool) => {
          const Icon = tool.icon
          const card = (
            <article className={`group h-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm ${tool.to ? 'transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-lg' : ''}`}>
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
                {tool.to ? (
                  <div className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-blue-700">
                    Open tool
                    <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
                  </div>
                ) : (
                  <div className="mt-5 text-sm font-semibold text-slate-400">Feature coming soon</div>
                )}
              </div>
            </article>
          )

          return tool.to ? (
            <Link key={tool.title} to={tool.to}>
              {card}
            </Link>
          ) : (
            <div key={tool.title}>{card}</div>
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
          <Route path="/training" element={<TrainingTools />} />
          <Route path="/hr-platform" element={<HRPlatform />} />
          <Route path="/hr-platform/new-hire" element={<NewHire />} />
          <Route path="/hr-platform/termination" element={<Termination />} />
          <Route path="/hr-platform/employment-change" element={<EmploymentChange />} />
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

