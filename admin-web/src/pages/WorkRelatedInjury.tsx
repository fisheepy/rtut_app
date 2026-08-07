import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, ClipboardList, FileClock, HardHat, HeartPulse, KeyRound, LogOut, Mail, RefreshCw, ShieldCheck, Stethoscope } from 'lucide-react'
import { api } from '../shared/api'

function InjuryLogin({ onLogin }: { onLogin: () => void }) {
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [codeSent, setCodeSent] = useState(false)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  async function requestCode(event: React.FormEvent) {
    event.preventDefault()
    setBusy(true)
    setMessage('Sending your one-time code...')
    try {
      await api.post('/training-auth/request-code', { email: email.trim() })
      setCodeSent(true)
      setMessage('A 6-digit code was sent to your email. It expires in 10 minutes.')
    } catch (error: any) {
      setMessage(error.response?.data?.error || 'The login code could not be sent.')
    } finally {
      setBusy(false)
    }
  }

  async function verifyCode(event: React.FormEvent) {
    event.preventDefault()
    setBusy(true)
    setMessage('Verifying your code...')
    try {
      await api.post('/training-auth/verify-code', { email: email.trim(), code: code.trim() })
      onLogin()
    } catch (error: any) {
      setMessage(error.response?.data?.error || 'Invalid or expired login code.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-white/70 bg-white shadow-2xl">
      <div className="grid lg:grid-cols-[0.9fr_1.1fr]">
        <div className="relative overflow-hidden bg-slate-950 p-8 text-white md:p-10">
          <div className="absolute -right-20 -top-20 h-72 w-72 rounded-full bg-orange-500/30 blur-3xl" />
          <div className="absolute -bottom-24 left-12 h-64 w-64 rounded-full bg-rose-500/20 blur-3xl" />
          <div className="relative">
            <Link className="inline-flex items-center gap-2 text-sm font-semibold text-slate-300 hover:text-white" to="/">
              <ArrowLeft className="h-4 w-4" /> Back to HR Tools
            </Link>
            <div className="mt-8 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-semibold text-orange-100">
              <ShieldCheck className="h-4 w-4" /> Authorized Access Only
            </div>
            <h1 className="mt-5 text-4xl font-semibold">Work Related Injury / Accident</h1>
            <p className="mt-4 max-w-md text-sm leading-6 text-slate-300">
              This workspace uses the same secure access permissions as Training Tools.
            </p>
          </div>
        </div>
        <div className="p-6 md:p-10">
          <h2 className="text-2xl font-semibold text-slate-950">Sign in</h2>
          <p className="mt-1 text-sm text-slate-500">Request a one-time code using an authorized email address.</p>
          <form className="mt-6 space-y-4" onSubmit={codeSent ? verifyCode : requestCode}>
            <label className="block">
              <span className="text-sm font-semibold text-slate-700">Authorized email</span>
              <span className="relative mt-2 block">
                <Mail className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                <input autoComplete="email" className="w-full rounded-lg border border-slate-200 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100" onChange={(event) => setEmail(event.target.value)} placeholder="name@royaltrailersales.com" type="email" value={email} />
              </span>
            </label>
            {codeSent ? (
              <label className="block">
                <span className="text-sm font-semibold text-slate-700">6-digit code</span>
                <input autoComplete="one-time-code" autoFocus className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-center text-xl font-semibold tracking-[0.35em] outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100" inputMode="numeric" maxLength={6} onChange={(event) => setCode(event.target.value.replace(/\D/g, ''))} placeholder="000000" value={code} />
              </label>
            ) : null}
            <button className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-orange-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-orange-800 disabled:cursor-not-allowed disabled:opacity-50" disabled={busy || (codeSent ? code.length !== 6 : !email.trim())} type="submit">
              <KeyRound className="h-4 w-4" />
              {codeSent ? (busy ? 'Signing in...' : 'Sign in with code') : (busy ? 'Sending...' : 'Email me a code')}
            </button>
            {codeSent ? <button className="w-full text-sm font-semibold text-orange-700 hover:text-orange-800 disabled:opacity-50" disabled={busy} onClick={requestCode} type="button">Send a new code</button> : null}
          </form>
          {message ? <p className="mt-4 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">{message}</p> : null}
        </div>
      </div>
    </section>
  )
}

function InjuryWorkspace({ onLogout }: { onLogout: () => void }) {
  async function logout() {
    await api.post('/training-auth/logout').catch(() => {})
    onLogout()
  }

  const areas = [
    { icon: ClipboardList, title: 'Incident Intake', description: 'Employee, incident date, location, and incident details.' },
    { icon: Stethoscope, title: 'Medical & Claim Follow-up', description: 'Medical treatment, restrictions, claim activity, and follow-up records.' },
    { icon: HeartPulse, title: 'Return-to-Work', description: 'Work restrictions, transitional duty, and return-to-work tracking.' },
    { icon: FileClock, title: 'Reports & History', description: 'Maintain a clear record of open and historical injury or accident cases.' },
  ]

  return (
    <div className="space-y-6 pb-10">
      <section className="relative overflow-hidden rounded-2xl border border-white/70 bg-slate-950 px-6 py-7 text-white shadow-xl md:px-8">
        <div className="absolute -right-16 -top-20 h-64 w-64 rounded-full bg-orange-500/30 blur-3xl" />
        <div className="absolute -bottom-24 left-24 h-56 w-56 rounded-full bg-rose-500/20 blur-3xl" />
        <div className="relative">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-4">
              <Link className="inline-flex items-center gap-2 text-sm font-semibold text-slate-300 hover:text-white" to="/"><ArrowLeft className="h-4 w-4" />Back to HR Tools</Link>
              <Link className="text-sm font-semibold text-orange-200 hover:text-white" to="/training">Training Tools</Link>
            </div>
            <button className="inline-flex items-center gap-2 text-sm font-semibold text-slate-300 hover:text-white" onClick={logout} type="button"><LogOut className="h-4 w-4" />Sign out</button>
          </div>
          <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-semibold text-orange-100"><HardHat className="h-4 w-4" />Safety & Injury</div>
          <h1 className="mt-4 text-4xl font-semibold md:text-5xl">Work Related Injury / Accident</h1>
          <p className="mt-3 max-w-2xl text-base leading-7 text-slate-300">A secure workspace for documenting and following work-related injuries and accidents.</p>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        {areas.map(({ icon: Icon, title, description }) => (
          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm" key={title}>
            <div className="grid h-11 w-11 place-items-center rounded-xl bg-orange-100 text-orange-800"><Icon className="h-5 w-5" /></div>
            <h2 className="mt-4 text-lg font-semibold text-slate-950">{title}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
          </article>
        ))}
      </section>

      <section className="rounded-2xl border border-orange-200 bg-orange-50 p-5 text-sm leading-6 text-orange-950">
        The secure module and navigation are now available. The detailed injury and accident workflow can be configured in the next step without changing its access permissions.
      </section>
    </div>
  )
}

export default function WorkRelatedInjury() {
  const [authState, setAuthState] = useState<'checking' | 'authenticated' | 'signed-out'>('checking')

  useEffect(() => {
    api.get('/training-auth/me').then(() => setAuthState('authenticated')).catch(() => setAuthState('signed-out'))
  }, [])

  if (authState === 'checking') {
    return <div className="grid min-h-64 place-items-center rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="text-center"><RefreshCw className="mx-auto h-7 w-7 animate-spin text-orange-600" /><p className="mt-3 text-sm font-semibold text-slate-700">Checking secure access...</p></div></div>
  }
  if (authState === 'signed-out') return <InjuryLogin onLogin={() => setAuthState('authenticated')} />
  return <InjuryWorkspace onLogout={() => setAuthState('signed-out')} />
}
