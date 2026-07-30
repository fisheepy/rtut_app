import { useEffect, useMemo, useState } from 'react'
import { ArrowDown, ArrowLeft, ArrowUp, ArrowUpDown, BookOpenCheck, GraduationCap, RefreshCw, Search, UsersRound, X } from 'lucide-react'
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

type ColumnKey =
  | 'employeeName'
  | 'jobTitle'
  | 'location'
  | 'department'
  | 'reportingTo'
  | 'firstDay'
  | 'employmentStatus'
  | 'orientation'
  | 'monthly'

type SortDirection = 'asc' | 'desc'

const columns: { key: ColumnKey; label: string }[] = [
  { key: 'employeeName', label: 'Employee Name' },
  { key: 'jobTitle', label: 'Job Title' },
  { key: 'location', label: 'Location' },
  { key: 'department', label: 'Department' },
  { key: 'reportingTo', label: 'Reporting To' },
  { key: 'firstDay', label: 'First Day' },
  { key: 'employmentStatus', label: 'Status' },
  { key: 'orientation', label: 'Orientation Training' },
  { key: 'monthly', label: 'Monthly Training' },
]

const emptyColumnFilters: Record<ColumnKey, string[]> = {
  employeeName: [],
  jobTitle: [],
  location: [],
  department: [],
  reportingTo: [],
  firstDay: [],
  employmentStatus: [],
  orientation: [],
  monthly: [],
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

function getColumnValue(employee: TrainingEmployee, key: ColumnKey) {
  if (key === 'orientation') return employee.training.orientation.status
  if (key === 'monthly') return employee.training.monthly.status
  return employee[key] || ''
}

function getColumnFilterValue(employee: TrainingEmployee, key: ColumnKey) {
  const value = getColumnValue(employee, key)
  if (!value) return 'Not specified'
  return key === 'firstDay' ? displayDate(value) : value
}

function ColumnMultiFilter({
  label,
  options,
  selected,
  onChange,
}: {
  label: string
  options: string[]
  selected: string[]
  onChange: (values: string[]) => void
}) {
  return (
    <details className="group relative">
      <summary
        aria-label={`Filter ${label}`}
        className={`flex min-w-[130px] cursor-pointer list-none items-center justify-between gap-2 rounded-md border bg-white px-2.5 py-1.5 text-xs font-normal outline-none marker:hidden focus:ring-2 focus:ring-emerald-100 ${
          selected.length ? 'border-emerald-400 text-emerald-800' : 'border-slate-200 text-slate-600'
        }`}
      >
        <span className="truncate">{selected.length ? `${selected.length} selected` : 'All'}</span>
        <span className="text-[10px] text-slate-400 group-open:rotate-180">▼</span>
      </summary>
      <div className="absolute left-0 z-50 mt-1 max-h-64 min-w-[220px] overflow-auto rounded-lg border border-slate-200 bg-white p-2 text-left shadow-xl">
        <div className="mb-1 flex items-center justify-between gap-3 border-b border-slate-100 px-1 pb-2">
          <span className="text-xs font-semibold text-slate-700">{label}</span>
          {selected.length ? (
            <button className="text-xs font-semibold text-emerald-700 hover:text-emerald-800" onClick={() => onChange([])} type="button">
              Clear
            </button>
          ) : null}
        </div>
        {options.map((option) => (
          <label className="flex cursor-pointer items-start gap-2 rounded px-1 py-1.5 text-xs font-normal text-slate-700 hover:bg-slate-50" key={option}>
            <input
              checked={selected.includes(option)}
              className="mt-0.5 h-3.5 w-3.5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
              onChange={(event) => onChange(
                event.target.checked
                  ? [...selected, option]
                  : selected.filter((value) => value !== option),
              )}
              type="checkbox"
            />
            <span>{option}</span>
          </label>
        ))}
      </div>
    </details>
  )
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
  const [columnFilters, setColumnFilters] = useState<Record<ColumnKey, string[]>>(emptyColumnFilters)
  const [sort, setSort] = useState<{ key: ColumnKey; direction: SortDirection }>({
    key: 'employeeName',
    direction: 'asc',
  })
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
    return employees
      .filter((employee) => {
        const matchesStatus = employee.employmentStatus.toLowerCase() === view
        const matchesSearch = !query || [
          employee.employeeName,
          employee.jobTitle,
          employee.location,
          employee.department,
          employee.reportingTo,
        ].some((value) => value.toLowerCase().includes(query))
        const matchesColumnFilters = columns.every(({ key }) => (
          !columnFilters[key].length
          || columnFilters[key].includes(getColumnFilterValue(employee, key))
        ))
        return matchesStatus && matchesSearch && matchesColumnFilters
      })
      .sort((left, right) => {
        const leftValue = getColumnValue(left, sort.key)
        const rightValue = getColumnValue(right, sort.key)
        const comparison = leftValue.localeCompare(rightValue, undefined, {
          numeric: true,
          sensitivity: 'base',
        })
        return sort.direction === 'asc' ? comparison : -comparison
      })
  }, [columnFilters, employees, search, sort, view])

  const columnOptions = useMemo(() => Object.fromEntries(
    columns.map(({ key }) => [
      key,
      Array.from(new Set(
        employees
          .filter((employee) => employee.employmentStatus.toLowerCase() === view)
          .map((employee) => getColumnFilterValue(employee, key)),
      )).sort((left, right) => left.localeCompare(right, undefined, { numeric: true, sensitivity: 'base' })),
    ]),
  ) as Record<ColumnKey, string[]>, [employees, view])

  const hasColumnFilters = Object.values(columnFilters).some((values) => values.length)

  function toggleSort(key: ColumnKey) {
    setSort((current) => ({
      key,
      direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc',
    }))
  }

  function changeView(nextView: 'active' | 'terminated') {
    setView(nextView)
    setColumnFilters(emptyColumnFilters)
  }

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
        <button className={`rounded-xl border p-4 text-left shadow-sm transition ${view === 'active' ? 'border-emerald-400 bg-emerald-50 ring-2 ring-emerald-100' : 'border-slate-200 bg-white hover:border-emerald-200'}`} onClick={() => changeView('active')} type="button">
          <div className="text-xs font-semibold uppercase text-emerald-700">Active</div>
          <div className="mt-2 text-3xl font-semibold text-emerald-800">{activeCount}</div>
          <div className="mt-1 text-xs text-emerald-700">Open active employees</div>
        </button>
        <button className={`rounded-xl border p-4 text-left shadow-sm transition ${view === 'terminated' ? 'border-slate-500 bg-slate-100 ring-2 ring-slate-200' : 'border-slate-200 bg-white hover:border-slate-300'}`} onClick={() => changeView('terminated')} type="button">
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
              <button className={`rounded-md px-3 py-1.5 text-sm font-semibold ${view === 'active' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500'}`} onClick={() => changeView('active')} type="button">Active Employees</button>
              <button className={`rounded-md px-3 py-1.5 text-sm font-semibold ${view === 'terminated' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'}`} onClick={() => changeView('terminated')} type="button">Terminated Employees</button>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
            <span>Employee Name stays visible while you scroll horizontally. Open a filter below any heading and check one or more values.</span>
            {hasColumnFilters ? (
              <button
                className="inline-flex items-center gap-1 font-semibold text-emerald-700 hover:text-emerald-800"
                onClick={() => setColumnFilters(emptyColumnFilters)}
                type="button"
              >
                <X className="h-3.5 w-3.5" />
                Clear column filters
              </button>
            ) : null}
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
                  {columns.map((column, index) => (
                    <th
                      className={`border-b px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 ${
                        index === 0
                          ? 'sticky left-0 z-30 min-w-[220px] border-r border-slate-200 bg-slate-50 shadow-[4px_0_8px_-6px_rgba(15,23,42,0.45)]'
                          : ''
                      }`}
                      key={column.key}
                    >
                      <button
                        aria-label={`Sort ${column.label} ${sort.key === column.key && sort.direction === 'asc' ? 'descending' : 'ascending'}`}
                        className="inline-flex w-full items-center justify-between gap-2 text-left hover:text-slate-800"
                        onClick={() => toggleSort(column.key)}
                        type="button"
                      >
                        <span>{column.label}</span>
                        {sort.key !== column.key ? (
                          <ArrowUpDown className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                        ) : sort.direction === 'asc' ? (
                          <ArrowUp className="h-3.5 w-3.5 shrink-0 text-emerald-700" />
                        ) : (
                          <ArrowDown className="h-3.5 w-3.5 shrink-0 text-emerald-700" />
                        )}
                      </button>
                    </th>
                  ))}
                </tr>
                <tr>
                  {columns.map((column, index) => (
                    <th
                      className={`border-b px-3 pb-3 ${
                        index === 0
                          ? 'sticky left-0 z-30 min-w-[220px] border-r border-slate-200 bg-slate-50 shadow-[4px_0_8px_-6px_rgba(15,23,42,0.45)]'
                          : 'bg-slate-50'
                      }`}
                      key={`${column.key}-filter`}
                    >
                      <ColumnMultiFilter
                        label={column.label}
                        onChange={(values) => setColumnFilters((current) => ({
                          ...current,
                          [column.key]: values,
                        }))}
                        options={columnOptions[column.key]}
                        selected={columnFilters[column.key]}
                      />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visibleEmployees.map((employee) => (
                  <tr className={employee.employmentStatus === 'Terminated' ? 'bg-slate-50 text-slate-500' : 'even:bg-slate-50/50'} key={employee.id}>
                    <td className={`sticky left-0 z-20 min-w-[220px] border-b border-r border-slate-200 px-4 py-3 shadow-[4px_0_8px_-6px_rgba(15,23,42,0.45)] ${
                      employee.employmentStatus === 'Terminated' ? 'bg-slate-50' : 'bg-white'
                    }`}>
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
