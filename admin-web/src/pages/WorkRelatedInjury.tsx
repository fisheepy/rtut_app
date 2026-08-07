import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, ArrowLeft, CheckCircle2, ClipboardEdit, HardHat, KeyRound, LogOut, Mail, Plus, RefreshCw, Search, ShieldCheck, XCircle } from 'lucide-react'
import { api } from '../shared/api'

type Employee = {
  id: string
  employeeName: string
  hireDate: string
  department: string
  location: string
  reportingTo: string
  jobTitle: string
  contactNumber: string
  email: string
  employmentStatus: string
}

type InjuryCase = {
  id: string
  employeeId: string
  employeeName: string
  hireDate: string
  department: string
  location: string
  supervisor: string
  jobTitle: string
  employeePhone: string
  employeeEmail: string
  injuryDateTime: string
  firstNoticeDate: string
  injuryDescription: string
  injuryLocation: string
  safetyViolation: 'Yes' | 'No'
  employeeStatus: string
  injuredBodyPart: string
  oshaRecordable: 'Yes' | 'No'
  followUpIssues: string
  followUpDate: string
}

type CaseForm = Pick<InjuryCase, 'employeeId' | 'injuryDateTime' | 'firstNoticeDate' | 'injuryDescription' | 'injuryLocation' | 'safetyViolation' | 'employeeStatus' | 'injuredBodyPart' | 'oshaRecordable' | 'followUpIssues' | 'followUpDate'>

const emptyForm: CaseForm = {
  employeeId: '', injuryDateTime: '', firstNoticeDate: '', injuryDescription: '', injuryLocation: '',
  safetyViolation: 'No', employeeStatus: 'Active', injuredBodyPart: '', oshaRecordable: 'No',
  followUpIssues: '', followUpDate: '',
}

function displayDate(value: string, withTime = false) {
  if (!value) return '—'
  const date = new Date(withTime ? value : `${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString('en-US', withTime ? { dateStyle: 'medium', timeStyle: 'short' } : { dateStyle: 'medium' })
}

function InjuryLogin({ onLogin }: { onLogin: () => void }) {
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [codeSent, setCodeSent] = useState(false)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  async function requestCode(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setMessage('Sending your one-time code...')
    try { await api.post('/training-auth/request-code', { email: email.trim() }); setCodeSent(true); setMessage('A 6-digit code was sent to your email. It expires in 10 minutes.') }
    catch (error: any) { setMessage(error.response?.data?.error || 'The login code could not be sent.') }
    finally { setBusy(false) }
  }

  async function verifyCode(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setMessage('Verifying your code...')
    try { await api.post('/training-auth/verify-code', { email: email.trim(), code: code.trim() }); onLogin() }
    catch (error: any) { setMessage(error.response?.data?.error || 'Invalid or expired login code.') }
    finally { setBusy(false) }
  }

  return <section className="overflow-hidden rounded-2xl border border-white/70 bg-white shadow-2xl"><div className="grid lg:grid-cols-[0.9fr_1.1fr]">
    <div className="relative overflow-hidden bg-slate-950 p-8 text-white md:p-10"><div className="absolute -right-20 -top-20 h-72 w-72 rounded-full bg-orange-500/30 blur-3xl" /><div className="relative">
      <Link className="inline-flex items-center gap-2 text-sm font-semibold text-slate-300 hover:text-white" to="/"><ArrowLeft className="h-4 w-4" />Back to HR &amp; Safety Platform</Link>
      <div className="mt-8 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-semibold text-orange-100"><ShieldCheck className="h-4 w-4" />Authorized Access Only</div>
      <h1 className="mt-5 text-4xl font-semibold">Work Related Injury / Accident</h1><p className="mt-4 text-sm leading-6 text-slate-300">This workspace uses the same secure access permissions as Training Tools.</p>
    </div></div>
    <div className="p-6 md:p-10"><h2 className="text-2xl font-semibold">Sign in</h2><p className="mt-1 text-sm text-slate-500">Request a one-time code using an authorized email address.</p>
      <form className="mt-6 space-y-4" onSubmit={codeSent ? verifyCode : requestCode}><label className="block"><span className="text-sm font-semibold text-slate-700">Authorized email</span><span className="relative mt-2 block"><Mail className="absolute left-3 top-3 h-4 w-4 text-slate-400" /><input className="w-full rounded-lg border border-slate-200 py-2.5 pl-9 pr-3 text-sm" onChange={event => setEmail(event.target.value)} placeholder="name@royaltrailersales.com" type="email" value={email} /></span></label>
        {codeSent ? <label className="block"><span className="text-sm font-semibold text-slate-700">6-digit code</span><input className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-center text-xl font-semibold tracking-[0.35em]" maxLength={6} onChange={event => setCode(event.target.value.replace(/\D/g, ''))} value={code} /></label> : null}
        <button className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-orange-700 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50" disabled={busy || (codeSent ? code.length !== 6 : !email.trim())} type="submit"><KeyRound className="h-4 w-4" />{codeSent ? 'Sign in with code' : 'Email me a code'}</button>
      </form>{message ? <p className="mt-4 rounded-lg bg-slate-50 px-3 py-2 text-sm">{message}</p> : null}
    </div>
  </div></section>
}

function CaseEditor({ employees, existing, onCancel, onSaved }: { employees: Employee[]; existing: InjuryCase | null; onCancel: () => void; onSaved: () => void }) {
  const [form, setForm] = useState<CaseForm>(existing ? {
    employeeId: existing.employeeId, injuryDateTime: existing.injuryDateTime, firstNoticeDate: existing.firstNoticeDate,
    injuryDescription: existing.injuryDescription, injuryLocation: existing.injuryLocation, safetyViolation: existing.safetyViolation,
    employeeStatus: existing.employeeStatus, injuredBodyPart: existing.injuredBodyPart, oshaRecordable: existing.oshaRecordable,
    followUpIssues: existing.followUpIssues || '', followUpDate: existing.followUpDate || '',
  } : emptyForm)
  const [search, setSearch] = useState(existing?.employeeName || '')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const employee = employees.find(item => item.id === form.employeeId)
  const matches = useMemo(() => search.trim() && !form.employeeId ? employees.filter(item => item.employeeName.toLowerCase().includes(search.toLowerCase())).slice(0, 8) : [], [employees, form.employeeId, search])
  const set = (key: keyof CaseForm, value: string) => setForm(current => ({ ...current, [key]: value }))

  async function save(event: React.FormEvent) {
    event.preventDefault(); setSaving(true); setError('')
    try {
      if (existing) await api.put(`/work-injury/cases/${existing.id}`, form)
      else await api.post('/work-injury/cases', form)
      onSaved()
    } catch (requestError: any) { setError(requestError.response?.data?.error || 'The work injury case could not be saved.') }
    finally { setSaving(false) }
  }

  const rosterFields = employee ? [
    ['Hire Date', displayDate(employee.hireDate)], ['Department', employee.department], ['Location', employee.location],
    ['Supervisor', employee.reportingTo], ['Job Title', employee.jobTitle], ['Employee Phone', employee.contactNumber], ['Employee Email', employee.email],
  ] : []

  return <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-6 py-5"><div><p className="text-xs font-bold uppercase tracking-wider text-orange-700">Work Injury</p><h2 className="mt-1 text-2xl font-semibold">{existing ? 'Edit Injury Case' : 'New Injury Case'}</h2></div><button className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold" onClick={onCancel} type="button"><ArrowLeft className="h-4 w-4" />Back to cases</button></div>
    <form className="space-y-6 p-6" onSubmit={save}>
      <div><label className="text-sm font-semibold text-slate-700">Employee Name *</label><div className="relative mt-2"><Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" /><input className="w-full rounded-lg border border-slate-300 py-2.5 pl-9 pr-3" disabled={Boolean(existing)} onChange={event => { setSearch(event.target.value); set('employeeId', '') }} placeholder="Search active or leave employee" value={search} />
        {matches.length ? <div className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-lg border border-slate-200 bg-white p-1 shadow-xl">{matches.map(item => <button className="block w-full rounded-md px-3 py-2 text-left text-sm hover:bg-orange-50" key={item.id} onClick={() => { set('employeeId', item.id); set('employeeStatus', item.employmentStatus || 'Active'); setSearch(item.employeeName) }} type="button"><span className="font-semibold">{item.employeeName}</span><span className="ml-2 text-slate-500">{item.jobTitle} · {item.location}</span></button>)}</div> : null}
      </div></div>
      {employee ? <div className="grid gap-3 rounded-xl border border-blue-100 bg-blue-50 p-4 sm:grid-cols-2 lg:grid-cols-4">{rosterFields.map(([label, value]) => <div key={label}><div className="text-xs font-bold uppercase tracking-wide text-blue-700">{label}</div><div className="mt-1 text-sm font-semibold text-slate-800">{value || 'Not available'}</div></div>)}</div> : null}
      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        <Field label="Injury Date and Time *"><input className="control" onChange={event => set('injuryDateTime', event.target.value)} required type="datetime-local" value={form.injuryDateTime} /></Field>
        <Field label="First Notice Date *"><input className="control" onChange={event => set('firstNoticeDate', event.target.value)} required type="date" value={form.firstNoticeDate} /></Field>
        <Field label="Injury Location *"><input className="control" onChange={event => set('injuryLocation', event.target.value)} required value={form.injuryLocation} /></Field>
        <Field label="Injured Body Part *"><input className="control" onChange={event => set('injuredBodyPart', event.target.value)} placeholder="Example: Left hand" required value={form.injuredBodyPart} /></Field>
        <Field label="Employee Status *"><select className="control" onChange={event => set('employeeStatus', event.target.value)} required value={form.employeeStatus}><option>Active</option><option>Leave</option><option>Terminated</option></select></Field>
        <Field label="Any Safety Violation? *"><select className="control" onChange={event => set('safetyViolation', event.target.value)} value={form.safetyViolation}><option>No</option><option>Yes</option></select></Field>
        <Field label="OSHA Recordable? *"><select className="control" onChange={event => set('oshaRecordable', event.target.value)} value={form.oshaRecordable}><option>No</option><option>Yes</option></select></Field>
        <Field label="Follow-up Date"><input className="control" onChange={event => set('followUpDate', event.target.value)} required={Boolean(form.followUpIssues.trim())} type="date" value={form.followUpDate} /></Field>
      </div>
      <Field label="Injury Description *"><textarea className="control min-h-28" onChange={event => set('injuryDescription', event.target.value)} required value={form.injuryDescription} /></Field>
      <Field label="Follow-up Issues"><textarea className="control min-h-24" onChange={event => set('followUpIssues', event.target.value)} placeholder="Enter any open issues or required follow-up" value={form.followUpIssues} /></Field>
      {error ? <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</p> : null}
      <div className="flex justify-end gap-3"><button className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold" onClick={onCancel} type="button">Cancel</button><button className="rounded-lg bg-orange-700 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50" disabled={saving || !form.employeeId} type="submit">{saving ? 'Saving...' : existing ? 'Save Changes' : 'Create Case'}</button></div>
    </form>
  </section>
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block"><span className="text-sm font-semibold text-slate-700">{label}</span><span className="mt-2 block">{children}</span></label> }

function InjuryWorkspace({ onLogout }: { onLogout: () => void }) {
  const [tab, setTab] = useState<'injury' | 'accident'>('injury')
  const [view, setView] = useState<'dashboard' | 'new' | 'edit'>('dashboard')
  const [employees, setEmployees] = useState<Employee[]>([])
  const [cases, setCases] = useState<InjuryCase[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const selected = cases.find(item => item.id === selectedId) || null

  async function load() {
    setLoading(true); setError('')
    try {
      const [employeeResponse, caseResponse] = await Promise.all([api.get('/training/employees'), api.get('/work-injury/cases')])
      setEmployees(employeeResponse.data.employees.filter((employee: Employee) => employee.employmentStatus !== 'Terminated'))
      setCases(caseResponse.data.cases || [])
    } catch (requestError: any) { setError(requestError.response?.data?.error || 'The injury workspace could not be loaded.') }
    finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  async function logout() { await api.post('/training-auth/logout').catch(() => {}); onLogout() }
  async function closeCase() {
    if (!selected || !window.confirm(`Close the work injury case for ${selected.employeeName}? The case will be removed from the current-case summary.`)) return
    try { await api.post(`/work-injury/cases/${selected.id}/close`); setSelectedId(''); await load() }
    catch (requestError: any) { setError(requestError.response?.data?.error || 'The case could not be closed.') }
  }

  if (view !== 'dashboard') return <div className="space-y-6 pb-10"><CaseEditor employees={employees} existing={view === 'edit' ? selected : null} onCancel={() => setView('dashboard')} onSaved={async () => { setView('dashboard'); setSelectedId(''); await load() }} /></div>

  return <div className="space-y-6 pb-10">
    <section className="relative overflow-hidden rounded-2xl bg-slate-950 px-6 py-7 text-white shadow-xl md:px-8"><div className="absolute -right-16 -top-20 h-64 w-64 rounded-full bg-orange-500/30 blur-3xl" /><div className="relative">
      <div className="flex flex-wrap items-center justify-between gap-3"><div className="flex gap-4"><Link className="inline-flex items-center gap-2 text-sm font-semibold text-slate-300 hover:text-white" to="/"><ArrowLeft className="h-4 w-4" />HR &amp; Safety Platform</Link><Link className="text-sm font-semibold text-orange-200 hover:text-white" to="/training">Training Tools</Link></div><button className="inline-flex items-center gap-2 text-sm font-semibold text-slate-300" onClick={logout}><LogOut className="h-4 w-4" />Sign out</button></div>
      <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-semibold text-orange-100"><HardHat className="h-4 w-4" />Safety Case Management</div><h1 className="mt-4 text-4xl font-semibold md:text-5xl">Work Related Injury / Accident</h1>
    </div></section>
    <div className="flex rounded-xl border border-slate-200 bg-white p-1 shadow-sm"><button className={`flex-1 rounded-lg px-4 py-3 text-sm font-bold ${tab === 'injury' ? 'bg-orange-700 text-white shadow' : 'text-slate-600 hover:bg-slate-50'}`} onClick={() => setTab('injury')}>Work Injury</button><button className={`flex-1 rounded-lg px-4 py-3 text-sm font-bold ${tab === 'accident' ? 'bg-blue-700 text-white shadow' : 'text-slate-600 hover:bg-slate-50'}`} onClick={() => setTab('accident')}>Accident</button></div>
    {tab === 'accident' ? <section className="rounded-2xl border border-blue-200 bg-blue-50 p-10 text-center"><AlertTriangle className="mx-auto h-10 w-10 text-blue-700" /><h2 className="mt-4 text-2xl font-semibold">Accident Case Management</h2><p className="mt-2 text-sm text-slate-600">The Accident workflow is separate and will be configured in the next step.</p></section> : <>
      <section className="grid gap-3 sm:grid-cols-3"><button className="inline-flex items-center justify-center gap-2 rounded-xl bg-orange-700 px-5 py-4 font-bold text-white shadow-sm hover:bg-orange-800" onClick={() => setView('new')}><Plus className="h-5 w-5" />New Case</button><button className="inline-flex items-center justify-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-5 py-4 font-bold text-blue-800 disabled:cursor-not-allowed disabled:opacity-40" disabled={!selected} onClick={() => setView('edit')}><ClipboardEdit className="h-5 w-5" />Edit Case</button><button className="inline-flex items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 px-5 py-4 font-bold text-red-700 disabled:cursor-not-allowed disabled:opacity-40" disabled={!selected} onClick={closeCase}><XCircle className="h-5 w-5" />Close Case</button></section>
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="flex items-center justify-between border-b border-slate-200 px-5 py-4"><div><h2 className="text-xl font-semibold">Current Injury Cases</h2><p className="mt-1 text-sm text-slate-500">Read-only summary. Select a row, then use Edit Case or Close Case above.</p></div><span className="rounded-full bg-orange-100 px-3 py-1 text-sm font-bold text-orange-800">{cases.length} Open</span></div>
        {error ? <p className="m-5 rounded-lg bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</p> : null}
        {loading ? <div className="grid min-h-48 place-items-center"><RefreshCw className="h-7 w-7 animate-spin text-orange-600" /></div> : cases.length === 0 ? <div className="px-6 py-14 text-center"><CheckCircle2 className="mx-auto h-10 w-10 text-emerald-600" /><h3 className="mt-3 text-lg font-semibold">No open injury cases</h3><p className="mt-1 text-sm text-slate-500">Use New Case when a work injury is reported.</p></div> : <div className="overflow-x-auto"><table className="min-w-[1250px] w-full text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr>{['Employee','Injury Date / Time','First Notice','Department / Location','Body Part','OSHA','Safety Violation','Employee Status','Follow-up'].map(label => <th className="px-4 py-3" key={label}>{label}</th>)}</tr></thead><tbody>{cases.map(item => <tr className={`cursor-pointer border-t border-slate-100 ${selectedId === item.id ? 'bg-orange-50 ring-1 ring-inset ring-orange-300' : 'hover:bg-slate-50'}`} key={item.id} onClick={() => setSelectedId(item.id)}><td className="px-4 py-3"><div className="font-bold text-slate-900">{item.employeeName}</div><div className="text-xs text-slate-500">{item.jobTitle}</div></td><td className="px-4 py-3 font-semibold">{displayDate(item.injuryDateTime, true)}</td><td className="px-4 py-3">{displayDate(item.firstNoticeDate)}</td><td className="px-4 py-3"><div>{item.department}</div><div className="text-xs text-slate-500">{item.location}</div></td><td className="px-4 py-3">{item.injuredBodyPart}</td><td className="px-4 py-3">{item.oshaRecordable}</td><td className="px-4 py-3">{item.safetyViolation}</td><td className="px-4 py-3">{item.employeeStatus}</td><td className="max-w-64 px-4 py-3"><div className="truncate">{item.followUpIssues || 'None'}</div><div className="text-xs text-slate-500">{displayDate(item.followUpDate)}</div></td></tr>)}</tbody></table></div>}
      </section>
    </>}
  </div>
}

export default function WorkRelatedInjury() {
  const [authState, setAuthState] = useState<'checking' | 'authenticated' | 'signed-out'>('checking')
  useEffect(() => { api.get('/training-auth/me').then(() => setAuthState('authenticated')).catch(() => setAuthState('signed-out')) }, [])
  if (authState === 'checking') return <div className="grid min-h-64 place-items-center rounded-2xl bg-white"><RefreshCw className="h-7 w-7 animate-spin text-orange-600" /></div>
  if (authState === 'signed-out') return <InjuryLogin onLogin={() => setAuthState('authenticated')} />
  return <InjuryWorkspace onLogout={() => setAuthState('signed-out')} />
}
