import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { AlertTriangle, ArrowLeft, ClipboardEdit, ExternalLink, HardHat, KeyRound, LogOut, Mail, Plus, RefreshCw, Search, ShieldCheck, XCircle } from 'lucide-react'
import { api } from '../shared/api'

type Employee = {
  id: string
  employeeName: string
  firstDay: string
  department: string
  location: string
  reportingTo: string
  jobTitle: string
  contactNumber: string
  email: string
  employmentStatus: string
}

type TimelineEntry = { date: string; description: string; workStatusAfter: string; otherWorkStatusAfter: string; documentationLink: string }
type CostEntry = { invoiceDate: string; description: string; paidBy: 'Workers Compensation' | 'Royal'; amount: number | string; invoiceLink: string }

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
  safetyViolationDetails: string
  investigationStatus: 'Not Started' | 'In Progress' | 'Completed'
  investigationDate: string
  rootCause: string
  correctiveActionRequired: 'Yes' | 'No'
  correctiveActionDetails: string
  correctiveActionTargetDate: string
  workStatus: string
  otherWorkStatus: string
  initialWorkStatus?: string
  initialOtherWorkStatus?: string
  injuredBodyPart: string
  oshaRecordable: 'Yes' | 'No'
  employeeInjuryFolderLink: string
  injuryReportReceived: 'Yes' | 'No'
  injuryReportLink: string
  workersCompClaimed: 'Yes' | 'No'
  workersCompCaseNumber: string
  followUpIssues: string
  timeline: TimelineEntry[]
  costs: CostEntry[]
  closedAt?: string | null
  closedBy?: string | null
}

type CaseForm = Pick<InjuryCase, 'employeeId' | 'injuryDateTime' | 'firstNoticeDate' | 'injuryDescription' | 'injuryLocation' | 'safetyViolation' | 'safetyViolationDetails' | 'investigationStatus' | 'investigationDate' | 'rootCause' | 'correctiveActionRequired' | 'correctiveActionDetails' | 'correctiveActionTargetDate' | 'workStatus' | 'otherWorkStatus' | 'injuredBodyPart' | 'oshaRecordable' | 'employeeInjuryFolderLink' | 'injuryReportReceived' | 'injuryReportLink' | 'workersCompClaimed' | 'workersCompCaseNumber' | 'followUpIssues' | 'timeline' | 'costs'>

const emptyForm: CaseForm = {
  employeeId: '', injuryDateTime: '', firstNoticeDate: '', injuryDescription: '', injuryLocation: '',
  safetyViolation: 'No', safetyViolationDetails: '', workStatus: 'Pending Medical Evaluation', otherWorkStatus: '', injuredBodyPart: '', oshaRecordable: 'No',
  investigationStatus: 'Not Started', investigationDate: '', rootCause: '', correctiveActionRequired: 'No', correctiveActionDetails: '', correctiveActionTargetDate: '',
  employeeInjuryFolderLink: '', injuryReportReceived: 'No', injuryReportLink: '', workersCompClaimed: 'No', workersCompCaseNumber: '',
  followUpIssues: '', timeline: [], costs: [],
}

function displayDate(value: string, withTime = false) {
  if (!value) return '—'
  const date = new Date(withTime ? value : `${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString('en-US', withTime ? { dateStyle: 'medium', timeStyle: 'short' } : { dateStyle: 'medium' })
}

function employmentYears(hireDate: string) {
  if (!hireDate) return null
  const hired = new Date(`${hireDate.slice(0, 10)}T00:00:00`)
  if (Number.isNaN(hired.getTime())) return null
  const today = new Date()
  let years = today.getFullYear() - hired.getFullYear()
  if (today.getMonth() < hired.getMonth() || (today.getMonth() === hired.getMonth() && today.getDate() < hired.getDate())) years -= 1
  return Math.max(0, years)
}

function uniqueCaseValues(cases: InjuryCase[], field: 'location' | 'jobTitle' | 'department') {
  const values = new Map<string, string>()
  cases.forEach(item => {
    const value = item[field]?.trim()
    if (value && !values.has(value.toLowerCase())) values.set(value.toLowerCase(), value)
  })
  return [...values.values()].sort((a, b) => a.localeCompare(b))
}

function MultiSelectFilter({ label, options, selected, onChange }: { label: string; options: string[]; selected: string[]; onChange: (values: string[]) => void }) {
  return <details className="relative"><summary className="control mt-1.5 cursor-pointer list-none pr-8"><span className="block truncate">{selected.length ? `${selected.length} selected` : `All ${label}s`}</span><span className="absolute right-3 top-[2.7rem] text-xs text-slate-400">▼</span></summary><div className="absolute z-30 mt-1 max-h-64 w-full min-w-56 overflow-auto rounded-xl border border-slate-200 bg-white p-2 shadow-xl"><button className="mb-1 w-full rounded-lg px-3 py-2 text-left text-xs font-bold text-blue-700 hover:bg-blue-50" onClick={() => onChange([])} type="button">Select All</button>{options.map(option => <label className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-slate-50" key={option}><input checked={selected.includes(option)} onChange={() => onChange(selected.includes(option) ? selected.filter(value => value !== option) : [...selected, option])} type="checkbox" /><span>{option}</span></label>)}</div></details>
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
    safetyViolationDetails: existing.safetyViolationDetails || '', workStatus: existing.initialWorkStatus || existing.workStatus || 'Pending Medical Evaluation', otherWorkStatus: existing.initialOtherWorkStatus || existing.otherWorkStatus || '', injuredBodyPart: existing.injuredBodyPart, oshaRecordable: existing.oshaRecordable,
    investigationStatus: existing.investigationStatus || 'Not Started', investigationDate: existing.investigationDate || '', rootCause: existing.rootCause || '', correctiveActionRequired: existing.correctiveActionRequired || 'No', correctiveActionDetails: existing.correctiveActionDetails || '', correctiveActionTargetDate: existing.correctiveActionTargetDate || '',
    employeeInjuryFolderLink: existing.employeeInjuryFolderLink || '', injuryReportReceived: existing.injuryReportReceived || 'No', injuryReportLink: existing.injuryReportLink || '', workersCompClaimed: existing.workersCompClaimed || 'No', workersCompCaseNumber: existing.workersCompCaseNumber || '',
    followUpIssues: existing.followUpIssues || '', timeline: existing.timeline || [], costs: existing.costs || [],
  } : emptyForm)
  const [search, setSearch] = useState(existing?.employeeName || '')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const employee = employees.find(item => item.id === form.employeeId)
  const matches = useMemo(() => search.trim() && !form.employeeId ? employees.filter(item => item.employeeName.toLowerCase().includes(search.toLowerCase())).slice(0, 8) : [], [employees, form.employeeId, search])
  const set = (key: keyof CaseForm, value: string) => setForm(current => ({ ...current, [key]: value }))
  const updateTimeline = (index: number, key: keyof TimelineEntry, value: string) => setForm(current => ({ ...current, timeline: current.timeline.map((item, itemIndex) => itemIndex === index ? { ...item, [key]: value } : item) }))
  const updateCost = (index: number, key: keyof CostEntry, value: string) => setForm(current => ({ ...current, costs: current.costs.map((item, itemIndex) => itemIndex === index ? { ...item, [key]: value } : item) }))

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
    ['Hire Date', displayDate(employee.firstDay)], ['Department', employee.department], ['Location', employee.location],
    ['Supervisor', employee.reportingTo], ['Job Title', employee.jobTitle], ['Employee Phone', employee.contactNumber], ['Employee Email', employee.email],
  ] : []

  return <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-6 py-5"><div><p className="text-xs font-bold uppercase tracking-wider text-orange-700">Work Injury</p><h2 className="mt-1 text-2xl font-semibold">{existing ? 'Edit Injury Case' : 'New Injury Case'}</h2></div><button className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold" onClick={onCancel} type="button"><ArrowLeft className="h-4 w-4" />Back to cases</button></div>
    <form className="space-y-6 p-6" onSubmit={save}>
      <div><label className="text-sm font-semibold text-slate-700">Employee Name *</label><div className="relative mt-2"><Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" /><input className="w-full rounded-lg border border-slate-300 py-2.5 pl-9 pr-3" disabled={Boolean(existing)} onChange={event => { setSearch(event.target.value); set('employeeId', '') }} placeholder="Search active or leave employee" value={search} />
        {matches.length ? <div className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-lg border border-slate-200 bg-white p-1 shadow-xl">{matches.map(item => <button className="block w-full rounded-md px-3 py-2 text-left text-sm hover:bg-orange-50" key={item.id} onClick={() => { set('employeeId', item.id); setSearch(item.employeeName) }} type="button"><span className="font-semibold">{item.employeeName}</span><span className="ml-2 text-slate-500">{item.jobTitle} · {item.location}</span></button>)}</div> : null}
      </div></div>
      {employee ? <div className="grid gap-3 rounded-xl border border-blue-100 bg-blue-50 p-4 sm:grid-cols-2 lg:grid-cols-4">{rosterFields.map(([label, value]) => <div key={label}><div className="text-xs font-bold uppercase tracking-wide text-blue-700">{label}</div><div className="mt-1 text-sm font-semibold text-slate-800">{value || 'Not available'}</div></div>)}</div> : null}
      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        <Field label="Injury Date and Time *"><input className="control" onChange={event => set('injuryDateTime', event.target.value)} required type="datetime-local" value={form.injuryDateTime} /></Field>
        <Field label="First Notice Date *"><input className="control" onChange={event => set('firstNoticeDate', event.target.value)} required type="date" value={form.firstNoticeDate} /></Field>
        <Field label="Injury Location *"><input className="control" onChange={event => set('injuryLocation', event.target.value)} required value={form.injuryLocation} /></Field>
        <Field label="Injured Body Part *"><input className="control" onChange={event => set('injuredBodyPart', event.target.value)} placeholder="Example: Left hand" required value={form.injuredBodyPart} /></Field>
        <Field label={`${existing ? 'Initial ' : ''}Work Status / Medical Restriction *`}><select className="control" disabled={Boolean(existing)} onChange={event => set('workStatus', event.target.value)} required value={form.workStatus}><option>Pending Medical Evaluation</option><option>Off Work</option><option>Returned to Work - No Restrictions</option><option>Returned to Work - With Restrictions</option><option>Other</option></select></Field>
        <Field label="OSHA Recordable? *"><select className="control" onChange={event => set('oshaRecordable', event.target.value)} value={form.oshaRecordable}><option>No</option><option>Yes</option></select></Field>
        <Field label="Injury Report Received? *"><select className="control" onChange={event => set('injuryReportReceived', event.target.value)} value={form.injuryReportReceived}><option>No</option><option>Yes</option></select></Field>
        <Field label="Workers’ Compensation Claimed? *"><select className="control" onChange={event => set('workersCompClaimed', event.target.value)} value={form.workersCompClaimed}><option>No</option><option>Yes</option></select></Field>
      </div>
      {form.workStatus === 'Other' ? <Field label={`${existing ? 'Initial ' : ''}Other Work Status / Medical Restriction *`}><input className="control" disabled={Boolean(existing)} onChange={event => set('otherWorkStatus', event.target.value)} required value={form.otherWorkStatus} /></Field> : null}
      <Field label="Employee Injury Folder Link"><input className="control" onChange={event => set('employeeInjuryFolderLink', event.target.value)} placeholder="Secure SharePoint folder link" type="url" value={form.employeeInjuryFolderLink} /></Field>
      {form.injuryReportReceived === 'Yes' ? <Field label="Injury Report Link *"><input className="control" onChange={event => set('injuryReportLink', event.target.value)} placeholder="Secure SharePoint report link" required type="url" value={form.injuryReportLink} /></Field> : null}
      {form.workersCompClaimed === 'Yes' ? <Field label="Workers’ Compensation Case Number *"><input className="control" onChange={event => set('workersCompCaseNumber', event.target.value)} required value={form.workersCompCaseNumber} /></Field> : null}
      <Field label="Injury Description *"><textarea className="control min-h-28" onChange={event => set('injuryDescription', event.target.value)} required value={form.injuryDescription} /></Field>
      <Field label="Follow-up Issues"><textarea className="control min-h-24" onChange={event => set('followUpIssues', event.target.value)} placeholder="Enter any open issues or required follow-up" value={form.followUpIssues} /></Field>
      <section className="rounded-xl border border-amber-200 bg-amber-50/50 p-5"><div><h3 className="text-lg font-bold">Safety Violation &amp; Investigation</h3><p className="text-sm text-slate-600">Document the investigation findings and any corrective action required.</p></div><div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Field label="Investigation Status *"><select className="control" onChange={event => set('investigationStatus', event.target.value)} value={form.investigationStatus}><option>Not Started</option><option>In Progress</option><option>Completed</option></select></Field>
        <Field label="Investigation Date"><input className="control" onChange={event => set('investigationDate', event.target.value)} required={form.investigationStatus === 'Completed'} type="date" value={form.investigationDate} /></Field>
        <Field label="Safety Violation? *"><select className="control" onChange={event => set('safetyViolation', event.target.value)} value={form.safetyViolation}><option>No</option><option>Yes</option></select></Field>
        <Field label="Corrective Action Needed? *"><select className="control" onChange={event => set('correctiveActionRequired', event.target.value)} value={form.correctiveActionRequired}><option>No</option><option>Yes</option></select></Field>
        {form.correctiveActionRequired === 'Yes' ? <Field label="Target Completion Date"><input className="control" onChange={event => set('correctiveActionTargetDate', event.target.value)} type="date" value={form.correctiveActionTargetDate} /></Field> : null}
      </div>
      {form.safetyViolation === 'Yes' ? <div className="mt-4"><Field label="Safety Violation Details *"><textarea className="control min-h-24" onChange={event => set('safetyViolationDetails', event.target.value)} required value={form.safetyViolationDetails} /></Field></div> : null}
      <div className="mt-4"><Field label={`Root Cause${form.investigationStatus === 'Completed' ? ' *' : ''}`}><textarea className="control min-h-24" onChange={event => set('rootCause', event.target.value)} placeholder="Describe the underlying cause of the injury" required={form.investigationStatus === 'Completed'} value={form.rootCause} /></Field></div>
      {form.correctiveActionRequired === 'Yes' ? <div className="mt-4"><Field label="Corrective Action Details *"><textarea className="control min-h-24" onChange={event => set('correctiveActionDetails', event.target.value)} placeholder="Describe training, equipment, policy, or process changes needed" required value={form.correctiveActionDetails} /></Field></div> : null}
      </section>
      {existing ? <section className="rounded-xl border border-blue-200 bg-blue-50/40 p-5"><div className="flex items-center justify-between gap-3"><div><h3 className="text-lg font-bold">Case Progress Timeline</h3><p className="text-sm text-slate-600">The latest entry automatically updates the current Work Status / Medical Restriction.</p></div><button className="rounded-lg bg-blue-700 px-3 py-2 text-sm font-bold text-white" onClick={() => setForm(current => ({ ...current, timeline: [...current.timeline, { date: '', description: '', workStatusAfter: 'Pending Medical Evaluation', otherWorkStatusAfter: '', documentationLink: '' }] }))} type="button">Add Timeline Entry</button></div><div className="mt-4 space-y-4">{form.timeline.map((item, index) => <div className="grid gap-3 rounded-xl border border-blue-100 bg-white p-4 md:grid-cols-2" key={index}><Field label="Date *"><input className="control" onChange={event => updateTimeline(index, 'date', event.target.value)} required type="date" value={item.date} /></Field><Field label="Work Status After This Event *"><select className="control" onChange={event => updateTimeline(index, 'workStatusAfter', event.target.value)} required value={item.workStatusAfter}><option>Pending Medical Evaluation</option><option>Off Work</option><option>Returned to Work - No Restrictions</option><option>Returned to Work - With Restrictions</option><option>Other</option></select></Field>{item.workStatusAfter === 'Other' ? <div className="md:col-span-2"><Field label="Other Work Status / Medical Restriction *"><input className="control" onChange={event => updateTimeline(index, 'otherWorkStatusAfter', event.target.value)} required value={item.otherWorkStatusAfter || ''} /></Field></div> : null}<div className="md:col-span-2"><Field label="Description *"><textarea className="control min-h-20" onChange={event => updateTimeline(index, 'description', event.target.value)} required value={item.description} /></Field></div><Field label="Documentation Link"><input className="control" onChange={event => updateTimeline(index, 'documentationLink', event.target.value)} placeholder="Secure SharePoint link" type="url" value={item.documentationLink} /></Field><button className="self-end justify-self-start text-sm font-bold text-red-700" onClick={() => setForm(current => ({ ...current, timeline: current.timeline.filter((_, itemIndex) => itemIndex !== index) }))} type="button">Remove Entry</button></div>)}</div></section> : null}
      {existing ? <section className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-5"><div className="flex items-center justify-between gap-3"><div><h3 className="text-lg font-bold">Case Costs</h3><p className="text-sm text-slate-600">Record invoices paid by Workers’ Compensation or Royal.</p></div><button className="rounded-lg bg-emerald-700 px-3 py-2 text-sm font-bold text-white" onClick={() => setForm(current => ({ ...current, costs: [...current.costs, { invoiceDate: '', description: '', paidBy: 'Royal', amount: '', invoiceLink: '' }] }))} type="button">Add Cost</button></div><div className="mt-4 space-y-4">{form.costs.map((item, index) => <div className="grid gap-3 rounded-xl border border-emerald-100 bg-white p-4 md:grid-cols-2 lg:grid-cols-4" key={index}><Field label="Invoice Date (Optional)"><input className="control" onChange={event => updateCost(index, 'invoiceDate', event.target.value)} type="date" value={item.invoiceDate} /></Field><Field label="Paid By *"><select className="control" onChange={event => updateCost(index, 'paidBy', event.target.value)} value={item.paidBy}><option>Royal</option><option>Workers Compensation</option></select></Field><Field label="Amount *"><input className="control" min="0" onChange={event => updateCost(index, 'amount', event.target.value)} required step="0.01" type="number" value={item.amount} /></Field><Field label="Description *"><input className="control" onChange={event => updateCost(index, 'description', event.target.value)} required value={item.description} /></Field><div className="lg:col-span-3"><Field label="Invoice Link"><input className="control" onChange={event => updateCost(index, 'invoiceLink', event.target.value)} placeholder="Secure SharePoint link" type="url" value={item.invoiceLink} /></Field></div><button className="self-end justify-self-start text-sm font-bold text-red-700" onClick={() => setForm(current => ({ ...current, costs: current.costs.filter((_, itemIndex) => itemIndex !== index) }))} type="button">Remove Cost</button></div>)}</div></section> : null}
      {error ? <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</p> : null}
      <div className="flex justify-end gap-3"><button className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold" onClick={onCancel} type="button">Cancel</button><button className="rounded-lg bg-orange-700 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50" disabled={saving || !form.employeeId} type="submit">{saving ? 'Saving...' : existing ? 'Save Changes' : 'Create Case'}</button></div>
    </form>
  </section>
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block"><span className="text-sm font-semibold text-slate-700">{label}</span><span className="mt-2 block">{children}</span></label> }

function DetailBlock({ label, value }: { label: string; value: string }) {
  return <div><div className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</div><div className="mt-2 whitespace-pre-wrap rounded-xl border border-slate-200 p-4 text-sm leading-6 text-slate-800">{value}</div></div>
}

function CaseDetails({ caseId, onLogout }: { caseId: string; onLogout: () => void }) {
  const [record, setRecord] = useState<InjuryCase | null>(null)
  const [error, setError] = useState('')
  useEffect(() => { api.get(`/work-injury/cases/${caseId}`).then(response => setRecord(response.data.case)).catch(requestError => setError(requestError.response?.data?.error || 'The case could not be loaded.')) }, [caseId])
  if (error) return <div className="rounded-xl bg-red-50 p-6 text-red-700">{error}</div>
  if (!record) return <div className="grid min-h-64 place-items-center"><RefreshCw className="h-7 w-7 animate-spin text-orange-600" /></div>
  const status = record.closedAt ? 'Closed' : 'Open'
  const workStatus = record.workStatus === 'Other' ? record.otherWorkStatus : record.workStatus
  const basicDetails = [['Employee Name', record.employeeName], ['Hire Date', displayDate(record.hireDate)], ['Department', record.department], ['Location', record.location], ['Supervisor', record.supervisor], ['Job Title', record.jobTitle], ['Employee Phone', record.employeePhone], ['Employee Email', record.employeeEmail]]
  const injuryDetails = [['Case Status', status], ['Injury Date and Time', displayDate(record.injuryDateTime, true)], ['First Notice Date', displayDate(record.firstNoticeDate)], ['Injury Location', record.injuryLocation], ['Injured Body Part', record.injuredBodyPart], ['Initial Work Status / Medical Restriction', workStatus], ['OSHA Recordable', record.oshaRecordable], ['Injury Report Received', record.injuryReportReceived], ['Workers’ Compensation Claimed', record.workersCompClaimed], ['Workers’ Compensation Case Number', record.workersCompCaseNumber || 'Not applicable'], ['Closed Date', record.closedAt ? displayDate(record.closedAt, true) : 'Open'], ['Closed By', record.closedBy || '—']]
  const investigationDetails = [['Investigation Status', record.investigationStatus || 'Not Started'], ['Investigation Date', record.investigationDate ? displayDate(record.investigationDate) : 'Not entered'], ['Safety Violation', record.safetyViolation], ['Safety Violation Details', record.safetyViolationDetails || 'Not applicable'], ['Root Cause', record.rootCause || 'Not entered'], ['Corrective Action Needed', record.correctiveActionRequired || 'No'], ['Corrective Action Details', record.correctiveActionDetails || 'Not applicable'], ['Target Completion Date', record.correctiveActionTargetDate ? displayDate(record.correctiveActionTargetDate) : 'Not entered']]
  const timeline = record.timeline || []
  const costs = record.costs || []
  const wcTotal = costs.filter(item => item.paidBy === 'Workers Compensation').reduce((sum, item) => sum + Number(item.amount || 0), 0)
  const royalTotal = costs.filter(item => item.paidBy === 'Royal').reduce((sum, item) => sum + Number(item.amount || 0), 0)
  const DetailGrid = ({ items }: { items: string[][] }) => <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{items.map(([label, value]) => <div className="rounded-xl bg-slate-50 p-4" key={label}><div className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</div><div className="mt-2 font-semibold text-slate-900">{value || '—'}</div></div>)}</div>
  return <div className="space-y-6 pb-10"><section className="rounded-2xl bg-slate-950 px-6 py-6 text-white shadow-xl"><div className="flex flex-wrap items-center justify-between gap-3"><Link className="inline-flex items-center gap-2 text-sm font-semibold text-slate-300 hover:text-white" to="/work-related-injury"><ArrowLeft className="h-4 w-4" />Back to Injury Cases</Link><button className="inline-flex items-center gap-2 text-sm font-semibold text-slate-300" onClick={onLogout}><LogOut className="h-4 w-4" />Sign out</button></div><div className="mt-6 flex flex-wrap items-center gap-3"><h1 className="text-3xl font-semibold">Work Injury Case Details</h1><span className={`rounded-full px-3 py-1 text-xs font-bold ${record.closedAt ? 'bg-slate-700 text-slate-200' : 'bg-emerald-500 text-white'}`}>{status}</span>{record.oshaRecordable === 'Yes' ? <span className="rounded-full bg-red-500 px-3 py-1 text-xs font-bold text-white">OSHA Recordable</span> : null}</div><p className="mt-2 text-slate-300">Complete read-only case record for {record.employeeName}.</p></section>
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><h2 className="mb-4 text-xl font-bold">1. Employee Basic Information</h2><DetailGrid items={basicDetails} /></section>
    <section className="rounded-2xl border border-orange-200 bg-white p-6 shadow-sm"><h2 className="mb-4 text-xl font-bold">2. Employee Injury Information</h2><DetailGrid items={injuryDetails} /><div className="mt-6 space-y-4"><DetailBlock label="Injury Description" value={record.injuryDescription} /><DetailBlock label="Follow-up Issues" value={record.followUpIssues || 'None'} /></div><div className="mt-6 flex flex-wrap gap-3">{record.employeeInjuryFolderLink ? <a className="inline-flex items-center gap-2 rounded-lg bg-orange-700 px-4 py-2.5 text-sm font-bold text-white" href={record.employeeInjuryFolderLink} rel="noreferrer" target="_blank"><ExternalLink className="h-4 w-4" />Employee Injury Folder</a> : null}{record.injuryReportLink ? <a className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-bold text-white" href={record.injuryReportLink} rel="noreferrer" target="_blank"><ExternalLink className="h-4 w-4" />Injury Report</a> : null}</div></section>
    <section className="rounded-2xl border border-amber-200 bg-white p-6 shadow-sm"><h2 className="mb-4 text-xl font-bold">3. Safety Violation &amp; Investigation</h2><DetailGrid items={investigationDetails} /></section>
    <section className="rounded-2xl border border-blue-200 bg-white p-6 shadow-sm"><h2 className="text-xl font-bold">4. Case Progress Timeline</h2><p className="mt-1 text-sm text-slate-500">Medical files, status changes, and other case events in chronological order.</p>{timeline.length ? <div className="relative mt-6 space-y-5 border-l-2 border-blue-200 pl-6">{[...timeline].sort((a, b) => a.date.localeCompare(b.date)).map((item, index) => <article className="relative rounded-xl bg-blue-50 p-4" key={`${item.date}-${index}`}><span className="absolute -left-[31px] top-5 h-3 w-3 rounded-full bg-blue-600 ring-4 ring-white" /><div className="text-xs font-bold uppercase text-blue-700">{displayDate(item.date)}</div><div className="mt-2 font-semibold">{item.description}</div><div className="mt-2 text-sm text-slate-600"><span className="font-bold">Work Status After:</span> {item.workStatusAfter === 'Other' ? item.otherWorkStatusAfter : item.workStatusAfter}</div>{item.documentationLink ? <a className="mt-3 inline-flex items-center gap-1 text-sm font-bold text-blue-700" href={item.documentationLink} rel="noreferrer" target="_blank"><ExternalLink className="h-4 w-4" />Documentation</a> : null}</article>)}</div> : <p className="mt-5 rounded-xl bg-slate-50 p-5 text-sm text-slate-500">No timeline entries have been added.</p>}</section>
    <section className="rounded-2xl border border-emerald-200 bg-white p-6 shadow-sm"><h2 className="text-xl font-bold">5. Case Costs</h2><div className="mt-4 grid gap-3 sm:grid-cols-3"><CostTotal label="Paid by Workers’ Compensation" value={wcTotal} /><CostTotal label="Paid by Royal" value={royalTotal} /><CostTotal label="Total Case Cost" value={wcTotal + royalTotal} primary /></div>{costs.length ? <div className="mt-6 overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-4 py-3">Invoice Date</th><th className="px-4 py-3">Description</th><th className="px-4 py-3">Paid By</th><th className="px-4 py-3">Amount</th><th className="px-4 py-3">Document</th></tr></thead><tbody>{costs.map((item, index) => <tr className="border-t border-slate-100" key={`${item.invoiceDate}-${index}`}><td className="px-4 py-3">{displayDate(item.invoiceDate)}</td><td className="px-4 py-3 font-semibold">{item.description}</td><td className="px-4 py-3">{item.paidBy}</td><td className="px-4 py-3 font-bold">{Number(item.amount).toLocaleString('en-US', { style: 'currency', currency: 'USD' })}</td><td className="px-4 py-3">{item.invoiceLink ? <a className="font-bold text-blue-700" href={item.invoiceLink} rel="noreferrer" target="_blank">Open Invoice</a> : '—'}</td></tr>)}</tbody></table></div> : <p className="mt-5 rounded-xl bg-slate-50 p-5 text-sm text-slate-500">No costs have been recorded.</p>}</section>
  </div>
}

function CostTotal({ label, value, primary = false }: { label: string; value: number; primary?: boolean }) { return <div className={`rounded-xl p-4 ${primary ? 'bg-emerald-700 text-white' : 'bg-emerald-50 text-emerald-950'}`}><div className="text-xs font-bold uppercase tracking-wide opacity-75">{label}</div><div className="mt-2 text-2xl font-bold">{value.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}</div></div> }

function InjuryWorkspace({ onLogout }: { onLogout: () => void }) {
  const [tab, setTab] = useState<'injury' | 'accident'>('injury')
  const [view, setView] = useState<'dashboard' | 'new' | 'edit'>('dashboard')
  const [employees, setEmployees] = useState<Employee[]>([])
  const [cases, setCases] = useState<InjuryCase[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [nameFilter, setNameFilter] = useState('')
  const [injuryDateFrom, setInjuryDateFrom] = useState('')
  const [injuryDateTo, setInjuryDateTo] = useState('')
  const [oshaFilter, setOshaFilter] = useState<'all' | 'yes' | 'no'>('all')
  const [caseView, setCaseView] = useState<'current' | 'open' | 'closed' | 'all'>('current')
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [locationFilter, setLocationFilter] = useState<string[]>([])
  const [jobTitleFilter, setJobTitleFilter] = useState<string[]>([])
  const [departmentFilter, setDepartmentFilter] = useState<string[]>([])
  const [seniorityFrom, setSeniorityFrom] = useState('')
  const [seniorityTo, setSeniorityTo] = useState('')
  const selected = cases.find(item => item.id === selectedId) || null
  const locations = useMemo(() => uniqueCaseValues(cases, 'location'), [cases])
  const jobTitles = useMemo(() => uniqueCaseValues(cases, 'jobTitle'), [cases])
  const departments = useMemo(() => uniqueCaseValues(cases, 'department'), [cases])
  const filteredCases = useMemo(() => {
    const currentYearStart = `${new Date().getFullYear()}-01-01`
    return cases.filter(item => {
      const injuryDate = item.injuryDateTime.slice(0, 10)
      const isOpen = !item.closedAt
      if (caseView === 'current' && !isOpen && injuryDate < currentYearStart) return false
      if (caseView === 'open' && !isOpen) return false
      if (caseView === 'closed' && isOpen) return false
      if (nameFilter.trim() && !item.employeeName.toLowerCase().includes(nameFilter.trim().toLowerCase())) return false
      if (injuryDateFrom && injuryDate < injuryDateFrom) return false
      if (injuryDateTo && injuryDate > injuryDateTo) return false
      if (oshaFilter !== 'all' && item.oshaRecordable.toLowerCase() !== oshaFilter) return false
      if (locationFilter.length && !locationFilter.some(value => value.toLowerCase() === item.location.trim().toLowerCase())) return false
      if (jobTitleFilter.length && !jobTitleFilter.some(value => value.toLowerCase() === item.jobTitle.trim().toLowerCase())) return false
      if (departmentFilter.length && !departmentFilter.some(value => value.toLowerCase() === item.department.trim().toLowerCase())) return false
      const years = employmentYears(item.hireDate)
      if (seniorityFrom && (years === null || years < Number(seniorityFrom))) return false
      if (seniorityTo && (years === null || years > Number(seniorityTo))) return false
      return true
    })
  }, [caseView, cases, departmentFilter, injuryDateFrom, injuryDateTo, jobTitleFilter, locationFilter, nameFilter, oshaFilter, seniorityFrom, seniorityTo])
  const openCount = filteredCases.filter(item => !item.closedAt).length

  function resetFilters() {
    setNameFilter(''); setInjuryDateFrom(''); setInjuryDateTo(''); setOshaFilter('all'); setCaseView('current')
    setLocationFilter([]); setJobTitleFilter([]); setDepartmentFilter([]); setSeniorityFrom(''); setSeniorityTo('')
  }
  const activeFilterCount = [nameFilter, injuryDateFrom, injuryDateTo, oshaFilter !== 'all' ? oshaFilter : '', caseView !== 'current' ? caseView : '', seniorityFrom, seniorityTo].filter(Boolean).length + locationFilter.length + jobTitleFilter.length + departmentFilter.length

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
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="flex items-center justify-between border-b border-slate-200 px-5 py-4"><div><h2 className="text-xl font-semibold">Current Injury Cases</h2><p className="mt-1 text-sm text-slate-500">Open cases from prior years and all cases from the current year. The summary is read-only.</p></div><span className="rounded-full bg-orange-100 px-3 py-1 text-sm font-bold text-orange-800">{openCount} Open</span></div>
        <div className="border-b border-slate-200 bg-slate-50/70 p-4"><div className="flex flex-wrap items-center justify-between gap-3"><button className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-100" onClick={() => setFiltersOpen(value => !value)} type="button"><Search className="h-4 w-4" />{filtersOpen ? 'Hide Filters' : 'Show Filters'}{activeFilterCount ? <span className="rounded-full bg-orange-700 px-2 py-0.5 text-xs text-white">{activeFilterCount}</span> : null}</button><div className="text-xs font-semibold text-slate-500">Showing {filteredCases.length} of {cases.length} cases</div></div>{filtersOpen ? <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <label><span className="text-xs font-bold uppercase tracking-wide text-slate-500">Employee Name</span><input className="control mt-1.5" onChange={event => setNameFilter(event.target.value)} placeholder="Search employee" value={nameFilter} /></label>
          <label><span className="text-xs font-bold uppercase tracking-wide text-slate-500">Injury Date From</span><input className="control mt-1.5" onChange={event => setInjuryDateFrom(event.target.value)} type="date" value={injuryDateFrom} /></label>
          <label><span className="text-xs font-bold uppercase tracking-wide text-slate-500">Injury Date To</span><input className="control mt-1.5" onChange={event => setInjuryDateTo(event.target.value)} type="date" value={injuryDateTo} /></label>
          <label><span className="text-xs font-bold uppercase tracking-wide text-slate-500">OSHA Recordable</span><select className="control mt-1.5" onChange={event => setOshaFilter(event.target.value as 'all' | 'yes' | 'no')} value={oshaFilter}><option value="all">All</option><option value="yes">Yes</option><option value="no">No</option></select></label>
          <label><span className="text-xs font-bold uppercase tracking-wide text-slate-500">Case View</span><select className="control mt-1.5" onChange={event => setCaseView(event.target.value as 'current' | 'open' | 'closed' | 'all')} value={caseView}><option value="current">Current Window</option><option value="open">Open Cases - All Years</option><option value="closed">Closed Cases - All History</option><option value="all">All Cases - All History</option></select></label>
          <label><span className="text-xs font-bold uppercase tracking-wide text-slate-500">Location</span><MultiSelectFilter label="Location" onChange={setLocationFilter} options={locations} selected={locationFilter} /></label>
          <label><span className="text-xs font-bold uppercase tracking-wide text-slate-500">Job Title</span><MultiSelectFilter label="Job Title" onChange={setJobTitleFilter} options={jobTitles} selected={jobTitleFilter} /></label>
          <label><span className="text-xs font-bold uppercase tracking-wide text-slate-500">Department</span><MultiSelectFilter label="Department" onChange={setDepartmentFilter} options={departments} selected={departmentFilter} /></label>
          <label><span className="text-xs font-bold uppercase tracking-wide text-slate-500">Seniority From (Years)</span><input className="control mt-1.5" min="0" onChange={event => setSeniorityFrom(event.target.value)} placeholder="Minimum years" type="number" value={seniorityFrom} /></label>
          <label><span className="text-xs font-bold uppercase tracking-wide text-slate-500">Seniority To (Years)</span><input className="control mt-1.5" min="0" onChange={event => setSeniorityTo(event.target.value)} placeholder="Maximum years" type="number" value={seniorityTo} /></label>
          <button className="self-end rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-100" onClick={resetFilters} type="button">Reset All Filters</button>
        </div> : null}</div>
        {error ? <p className="m-5 rounded-lg bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</p> : null}
        {loading ? <div className="grid min-h-48 place-items-center"><RefreshCw className="h-7 w-7 animate-spin text-orange-600" /></div> : filteredCases.length === 0 ? <div className="px-6 py-14 text-center"><Search className="mx-auto h-10 w-10 text-slate-400" /><h3 className="mt-3 text-lg font-semibold">No matching injury cases</h3><p className="mt-1 text-sm text-slate-500">Adjust or reset the filters to see more cases.</p></div> : <div className="overflow-x-auto"><table className="min-w-[1450px] w-full text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr>{['Employee / Case Status','Injury Date / Time','First Notice','Department / Location','Body Part','OSHA','Safety Violation','Work Status / Restriction','Injury Report','Workers’ Comp','Follow-up'].map(label => <th className="px-4 py-3" key={label}>{label}</th>)}</tr></thead><tbody>{filteredCases.map(item => {
          const isOpen = !item.closedAt
          const isOsha = item.oshaRecordable === 'Yes'
          return <tr className={`cursor-pointer border-t border-slate-100 ${selectedId === item.id ? 'ring-2 ring-inset ring-orange-400' : ''} ${isOsha ? 'bg-red-50 hover:bg-red-100' : isOpen ? 'bg-amber-50 hover:bg-amber-100' : 'hover:bg-slate-50'}`} key={item.id} onClick={() => setSelectedId(item.id)}><td className="px-4 py-3"><Link className="font-bold text-blue-700 underline decoration-blue-300 underline-offset-2 hover:text-blue-900" onClick={event => event.stopPropagation()} to={`/work-related-injury/cases/${item.id}`}>{item.employeeName}</Link><div className="text-xs text-slate-500">{item.jobTitle}</div><div className="mt-2 flex flex-wrap gap-1">{isOpen ? <span className="rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-bold uppercase text-white">Open</span> : <span className="rounded-full bg-slate-500 px-2 py-0.5 text-[10px] font-bold uppercase text-white">Closed</span>}{isOsha ? <span className="rounded-full bg-red-600 px-2 py-0.5 text-[10px] font-bold uppercase text-white">OSHA Recordable</span> : null}</div></td><td className="px-4 py-3 font-semibold">{displayDate(item.injuryDateTime, true)}</td><td className="px-4 py-3">{displayDate(item.firstNoticeDate)}</td><td className="px-4 py-3"><div>{item.department}</div><div className="text-xs text-slate-500">{item.location}</div></td><td className="px-4 py-3">{item.injuredBodyPart}</td><td className="px-4 py-3">{item.oshaRecordable}</td><td className="px-4 py-3"><div>{item.safetyViolation}</div>{item.safetyViolationDetails ? <div className="max-w-48 truncate text-xs text-slate-500">{item.safetyViolationDetails}</div> : null}</td><td className="px-4 py-3 font-semibold">{item.workStatus === 'Other' ? item.otherWorkStatus : item.workStatus || 'Pending Medical Evaluation'}</td><td className="px-4 py-3">{item.injuryReportReceived || 'No'}</td><td className="px-4 py-3"><div>{item.workersCompClaimed || 'No'}</div><div className="text-xs text-slate-500">{item.workersCompCaseNumber}</div></td><td className="max-w-64 px-4 py-3"><div className="truncate">{item.followUpIssues || 'None'}</div></td></tr>
        })}</tbody></table></div>}
      </section>
    </>}
  </div>
}

export default function WorkRelatedInjury() {
  const { caseId } = useParams()
  const [authState, setAuthState] = useState<'checking' | 'authenticated' | 'signed-out'>('checking')
  useEffect(() => { api.get('/training-auth/me').then(() => setAuthState('authenticated')).catch(() => setAuthState('signed-out')) }, [])
  if (authState === 'checking') return <div className="grid min-h-64 place-items-center rounded-2xl bg-white"><RefreshCw className="h-7 w-7 animate-spin text-orange-600" /></div>
  if (authState === 'signed-out') return <InjuryLogin onLogin={() => setAuthState('authenticated')} />
  if (caseId) return <CaseDetails caseId={caseId} onLogout={() => setAuthState('signed-out')} />
  return <InjuryWorkspace onLogout={() => setAuthState('signed-out')} />
}

