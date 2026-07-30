import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, BookOpenCheck, GraduationCap, RefreshCw, Search, UsersRound } from 'lucide-react'
import { Link } from 'react-router-dom'
import { api } from '../shared/api'

type TrainingStatus = {
  status: string
  completedAt: string | null
}

type TrainingEmployee = {
  id: string
  employeeName: string
  jobTitle: string
  location: string
  department: string
  firstDay: string
  terminationDay: string | null
  reportingTo: string
  employmentStatus: 'Active' | 'Terminated'
  training: {
    orientation: TrainingStatus
    monthly: TrainingStatus
  }
}

function displayDate(value?: string | null) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

function TrainingBadge({ training }: { training: TrainingStatus }) {
  const completed = training.status.toLowerCase() === 'completed'
  const inProgress = training.status.toLowerCase() === 'in progress'
  const tone = completed
    ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
    : inProgress
      ? 'bg-blue-50 text-blue-700 ring-blue-200'
      : 'bg-slate-100 text-slate-600 ring-slate-200'

  return (
    <div>
      <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${tone}`}>
        {training.status}
      </span>
      {training.completedAt ? <div className="mt-1 text-xs text-slate-500">{displayDate(training.completedAt)}</div> : null}
    </div>
  )
}

export default function TrainingTools() {
  const [employees, setEmployees] = useState<TrainingEmployee[]>([])
  const [source, setSource] = useState('')
  const [search, setSearch] = useState('')
  const [view, setView] = useState<'active' | 'terminated'>('active')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')

  async function loadEmployees(showLoading = true) {
    if (showLoading) setIsLoading(true)
    setError('')
    try {
      const response = await api.get('/training/employees')
      setEmployees(response.data.employees || [])
      setSource(response.data.source || '')
    } catch (requestError: any) {
      setError(requestError.response?.data?.error || 'Employee training information could not be loaded. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadEmployees()
    const refreshTimer = window.setInterval(() => loadEmployees(false), 30_000)
    return () => window.clearInterval(refreshTimer)
  }, [])

  const visibleEmployees = useMemo(() => {
    const query = search.trim().toLowerCase()
    return employees.filter((employee) => {
      const matchesStatus = employee.employmentStatus.toLowerCase() === view
      const matchesSearch = !query || [
        employee.employeeName,
        employee.jobTitle,
        employee.location,
        employee.department,
        employee.reportingTo,
      ].some((value) => value.toLowerCase().includes(query))
      return matchesStatus && matchesSearch
    })
  }, [employees, search, view])

  const activeCount = employees.filter((employee) => employee.employmentStatus === 'Active').length
  const terminatedCount = employees.length - activeCount

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-2xl border border-white/70 bg-slate-950 px-6 py-7 text-white shadow-xl md:px-8">
        <div className="absolute -right-16 -top-20 h-64 w-64 rounded-full bg-emerald-500/30 blur-3xl" />
        <div className="absolute -bottom-24 left-24 h-56 w-56 rounded-full bg-cyan-400/20 blur-3xl" />
        <div className="relative">
          <Link className="inline-flex items-center gap-2 text-sm font-semibold text-slate-300 hover:text-white" to="/">
            <ArrowLeft className="h-4 w-4" />
            Back to HR Tools
          </Link>
          <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-semibold text-emerald-100">
            <GraduationCap className="h-4 w-4" />
            Training Operations
          </div>
          <h1 className="mt-4 text-4xl font-semibold tracking-normal md:text-5xl">Training Tools</h1>
          <p className="mt-3 max-w-2xl text-base leading-7 text-slate-300">
            Review employee details and track Orientation Training and Monthly Training in one place.
          </p>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase text-slate-500"><UsersRound className="h-4 w-4" />Employees</div>
          <div className="mt-2 text-3xl font-semibold text-slate-950">{employees.length}</div>
        </div>
        <button className={`rounded-xl border p-4 text-left shadow-sm transition ${view === 'active' ? 'border-emerald-400 bg-emerald-50 ring-2 ring-emerald-100' : 'border-slate-200 bg-white hover:border-emerald-200'}`} onClick={() => setView('active')} type="button">
          <div className="text-xs font-semibold uppercase text-emerald-700">Active</div>
          <div className="mt-2 text-3xl font-semibold text-emerald-800">{activeCount}</div>
          <div className="mt-1 text-xs text-emerald-700">Open active employees</div>
        </button>
        <button className={`rounded-xl border p-4 text-left shadow-sm transition ${view === 'terminated' ? 'border-slate-500 bg-slate-100 ring-2 ring-slate-200' : 'border-slate-200 bg-white hover:border-slate-300'}`} onClick={() => setView('terminated')} type="button">
          <div className="text-xs font-semibold uppercase text-slate-500">Terminated</div>
          <div className="mt-2 text-3xl font-semibold text-slate-700">{terminatedCount}</div>
          <div className="mt-1 text-xs text-slate-500">Open terminated employees</div>
        </button>
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 p-5">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <BookOpenCheck className="h-5 w-5 text-emerald-700" />
                <h2 className="text-xl font-semibold text-slate-950">{view === 'active' ? 'Active Employees' : 'Terminated Employees'}</h2>
              </div>
              <p className="mt-1 text-sm text-slate-500">{source ? `Employee data: ${source}` : 'Employee and training records'}</p>
            </div>
            <button className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50" onClick={() => loadEmployees()} type="button">
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row">
            <label className="relative flex-1">
              <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
              <input
                className="w-full rounded-lg border border-slate-200 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search by employee, job, location, department, or manager"
                type="search"
                value={search}
              />
            </label>
            <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-1">
              <button className={`rounded-md px-3 py-1.5 text-sm font-semibold ${view === 'active' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500'}`} onClick={() => setView('active')} type="button">Active Employees</button>
              <button className={`rounded-md px-3 py-1.5 text-sm font-semibold ${view === 'terminated' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'}`} onClick={() => setView('terminated')} type="button">Terminated Employees</button>
            </div>
          </div>
        </div>

        {error ? (
          <div className="m-5 rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
            <div className="font-semibold">Unable to load employee training information</div>
            <div className="mt-1">{error}</div>
            <button className="mt-3 font-semibold underline" onClick={() => loadEmployees()} type="button">Try again</button>
          </div>
        ) : isLoading ? (
          <div className="grid min-h-64 place-items-center p-8 text-center">
            <div>
              <RefreshCw className="mx-auto h-7 w-7 animate-spin text-emerald-600" />
              <div className="mt-3 font-semibold text-slate-800">Loading employee training information...</div>
            </div>
          </div>
        ) : visibleEmployees.length === 0 ? (
          <div className="grid min-h-64 place-items-center p-8 text-center">
            <div>
              <GraduationCap className="mx-auto h-9 w-9 text-slate-400" />
              <div className="mt-3 font-semibold text-slate-800">{employees.length ? `No ${view} employees match this search.` : 'No employee records are available.'}</div>
              <div className="mt-1 text-sm text-slate-500">{employees.length ? 'Try a different search.' : 'Employee records will appear after they are added to Company App.'}</div>
            </div>
          </div>
        ) : (
          <div className="overflow-auto">
            <table className="w-full min-w-[1320px] text-sm">
              <thead className="bg-slate-50">
                <tr>
                  {['Employee Name', 'Job Title', 'Location', 'Department', 'Reporting To', 'First Day', 'Status', 'Orientation Training', 'Monthly Training'].map((heading) => (
                    <th className="border-b px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500" key={heading}>{heading}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visibleEmployees.map((employee) => (
                  <tr className={employee.employmentStatus === 'Terminated' ? 'bg-slate-50 text-slate-500' : 'even:bg-slate-50/50'} key={employee.id}>
                    <td className="border-b px-4 py-3">
                      <div className="font-semibold text-slate-900">{employee.employeeName || 'Unnamed employee'}</div>
                      <span className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${employee.employmentStatus === 'Active' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-200 text-slate-600'}`}>{employee.employmentStatus}</span>
                    </td>
                    <td className="border-b px-4 py-3">{employee.jobTitle || '—'}</td>
                    <td className="border-b px-4 py-3">{employee.location || '—'}</td>
                    <td className="border-b px-4 py-3">{employee.department || '—'}</td>
                    <td className="border-b px-4 py-3">{employee.reportingTo || '—'}</td>
                    <td className="border-b px-4 py-3 whitespace-nowrap">{displayDate(employee.firstDay)}</td>
                    <td className="border-b px-4 py-3">
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${employee.employmentStatus === 'Active' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-200 text-slate-600'}`}>
                        {employee.employmentStatus}
                      </span>
                    </td>
                    <td className="border-b px-4 py-3"><TrainingBadge training={employee.training.orientation} /></td>
                    <td className="border-b px-4 py-3"><TrainingBadge training={employee.training.monthly} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {!isLoading && !error && employees.length ? (
          <div className="border-t border-slate-200 bg-slate-50 px-5 py-3 text-sm text-slate-600">
            Showing <span className="font-semibold text-slate-900">{visibleEmployees.length}</span> {view} employees.
          </div>
        ) : null}
      </section>

    </div>
  )
}
