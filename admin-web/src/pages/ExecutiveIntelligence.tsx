import { useEffect, useState } from 'react'
import { ArrowLeft, Bot, Building2, KeyRound, LockKeyhole, LogOut, Mail, MessageSquareText, RefreshCw, Search, Send, ShieldCheck, Sparkles, UserRoundCheck, X, type LucideIcon } from 'lucide-react'
import { Link } from 'react-router-dom'
import { api } from '../shared/api'

type Overview = {
  email: string
  generatedAt: string
  headcount: number
  locations: Array<{ location: string; count: number }>
  employees: Array<{ id: string; name: string; jobTitle: string; department: string; location: string; status: string }>
  currentMonth: string
  currentMonthNewHires: Array<{ id: string; name: string; hireDate: string; jobTitle: string; department: string; location: string; employeeStatus: string; onboardingStatus: 'Completed' | 'Final Review Needed' | 'In Progress' }>
  openLeaveCases: number
  openInjuryCases: number
  unfinishedEmploymentChanges: number
  smartAiEnabled: boolean
}

type AssistantResponse = {
  answer: string
  details: string[]
  sources: string[]
  dataAsOf: string
  assistantMode?: 'smart-ai' | 'guided-fallback'
}

function ExecutiveLogin({ onLogin }: { onLogin: () => void }) {
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [codeSent, setCodeSent] = useState(false)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setBusy(true)
    try {
      if (!codeSent) {
        await api.post('/executive-auth/request-code', { email: email.trim() })
        setCodeSent(true)
        setMessage('A 6-digit executive access code was sent to your company email.')
      } else {
        await api.post('/executive-auth/verify-code', { email: email.trim(), code: code.trim() })
        onLogin()
      }
    } catch (error: any) {
      setMessage(error.response?.data?.error || 'Secure executive access could not be completed.')
    } finally { setBusy(false) }
  }

  return <div className="mx-auto max-w-5xl overflow-hidden rounded-3xl border border-white/80 bg-white shadow-2xl">
    <div className="grid lg:grid-cols-[1.08fr_0.92fr]">
      <section className="relative overflow-hidden bg-gradient-to-br from-slate-950 via-indigo-950 to-blue-950 p-9 text-white md:p-12">
        <div className="absolute -right-20 -top-20 h-72 w-72 rounded-full bg-cyan-400/20 blur-3xl" />
        <div className="relative"><Link className="inline-flex items-center gap-2 text-sm font-semibold text-blue-200 hover:text-white" to="/"><ArrowLeft className="h-4 w-4" />Back to Integrated Platform</Link>
          <div className="mt-10 inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1.5 text-xs font-black uppercase tracking-[0.14em] text-cyan-100"><ShieldCheck className="h-4 w-4" />C-Suite Restricted</div>
          <Sparkles className="mt-8 h-12 w-12 text-cyan-300" /><h1 className="mt-5 text-4xl font-black leading-tight">Executive Intelligence Platform</h1>
          <p className="mt-4 max-w-xl text-sm leading-7 text-slate-300">Ask governed, read-only questions across Royal’s connected workforce data. Every response identifies its sources and is recorded in the executive audit log.</p>
        </div>
      </section>
      <section className="p-8 md:p-12"><LockKeyhole className="h-9 w-9 text-indigo-700" /><h2 className="mt-5 text-2xl font-black text-slate-950">Executive access</h2><p className="mt-2 text-sm leading-6 text-slate-500">Use an approved C-Suite company email. The one-time code expires after 10 minutes.</p>
        <form className="mt-7 space-y-4" onSubmit={submit}><label className="block text-sm font-bold text-slate-700">Company email<span className="relative mt-2 block"><Mail className="absolute left-3 top-3 h-4 w-4 text-slate-400" /><input className="w-full rounded-xl border border-slate-200 py-2.5 pl-9 pr-3 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100" onChange={event => setEmail(event.target.value)} placeholder="name@royaltrailersales.com" type="email" value={email} /></span></label>
          {codeSent && <label className="block text-sm font-bold text-slate-700">6-digit code<input autoFocus className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-center text-xl font-bold tracking-[0.35em] outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100" inputMode="numeric" maxLength={6} onChange={event => setCode(event.target.value.replace(/\D/g, ''))} value={code} /></label>}
          <button className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-700 px-4 py-3 text-sm font-bold text-white hover:bg-indigo-800 disabled:opacity-50" disabled={busy || !email.trim() || (codeSent && code.length !== 6)} type="submit"><KeyRound className="h-4 w-4" />{busy ? 'Please wait...' : codeSent ? 'Enter Executive Platform' : 'Email me a code'}</button>
        </form>{message && <p className="mt-4 rounded-xl bg-slate-50 p-3 text-sm font-semibold text-slate-700">{message}</p>}
      </section>
    </div>
  </div>
}

const examples = [
  'What is Cherie Lynch’s current pay rate and last payroll change?',
  'How many employees do we currently have?',
  'How many open medical leave cases are there?',
  'How many open injury cases are OSHA recordable?',
]

type OverviewCard = {
  label: string
  value: number
  icon: LucideIcon
  note: string
}

export default function ExecutiveIntelligence() {
  const [authState, setAuthState] = useState<'checking' | 'authenticated' | 'signed-out'>('checking')
  const [overview, setOverview] = useState<Overview | null>(null)
  const [question, setQuestion] = useState('')
  const [response, setResponse] = useState<AssistantResponse | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [showHeadcount, setShowHeadcount] = useState(false)
  const [headcountLocation, setHeadcountLocation] = useState('')
  const [employeeSearch, setEmployeeSearch] = useState('')

  async function loadOverview() {
    const result = await api.get<Overview>('/executive/overview')
    setOverview(result.data)
  }

  useEffect(() => {
    api.get('/executive-auth/me').then(async () => { setAuthState('authenticated'); await loadOverview() }).catch(() => setAuthState('signed-out'))
  }, [])

  async function ask(event?: React.FormEvent) {
    event?.preventDefault()
    if (!question.trim()) return
    setBusy(true); setError(''); setResponse(null)
    try {
      const result = await api.post<AssistantResponse>('/executive/ask', { question: question.trim() })
      setResponse(result.data)
    } catch (requestError: any) {
      setError(requestError.response?.data?.error || 'The Executive Data Assistant could not answer this question.')
    } finally { setBusy(false) }
  }

  async function logout() { await api.post('/executive-auth/logout').catch(() => {}); setAuthState('signed-out'); setOverview(null) }

  if (authState === 'checking') return <div className="grid min-h-64 place-items-center rounded-3xl bg-white shadow-sm"><RefreshCw className="h-7 w-7 animate-spin text-indigo-700" /></div>
  if (authState === 'signed-out') return <ExecutiveLogin onLogin={() => { setAuthState('authenticated'); void loadOverview() }} />

  const filteredEmployees = (overview?.employees || []).filter(employee => {
    const query = employeeSearch.trim().toLowerCase()
    const locationMatches = !headcountLocation || employee.location === headcountLocation
    const searchMatches = !query || [employee.name, employee.jobTitle, employee.department, employee.location, employee.status].some(value => value.toLowerCase().includes(query))
    return locationMatches && searchMatches
  })

  function openHeadcount(location = '') {
    setHeadcountLocation(location)
    setEmployeeSearch('')
    setShowHeadcount(true)
  }

  return <div className="space-y-7">
    <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-indigo-950 to-blue-950 px-7 py-8 text-white shadow-xl"><div className="absolute -right-12 -top-20 h-72 w-72 rounded-full bg-cyan-400/20 blur-3xl" /><div className="relative flex flex-wrap items-start justify-between gap-5"><div><Link className="inline-flex items-center gap-2 text-sm font-semibold text-blue-200 hover:text-white" to="/"><ArrowLeft className="h-4 w-4" />Back to Integrated Platform</Link><p className="mt-7 text-xs font-black uppercase tracking-[0.18em] text-cyan-200">C-Suite Restricted Workspace</p><h1 className="mt-2 text-4xl font-black">Executive Intelligence Platform</h1><p className="mt-3 max-w-3xl text-sm leading-7 text-slate-300">Read-only workforce intelligence with source-backed answers and a complete query audit trail.</p></div><button className="inline-flex items-center gap-2 text-sm font-bold text-slate-300 hover:text-white" onClick={logout} type="button"><LogOut className="h-4 w-4" />Sign out</button></div></section>

    <section className="overflow-hidden rounded-3xl border border-indigo-200 bg-white shadow-xl"><div className="bg-gradient-to-r from-indigo-950 to-blue-900 px-6 py-6 text-white"><div className="flex items-center gap-3"><div className="grid h-12 w-12 place-items-center rounded-2xl bg-cyan-300/15"><Bot className="h-7 w-7 text-cyan-200" /></div><div><p className="text-xs font-black uppercase tracking-[0.15em] text-cyan-200">Read-only assistant</p><h2 className="mt-1 text-2xl font-black">Ask Royal’s workforce data</h2></div></div><p className="mt-3 max-w-3xl text-sm leading-6 text-indigo-100">The assistant never changes employee records. If historical data is missing, it will say so instead of estimating or guessing.</p></div>
      <div className="p-6"><div className={`mb-4 inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-black ${overview?.smartAiEnabled ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-900'}`}><span className={`h-2 w-2 rounded-full ${overview?.smartAiEnabled ? 'bg-emerald-500' : 'bg-amber-500'}`} />{overview?.smartAiEnabled ? 'Smart AI Active' : 'Guided Assistant Active — Smart AI ready for secure key'}</div><form className="flex flex-col gap-3 md:flex-row" onSubmit={ask}><label className="sr-only" htmlFor="executive-question">Executive question</label><input className="min-w-0 flex-1 rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100" id="executive-question" maxLength={500} onChange={event => setQuestion(event.target.value)} placeholder="Ask about employees, locations, departments, headcount, leave, injury, or payroll history..." value={question} /><button className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-700 px-5 py-3 text-sm font-black text-white hover:bg-indigo-800 disabled:opacity-50" disabled={busy || !question.trim()} type="submit"><Send className="h-4 w-4" />{busy ? 'Reviewing data...' : 'Ask'}</button></form>
        <div className="mt-4 flex flex-wrap gap-2">{examples.map(example => <button className="rounded-full border border-indigo-100 bg-indigo-50 px-3 py-1.5 text-left text-xs font-bold text-indigo-800 hover:bg-indigo-100" key={example} onClick={() => setQuestion(example)} type="button">{example}</button>)}</div>
        {error && <p className="mt-5 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-800">{error}</p>}
        {response && <article className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-5"><p className="text-lg font-black text-slate-950">{response.answer}</p>{response.details?.length > 0 && <div className="mt-4 grid gap-2 md:grid-cols-2">{response.details.map(detail => <p className="rounded-xl bg-white px-4 py-3 text-sm font-semibold text-slate-700" key={detail}>{detail}</p>)}</div>}<div className="mt-5 border-t border-slate-200 pt-4"><p className="text-xs font-black uppercase tracking-wide text-slate-500">Data sources</p><div className="mt-2 flex flex-wrap gap-2">{response.sources.length ? response.sources.map(source => <span className="rounded-full bg-indigo-100 px-3 py-1 text-xs font-bold text-indigo-900" key={source}>{source}</span>) : <span className="text-xs text-slate-500">No record source matched.</span>}</div><p className="mt-3 text-xs text-slate-500">Data reviewed {new Date(response.dataAsOf).toLocaleString()}</p></div></article>}
      </div>
    </section>

    {overview && <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-lg"><div className="grid lg:grid-cols-[0.34fr_0.66fr]"><button className="group bg-gradient-to-br from-cyan-50 to-blue-50 p-7 text-left transition hover:from-cyan-100 hover:to-blue-100 focus:outline-none focus:ring-4 focus:ring-inset focus:ring-indigo-200" onClick={() => openHeadcount()} type="button"><div className="flex items-center justify-between"><p className="text-xs font-black uppercase tracking-[0.14em] text-indigo-700">Current workforce</p><UserRoundCheck className="h-7 w-7 text-indigo-700" /></div><p className="mt-5 text-6xl font-black tracking-tight text-slate-950 underline decoration-indigo-300 decoration-2 underline-offset-8 group-hover:decoration-indigo-700">{overview.headcount}</p><p className="mt-3 text-sm font-bold text-slate-600">Current Company Headcount</p><p className="mt-1 text-xs leading-5 text-slate-500">Click the number to view employees. Active and leave-status employees are included; terminated employees are excluded.</p></button><div className="p-7"><div className="flex items-center gap-2"><Building2 className="h-5 w-5 text-indigo-700" /><h2 className="text-xl font-black text-slate-950">Headcount by Location</h2></div><div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{overview.locations.map(row => <button className="group flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 text-left transition hover:border-indigo-200 hover:bg-indigo-50 focus:outline-none focus:ring-2 focus:ring-indigo-200" key={row.location} onClick={() => openHeadcount(row.location)} type="button"><span className="text-sm font-bold text-slate-700">{row.location}</span><span className="rounded-full bg-indigo-950 px-2.5 py-1 text-xs font-black text-white group-hover:bg-indigo-700">{row.count}</span></button>)}</div><p className="mt-3 text-xs font-semibold text-slate-500">Click any location count to view its employees.</p></div></div></section>}

    {overview && <section className="overflow-hidden rounded-3xl border border-emerald-200 bg-white shadow-lg"><header className="flex flex-wrap items-center justify-between gap-4 border-b border-emerald-100 bg-gradient-to-r from-emerald-50 to-cyan-50 px-6 py-5"><div><p className="text-xs font-black uppercase tracking-[0.14em] text-emerald-700">Current month workforce activity</p><h2 className="mt-1 text-xl font-black text-slate-950">This Month’s New Hires</h2><p className="mt-1 text-sm text-slate-600">All employees with a Hire Date in {new Date(`${overview.currentMonth}-01T12:00:00`).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}, including completed and in-progress onboarding.</p></div><span className="rounded-full bg-emerald-700 px-4 py-2 text-sm font-black text-white">{overview.currentMonthNewHires.length} New Hire{overview.currentMonthNewHires.length === 1 ? '' : 's'}</span></header>{overview.currentMonthNewHires.length ? <div className="overflow-x-auto"><table className="w-full min-w-[980px] text-left text-sm"><thead className="bg-slate-900 text-xs uppercase tracking-wide text-white"><tr>{['Employee Name', 'Hire Date', 'Job Title', 'Home Department', 'Location', 'Company Status', 'Onboarding Status'].map(label => <th className="px-4 py-3" key={label}>{label}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{overview.currentMonthNewHires.map(employee => <tr className="hover:bg-emerald-50/50" key={employee.id}><td className="px-4 py-3 font-bold text-slate-950">{employee.name}</td><td className="whitespace-nowrap px-4 py-3 text-slate-700">{new Date(`${employee.hireDate}T12:00:00`).toLocaleDateString('en-US')}</td><td className="px-4 py-3 text-slate-700">{employee.jobTitle}</td><td className="px-4 py-3 text-slate-700">{employee.department}</td><td className="px-4 py-3 text-slate-700">{employee.location}</td><td className="px-4 py-3 text-slate-700">{employee.employeeStatus}</td><td className="px-4 py-3"><span className={`whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-black ${employee.onboardingStatus === 'Completed' ? 'bg-emerald-100 text-emerald-800' : employee.onboardingStatus === 'Final Review Needed' ? 'bg-amber-100 text-amber-900' : 'bg-blue-100 text-blue-800'}`}>{employee.onboardingStatus}</span></td></tr>)}</tbody></table></div> : <p className="px-6 py-8 text-center text-sm font-semibold text-slate-500">No employees have a Hire Date in this month.</p>}</section>}

    {overview && <section className="grid gap-4 sm:grid-cols-3">{([
      { label: 'Open Leave Cases', value: overview.openLeaveCases, icon: Building2, note: 'FMLA / ADA / Medical Leave' },
      { label: 'Open Injury Cases', value: overview.openInjuryCases, icon: ShieldCheck, note: 'Cases awaiting closure' },
      { label: 'Employment Changes', value: overview.unfinishedEmploymentChanges, icon: MessageSquareText, note: 'Records with unfinished tasks' },
    ] satisfies OverviewCard[]).map(({ label, value, icon: Icon, note }) => <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm" key={label}><div className="flex items-center justify-between"><p className="text-xs font-black uppercase tracking-wide text-slate-500">{label}</p><Icon className="h-5 w-5 text-indigo-600" /></div><p className="mt-3 text-3xl font-black text-slate-950">{value}</p><p className="mt-1 text-xs font-semibold text-slate-500">{note}</p></article>)}</section>}

    {showHeadcount && overview && <div aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm" role="dialog"><section className="flex max-h-[90vh] w-full max-w-6xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl"><header className="flex items-start justify-between gap-5 border-b border-slate-200 px-6 py-5"><div><p className="text-xs font-black uppercase tracking-[0.14em] text-indigo-700">{headcountLocation || 'Current workforce'}</p><h2 className="mt-1 text-2xl font-black text-slate-950">{headcountLocation ? `${headcountLocation} Employee Details` : 'Employee Headcount Details'}</h2><p className="mt-1 text-sm text-slate-500">{headcountLocation ? `${overview.employees.filter(employee => employee.location === headcountLocation).length} employees at this location` : `${overview.headcount} active or leave-status employees`}</p></div><button aria-label="Close employee headcount details" className="rounded-full p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-950" onClick={() => setShowHeadcount(false)} type="button"><X className="h-6 w-6" /></button></header><div className="border-b border-slate-200 bg-slate-50 px-6 py-4"><label className="relative block"><Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" /><input autoFocus className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm font-semibold outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100" onChange={event => setEmployeeSearch(event.target.value)} placeholder="Search employee, job title, department, location, or status..." value={employeeSearch} /></label></div><div className="overflow-auto"><table className="w-full min-w-[850px] text-left text-sm"><thead className="sticky top-0 bg-slate-900 text-xs uppercase tracking-wide text-white"><tr>{['Employee Name', 'Job Title', 'Home Department', 'Location', 'Status'].map(label => <th className="px-4 py-3" key={label}>{label}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{filteredEmployees.map(employee => <tr className="hover:bg-indigo-50/50" key={employee.id}><td className="px-4 py-3 font-bold text-slate-950">{employee.name}</td><td className="px-4 py-3 text-slate-700">{employee.jobTitle}</td><td className="px-4 py-3 text-slate-700">{employee.department}</td><td className="px-4 py-3 text-slate-700">{employee.location}</td><td className="px-4 py-3"><span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-800">{employee.status}</span></td></tr>)}</tbody></table>{!filteredEmployees.length && <p className="p-8 text-center text-sm font-semibold text-slate-500">No employees match this search.</p>}</div><footer className="flex items-center justify-between border-t border-slate-200 bg-white px-6 py-4"><p className="text-sm font-bold text-slate-600">Showing {filteredEmployees.length}{headcountLocation ? ` employees in ${headcountLocation}` : ` of ${overview.headcount} employees`}</p><button className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white hover:bg-slate-800" onClick={() => setShowHeadcount(false)} type="button">Close</button></footer></section></div>}
  </div>
}
