import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Filter, HeartPulse, RefreshCw, Search } from 'lucide-react'
import { api } from '../shared/api'
import { isAuthenticationError, SessionExpired } from '../shared/hrPlatformUi'

type LeaveEmployee = {
  id: string; leaveRecordId: string; name: string; email: string; phone: string; status: string;
  hireDate: string; department: string; jobTitle: string; location: string; supervisor: string;
  leaveStartedAt: string | null;
}

const dateDisplay = (value?: string | null) => value ? new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00` : value).toLocaleDateString('en-US') : '--'

export default function MedicalLeave() {
  const [employees, setEmployees] = useState<LeaveEmployee[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [department, setDepartment] = useState('')
  const [location, setLocation] = useState('')

  async function load() {
    setLoading(true); setError('')
    try {
      const response = await api.get('/hr-platform/leaves')
      setEmployees(response.data || [])
    } catch (requestError: any) {
      setError(requestError.response?.data?.error || 'FMLA / ADA / Medical Leave records could not be loaded.')
    } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const visible = useMemo(() => employees.filter(employee => {
    const needle = query.trim().toLowerCase()
    if (needle && !`${employee.name} ${employee.email} ${employee.phone} ${employee.department} ${employee.jobTitle} ${employee.location} ${employee.supervisor}`.toLowerCase().includes(needle)) return false
    if (department && employee.department !== department) return false
    if (location && employee.location !== location) return false
    return true
  }), [employees, query, department, location])
  const departments = [...new Set(employees.map(employee => employee.department).filter(Boolean))].sort()
  const locations = [...new Set(employees.map(employee => employee.location).filter(Boolean))].sort()

  if (!loading && isAuthenticationError(error)) return <SessionExpired />

  return <div className="space-y-7 pb-12">
    <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-violet-950 to-fuchsia-900 px-7 py-8 text-white shadow-2xl">
      <div className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-fuchsia-400/15 blur-3xl" />
      <Link className="relative inline-flex items-center gap-2 text-sm font-semibold text-violet-100 hover:text-white" to="/hr-platform"><ArrowLeft className="h-4 w-4" />Back to HR Platform</Link>
      <div className="relative mt-6 flex flex-wrap items-end justify-between gap-4"><div><div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-bold uppercase tracking-wider"><HeartPulse className="h-4 w-4" />Protected & Medical Leave</div><h1 className="mt-3 text-4xl font-semibold">FMLA / ADA / Medical Leave</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-violet-100">Employees whose Company App Status is Leave appear here automatically. They remain active Company App employees and are not treated as terminated.</p></div><button className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-violet-950 shadow" onClick={load}><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />Refresh from Company App</button></div>
    </section>

    {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-800">{error}</div>}

    <section className="grid gap-4 sm:grid-cols-3">
      <div className="rounded-2xl border border-violet-200 bg-violet-50 p-5 shadow-sm"><div className="text-xs font-bold uppercase tracking-wider text-violet-700">Employees on Leave</div><div className="mt-2 text-3xl font-bold text-violet-950">{employees.length}</div></div>
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 shadow-sm"><div className="text-xs font-bold uppercase tracking-wider text-emerald-700">Company App Status</div><div className="mt-2 text-xl font-bold text-emerald-950">Leave</div></div>
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="text-xs font-bold uppercase tracking-wider text-slate-500">Employment Status</div><div className="mt-2 text-xl font-bold text-slate-950">Active — Not Terminated</div></div>
    </section>

    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><div className="flex flex-wrap items-center gap-3"><label className="relative min-w-72 flex-1"><Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" /><input className="w-full rounded-xl border border-slate-300 py-2.5 pl-9 pr-3 text-sm" placeholder="Search employee, department, job title, location, or supervisor..." value={query} onChange={event => setQuery(event.target.value)} /></label><button className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-bold ${showFilters || department || location ? 'border-violet-300 bg-violet-50 text-violet-800' : 'border-slate-300 text-slate-700'}`} onClick={() => setShowFilters(value => !value)}><Filter className="h-4 w-4" />Filters</button><span className="text-sm font-bold text-slate-500">{visible.length} employees</span></div>{showFilters && <div className="mt-4 grid gap-3 border-t pt-4 sm:grid-cols-3"><FilterField label="Department" value={department} onChange={setDepartment} options={departments} /><FilterField label="Location" value={location} onChange={setLocation} options={locations} /><button className="self-end rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-bold" onClick={() => { setDepartment(''); setLocation(''); setQuery('') }}>Reset Filters</button></div>}</section>

    <section className="overflow-hidden rounded-3xl border border-violet-200 bg-white shadow-xl"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-violet-200 bg-gradient-to-r from-violet-50 via-fuchsia-50 to-white px-6 py-5"><div><h2 className="text-xl font-bold text-violet-950">Employees Currently on Leave</h2><p className="mt-1 text-sm text-violet-700">Change the employee Status back to Active in Company App when the employee returns.</p></div><span className="rounded-full bg-white px-3.5 py-1.5 text-sm font-bold text-violet-800 shadow-sm">{visible.length} employees</span></div><div className="max-h-[620px] overflow-auto"><table className="min-w-[1250px] w-full text-sm"><thead className="sticky top-0 z-20 bg-slate-100 text-left text-xs uppercase text-slate-600"><tr>{['Employee','Status','Leave Status Since','Hire Date','Department','Job Title','Location','Supervisor','Email','Phone'].map((label, index) => <th className={`whitespace-nowrap px-4 py-3 ${index === 0 ? 'sticky left-0 z-30 bg-slate-100' : ''}`} key={label}>{label}</th>)}</tr></thead><tbody>{visible.map(employee => <tr className="border-t transition hover:bg-violet-50/40" key={employee.id}><td className="sticky left-0 z-10 min-w-56 border-r-4 border-violet-100 bg-white px-4 py-3 font-bold">{employee.name}<div className="text-xs font-normal text-slate-500">Active employee</div></td><td className="px-4 py-3"><span className="rounded-full bg-violet-100 px-2.5 py-1 text-xs font-bold text-violet-800">Leave</span></td><td className="px-4 py-3 font-semibold">{dateDisplay(employee.leaveStartedAt)}</td><td className="px-4 py-3">{dateDisplay(employee.hireDate)}</td><td className="px-4 py-3">{employee.department || '--'}</td><td className="px-4 py-3">{employee.jobTitle || '--'}</td><td className="px-4 py-3">{employee.location || '--'}</td><td className="px-4 py-3">{employee.supervisor || '--'}</td><td className="px-4 py-3">{employee.email || '--'}</td><td className="px-4 py-3">{employee.phone || '--'}</td></tr>)}{!visible.length && <tr><td className="px-6 py-14 text-center text-slate-500" colSpan={10}>{loading ? 'Loading leave employees...' : employees.length ? 'No employees match these filters.' : 'No employees currently have Leave status in Company App.'}</td></tr>}</tbody></table></div></section>
  </div>
}

function FilterField({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: string[] }) {
  return <label className="text-xs font-bold text-slate-600">{label}<select className="mt-1 block w-full rounded-xl border border-slate-300 p-2.5 text-sm font-normal" value={value} onChange={event => onChange(event.target.value)}><option value="">All {label}s</option>{options.map(option => <option key={option}>{option}</option>)}</select></label>
}
