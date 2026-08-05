import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, ExternalLink, Filter, FolderOpen, Lock, RefreshCw, Save, Search, Settings, UserMinus, X } from 'lucide-react'
import { api } from '../shared/api'

type Employee = {
  id: string; name: string; email: string; phone: string; hireDate: string; terminationDate: string;
  homeDepartment: string; jobTitle: string; location: string; supervisor: string; payCategory: string;
  employeeFolderUrl: string; fileTracker: any;
  finalPayrollDate: string; pendingIssues: boolean; pendingIssuesNotes: string; payrollFollowThroughUntil: string;
  insuranceParticipation: string; insuranceEndingDate: string; retirementParticipation: string; retirementEndingDate: string;
  payrollCheckedAt: string | null; payrollCheckedBy: string; payrollFinalReviewedAt: string | null; payrollFinalReviewedBy: string;
  insuranceCobraCheckedAt: string | null; insuranceCobraCheckedBy: string; retirementCheckedAt: string | null; retirementCheckedBy: string;
}
type EditRecord = Pick<Employee, 'employeeFolderUrl' | 'finalPayrollDate' | 'pendingIssues' | 'pendingIssuesNotes' | 'payrollFollowThroughUntil' | 'insuranceParticipation' | 'insuranceEndingDate' | 'retirementParticipation' | 'retirementEndingDate'>
type TrackerField = { id: string; label: string; options: string[] }
const emptyRecord: EditRecord = { employeeFolderUrl: '', finalPayrollDate: '', pendingIssues: false, pendingIssuesNotes: '', payrollFollowThroughUntil: '', insuranceParticipation: '', insuranceEndingDate: '', retirementParticipation: '', retirementEndingDate: '' }
const dateDisplay = (value: string) => value?.match(/^\d{4}-\d{2}-\d{2}/) ? `${value.slice(5, 7)}/${value.slice(8, 10)}/${value.slice(0, 4)}` : value || '--'
const isCurrentMonth = (value?: string | null) => { if (!value) return false; const date = new Date(value); const now = new Date(); return !Number.isNaN(date.getTime()) && date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth() }
const actionDate = (employee: Employee) => employee.pendingIssues && employee.payrollFollowThroughUntil ? employee.payrollFollowThroughUntil : employee.finalPayrollDate || employee.terminationDate
const employeeDate = (employee: Employee) => employee.terminationDate || '9999-12-31'
const statusPill = (done: boolean, label = done ? 'Complete' : 'Action Needed') => <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${done ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>{label}</span>

export default function Termination() {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [editing, setEditing] = useState<Employee | null>(null)
  const [record, setRecord] = useState<EditRecord>(emptyRecord)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [currentUserEmail, setCurrentUserEmail] = useState('')
  const [catalog, setCatalog] = useState<TrackerField[]>([])
  const [tracking, setTracking] = useState<Employee | null>(null)
  const [tracker, setTracker] = useState<any>({ responses: {}, comments: '', confirmationDate: '' })
  const [trackerError, setTrackerError] = useState('')

  async function load() {
    setLoading(true); setError('')
    try {
      const [records, auth, fields] = await Promise.all([api.get('/hr-platform/terminations'), api.get('/hr-tools-auth/me'), api.get('/hr-platform/file-tracker-fields')])
      setEmployees(records.data || []); setCurrentUserEmail(auth.data.email || ''); setCatalog(fields.data.fields || [])
    } catch (requestError: any) { setError(requestError.response?.data?.error || 'Termination records could not be loaded.') }
    finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  const filtered = useMemo(() => employees.filter(employee => {
    const needle = query.trim().toLowerCase()
    if (needle && !Object.values(employee).some(value => String(value || '').toLowerCase().includes(needle))) return false
    if (dateFrom && employee.terminationDate.slice(0, 10) < dateFrom) return false
    if (dateTo && employee.terminationDate.slice(0, 10) > dateTo) return false
    return true
  }), [employees, query, dateFrom, dateTo])
  const rangeActive = Boolean(dateFrom || dateTo)
  const payroll = [...filtered].filter(employee => rangeActive || !employee.payrollFinalReviewedAt || isCurrentMonth(employee.terminationDate) || isCurrentMonth(employee.payrollFinalReviewedAt)).sort((a, b) => employeeDate(a).localeCompare(employeeDate(b)) || a.name.localeCompare(b.name))
  const insurance = [...filtered].filter(employee => rangeActive || !employee.insuranceCobraCheckedAt).sort((a, b) => (a.insuranceEndingDate || a.terminationDate).localeCompare(b.insuranceEndingDate || b.terminationDate))
  const retirement = [...filtered].filter(employee => rangeActive || !employee.retirementCheckedAt).sort((a, b) => (a.retirementEndingDate || a.terminationDate).localeCompare(b.retirementEndingDate || b.terminationDate))
  const monthlyActions = employees.flatMap(employee => [
    !employee.payrollFinalReviewedAt && actionDate(employee) && isCurrentMonth(actionDate(employee)) ? { employee, type: employee.pendingIssues ? 'Payroll Follow-through' : 'Final Payroll', date: actionDate(employee) } : null,
    !employee.insuranceCobraCheckedAt && employee.insuranceEndingDate && isCurrentMonth(employee.insuranceEndingDate) ? { employee, type: 'Insurance & COBRA', date: employee.insuranceEndingDate } : null,
    !employee.retirementCheckedAt && employee.retirementEndingDate && isCurrentMonth(employee.retirementEndingDate) ? { employee, type: '401(k)', date: employee.retirementEndingDate } : null,
  ].filter(Boolean) as { employee: Employee; type: string; date: string }[]).sort((a, b) => a.date.localeCompare(b.date))

  function openEdit(employee: Employee) {
    setEditing(employee); setRecord({ employeeFolderUrl: employee.employeeFolderUrl, finalPayrollDate: employee.finalPayrollDate, pendingIssues: employee.pendingIssues, pendingIssuesNotes: employee.pendingIssuesNotes, payrollFollowThroughUntil: employee.payrollFollowThroughUntil, insuranceParticipation: employee.insuranceParticipation, insuranceEndingDate: employee.insuranceEndingDate, retirementParticipation: employee.retirementParticipation, retirementEndingDate: employee.retirementEndingDate }); setSaveError('')
  }
  function openTracker(employee: Employee) { const value = employee.fileTracker || {}; setTracking(employee); setTracker({ responses: value.responses || {}, comments: value.comments || '', confirmationDate: value.confirmationDate || '' }); setTrackerError('') }
  async function saveTracker(action: 'save' | 'submit' | 'lock') { if (!tracking) return; if (action !== 'save' && !window.confirm(`${action === 'lock' ? 'Lock' : 'Confirm'} the Termination File Tracker for ${tracking.name}?`)) return; try { await api.put(`/hr-platform/terminations/${tracking.id}/file-tracker`, { action, fileTracker: tracker, confirmationDate: tracker.confirmationDate }); setTracking(null); await load() } catch (e: any) { setTrackerError(e.response?.data?.error || 'The tracker could not be saved.') } }
  async function save() {
    if (!editing) return
    setSaving(true); setSaveError('')
    try { await api.put(`/hr-platform/terminations/${editing.id}`, record); setEditing(null); await load() }
    catch (requestError: any) { setSaveError(requestError.response?.data?.error || 'Termination details could not be saved.') }
    finally { setSaving(false) }
  }
  async function check(employee: Employee, action: string, label: string) {
    if (!window.confirm(`Confirm ${label} for ${employee.name}? This action will be recorded under your account.`)) return
    try { await api.put(`/hr-platform/terminations/${employee.id}/checks`, { action }); await load() }
    catch (requestError: any) { setError(requestError.response?.data?.error || `${label} could not be completed.`) }
  }
  const manager = currentUserEmail.toLowerCase() === 'myu@royaltrailersales.com'

  return <div className="space-y-6">
    <section className="overflow-hidden rounded-2xl bg-gradient-to-r from-rose-950 via-rose-900 to-orange-800 px-6 py-7 text-white shadow-xl">
      <Link className="inline-flex items-center gap-2 text-sm font-semibold text-rose-100 hover:text-white" to="/hr-platform"><ArrowLeft className="h-4 w-4" />Back to HR Platform</Link>
      <div className="mt-5 flex flex-wrap items-end justify-between gap-4"><div><div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-bold uppercase tracking-wider"><UserMinus className="h-4 w-4" />Employee Separation</div><h1 className="mt-3 text-4xl font-semibold">Termination</h1><p className="mt-2 max-w-2xl text-sm text-rose-100">Employees terminated in Company App appear here automatically for payroll, Insurance & COBRA, and 401(k) follow-up.</p></div><button className="inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-rose-900 shadow" onClick={load}><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />Refresh from Company App</button></div>
    </section>

    {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">{error}</div>}
    <section className="overflow-hidden rounded-2xl border border-rose-200 bg-white shadow-sm">
      <div className="border-b border-rose-200 bg-gradient-to-r from-rose-50 via-orange-50 to-white px-5 py-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><div className="mb-2 inline-flex rounded-full bg-rose-100 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-rose-800">Monthly Priority View</div><h2 className="text-xl font-semibold text-rose-950">This Month&apos;s Termination Action Calendar</h2><p className="mt-1 text-sm text-rose-700">Incomplete payroll, Insurance & COBRA, and 401(k) actions scheduled this month.</p></div><span className="rounded-full border border-rose-200 bg-white px-4 py-2 text-sm font-bold text-rose-800">{monthlyActions.length} Pending</span></div></div>
      <div className="max-h-80 overflow-auto"><table className="min-w-full text-sm"><thead className="sticky top-0 bg-slate-50 text-left text-xs uppercase text-slate-500"><tr><th className="px-5 py-3">Action Date</th><th className="px-5 py-3">Employee</th><th className="px-5 py-3">Action Type</th><th className="px-5 py-3">Status</th></tr></thead><tbody className="divide-y divide-slate-100">{monthlyActions.length ? monthlyActions.map(item => <tr key={`${item.employee.id}-${item.type}`}><td className="px-5 py-3 font-semibold">{dateDisplay(item.date)}</td><td className="px-5 py-3">{item.employee.name}</td><td className="px-5 py-3">{item.type}</td><td className="px-5 py-3">{statusPill(false)}</td></tr>) : <tr><td className="px-5 py-8 text-center text-slate-500" colSpan={4}>No pending actions scheduled this month.</td></tr>}</tbody></table></div>
    </section>

    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><div className="flex flex-wrap gap-3"><label className="relative min-w-64 flex-1"><Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" /><input className="w-full rounded-lg border border-slate-300 py-2.5 pl-9 pr-3 text-sm" placeholder="Search terminated employees" value={query} onChange={event => setQuery(event.target.value)} /></label><button className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold" onClick={() => setShowFilters(value => !value)}><Filter className="h-4 w-4" />Filters</button><span className="self-center text-sm font-semibold text-slate-500">{filtered.length} employees</span></div>{showFilters && <div className="mt-4 grid gap-3 border-t border-slate-100 pt-4 sm:grid-cols-2"><label className="text-xs font-bold text-slate-600">Termination Date From<input className="mt-1 block w-full rounded-lg border border-slate-300 p-2 text-sm" type="date" value={dateFrom} onChange={event => setDateFrom(event.target.value)} /></label><label className="text-xs font-bold text-slate-600">Termination Date To<input className="mt-1 block w-full rounded-lg border border-slate-300 p-2 text-sm" type="date" value={dateTo} onChange={event => setDateTo(event.target.value)} /></label><button className="text-left text-sm font-semibold text-rose-700" onClick={() => { setDateFrom(''); setDateTo(''); setQuery('') }}>Reset all filters</button></div>}</section>

    <StatusSection title="Termination & Payroll Status" description={rangeActive ? 'Showing all employees in the selected termination date range.' : 'Unfinished items remain visible; completed terminations remain visible during the current month.'} tone="blue" count={payroll.length}>
      <table className="min-w-[1760px] text-sm"><TableHead labels={['Name','Termination Date','Department','Job Title','Location','Supervisor','Employee Folder','Final Payroll Date','Follow-up Issues','Follow Through','File Tracker','Payroll Check','Payroll Final Review','Manage']} /><tbody className="divide-y divide-slate-100">{payroll.map(employee => { const attention = !employee.payrollFinalReviewedAt; return <tr className={attention ? 'bg-red-50 ring-1 ring-inset ring-red-200' : ''} key={employee.id}><StickyName employee={employee} /><Cell>{dateDisplay(employee.terminationDate)}</Cell><Cell>{employee.homeDepartment || '--'}</Cell><Cell>{employee.jobTitle || '--'}</Cell><Cell>{employee.location || '--'}</Cell><Cell>{employee.supervisor || '--'}</Cell><Cell>{employee.employeeFolderUrl ? <a className="inline-flex items-center gap-1 font-bold text-blue-700" href={employee.employeeFolderUrl} rel="noreferrer" target="_blank">Open <ExternalLink className="h-3.5 w-3.5" /></a> : <span className="font-semibold text-amber-700">Not added</span>}</Cell><Cell>{dateDisplay(employee.finalPayrollDate)}</Cell><Cell>{employee.pendingIssues ? <span className="font-bold text-red-700">{employee.pendingIssuesNotes}</span> : 'None'}</Cell><Cell>{dateDisplay(employee.payrollFollowThroughUntil)}</Cell><Cell><ActionButton label={employee.fileTracker?.finalLockedAt ? 'Locked' : employee.fileTracker?.submittedAt ? 'Awaiting Lock' : 'Manage Tracker'} onClick={() => openTracker(employee)} /></Cell><Cell>{employee.payrollCheckedAt ? statusPill(true) : <ActionButton label="Confirm Check" onClick={() => check(employee, 'payroll-check', 'Payroll Check')} disabled={!employee.finalPayrollDate} />}</Cell><Cell>{employee.payrollFinalReviewedAt ? <div>{statusPill(true, 'Final Reviewed')}{manager && <button className="ml-2 text-xs font-bold text-red-700" onClick={() => check(employee, 'payroll-final-review-undo', 'undo Payroll Final Review')}>Correct</button>}</div> : manager ? <ActionButton label="Final Review" onClick={() => check(employee, 'payroll-final-review', 'Payroll Final Review')} disabled={!employee.payrollCheckedAt} /> : <span className="text-xs font-bold text-red-700">Final review needed</span>}</Cell><Cell><ActionButton label="Edit Details" onClick={() => openEdit(employee)} /></Cell></tr>})}{!payroll.length && <EmptyRow columns={14} />}</tbody></table>
    </StatusSection>

    <StatusSection title="Insurance & COBRA Status" description="Unfinished actions remain until completed and are sorted by Insurance Ending Date." tone="emerald" count={insurance.length}><SimpleStatusTable employees={insurance} type="insurance" openEdit={openEdit} check={check} /></StatusSection>
    <StatusSection title="401(k) Status" description="Unfinished actions remain until completed and are sorted by 401(k) Ending Date." tone="violet" count={retirement.length}><SimpleStatusTable employees={retirement} type="retirement" openEdit={openEdit} check={check} /></StatusSection>

    {editing && <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/55 p-4"><div className="max-h-[92vh] w-full max-w-2xl overflow-auto rounded-2xl bg-white shadow-2xl"><div className="sticky top-0 flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4"><div><h2 className="text-xl font-semibold">Termination Details</h2><p className="text-sm text-slate-500">{editing.name} · Terminated {dateDisplay(editing.terminationDate)}</p></div><button onClick={() => setEditing(null)}><X className="h-5 w-5" /></button></div><div className="grid gap-5 p-6 sm:grid-cols-2">
      <Field label="Final Payroll Date *"><input className="mt-1 block w-full rounded-lg border border-slate-300 p-2.5 font-normal" type="date" value={record.finalPayrollDate} onChange={event => setRecord({ ...record, finalPayrollDate: event.target.value })} /></Field>
      <Field label="Employee Folder Link"><input className="mt-1 block w-full rounded-lg border border-slate-300 p-2.5 font-normal" placeholder="https://..." type="url" value={record.employeeFolderUrl} onChange={event => setRecord({ ...record, employeeFolderUrl: event.target.value })} /></Field>
      <label className="flex items-center gap-3 self-end rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm font-semibold"><input checked={record.pendingIssues} onChange={event => setRecord({ ...record, pendingIssues: event.target.checked })} type="checkbox" />Pending payroll issues</label>
      {record.pendingIssues && <><Field label="Payroll Follow-through Until *"><input className="mt-1 block w-full rounded-lg border border-slate-300 p-2.5 font-normal" type="date" value={record.payrollFollowThroughUntil} onChange={event => setRecord({ ...record, payrollFollowThroughUntil: event.target.value })} /></Field><Field label="Pending Issues Notes *"><textarea className="mt-1 block min-h-20 w-full rounded-lg border border-slate-300 p-2.5 font-normal" value={record.pendingIssuesNotes} onChange={event => setRecord({ ...record, pendingIssuesNotes: event.target.value })} /></Field></>}
      <Field label="Insurance Participation *"><select className="mt-1 block w-full rounded-lg border border-slate-300 p-2.5 font-normal" value={record.insuranceParticipation} onChange={event => setRecord({ ...record, insuranceParticipation: event.target.value, insuranceEndingDate: event.target.value === 'not-participated' ? '' : record.insuranceEndingDate })}><option value="">Select...</option><option value="participated">Participated</option><option value="not-participated">Not Participated</option></select></Field>
      {record.insuranceParticipation === 'participated' && <Field label="Insurance Ending Date *"><input className="mt-1 block w-full rounded-lg border border-slate-300 p-2.5 font-normal" type="date" value={record.insuranceEndingDate} onChange={event => setRecord({ ...record, insuranceEndingDate: event.target.value })} /></Field>}
      <Field label="401(k) Participation *"><select className="mt-1 block w-full rounded-lg border border-slate-300 p-2.5 font-normal" value={record.retirementParticipation} onChange={event => setRecord({ ...record, retirementParticipation: event.target.value, retirementEndingDate: event.target.value === 'not-participated' ? '' : record.retirementEndingDate })}><option value="">Select...</option><option value="participated">Participated</option><option value="not-participated">Not Participated</option></select></Field>
      {record.retirementParticipation === 'participated' && <Field label="401(k) Ending Date *"><input className="mt-1 block w-full rounded-lg border border-slate-300 p-2.5 font-normal" type="date" value={record.retirementEndingDate} onChange={event => setRecord({ ...record, retirementEndingDate: event.target.value })} /></Field>}
      {saveError && <div className="sm:col-span-2 rounded-lg bg-red-50 p-3 text-sm font-semibold text-red-700">{saveError}</div>}
    </div><div className="sticky bottom-0 flex justify-end gap-3 border-t border-slate-200 bg-white px-6 py-4"><button className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold" onClick={() => setEditing(null)}>Cancel</button><button className="inline-flex items-center gap-2 rounded-lg bg-rose-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50" disabled={saving} onClick={save}><Save className="h-4 w-4" />{saving ? 'Saving...' : 'Save Details'}</button></div></div></div>}
    {tracking && <TrackerModal employee={tracking} catalog={tracking.fileTracker?.fieldsSnapshot || catalog} tracker={tracker} setTracker={setTracker} error={trackerError} manager={manager} close={() => setTracking(null)} save={saveTracker} />}
  </div>
}

function StatusSection({ title, description, tone, count, children }: { title: string; description: string; tone: string; count: number; children: React.ReactNode }) { const colors: Record<string, string> = { blue: 'border-blue-200 bg-blue-50 text-blue-950', emerald: 'border-emerald-200 bg-emerald-50 text-emerald-950', violet: 'border-violet-200 bg-violet-50 text-violet-950' }; return <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><div className={`flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4 ${colors[tone]}`}><div><h2 className="text-xl font-semibold">{title}</h2><p className="mt-1 text-sm opacity-75">{description}</p></div><span className="rounded-full bg-white px-3 py-1.5 text-sm font-bold shadow-sm">{count} employees</span></div><div className="max-h-[520px] overflow-auto">{children}</div></section> }
function TableHead({ labels }: { labels: string[] }) { return <thead className="sticky top-0 z-20 bg-slate-100 text-left text-[11px] uppercase tracking-wide text-slate-600"><tr>{labels.map((label, index) => <th className={`whitespace-nowrap px-4 py-3 ${index === 0 ? 'sticky left-0 z-30 bg-slate-100' : ''}`} key={label}>{label}</th>)}</tr></thead> }
function Cell({ children }: { children: React.ReactNode }) { return <td className="max-w-64 whitespace-nowrap px-4 py-3 align-top">{children}</td> }
function StickyName({ employee }: { employee: Employee }) { return <td className="sticky left-0 z-10 min-w-48 bg-inherit px-4 py-3 font-bold text-slate-950"><div>{employee.name}</div><div className="mt-1 text-xs font-normal text-slate-500">{employee.email}</div></td> }
function ActionButton({ label, onClick, disabled = false }: { label: string; onClick: () => void; disabled?: boolean }) { return <button className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 shadow-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40" disabled={disabled} onClick={onClick}>{label}</button> }
function EmptyRow({ columns }: { columns: number }) { return <tr><td className="px-5 py-10 text-center text-slate-500" colSpan={columns}>No employees match this view.</td></tr> }
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="text-sm font-bold text-slate-700">{label}{children}</label> }
function SimpleStatusTable({ employees, type, openEdit, check }: { employees: Employee[]; type: 'insurance' | 'retirement'; openEdit: (employee: Employee) => void; check: (employee: Employee, action: string, label: string) => void }) { const insurance = type === 'insurance'; return <table className="min-w-full text-sm"><TableHead labels={['Employee','Participation','Ending Date','Status','Checked By','Action']} /><tbody className="divide-y divide-slate-100">{employees.map(employee => { const participation = insurance ? employee.insuranceParticipation : employee.retirementParticipation; const endingDate = insurance ? employee.insuranceEndingDate : employee.retirementEndingDate; const checkedAt = insurance ? employee.insuranceCobraCheckedAt : employee.retirementCheckedAt; const checkedBy = insurance ? employee.insuranceCobraCheckedBy : employee.retirementCheckedBy; return <tr key={employee.id}><StickyName employee={employee} /><Cell>{participation === 'participated' ? 'Participated' : participation === 'not-participated' ? 'Not Participated' : 'Not Set'}</Cell><Cell>{dateDisplay(endingDate)}</Cell><Cell>{statusPill(Boolean(checkedAt))}</Cell><Cell>{checkedBy || '--'}</Cell><Cell>{checkedAt ? statusPill(true, 'Action Taken') : participation ? <ActionButton label="Confirm Action Taken" onClick={() => check(employee, insurance ? 'insurance-cobra-check' : 'retirement-check', insurance ? 'Insurance & COBRA Action' : '401(k) Action')} /> : <ActionButton label="Set Details" onClick={() => openEdit(employee)} />}</Cell></tr> })}{!employees.length && <EmptyRow columns={6} />}</tbody></table> }

function TrackerModal({ employee, catalog, tracker, setTracker, error, manager, close, save }: { employee: Employee; catalog: TrackerField[]; tracker: any; setTracker: (value: any) => void; error: string; manager: boolean; close: () => void; save: (action: 'save' | 'submit' | 'lock') => void }) {
  const locked = Boolean(employee.fileTracker?.finalLockedAt)
  const submitted = Boolean(employee.fileTracker?.submittedAt)
  return <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/60 p-4"><div className="max-h-[92vh] w-full max-w-3xl overflow-auto rounded-2xl bg-white shadow-2xl"><div className="sticky top-0 z-10 flex items-center justify-between border-b bg-white px-6 py-4"><div><h2 className="flex items-center gap-2 text-xl font-semibold"><FolderOpen className="h-5 w-5 text-rose-700" />Termination File Tracker</h2><p className="text-sm text-slate-500">{employee.name}</p></div><button onClick={close}><X className="h-5 w-5" /></button></div><div className="space-y-5 p-6">
    <div className={`rounded-xl border p-4 text-sm font-semibold ${locked ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : submitted ? 'border-blue-200 bg-blue-50 text-blue-800' : 'border-amber-200 bg-amber-50 text-amber-800'}`}>{locked ? 'Final locked — this record is read-only.' : submitted ? 'Administrator confirmed — awaiting upper-level manager lock.' : 'Complete the checklist, save progress, then confirm for final review.'}</div>
    <div className="grid gap-4 sm:grid-cols-2">{catalog.map(field => <Field label={field.label} key={field.id}><select className="mt-1 block w-full rounded-lg border border-slate-300 p-2.5 font-normal disabled:bg-slate-100" disabled={locked || submitted} value={tracker.responses?.[field.id] || ''} onChange={e => setTracker({ ...tracker, responses: { ...tracker.responses, [field.id]: e.target.value } })}><option value="">Select...</option>{field.options.map(option => <option key={option}>{option}</option>)}</select></Field>)}</div>
    <Field label="Administrator Comments"><textarea className="mt-1 block min-h-24 w-full rounded-lg border border-slate-300 p-2.5 font-normal disabled:bg-slate-100" disabled={locked || submitted} value={tracker.comments || ''} onChange={e => setTracker({ ...tracker, comments: e.target.value })} /></Field>
    <Field label="Confirmation Date"><input className="mt-1 block w-full max-w-xs rounded-lg border border-slate-300 p-2.5 font-normal disabled:bg-slate-100" disabled={locked || submitted} type="date" value={tracker.confirmationDate || ''} onChange={e => setTracker({ ...tracker, confirmationDate: e.target.value })} /></Field>
    {error && <div className="rounded-lg bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</div>}
  </div><div className="sticky bottom-0 flex flex-wrap justify-between gap-3 border-t bg-white px-6 py-4"><div className="inline-flex items-center gap-2 text-xs font-semibold text-slate-500"><Settings className="h-4 w-4" />Checklist items follow the Employee File Checklist Manager.</div><div className="flex gap-2"><button className="rounded-lg border px-4 py-2 text-sm font-semibold" onClick={close}>Close</button>{!locked && !submitted && <><button className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold" onClick={() => save('save')}>Save Progress</button><button className="rounded-lg bg-rose-700 px-4 py-2 text-sm font-semibold text-white" onClick={() => save('submit')}>Confirm Tracker</button></>}{submitted && manager && !locked && <button className="inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white" onClick={() => save('lock')}><Lock className="h-4 w-4" />Final Lock</button>}</div></div></div></div>
}

