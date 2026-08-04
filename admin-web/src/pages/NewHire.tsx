import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, ExternalLink, Filter, FolderOpen, RefreshCw, RotateCcw, Save, Search, UserPlus, X } from 'lucide-react'
import { api } from '../shared/api'

type NewHireEmployee = {
  id: string; name: string; email: string; phone: string; hireDate: string; homeDepartment: string
  jobTitle: string; location: string; supervisor: string; eeoc: string; employmentCategory: string
  payCategory: string; positionStatus: string; accountActive: string; activated: string
  employeeFolderUrl: string; firstPayrollDate: string; insuranceEffectiveDate: string; retirementEffectiveDate: string
}

type EditableRecord = Pick<NewHireEmployee, 'employeeFolderUrl' | 'firstPayrollDate' | 'insuranceEffectiveDate' | 'retirementEffectiveDate'>

const emptyRecord: EditableRecord = { employeeFolderUrl: '', firstPayrollDate: '', insuranceEffectiveDate: '', retirementEffectiveDate: '' }
const emptyFilters = { homeDepartment: '', jobTitle: '', location: '', supervisor: '', employmentCategory: '', payCategory: '', activated: '' }
const display = (value: string) => value || '—'
const dateDisplay = (value: string) => {
  if (!value) return '—'
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/)
  return match ? `${match[2]}/${match[3]}/${match[1]}` : value
}

export default function NewHire() {
  const [employees, setEmployees] = useState<NewHireEmployee[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [filters, setFilters] = useState(emptyFilters)
  const [editing, setEditing] = useState<NewHireEmployee | null>(null)
  const [record, setRecord] = useState<EditableRecord>(emptyRecord)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')

  async function loadEmployees() {
    setLoading(true)
    setError('')
    try {
      const response = await api.get('/hr-platform/new-hires')
      setEmployees(response.data || [])
    } catch (requestError: any) {
      setError(requestError.response?.data?.error || 'New Hire records could not be loaded.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadEmployees() }, [])

  const filteredEmployees = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return employees.filter(employee => {
      if (needle && !Object.values(employee).some(value => String(value || '').toLowerCase().includes(needle))) return false
      return Object.entries(filters).every(([field, value]) => !value || String(employee[field as keyof NewHireEmployee] || '') === value)
    })
  }, [employees, filters, query])

  const filterFields = [
    ['homeDepartment', 'Home Department'], ['jobTitle', 'Job Title'], ['location', 'Location'], ['supervisor', 'Supervisor'],
    ['employmentCategory', 'Employment Category'], ['payCategory', 'Pay Category'], ['activated', 'App Activated'],
  ] as const

  const filterOptions = useMemo(() => Object.fromEntries(filterFields.map(([field]) => [
    field,
    [...new Set(employees.map(employee => employee[field]).filter(Boolean))].sort((left, right) => left.localeCompare(right)),
  ])), [employees]) as Record<keyof typeof emptyFilters, string[]>

  function openRecord(employee: NewHireEmployee) {
    setEditing(employee)
    setRecord({
      employeeFolderUrl: employee.employeeFolderUrl,
      firstPayrollDate: employee.firstPayrollDate,
      insuranceEffectiveDate: employee.insuranceEffectiveDate,
      retirementEffectiveDate: employee.retirementEffectiveDate,
    })
    setSaveError('')
  }

  async function saveRecord() {
    if (!editing) return
    setSaving(true)
    setSaveError('')
    try {
      const response = await api.put(`/hr-platform/new-hires/${editing.id}`, record)
      setEmployees(current => current.map(employee => employee.id === editing.id ? { ...employee, ...response.data } : employee))
      setEditing(null)
    } catch (requestError: any) {
      setSaveError(requestError.response?.data?.error || 'The New Hire record could not be saved.')
    } finally {
      setSaving(false)
    }
  }

  const columns = [
    ['Employee Folder', (employee: NewHireEmployee) => employee.employeeFolderUrl ? <a className="inline-flex items-center gap-1 font-semibold text-blue-700 hover:underline" href={employee.employeeFolderUrl} rel="noreferrer" target="_blank">Open Folder<ExternalLink className="h-3.5 w-3.5" /></a> : <button className="font-semibold text-emerald-700 hover:underline" onClick={() => openRecord(employee)} type="button">+ Add Link</button>],
    ['Hire Date', (employee: NewHireEmployee) => dateDisplay(employee.hireDate)],
    ['Email', (employee: NewHireEmployee) => display(employee.email)], ['Phone', (employee: NewHireEmployee) => display(employee.phone)],
    ['Home Department', (employee: NewHireEmployee) => display(employee.homeDepartment)], ['Job Title', (employee: NewHireEmployee) => display(employee.jobTitle)],
    ['Location', (employee: NewHireEmployee) => display(employee.location)], ['Supervisor', (employee: NewHireEmployee) => display(employee.supervisor)],
    ['Employment Category', (employee: NewHireEmployee) => display(employee.employmentCategory)], ['Pay Category', (employee: NewHireEmployee) => display(employee.payCategory)],
    ['App Activated', (employee: NewHireEmployee) => display(employee.activated)],
    ['First Payroll Date', (employee: NewHireEmployee) => employee.firstPayrollDate ? dateDisplay(employee.firstPayrollDate) : <button className="font-semibold text-emerald-700 hover:underline" onClick={() => openRecord(employee)} type="button">+ Add Date</button>],
    ['Insurance Effective Date', (employee: NewHireEmployee) => employee.insuranceEffectiveDate ? dateDisplay(employee.insuranceEffectiveDate) : <button className="font-semibold text-emerald-700 hover:underline" onClick={() => openRecord(employee)} type="button">+ Add Date</button>],
    ['401(k) Effective Date', (employee: NewHireEmployee) => employee.retirementEffectiveDate ? dateDisplay(employee.retirementEffectiveDate) : <button className="font-semibold text-emerald-700 hover:underline" onClick={() => openRecord(employee)} type="button">+ Add Date</button>],
  ] as const

  return (
    <div className="space-y-6">
      <section className="rounded-2xl bg-slate-950 px-6 py-7 text-white shadow-xl">
        <Link className="inline-flex items-center gap-2 text-sm font-semibold text-slate-300 hover:text-white" to="/hr-platform"><ArrowLeft className="h-4 w-4" />Back to HR Platform</Link>
        <div className="mt-6 flex flex-wrap items-end justify-between gap-4">
          <div><div className="inline-flex items-center gap-2 rounded-full bg-emerald-500/15 px-3 py-1.5 text-xs font-semibold text-emerald-200"><UserPlus className="h-4 w-4" />New Hire Only</div><h1 className="mt-4 text-4xl font-semibold">New Hire</h1><p className="mt-2 text-sm leading-6 text-slate-300">Only employees added through Company App after this feature was enabled appear here. Existing employees are not imported.</p></div>
          <button className="inline-flex items-center gap-2 rounded-lg border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold hover:bg-white/15 disabled:opacity-50" disabled={loading} onClick={loadEmployees} type="button"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />Refresh from Company App</button>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3"><label className="relative block w-full max-w-md"><Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" /><input className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100" onChange={event => setQuery(event.target.value)} placeholder="Search new hire records" value={query} /></label><span className="text-sm font-semibold text-slate-600">{filteredEmployees.length} employees</span></div>
        <div className="mt-4 border-t border-slate-100 pt-4">
          <div className="mb-3 flex items-center justify-between gap-3"><div className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700"><Filter className="h-4 w-4 text-emerald-700" />Filters</div><button className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-emerald-700" onClick={() => { setFilters(emptyFilters); setQuery('') }} type="button"><RotateCcw className="h-3.5 w-3.5" />Reset all</button></div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{filterFields.map(([field, label]) => <label className="block" key={field}><span className="mb-1 block text-xs font-semibold text-slate-500">{label}</span><select className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100" onChange={event => setFilters(current => ({ ...current, [field]: event.target.value }))} value={filters[field]}><option value="">All</option>{filterOptions[field].map(option => <option key={option} value={option}>{option}</option>)}</select></label>)}</div>
        </div>
      </section>

      {error ? <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">{error}</div> : null}
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="max-h-[70vh] overflow-auto">
          <table className="min-w-[2500px] w-full border-separate border-spacing-0 text-sm">
            <thead className="sticky top-0 z-30 bg-slate-100 text-left text-xs uppercase tracking-wide text-slate-600"><tr><th className="sticky left-0 z-40 min-w-52 border-b border-r border-slate-200 bg-slate-100 px-4 py-3">Name</th>{columns.map(([label]) => <th className="whitespace-nowrap border-b border-slate-200 px-4 py-3" key={label}>{label}</th>)}<th className="sticky right-0 z-40 border-b border-l border-slate-200 bg-slate-100 px-4 py-3">Manage</th></tr></thead>
            <tbody>{loading ? <tr><td className="px-4 py-12 text-center text-slate-500" colSpan={columns.length + 2}>Loading Company App employees...</td></tr> : filteredEmployees.length ? filteredEmployees.map(employee => <tr className="group hover:bg-emerald-50/40" key={employee.id}><th className="sticky left-0 z-20 border-b border-r border-slate-200 bg-white px-4 py-3 text-left font-semibold text-slate-950 group-hover:bg-emerald-50">{employee.name}</th>{columns.map(([label, value]) => <td className="whitespace-nowrap border-b border-slate-100 px-4 py-3 text-slate-700" key={label}>{value(employee)}</td>)}<td className="sticky right-0 z-20 border-b border-l border-slate-200 bg-white px-4 py-2 group-hover:bg-emerald-50"><button className="inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-800" onClick={() => openRecord(employee)} type="button"><FolderOpen className="h-4 w-4" />Manage</button></td></tr>) : <tr><td className="px-4 py-12 text-center text-slate-500" colSpan={columns.length + 2}>No employees match this search.</td></tr>}</tbody>
          </table>
        </div>
      </section>

      {editing ? <div aria-modal="true" className="fixed inset-0 z-50 grid place-items-center bg-slate-950/60 p-4" role="dialog"><section className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-2xl"><div className="flex items-start justify-between gap-4"><div><h2 className="text-xl font-semibold text-slate-950">Manage New Hire Record</h2><p className="mt-1 text-sm text-slate-500">{editing.name}</p></div><button aria-label="Close" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" onClick={() => setEditing(null)} type="button"><X className="h-5 w-5" /></button></div><div className="mt-6 space-y-4"><label className="block"><span className="text-sm font-semibold text-slate-700">Employee Folder Link</span><input className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100" onChange={event => setRecord(current => ({ ...current, employeeFolderUrl: event.target.value }))} placeholder="https://royaltruck.sharepoint.com/..." type="url" value={record.employeeFolderUrl} /></label><div className="grid gap-4 sm:grid-cols-3">{([['firstPayrollDate', 'First Payroll Date'], ['insuranceEffectiveDate', 'Insurance Effective Date'], ['retirementEffectiveDate', '401(k) Effective Date']] as const).map(([field, label]) => <label className="block" key={field}><span className="text-sm font-semibold text-slate-700">{label}</span><input className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100" onChange={event => setRecord(current => ({ ...current, [field]: event.target.value }))} type="date" value={record[field]} /></label>)}</div>{saveError ? <p className="rounded-lg bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{saveError}</p> : null}</div><div className="mt-6 flex justify-end gap-3"><button className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100" onClick={() => setEditing(null)} type="button">Cancel</button><button className="inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-50" disabled={saving} onClick={saveRecord} type="button"><Save className="h-4 w-4" />{saving ? 'Saving...' : 'Save Record'}</button></div></section></div> : null}
    </div>
  )
}
