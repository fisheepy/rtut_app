import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowDown, ArrowLeft, ArrowUp, ArrowUpDown, BookOpenCheck, ExternalLink, GraduationCap, KeyRound, Link2, LogOut, Mail, RefreshCw, Search, ShieldCheck, UsersRound, X } from 'lucide-react'
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
  folderUrl: string
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
  | 'folderLink'
  | 'orientation'
  | 'monthly'

type SortDirection = 'asc' | 'desc'

const columns: { key: ColumnKey; label: string }[] = [
  { key: 'employeeName', label: 'Employee Name' },
  { key: 'folderLink', label: 'Employee Folder' },
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
  folderLink: [],
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
  if (key === 'folderLink') return employee.folderUrl ? 'Linked' : 'Not linked'
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

function TrainingLogin({ onLogin }: { onLogin: () => void }) {
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
      await api.post('/training-auth/request-code', { email: email.trim() })
      setCodeSent(true)
      setMessage('A 6-digit code was sent to your email. It expires in 10 minutes.')
    } catch (requestError: any) {
      setMessage(requestError.response?.data?.error || 'The login code could not be sent.')
    } finally {
      setIsSending(false)
    }
  }

  async function verifyCode(event: React.FormEvent) {
    event.preventDefault()
    setIsVerifying(true)
    setMessage('Verifying your code...')
    try {
      await api.post('/training-auth/verify-code', {
        email: email.trim(),
        code: code.trim(),
      })
      onLogin()
    } catch (requestError: any) {
      setMessage(requestError.response?.data?.error || 'Invalid or expired login code.')
    } finally {
      setIsVerifying(false)
    }
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-white/70 bg-white shadow-2xl">
      <div className="grid lg:grid-cols-[0.9fr_1.1fr]">
        <div className="relative overflow-hidden bg-slate-950 p-8 text-white md:p-10">
          <div className="absolute -right-20 -top-20 h-72 w-72 rounded-full bg-emerald-500/30 blur-3xl" />
          <div className="absolute -bottom-24 left-12 h-64 w-64 rounded-full bg-cyan-400/20 blur-3xl" />
          <div className="relative">
            <Link className="inline-flex items-center gap-2 text-sm font-semibold text-slate-300 hover:text-white" to="/">
              <ArrowLeft className="h-4 w-4" />
              Back to HR Tools
            </Link>
            <div className="mt-8 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-semibold text-emerald-100">
              <ShieldCheck className="h-4 w-4" />
              Authorized Access Only
            </div>
            <h1 className="mt-5 text-4xl font-semibold">Training Tools</h1>
            <p className="mt-4 max-w-md text-sm leading-6 text-slate-300">
              Employee training records are protected. Request a one-time code using an authorized email address.
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
                  className="w-full rounded-lg border border-slate-200 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
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
                  className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-center text-xl font-semibold tracking-[0.35em] outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                  inputMode="numeric"
                  maxLength={6}
                  onChange={(event) => setCode(event.target.value.replace(/\D/g, ''))}
                  placeholder="000000"
                  value={code}
                />
              </label>
            ) : null}
            <button
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={codeSent ? code.length !== 6 || isVerifying : !email.trim() || isSending}
              type="submit"
            >
              <KeyRound className="h-4 w-4" />
              {codeSent ? (isVerifying ? 'Signing in...' : 'Sign in with code') : (isSending ? 'Sending...' : 'Email me a code')}
            </button>
            {codeSent ? (
              <button
                className="w-full text-sm font-semibold text-emerald-700 hover:text-emerald-800 disabled:opacity-50"
                disabled={isSending}
                onClick={requestCode}
                type="button"
              >
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

export default function TrainingTools() {
  const [authState, setAuthState] = useState<'checking' | 'authenticated' | 'signed-out'>('checking')

  useEffect(() => {
    api.get('/training-auth/me')
      .then(() => setAuthState('authenticated'))
      .catch(() => setAuthState('signed-out'))
  }, [])

  if (authState === 'checking') {
    return (
      <div className="grid min-h-64 place-items-center rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="text-center">
          <RefreshCw className="mx-auto h-7 w-7 animate-spin text-emerald-600" />
          <p className="mt-3 text-sm font-semibold text-slate-700">Checking secure access...</p>
        </div>
      </div>
    )
  }

  if (authState === 'signed-out') return <TrainingLogin onLogin={() => setAuthState('authenticated')} />

  return <TrainingWorkspace onLogout={() => setAuthState('signed-out')} />
}

function TrainingWorkspace({ onLogout }: { onLogout: () => void }) {
  const tableScrollRef = useRef<HTMLDivElement>(null)
  const stickyScrollRef = useRef<HTMLDivElement>(null)
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
  const [linkEmployee, setLinkEmployee] = useState<TrainingEmployee | null>(null)
  const [folderUrl, setFolderUrl] = useState('')
  const [linkError, setLinkError] = useState('')
  const [isSavingLink, setIsSavingLink] = useState(false)
  const [tableScrollWidth, setTableScrollWidth] = useState(0)
  const [showBackToTop, setShowBackToTop] = useState(false)

  async function loadEmployees(showLoading = true) {
    if (showLoading) setIsLoading(true)
    setError('')
    try {
      const response = await api.get('/training/employees')
      setEmployees(response.data.employees || [])
      setSource(response.data.source || '')
    } catch (requestError: any) {
      if (requestError.response?.status === 401) {
        onLogout()
        return
      }
      setError(requestError.response?.data?.error || 'Employee training information could not be loaded. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  async function logout() {
    await api.post('/training-auth/logout').catch(() => {})
    onLogout()
  }

  useEffect(() => {
    loadEmployees()
    const refreshTimer = window.setInterval(() => loadEmployees(false), 30_000)
    return () => window.clearInterval(refreshTimer)
  }, [])

  useEffect(() => {
    const updateBackToTop = () => setShowBackToTop(window.scrollY > 500)
    updateBackToTop()
    window.addEventListener('scroll', updateBackToTop, { passive: true })
    return () => window.removeEventListener('scroll', updateBackToTop)
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

  function editFolderLink(employee: TrainingEmployee) {
    setLinkEmployee(employee)
    setFolderUrl(employee.folderUrl || '')
    setLinkError('')
  }

  async function saveFolderLink(event: React.FormEvent) {
    event.preventDefault()
    if (!linkEmployee) return
    setIsSavingLink(true)
    setLinkError('')
    try {
      const response = await api.put(`/training/employees/${linkEmployee.id}/folder-link`, {
        folderUrl: folderUrl.trim(),
      })
      setEmployees((current) => current.map((employee) => (
        employee.id === linkEmployee.id
          ? { ...employee, folderUrl: response.data.folderUrl || '' }
          : employee
      )))
      setLinkEmployee(null)
    } catch (requestError: any) {
      if (requestError.response?.status === 401) {
        setLinkEmployee(null)
        onLogout()
        return
      }
      setLinkError(requestError.response?.data?.error || 'The employee folder link could not be saved.')
    } finally {
      setIsSavingLink(false)
    }
  }

  const activeCount = employees.filter((employee) => employee.employmentStatus === 'Active').length
  const terminatedCount = employees.length - activeCount

  useEffect(() => {
    const tableScroller = tableScrollRef.current
    if (!tableScroller) return
    const updateScrollWidth = () => setTableScrollWidth(tableScroller.scrollWidth)
    updateScrollWidth()
    const resizeObserver = new ResizeObserver(updateScrollWidth)
    resizeObserver.observe(tableScroller)
    const table = tableScroller.querySelector('table')
    if (table) resizeObserver.observe(table)
    return () => resizeObserver.disconnect()
  }, [visibleEmployees.length, view])

  function syncHorizontalScroll(source: 'table' | 'sticky') {
    const tableScroller = tableScrollRef.current
    const stickyScroller = stickyScrollRef.current
    if (!tableScroller || !stickyScroller) return
    if (source === 'table') stickyScroller.scrollLeft = tableScroller.scrollLeft
    else tableScroller.scrollLeft = stickyScroller.scrollLeft
  }

  return (
    <div className="space-y-6 pb-10">
      <section className="relative overflow-hidden rounded-2xl border border-white/70 bg-slate-950 px-6 py-7 text-white shadow-xl md:px-8">
        <div className="absolute -right-16 -top-20 h-64 w-64 rounded-full bg-emerald-500/30 blur-3xl" />
        <div className="absolute -bottom-24 left-24 h-56 w-56 rounded-full bg-cyan-400/20 blur-3xl" />
        <div className="relative">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Link className="inline-flex items-center gap-2 text-sm font-semibold text-slate-300 hover:text-white" to="/">
              <ArrowLeft className="h-4 w-4" />
              Back to HR Tools
            </Link>
            <button className="inline-flex items-center gap-2 text-sm font-semibold text-slate-300 hover:text-white" onClick={logout} type="button">
              <LogOut className="h-4 w-4" />
              Sign out
            </button>
          </div>
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
          <div
            className="overflow-auto"
            onScroll={() => syncHorizontalScroll('table')}
            ref={tableScrollRef}
          >
            <table className="w-full min-w-[1500px] text-sm">
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
                    <td className="border-b px-4 py-3">
                      <div className="flex flex-col items-start gap-1.5">
                        {employee.folderUrl ? (
                          <a
                            className="inline-flex items-center gap-1.5 rounded-md bg-blue-50 px-2.5 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100"
                            href={employee.folderUrl}
                            rel="noreferrer"
                            target="_blank"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                            Open Folder
                          </a>
                        ) : (
                          <span className="text-xs text-slate-400">Not linked</span>
                        )}
                        <button
                          className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:text-emerald-800"
                          onClick={() => editFolderLink(employee)}
                          type="button"
                        >
                          <Link2 className="h-3.5 w-3.5" />
                          {employee.folderUrl ? 'Edit Link' : 'Add Link'}
                        </button>
                      </div>
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

      {!isLoading && !error && visibleEmployees.length > 0 ? (
        <div className="fixed inset-x-0 bottom-0 z-50 border-t border-slate-200 bg-white/95 px-5 pb-1 pt-1.5 shadow-[0_-6px_18px_-14px_rgba(15,23,42,0.65)] backdrop-blur">
          <div className="mx-auto max-w-7xl">
            <div className="mb-0.5 text-center text-[10px] font-semibold uppercase tracking-wide text-slate-400">Drag left or right to scroll the table</div>
            <div
              aria-label="Horizontal table scroll bar"
              className="h-4 overflow-x-scroll overflow-y-hidden rounded bg-slate-100"
              onScroll={() => syncHorizontalScroll('sticky')}
              ref={stickyScrollRef}
              role="scrollbar"
            >
              <div className="h-px" style={{ width: `${tableScrollWidth}px` }} />
            </div>
          </div>
        </div>
      ) : null}

      {showBackToTop ? (
        <button
          aria-label="Back to top"
          className="fixed bottom-14 right-5 z-[60] inline-flex items-center gap-2 rounded-full bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white shadow-xl hover:bg-emerald-700 md:right-8"
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          type="button"
        >
          <ArrowUp className="h-4 w-4" />
          Back to Top
        </button>
      ) : null}

      {linkEmployee ? (
        <div className="fixed inset-0 z-[100] grid place-items-center bg-slate-950/55 p-4" role="presentation">
          <section
            aria-labelledby="folder-link-title"
            aria-modal="true"
            className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl"
            role="dialog"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-slate-950" id="folder-link-title">Employee Folder Link</h2>
                <p className="mt-1 text-sm text-slate-500">{linkEmployee.employeeName}</p>
              </div>
              <button
                aria-label="Close employee folder link"
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
                onClick={() => setLinkEmployee(null)}
                type="button"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <form className="mt-5" onSubmit={saveFolderLink}>
              <label className="block text-sm font-semibold text-slate-700" htmlFor="employee-folder-url">
                SharePoint folder URL
              </label>
              <input
                autoFocus
                className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                id="employee-folder-url"
                onChange={(event) => setFolderUrl(event.target.value)}
                placeholder="Paste the employee's SharePoint folder link"
                type="url"
                value={folderUrl}
              />
              <p className="mt-2 text-xs text-slate-500">
                Only secure links from royaltruck.sharepoint.com are accepted. Leave this blank to remove the current link.
              </p>
              {linkError ? <div className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{linkError}</div> : null}
              <div className="mt-5 flex justify-end gap-3">
                <button
                  className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  onClick={() => setLinkEmployee(null)}
                  type="button"
                >
                  Cancel
                </button>
                <button
                  className="inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={isSavingLink}
                  type="submit"
                >
                  {isSavingLink ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
                  Save Link
                </button>
              </div>
            </form>
          </section>
        </div>
      ) : null}

    </div>
  )
}
