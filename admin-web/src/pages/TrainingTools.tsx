import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowDown, ArrowLeft, ArrowUp, ArrowUpDown, BookOpenCheck, Download, ExternalLink, GraduationCap, KeyRound, Link2, LogOut, Mail, Plus, RefreshCw, Search, Settings, ShieldCheck, Trash2, UsersRound, X } from 'lucide-react'
import { Link } from 'react-router-dom'
import { api } from '../shared/api'

type TrainingStatus = {
  status: string
  completedAt: string | null
}

type CourseProgress = {
  completedAt: string | null
  folderUpdated: boolean
}

type OrientationTraining = TrainingStatus & {
  assignedLibraryIds: string[]
  assignedLibraries: OrientationLibrary[]
  courseProgress: Record<string, CourseProgress>
  completedCourseCount: number
  requiredCourseCount: number
}

type OrientationLibrary = {
  id: string
  name: string
  link: string
  accessCode: string
  courses: { id: string; title: string }[]
}

type MonthlyTopic = {
  id: string
  name: string
  targetDate: string
  link: string
  accessCode: string
  courses: { id: string; title: string }[]
}

type MonthlyAssignment = {
  topic: MonthlyTopic
  requirement: 'Unassigned' | 'Required' | 'Not Required'
  completionStatus: 'Unfinished' | 'Finished'
  completionDate: string | null
  folderUpdated: boolean
}

type MonthlyTraining = TrainingStatus & {
  assignments: MonthlyAssignment[]
  requiredCount: number
  finishedCount: number
}

type TrainingEmployee = {
  id: string
  employeeName: string
  email: string
  contactNumber: string
  jobTitle: string
  location: string
  department: string
  firstDay: string
  terminationDay: string | null
  reportingTo: string
  folderUrl: string
  employmentStatus: 'Active' | 'Terminated'
  training: {
    orientation: OrientationTraining
    monthly: MonthlyTraining
  }
}

type StaticColumnKey =
  | 'employeeName'
  | 'email'
  | 'contactNumber'
  | 'jobTitle'
  | 'location'
  | 'department'
  | 'reportingTo'
  | 'firstDay'
  | 'folderLink'
  | 'orientation'
  | 'monthlyOverview'

type MonthlyColumnField = 'requirement' | 'completionStatus' | 'completionDate' | 'folderUpdated'
type MonthlyColumnKey = `monthly:${string}:${MonthlyColumnField}`
type ColumnKey = StaticColumnKey | MonthlyColumnKey

type ReportCourseOption = {
  id: string
  trainingType: 'orientation' | 'monthly'
  label: string
  libraryId?: string
  courseId?: string
  topicId?: string
}

type SortDirection = 'asc' | 'desc'

const columns: { key: ColumnKey; label: string }[] = [
  { key: 'employeeName', label: 'Employee Name' },
  { key: 'folderLink', label: 'Employee Folder' },
  { key: 'email', label: 'Email' },
  { key: 'contactNumber', label: 'Contact Number' },
  { key: 'jobTitle', label: 'Job Title' },
  { key: 'location', label: 'Location' },
  { key: 'department', label: 'Department' },
  { key: 'reportingTo', label: 'Reporting To' },
  { key: 'firstDay', label: 'Hire Date' },
  { key: 'orientation', label: 'Orientation Training' },
  { key: 'monthlyOverview', label: 'Monthly Training' },
]

const monthlySubcolumns: { field: MonthlyColumnField; label: string }[] = [
  { field: 'requirement', label: 'Required' },
  { field: 'completionStatus', label: 'Completion' },
  { field: 'completionDate', label: 'Date' },
  { field: 'folderUpdated', label: 'Folder' },
]

const emptyColumnFilters: Record<string, string[]> = {
  employeeName: [],
  email: [],
  contactNumber: [],
  jobTitle: [],
  location: [],
  department: [],
  reportingTo: [],
  firstDay: [],
  folderLink: [],
  orientation: [],
  monthlyOverview: [],
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
  if (key.startsWith('monthly:')) {
    const [, topicId, field] = key.split(':') as [string, string, MonthlyColumnField]
    const assignment = employee.training.monthly.assignments.find((item) => item.topic.id === topicId)
    if (!assignment) return field === 'requirement' ? 'Unassigned' : 'Blocked'
    if (field === 'requirement') return assignment.requirement
    if (field === 'completionStatus') return assignment.requirement === 'Required' ? assignment.completionStatus : 'Blocked'
    if (field === 'completionDate') return assignment.requirement === 'Required' ? assignment.completionDate || '' : 'Blocked'
    return assignment.requirement === 'Required' ? assignment.folderUpdated ? 'Updated' : 'Not Updated' : 'Blocked'
  }
  if (key === 'orientation') return employee.training.orientation.status
  if (key === 'monthlyOverview') return 'Manage'
  if (key === 'folderLink') return employee.folderUrl ? 'Linked' : 'Not linked'
  const employeeKey = key as Exclude<StaticColumnKey, 'folderLink' | 'orientation' | 'monthlyOverview'>
  return String(employee[employeeKey] || '')
}

function isTestMonthlyTopic(name: string) {
  return ['hr test training', 'hr testing training'].includes(name.trim().toLowerCase())
}

function getColumnFilterValue(employee: TrainingEmployee, key: ColumnKey) {
  const value = getColumnValue(employee, key)
  if (!value) return 'Not specified'
  return key === 'firstDay' || key.endsWith(':completionDate') ? displayDate(value) : value
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
  const completed = ['completed', 'finished'].includes(training.status.toLowerCase())
  const inProgress = ['in progress', 'in process'].includes(training.status.toLowerCase())
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
  const [orientationLibraries, setOrientationLibraries] = useState<OrientationLibrary[]>([])
  const [monthlyTopics, setMonthlyTopics] = useState<MonthlyTopic[]>([])
  const [source, setSource] = useState('')
  const [search, setSearch] = useState('')
  const [view, setView] = useState<'active' | 'terminated'>('active')
  const [columnFilters, setColumnFilters] = useState<Record<string, string[]>>(emptyColumnFilters)
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
  const [orientationEmployee, setOrientationEmployee] = useState<TrainingEmployee | null>(null)
  const [assignedLibraryIds, setAssignedLibraryIds] = useState<string[]>([])
  const [assignedLibrarySnapshots, setAssignedLibrarySnapshots] = useState<OrientationLibrary[]>([])
  const [courseProgress, setCourseProgress] = useState<Record<string, CourseProgress>>({})
  const [orientationError, setOrientationError] = useState('')
  const [isSavingOrientation, setIsSavingOrientation] = useState(false)
  const [showOrientationSettings, setShowOrientationSettings] = useState(false)
  const [libraryEditor, setLibraryEditor] = useState<OrientationLibrary | null>(null)
  const [isNewLibrary, setIsNewLibrary] = useState(false)
  const [libraryError, setLibraryError] = useState('')
  const [isSavingLibrary, setIsSavingLibrary] = useState(false)
  const [libraryPendingDelete, setLibraryPendingDelete] = useState<OrientationLibrary | null>(null)
  const [showReportOptions, setShowReportOptions] = useState(false)
  const [reportTrainingType, setReportTrainingType] = useState<'orientation' | 'monthly'>('orientation')
  const [reportCourseIds, setReportCourseIds] = useState<string[]>([])
  const [reportStatus, setReportStatus] = useState('All Statuses')
  const [reportTargetDateFrom, setReportTargetDateFrom] = useState(`${new Date().getFullYear()}-01-01`)
  const [reportTargetDateTo, setReportTargetDateTo] = useState(`${new Date().getFullYear()}-12-31`)
  const [selectedMonthlyYear, setSelectedMonthlyYear] = useState(String(new Date().getFullYear()))
  const [monthlyEmployee, setMonthlyEmployee] = useState<TrainingEmployee | null>(null)
  const [monthlyAssignments, setMonthlyAssignments] = useState<MonthlyAssignment[]>([])
  const [monthlyError, setMonthlyError] = useState('')
  const [isSavingMonthly, setIsSavingMonthly] = useState(false)
  const [showMonthlySettings, setShowMonthlySettings] = useState(false)
  const [topicEditor, setTopicEditor] = useState<MonthlyTopic | null>(null)
  const [isNewTopic, setIsNewTopic] = useState(false)
  const [topicError, setTopicError] = useState('')
  const [isSavingTopic, setIsSavingTopic] = useState(false)
  const [topicPendingDelete, setTopicPendingDelete] = useState<MonthlyTopic | null>(null)
  const [autoAssignJobTitles, setAutoAssignJobTitles] = useState<string[]>([])
  const [autoAssignLocations, setAutoAssignLocations] = useState<string[]>([])
  const [tableScrollWidth, setTableScrollWidth] = useState(0)
  const [showBackToTop, setShowBackToTop] = useState(false)

  async function loadEmployees(showLoading = true) {
    if (showLoading) setIsLoading(true)
    setError('')
    try {
      const response = await api.get('/training/employees')
      setEmployees(response.data.employees || [])
      setOrientationLibraries(response.data.orientationLibraries || [])
      setMonthlyTopics(response.data.monthlyTopics || [])
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

  const allMonthlyTopics = useMemo(() => {
    const byId = new Map<string, MonthlyTopic>()
    employees.forEach((employee) => employee.training.monthly.assignments.forEach((assignment) => {
      byId.set(assignment.topic.id, assignment.topic)
    }))
    monthlyTopics.forEach((topic) => byId.set(topic.id, topic))
    return Array.from(byId.values()).filter((topic) => !isTestMonthlyTopic(topic.name))
  }, [employees, monthlyTopics])

  const allOrientationLibraries = useMemo(() => {
    const byId = new Map<string, OrientationLibrary>()
    employees.forEach((employee) => employee.training.orientation.assignedLibraries.forEach((library) => byId.set(library.id, library)))
    orientationLibraries.forEach((library) => byId.set(library.id, library))
    return Array.from(byId.values())
  }, [employees, orientationLibraries])

  const monthlyYears = useMemo(() => Array.from(new Set([
    String(new Date().getFullYear()),
    ...allMonthlyTopics.map((topic) => topic.targetDate?.slice(0, 4)).filter((year): year is string => Boolean(year)),
  ])).sort((left, right) => right.localeCompare(left)), [allMonthlyTopics])

  const displayedMonthlyTopics = useMemo(() => allMonthlyTopics.filter((topic) => (
    topic.targetDate?.slice(0, 4) === selectedMonthlyYear
  )).sort((left, right) => left.targetDate.localeCompare(right.targetDate) || left.name.localeCompare(right.name)), [allMonthlyTopics, selectedMonthlyYear])

  const allColumns = useMemo(() => [
    ...columns,
    ...displayedMonthlyTopics.flatMap((topic): { key: ColumnKey; label: string }[] => monthlySubcolumns.map((column) => ({
      key: `monthly:${topic.id}:${column.field}`,
      label: `${topic.name} — ${column.label}`,
    }))),
  ], [displayedMonthlyTopics])

  const visibleEmployees = useMemo(() => {
    const query = search.trim().toLowerCase()
    return employees
      .filter((employee) => {
        const matchesStatus = employee.employmentStatus.toLowerCase() === view
        const matchesSearch = !query || [
          employee.employeeName,
          employee.email,
          employee.contactNumber,
          employee.jobTitle,
          employee.location,
          employee.department,
          employee.reportingTo,
        ].some((value) => value.toLowerCase().includes(query))
        const matchesColumnFilters = allColumns.every(({ key }) => (
          !columnFilters[key]?.length
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
  }, [allColumns, columnFilters, employees, search, sort, view])

  const columnOptions = useMemo(() => Object.fromEntries(
    allColumns.map(({ key }) => [
      key,
      Array.from(new Set(
        employees
          .filter((employee) => employee.employmentStatus.toLowerCase() === view)
          .map((employee) => getColumnFilterValue(employee, key)),
      )).sort((left, right) => left.localeCompare(right, undefined, { numeric: true, sensitivity: 'base' })),
    ]),
  ) as Record<string, string[]>, [allColumns, employees, view])

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
  const activeJobTitles = Array.from(new Set(employees.filter((employee) => employee.employmentStatus === 'Active' && employee.jobTitle).map((employee) => employee.jobTitle))).sort()
  const activeLocations = Array.from(new Set(employees.filter((employee) => employee.employmentStatus === 'Active' && employee.location).map((employee) => employee.location))).sort()
  const autoAssignMatchCount = employees.filter((employee) => employee.employmentStatus === 'Active'
    && (!autoAssignJobTitles.length || autoAssignJobTitles.includes(employee.jobTitle))
    && (!autoAssignLocations.length || autoAssignLocations.includes(employee.location))
    && Boolean(autoAssignJobTitles.length || autoAssignLocations.length)).length
  const reportCourseOptions = useMemo<ReportCourseOption[]>(() => reportTrainingType === 'orientation'
    ? allOrientationLibraries.flatMap((library) => library.courses.map((course) => ({
        id: `orientation:${library.id}:${course.id}`,
        trainingType: 'orientation' as const,
        label: `${library.name} - ${course.title}`,
        libraryId: library.id,
        courseId: course.id,
      })))
    : allMonthlyTopics
      .filter((topic) => (!reportTargetDateFrom || topic.targetDate >= reportTargetDateFrom) && (!reportTargetDateTo || topic.targetDate <= reportTargetDateTo))
      .flatMap((topic) => (topic.courses.length ? topic.courses : [{ id: 'topic', title: topic.name }]).map((course) => ({
        id: `monthly:${topic.id}:${course.id}`,
        trainingType: 'monthly' as const,
        label: `${topic.name} - ${course.title} (${topic.targetDate?.slice(0, 4) || 'No year'})`,
        topicId: topic.id,
      }))), [allMonthlyTopics, allOrientationLibraries, reportTargetDateFrom, reportTargetDateTo, reportTrainingType])

  const selectedReportCourses = reportCourseOptions.filter((option) => reportCourseIds.includes(option.id))

  function getCourseReportStatus(employee: TrainingEmployee, course: ReportCourseOption) {
    if (!course) return 'Unassigned'
    if (course.trainingType === 'orientation') {
      const assigned = employee.training.orientation.assignedLibraries.some((library) => library.id === course.libraryId)
      if (!assigned) return 'Unassigned'
      const progress = employee.training.orientation.courseProgress[`${course.libraryId}:${course.courseId}`]
      return progress?.completedAt ? 'Finished' : 'Unfinished'
    }
    const assignment = employee.training.monthly.assignments.find((item) => item.topic.id === course.topicId)
    if (!assignment || assignment.requirement === 'Unassigned') return 'Unassigned'
    if (assignment.requirement === 'Not Required') return 'Not Required'
    return assignment.completionStatus
  }

  const reportStatusOptions = selectedReportCourses.length
    ? Array.from(new Set(selectedReportCourses.flatMap((course) => employees.map((employee) => getCourseReportStatus(employee, course))))).sort()
    : []
  const selectedOrientationLibraries = assignedLibrarySnapshots.filter((library) => assignedLibraryIds.includes(library.id))
  const orientationRequiredCount = selectedOrientationLibraries.reduce((total, library) => total + library.courses.length, 0)
  const orientationCompletedCount = selectedOrientationLibraries.reduce((total, library) => (
    total + library.courses.filter((course) => {
      const progress = courseProgress[`${library.id}:${course.id}`]
      return Boolean(progress?.completedAt && progress?.folderUpdated)
    }).length
  ), 0)
  const orientationDraftStatus = !assignedLibraryIds.length
    ? 'Unassigned'
    : orientationCompletedCount === orientationRequiredCount
      ? 'Finished'
      : 'In Process'
  const monthlyRequiredAssignments = monthlyAssignments.filter((assignment) => assignment.requirement === 'Required')
  const monthlyFinishedCount = monthlyRequiredAssignments.filter((assignment) => assignment.completionStatus === 'Finished' && assignment.completionDate).length
  const monthlyDraftStatus = !monthlyAssignments.length || monthlyAssignments.every((assignment) => assignment.requirement === 'Unassigned')
    ? 'Unassigned'
    : monthlyAssignments.some((assignment) => assignment.requirement === 'Unassigned')
      || monthlyRequiredAssignments.some((assignment) => assignment.completionStatus !== 'Finished' || !assignment.completionDate)
      ? 'In Process'
      : 'Finished'

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

  function editOrientation(employee: TrainingEmployee) {
    setOrientationEmployee(employee)
    setAssignedLibraryIds([...employee.training.orientation.assignedLibraryIds])
    setAssignedLibrarySnapshots(JSON.parse(JSON.stringify(employee.training.orientation.assignedLibraries || [])))
    setCourseProgress(JSON.parse(JSON.stringify(employee.training.orientation.courseProgress || {})))
    setOrientationError('')
  }

  function toggleOrientationLibrary(libraryId: string) {
    setAssignedLibraryIds((current) => {
      if (current.includes(libraryId)) {
        setAssignedLibrarySnapshots((snapshots) => snapshots.filter((library) => library.id !== libraryId))
        return current.filter((id) => id !== libraryId)
      }
      const library = orientationLibraries.find((item) => item.id === libraryId)
      if (library) setAssignedLibrarySnapshots((snapshots) => [...snapshots, JSON.parse(JSON.stringify(library))])
      return [...current, libraryId]
    })
  }

  function updateCourseProgress(key: string, update: Partial<CourseProgress>) {
    setCourseProgress((current) => ({
      ...current,
      [key]: {
        completedAt: current[key]?.completedAt || null,
        folderUpdated: current[key]?.folderUpdated || false,
        ...update,
      },
    }))
  }

  async function saveOrientation() {
    if (!orientationEmployee) return
    setIsSavingOrientation(true)
    setOrientationError('')
    try {
      const response = await api.put(`/training/employees/${orientationEmployee.id}/orientation`, {
        assignedLibraryIds,
        courseProgress,
      })
      setEmployees((current) => current.map((employee) => (
        employee.id === orientationEmployee.id
          ? {
              ...employee,
              training: { ...employee.training, orientation: response.data.orientation },
            }
          : employee
      )))
      setOrientationEmployee(null)
    } catch (requestError: any) {
      if (requestError.response?.status === 401) {
        setOrientationEmployee(null)
        onLogout()
        return
      }
      setOrientationError(requestError.response?.data?.error || 'Orientation training could not be saved.')
    } finally {
      setIsSavingOrientation(false)
    }
  }

  function downloadTrainingReport() {
    if (!selectedReportCourses.length) return
    const rows = selectedReportCourses.flatMap((course) => employees.map((employee) => {
      const courseStatus = getCourseReportStatus(employee, course)
      if (reportStatus !== 'All Statuses' && courseStatus !== reportStatus) return null
      const orientationProgress = course.trainingType === 'orientation'
        ? employee.training.orientation.courseProgress[`${course.libraryId}:${course.courseId}`]
        : null
      const monthlyAssignment = course.trainingType === 'monthly'
        ? employee.training.monthly.assignments.find((item) => item.topic.id === course.topicId)
        : null
      return [
        course.trainingType === 'orientation' ? 'Orientation Training' : 'Monthly Training',
        course.label,
        courseStatus,
        employee.employeeName,
        employee.email,
        employee.contactNumber,
        employee.employmentStatus,
        employee.jobTitle,
        employee.location,
        employee.department,
        employee.reportingTo,
        employee.firstDay,
        orientationProgress?.completedAt || monthlyAssignment?.completionDate || '',
        orientationProgress?.folderUpdated || monthlyAssignment?.folderUpdated ? 'Yes' : 'No',
      ]
    }).filter((row): row is string[] => Boolean(row)))
      .sort((left, right) => left[1].localeCompare(right[1]) || left[2].localeCompare(right[2]) || left[3].localeCompare(right[3]))
    const csvCell = (value: string) => `"${String(value || '').replace(/"/g, '""')}"`
    const csv = [
      ['Training Type', 'Training Course', 'Course Status', 'Employee Name', 'Email', 'Contact Number', 'Employment Status', 'Job Title', 'Location', 'Department', 'Reporting To', 'Hire Date', 'Completion Date', 'Folder Updated'],
      ...rows,
    ].map((row) => row.map(csvCell).join(',')).join('\r\n')
    const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' }))
    const link = document.createElement('a')
    link.href = url
    const statusName = reportStatus === 'All Statuses' ? 'all-statuses' : reportStatus.toLowerCase().replace(' ', '-')
    const reportName = selectedReportCourses.length === 1
      ? selectedReportCourses[0].label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
      : `${selectedReportCourses.length}-training-courses`
    link.download = `${reportName}-${statusName}-report-${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
    setShowReportOptions(false)
  }

  function downloadEmployeeTrainingReport(employee: TrainingEmployee) {
    const rows: string[][] = []
    employee.training.orientation.assignedLibraries.forEach((library) => library.courses.forEach((course) => {
      const progress = employee.training.orientation.courseProgress[`${library.id}:${course.id}`]
      const status = progress?.completedAt && progress.folderUpdated ? 'Finished' : 'Unfinished'
      rows.push(['Orientation Training', library.name, course.title, status, progress?.completedAt || '', progress?.folderUpdated ? 'Yes' : 'No'])
    }))
    employee.training.monthly.assignments.forEach((assignment) => {
      if (!isTestMonthlyTopic(assignment.topic.name) && assignment.requirement === 'Required') {
        rows.push(['Monthly Training', assignment.topic.name, assignment.topic.courses.map((course) => course.title).join('; '), assignment.completionStatus, assignment.completionDate || '', assignment.folderUpdated ? 'Yes' : 'No'])
      }
    })
    rows.sort((left, right) => left[3].localeCompare(right[3]) || left[4].localeCompare(right[4]) || left[1].localeCompare(right[1]))
    const csvCell = (value: string) => `"${String(value || '').replace(/"/g, '""')}"`
    const employeeDetails = [
      ['Employee Name', employee.employeeName],
      ['Email', employee.email],
      ['Job Title', employee.jobTitle],
      ['Location', employee.location],
      ['Department', employee.department],
      ['Hire Date', employee.firstDay],
      [],
      ['Training Type', 'Training Program / Topic', 'Course(s)', 'Training Status', 'Completion Date', 'Folder Updated'],
      ...rows,
    ]
    const csv = employeeDetails.map((row) => row.map(csvCell).join(',')).join('\r\n')
    const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' }))
    const link = document.createElement('a')
    link.href = url
    link.download = `${employee.employeeName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-assigned-training-report-${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
  }

  function openOrientationSettings() {
    setShowOrientationSettings(true)
    setLibraryEditor(null)
    setLibraryPendingDelete(null)
    setLibraryError('')
  }

  function editLibrary(library?: OrientationLibrary) {
    setLibraryEditor(library
      ? JSON.parse(JSON.stringify(library))
      : { id: '', name: '', link: '', accessCode: '', courses: [{ id: '', title: '' }] })
    setIsNewLibrary(!library)
    setLibraryPendingDelete(null)
    setLibraryError('')
  }

  function updateLibraryCourse(index: number, title: string) {
    setLibraryEditor((current) => current ? {
      ...current,
      courses: current.courses.map((course, courseIndex) => (
        courseIndex === index ? { ...course, title } : course
      )),
    } : current)
  }

  function removeLibraryCourse(index: number) {
    setLibraryEditor((current) => current ? {
      ...current,
      courses: current.courses.filter((_course, courseIndex) => courseIndex !== index),
    } : current)
  }

  async function saveLibrary(event: React.FormEvent) {
    event.preventDefault()
    if (!libraryEditor) return
    setIsSavingLibrary(true)
    setLibraryError('')
    try {
      const response = isNewLibrary
        ? await api.post('/training/orientation-libraries', libraryEditor)
        : await api.put(`/training/orientation-libraries/${libraryEditor.id}`, libraryEditor)
      const savedLibrary = response.data.library as OrientationLibrary
      setOrientationLibraries((current) => isNewLibrary
        ? [...current, savedLibrary]
        : current.map((library) => library.id === savedLibrary.id ? savedLibrary : library))
      setLibraryEditor(null)
      await loadEmployees(false)
    } catch (requestError: any) {
      if (requestError.response?.status === 401) {
        setShowOrientationSettings(false)
        onLogout()
        return
      }
      setLibraryError(requestError.response?.data?.error || 'The orientation library could not be saved.')
    } finally {
      setIsSavingLibrary(false)
    }
  }

  async function deleteLibrary() {
    if (!libraryPendingDelete) return
    setIsSavingLibrary(true)
    setLibraryError('')
    try {
      await api.delete(`/training/orientation-libraries/${libraryPendingDelete.id}`)
      setOrientationLibraries((current) => current.filter((library) => library.id !== libraryPendingDelete.id))
      setLibraryPendingDelete(null)
      setLibraryEditor(null)
      await loadEmployees(false)
    } catch (requestError: any) {
      setLibraryError(requestError.response?.data?.error || 'The orientation library could not be deleted.')
    } finally {
      setIsSavingLibrary(false)
    }
  }

  function editMonthly(employee: TrainingEmployee) {
    setMonthlyEmployee(employee)
    setMonthlyAssignments(JSON.parse(JSON.stringify((employee.training.monthly.assignments || []).filter((assignment) => !isTestMonthlyTopic(assignment.topic.name)))))
    setMonthlyError('')
  }

  function updateMonthlyAssignment(topicId: string, update: Partial<MonthlyAssignment>) {
    setMonthlyAssignments((current) => current.map((assignment) => {
      if (assignment.topic.id !== topicId) return assignment
      const next = { ...assignment, ...update }
      if (update.requirement && update.requirement !== 'Required') {
        next.completionStatus = 'Unfinished'
        next.completionDate = null
        next.folderUpdated = false
      }
      if (update.requirement === 'Required' && assignment.requirement !== 'Required') {
        next.completionStatus = 'Unfinished'
        next.completionDate = null
        next.folderUpdated = false
      }
      if (update.completionStatus === 'Unfinished') next.completionDate = null
      return next
    }))
  }

  async function saveMonthly() {
    if (!monthlyEmployee) return
    setIsSavingMonthly(true)
    setMonthlyError('')
    try {
      const topicAssignments = Object.fromEntries(monthlyAssignments.map((assignment) => [
        assignment.topic.id,
        {
          requirement: assignment.requirement,
          completionStatus: assignment.completionStatus,
          completionDate: assignment.completionDate,
          folderUpdated: assignment.folderUpdated,
        },
      ]))
      const response = await api.put(`/training/employees/${monthlyEmployee.id}/monthly`, { topicAssignments })
      setEmployees((current) => current.map((employee) => employee.id === monthlyEmployee.id
        ? { ...employee, training: { ...employee.training, monthly: response.data.monthly } }
        : employee))
      setMonthlyEmployee(null)
    } catch (requestError: any) {
      if (requestError.response?.status === 401) {
        setMonthlyEmployee(null)
        onLogout()
        return
      }
      setMonthlyError(requestError.response?.data?.error || 'Monthly training could not be saved.')
    } finally {
      setIsSavingMonthly(false)
    }
  }

  function openMonthlySettings() {
    setShowMonthlySettings(true)
    setTopicEditor(null)
    setTopicPendingDelete(null)
    setTopicError('')
  }

  function editTopic(topic?: MonthlyTopic) {
    setTopicEditor(topic
      ? JSON.parse(JSON.stringify(topic))
      : { id: '', name: '', targetDate: '', link: '', accessCode: '', courses: [{ id: '', title: '' }] })
    setIsNewTopic(!topic)
    setAutoAssignJobTitles([])
    setAutoAssignLocations([])
    setTopicPendingDelete(null)
    setTopicError('')
  }

  function updateTopicCourse(index: number, title: string) {
    setTopicEditor((current) => current ? {
      ...current,
      courses: current.courses.map((course, courseIndex) => courseIndex === index ? { ...course, title } : course),
    } : current)
  }

  async function saveTopic(event: React.FormEvent) {
    event.preventDefault()
    if (!topicEditor) return
    setIsSavingTopic(true)
    setTopicError('')
    try {
      const response = isNewTopic
        ? await api.post('/training/monthly-topics', {
            ...topicEditor,
            autoAssign: { jobTitles: autoAssignJobTitles, locations: autoAssignLocations },
          })
        : await api.put(`/training/monthly-topics/${topicEditor.id}`, topicEditor)
      const savedTopic = response.data.topic as MonthlyTopic
      setMonthlyTopics((current) => isNewTopic
        ? [...current, savedTopic]
        : current.map((topic) => topic.id === savedTopic.id ? savedTopic : topic))
      setTopicEditor(null)
      await loadEmployees(false)
    } catch (requestError: any) {
      setTopicError(requestError.response?.data?.error || 'The monthly training topic could not be saved.')
    } finally {
      setIsSavingTopic(false)
    }
  }

  async function deleteTopic() {
    if (!topicPendingDelete) return
    setIsSavingTopic(true)
    setTopicError('')
    try {
      await api.delete(`/training/monthly-topics/${topicPendingDelete.id}`)
      setMonthlyTopics((current) => current.filter((topic) => topic.id !== topicPendingDelete.id))
      setTopicPendingDelete(null)
      setTopicEditor(null)
      await loadEmployees(false)
    } catch (requestError: any) {
      setTopicError(requestError.response?.data?.error || 'The monthly training topic could not be deleted.')
    } finally {
      setIsSavingTopic(false)
    }
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
            <div className="flex flex-wrap gap-2">
              <button className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50" onClick={() => setShowReportOptions(true)} type="button">
                <Download className="h-4 w-4" />
                Download Training Report
              </button>
              <button className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50" onClick={openOrientationSettings} type="button">
                <Settings className="h-4 w-4" />
                Orientation Library Settings
              </button>
              <button className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50" onClick={openMonthlySettings} type="button">
                <Settings className="h-4 w-4" />
                Monthly Training Settings
              </button>
              <button className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50" onClick={() => loadEmployees()} type="button">
                <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            </div>
          </div>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row">
            <label className="relative flex-1">
              <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
              <input
                className="w-full rounded-lg border border-slate-200 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search by employee, email, phone, job, location, department, or manager"
                type="search"
                value={search}
              />
            </label>
            <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-1">
              <button className={`rounded-md px-3 py-1.5 text-sm font-semibold ${view === 'active' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500'}`} onClick={() => changeView('active')} type="button">Active Employees</button>
              <button className={`rounded-md px-3 py-1.5 text-sm font-semibold ${view === 'terminated' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'}`} onClick={() => changeView('terminated')} type="button">Terminated Employees</button>
            </div>
            <label className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2">
              <span className="whitespace-nowrap text-xs font-semibold uppercase text-slate-500">Monthly Year</span>
              <select className="bg-white text-sm font-semibold text-slate-800 outline-none" onChange={(event) => { setSelectedMonthlyYear(event.target.value); setColumnFilters(emptyColumnFilters) }} value={selectedMonthlyYear}>
                {monthlyYears.map((year) => <option key={year} value={year}>{year}{year === String(new Date().getFullYear()) ? ' (Current)' : ' History'}</option>)}
              </select>
            </label>
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
            <table className="w-full text-sm" style={{ minWidth: `${1850 + displayedMonthlyTopics.length * 620}px` }}>
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
                  {displayedMonthlyTopics.map((topic) => (
                    <th className="border-b border-l-2 border-emerald-200 bg-emerald-50/70 px-4 py-3 text-left" colSpan={4} key={`${topic.id}-group`}>
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-sm font-semibold text-emerald-950">{topic.name}</div>
                          <div className="mt-1 text-xs font-normal text-emerald-700">Target {displayDate(topic.targetDate)} · {topic.courses.length} course{topic.courses.length === 1 ? '' : 's'}</div>
                        </div>
                        {topic.link ? <a aria-label={`Open ${topic.name}`} className="rounded-md p-1.5 text-emerald-700 hover:bg-emerald-100" href={topic.link} rel="noreferrer" target="_blank"><ExternalLink className="h-4 w-4" /></a> : null}
                      </div>
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
                        selected={columnFilters[column.key] || []}
                      />
                    </th>
                  ))}
                  {displayedMonthlyTopics.flatMap((topic) => monthlySubcolumns.map((subcolumn, subcolumnIndex) => {
                    const key = `monthly:${topic.id}:${subcolumn.field}` as MonthlyColumnKey
                    const label = `${topic.name} — ${subcolumn.label}`
                    return (
                      <th className={`min-w-[145px] border-b bg-emerald-50/30 px-3 pb-3 pt-2 ${subcolumnIndex === 0 ? 'border-l-2 border-emerald-200' : ''}`} key={`${key}-filter`}>
                        <button aria-label={`Sort ${label}`} className="mb-2 inline-flex w-full items-center justify-between gap-2 text-left text-[11px] font-semibold uppercase tracking-wide text-emerald-800" onClick={() => toggleSort(key)} type="button">
                          <span>{subcolumn.label}</span>
                          {sort.key !== key ? <ArrowUpDown className="h-3.5 w-3.5 text-emerald-400" /> : sort.direction === 'asc' ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />}
                        </button>
                        <ColumnMultiFilter
                          label={label}
                          onChange={(values) => setColumnFilters((current) => ({ ...current, [key]: values }))}
                          options={columnOptions[key]}
                          selected={columnFilters[key] || []}
                        />
                      </th>
                    )
                  }))}
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
                      <button className="mt-2 flex items-center gap-1 text-left text-[11px] font-semibold text-blue-700 hover:text-blue-800" onClick={() => downloadEmployeeTrainingReport(employee)} type="button"><Download className="h-3.5 w-3.5" />Employee Training Report</button>
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
                    <td className="border-b px-4 py-3">
                      {employee.email ? <a className="text-blue-700 hover:underline" href={`mailto:${employee.email}`}>{employee.email}</a> : '—'}
                    </td>
                    <td className="whitespace-nowrap border-b px-4 py-3">
                      {employee.contactNumber ? <a className="text-blue-700 hover:underline" href={`tel:${employee.contactNumber}`}>{employee.contactNumber}</a> : '—'}
                    </td>
                    <td className="border-b px-4 py-3">{employee.jobTitle || '—'}</td>
                    <td className="border-b px-4 py-3">{employee.location || '—'}</td>
                    <td className="border-b px-4 py-3">{employee.department || '—'}</td>
                    <td className="border-b px-4 py-3">{employee.reportingTo || '—'}</td>
                    <td className="border-b px-4 py-3 whitespace-nowrap">{displayDate(employee.firstDay)}</td>
                    <td className="border-b px-4 py-3">
                      <TrainingBadge training={employee.training.orientation} />
                      {employee.training.orientation.requiredCourseCount > 0 ? (
                        <div className="mt-1 text-xs text-slate-500">
                          {employee.training.orientation.completedCourseCount}/{employee.training.orientation.requiredCourseCount} courses complete
                        </div>
                      ) : null}
                      <button
                        className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:text-emerald-800"
                        onClick={() => editOrientation(employee)}
                        type="button"
                      >
                        <BookOpenCheck className="h-3.5 w-3.5" />
                        Manage Orientation
                      </button>
                    </td>
                    <td className="min-w-[190px] border-b px-4 py-3">
                      <button className="inline-flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-100" onClick={() => editMonthly(employee)} type="button"><BookOpenCheck className="h-4 w-4" />Manage Monthly Training</button>
                    </td>
                    {displayedMonthlyTopics.map((topic) => {
                      const assignment = employee.training.monthly.assignments.find((item) => item.topic.id === topic.id)
                      const requirement = assignment?.requirement || 'Unassigned'
                      const required = requirement === 'Required'
                      return [
                        <td className="min-w-[145px] border-b border-l-2 border-emerald-100 bg-emerald-50/20 px-4 py-3" key={`${topic.id}-requirement`}>
                          <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${requirement === 'Required' ? 'bg-blue-50 text-blue-700' : requirement === 'Not Required' ? 'bg-slate-100 text-slate-600' : 'bg-amber-50 text-amber-700'}`}>{requirement}</span>
                        </td>,
                        <td className="min-w-[145px] border-b bg-emerald-50/20 px-4 py-3" key={`${topic.id}-completion`}>
                          {required ? <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${assignment?.completionStatus === 'Finished' ? 'bg-emerald-50 text-emerald-700' : 'bg-blue-50 text-blue-700'}`}>{assignment?.completionStatus || 'Unfinished'}</span> : <span className="text-xs font-semibold text-slate-400">Blocked</span>}
                        </td>,
                        <td className="min-w-[145px] whitespace-nowrap border-b bg-emerald-50/20 px-4 py-3" key={`${topic.id}-date`}>{required && assignment?.completionStatus === 'Finished' ? displayDate(assignment.completionDate) : '—'}</td>,
                        <td className="min-w-[145px] border-b bg-emerald-50/20 px-4 py-3" key={`${topic.id}-folder`}>{required ? <span className={`text-xs font-semibold ${assignment?.folderUpdated ? 'text-emerald-700' : 'text-slate-500'}`}>{assignment?.folderUpdated ? 'Updated' : 'Not Updated'}</span> : <span className="text-xs font-semibold text-slate-400">Blocked</span>}</td>,
                      ]
                    })}
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

      {monthlyEmployee ? (
        <div className="fixed inset-0 z-[100] grid place-items-center bg-slate-950/60 p-4" role="presentation">
          <section aria-labelledby="monthly-training-title" aria-modal="true" className="flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl" role="dialog">
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-5">
              <div>
                <h2 className="text-xl font-semibold text-slate-950" id="monthly-training-title">Monthly Training</h2>
                <p className="mt-1 text-sm text-slate-500">{monthlyEmployee.employeeName}</p>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Automatic Status</div>
                  <div className={`mt-1 text-sm font-semibold ${monthlyDraftStatus === 'Finished' ? 'text-emerald-700' : monthlyDraftStatus === 'In Process' ? 'text-blue-700' : 'text-slate-600'}`}>
                    {monthlyDraftStatus} · {monthlyFinishedCount}/{monthlyRequiredAssignments.length} required finished
                  </div>
                </div>
                <button aria-label="Close monthly training" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" onClick={() => setMonthlyEmployee(null)} type="button"><X className="h-5 w-5" /></button>
              </div>
            </div>
            <div className="overflow-auto p-5 md:p-6">
              {!monthlyAssignments.length ? (
                <div className="grid min-h-64 place-items-center rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
                  <div><BookOpenCheck className="mx-auto h-10 w-10 text-slate-400" /><div className="mt-3 font-semibold text-slate-800">No monthly training topics</div><p className="mt-1 text-sm text-slate-500">Add a topic in Monthly Training Settings first.</p></div>
                </div>
              ) : (
                <div className="space-y-4">
                  {monthlyAssignments.map((assignment) => {
                    const required = assignment.requirement === 'Required'
                    return (
                      <section className="overflow-hidden rounded-xl border border-slate-200" key={assignment.topic.id}>
                        <div className="flex flex-wrap items-start justify-between gap-3 bg-slate-50 px-4 py-3">
                          <div>
                            <h3 className="font-semibold text-slate-900">{assignment.topic.name}</h3>
                            <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                              <span>Target Date: <span className="font-semibold text-slate-700">{displayDate(assignment.topic.targetDate)}</span></span>
                              {assignment.topic.accessCode ? <span>Access Code: <span className="font-mono font-semibold text-slate-700">{assignment.topic.accessCode}</span></span> : null}
                              {assignment.topic.link ? <a className="inline-flex items-center gap-1 font-semibold text-blue-700" href={assignment.topic.link} rel="noreferrer" target="_blank"><ExternalLink className="h-3.5 w-3.5" />Open Training</a> : null}
                            </div>
                          </div>
                          <div className="text-xs text-slate-500">{assignment.topic.courses.length} courses</div>
                        </div>
                        <div className="grid gap-4 p-4 md:grid-cols-[1.2fr_1fr_1fr_1fr_1fr]">
                          <div>
                            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Courses</div>
                            <ul className="mt-2 space-y-1 text-sm text-slate-700">{assignment.topic.courses.map((course) => <li key={course.id}>• {course.title}</li>)}</ul>
                          </div>
                          <label>
                            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Requirement</span>
                            <select className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-sm" onChange={(event) => updateMonthlyAssignment(assignment.topic.id, { requirement: event.target.value as MonthlyAssignment['requirement'] })} value={assignment.requirement}>
                              <option>Unassigned</option><option>Required</option><option>Not Required</option>
                            </select>
                          </label>
                          <label>
                            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Completion</span>
                            <select className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-sm disabled:bg-slate-100 disabled:text-slate-400" disabled={!required} onChange={(event) => updateMonthlyAssignment(assignment.topic.id, { completionStatus: event.target.value as MonthlyAssignment['completionStatus'] })} value={assignment.completionStatus}>
                              <option>Unfinished</option><option>Finished</option>
                            </select>
                          </label>
                          <label>
                            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Completion Date</span>
                            <input className="mt-2 w-full rounded-lg border border-slate-200 px-2.5 py-2 text-sm disabled:bg-slate-100" disabled={!required || assignment.completionStatus !== 'Finished'} onChange={(event) => updateMonthlyAssignment(assignment.topic.id, { completionDate: event.target.value || null })} type="date" value={assignment.completionDate || ''} />
                          </label>
                          <label className="flex items-center gap-2 self-center pt-5 text-sm font-medium text-slate-700">
                            <input checked={assignment.folderUpdated} className="h-4 w-4 rounded border-slate-300 text-emerald-600" disabled={!required} onChange={(event) => updateMonthlyAssignment(assignment.topic.id, { folderUpdated: event.target.checked })} type="checkbox" />
                            Folder Updated
                          </label>
                        </div>
                      </section>
                    )
                  })}
                </div>
              )}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-6 py-4">
              <div className="text-xs text-slate-500">Completion controls are available only when the topic is Required.</div>
              <div className="flex gap-3">
                <button className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700" onClick={() => setMonthlyEmployee(null)} type="button">Cancel</button>
                <button className="inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60" disabled={isSavingMonthly} onClick={saveMonthly} type="button">{isSavingMonthly ? <RefreshCw className="h-4 w-4 animate-spin" /> : <BookOpenCheck className="h-4 w-4" />}Save Monthly Training</button>
              </div>
              {monthlyError ? <div className="w-full rounded-lg bg-red-50 p-3 text-sm text-red-700">{monthlyError}</div> : null}
            </div>
          </section>
        </div>
      ) : null}

      {showReportOptions ? (
        <div className="fixed inset-0 z-[120] grid place-items-center bg-slate-950/60 p-4" role="presentation">
          <section aria-labelledby="orientation-report-title" aria-modal="true" className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl" role="dialog">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-slate-950" id="orientation-report-title">Download Training Report</h2>
                <p className="mt-1 text-sm text-slate-500">Choose a specific training course and each employee status to include.</p>
              </div>
              <button aria-label="Close orientation report options" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" onClick={() => setShowReportOptions(false)} type="button">
                <X className="h-5 w-5" />
              </button>
            </div>
            <label className="mt-5 block">
              <span className="text-sm font-semibold text-slate-700">Training Type</span>
              <select
                className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                onChange={(event) => {
                  setReportTrainingType(event.target.value as typeof reportTrainingType)
                  setReportCourseIds([])
                  setReportStatus('All Statuses')
                }}
                value={reportTrainingType}
              >
                <option value="orientation">Orientation Training</option>
                <option value="monthly">Monthly Training</option>
              </select>
            </label>
            {reportTrainingType === 'monthly' ? (
              <div className="mt-4 grid grid-cols-2 gap-3">
                <label><span className="text-sm font-semibold text-slate-700">Target Date From</span><input className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm" onChange={(event) => { setReportTargetDateFrom(event.target.value); setReportCourseIds([]); setReportStatus('All Statuses') }} type="date" value={reportTargetDateFrom} /></label>
                <label><span className="text-sm font-semibold text-slate-700">Target Date To</span><input className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm" onChange={(event) => { setReportTargetDateTo(event.target.value); setReportCourseIds([]); setReportStatus('All Statuses') }} type="date" value={reportTargetDateTo} /></label>
                <p className="col-span-2 text-xs text-slate-500">This range uses the Target Date saved in Monthly Training Settings.</p>
              </div>
            ) : null}
            <fieldset className="mt-4">
              <div className="flex items-center justify-between gap-3"><legend className="text-sm font-semibold text-slate-700">Training Courses</legend>{reportCourseOptions.length ? <button className="text-xs font-semibold text-emerald-700" onClick={() => { setReportCourseIds(reportCourseIds.length === reportCourseOptions.length ? [] : reportCourseOptions.map((course) => course.id)); setReportStatus('All Statuses') }} type="button">{reportCourseIds.length === reportCourseOptions.length ? 'Clear All' : 'Select All'}</button> : null}</div>
              <div className="mt-2 max-h-52 space-y-1 overflow-y-auto rounded-lg border border-slate-200 p-2">
                {reportCourseOptions.length ? reportCourseOptions.map((course) => <label className="flex cursor-pointer items-start gap-2 rounded-md px-2 py-2 text-sm text-slate-700 hover:bg-slate-50" key={course.id}><input checked={reportCourseIds.includes(course.id)} className="mt-0.5 h-4 w-4 rounded border-slate-300 text-emerald-600" onChange={(event) => { setReportCourseIds((current) => event.target.checked ? [...current, course.id] : current.filter((id) => id !== course.id)); setReportStatus('All Statuses') }} type="checkbox" /><span>{course.label}</span></label>) : <div className="px-2 py-3 text-sm text-slate-500">No courses match this date range.</div>}
              </div>
            </fieldset>
            <label className="mt-4 block">
              <span className="text-sm font-semibold text-slate-700">Training Status</span>
              <select
                className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                onChange={(event) => setReportStatus(event.target.value)}
                value={reportStatus}
              >
                <option value="All Statuses">All Statuses</option>
                {reportStatusOptions.map((status) => <option key={status} value={status}>{status}</option>)}
              </select>
            </label>
            <div className="mt-4 rounded-xl bg-slate-50 p-4 text-sm text-slate-600">
              <span className="font-semibold text-slate-900">{selectedReportCourses.length}</span> course{selectedReportCourses.length === 1 ? '' : 's'} selected. The CSV will include one row per selected course and employee matching the chosen status.
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50" onClick={() => setShowReportOptions(false)} type="button">Cancel</button>
              <button className="inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50" disabled={!selectedReportCourses.length} onClick={downloadTrainingReport} type="button">
                <Download className="h-4 w-4" />
                Download CSV
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {showMonthlySettings ? (
        <div className="fixed inset-0 z-[110] grid place-items-center bg-slate-950/60 p-4" role="presentation">
          <section aria-labelledby="monthly-settings-title" aria-modal="true" className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl" role="dialog">
            <div className="flex items-start justify-between border-b border-slate-200 px-6 py-5">
              <div><h2 className="text-xl font-semibold text-slate-950" id="monthly-settings-title">Monthly Training Settings</h2><p className="mt-1 text-sm text-slate-500">Manage topics, courses, target dates, links, and access codes.</p></div>
              <button aria-label="Close monthly training settings" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" onClick={() => setShowMonthlySettings(false)} type="button"><X className="h-5 w-5" /></button>
            </div>
            <div className="grid min-h-0 flex-1 overflow-hidden lg:grid-cols-[300px_1fr]">
              <aside className="overflow-y-auto border-b border-slate-200 bg-slate-50 p-4 lg:border-b-0 lg:border-r">
                <button className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-700 px-3 py-2.5 text-sm font-semibold text-white" onClick={() => editTopic()} type="button"><Plus className="h-4 w-4" />Add Topic</button>
                <div className="mt-4 space-y-2">{monthlyTopics.filter((topic) => !isTestMonthlyTopic(topic.name)).map((topic) => (
                  <button className={`w-full rounded-lg border p-3 text-left ${topicEditor?.id === topic.id ? 'border-emerald-400 bg-emerald-50' : 'border-slate-200 bg-white hover:border-emerald-200'}`} key={topic.id} onClick={() => editTopic(topic)} type="button">
                    <span className="block text-sm font-semibold text-slate-800">{topic.name}</span><span className="mt-1 block text-xs text-slate-500">Target: {displayDate(topic.targetDate)} · {topic.courses.length} courses</span>
                  </button>
                ))}</div>
              </aside>
              <div className="overflow-y-auto p-5 md:p-6">
                {!topicEditor ? (
                  <div className="grid min-h-64 place-items-center rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center"><div><Settings className="mx-auto h-10 w-10 text-slate-400" /><div className="mt-3 font-semibold text-slate-800">Select a topic to modify</div><p className="mt-1 text-sm text-slate-500">You can also add a new monthly training topic.</p></div></div>
                ) : (
                  <form onSubmit={saveTopic}>
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="text-lg font-semibold text-slate-900">{isNewTopic ? 'Add Monthly Topic' : 'Edit Monthly Topic'}</h3>
                      {!isNewTopic ? <button className="inline-flex items-center gap-1.5 text-sm font-semibold text-red-600" onClick={() => setTopicPendingDelete(topicEditor)} type="button"><Trash2 className="h-4 w-4" />Delete Topic</button> : null}
                    </div>
                    <div className="mt-5 grid gap-4 sm:grid-cols-2">
                      <label className="block sm:col-span-2"><span className="text-sm font-semibold text-slate-700">Training Topic</span><input className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm" onChange={(event) => setTopicEditor({ ...topicEditor, name: event.target.value })} required value={topicEditor.name} /></label>
                      <label className="block"><span className="text-sm font-semibold text-slate-700">Target Date</span><input className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm" onChange={(event) => setTopicEditor({ ...topicEditor, targetDate: event.target.value })} type="date" value={topicEditor.targetDate} /></label>
                      <label className="block"><span className="text-sm font-semibold text-slate-700">Access Code</span><input className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2.5 font-mono text-sm" onChange={(event) => setTopicEditor({ ...topicEditor, accessCode: event.target.value })} value={topicEditor.accessCode} /></label>
                      <label className="block sm:col-span-2"><span className="text-sm font-semibold text-slate-700">Training Link</span><input className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm" onChange={(event) => setTopicEditor({ ...topicEditor, link: event.target.value })} placeholder="https://..." type="url" value={topicEditor.link} /></label>
                    </div>
                    {isNewTopic ? (
                      <div className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50/50 p-4">
                        <div className="flex flex-wrap items-start justify-between gap-2"><div><h4 className="font-semibold text-slate-900">Auto-Assign Employees</h4><p className="mt-1 text-xs text-slate-600">Optional. Matching active employees will be assigned as Required when this topic is created.</p></div><span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-emerald-700">{autoAssignMatchCount} employee{autoAssignMatchCount === 1 ? '' : 's'} match</span></div>
                        <p className="mt-2 text-xs text-slate-500">Multiple values within a group use OR. When both groups are selected, Job Title and Location must both match.</p>
                        <div className="mt-4 grid gap-4 md:grid-cols-2">
                          <fieldset><legend className="text-sm font-semibold text-slate-700">Job Title</legend><div className="mt-2 max-h-44 space-y-1 overflow-y-auto rounded-lg border border-slate-200 bg-white p-2">{activeJobTitles.length ? activeJobTitles.map((jobTitle) => <label className="flex cursor-pointer items-start gap-2 rounded px-2 py-1.5 text-sm text-slate-700 hover:bg-slate-50" key={jobTitle}><input checked={autoAssignJobTitles.includes(jobTitle)} className="mt-0.5 h-4 w-4 rounded border-slate-300 text-emerald-600" onChange={(event) => setAutoAssignJobTitles((current) => event.target.checked ? [...current, jobTitle] : current.filter((value) => value !== jobTitle))} type="checkbox" /><span>{jobTitle}</span></label>) : <div className="px-2 py-2 text-xs text-slate-500">No job titles available.</div>}</div></fieldset>
                          <fieldset><legend className="text-sm font-semibold text-slate-700">Location</legend><div className="mt-2 max-h-44 space-y-1 overflow-y-auto rounded-lg border border-slate-200 bg-white p-2">{activeLocations.length ? activeLocations.map((location) => <label className="flex cursor-pointer items-start gap-2 rounded px-2 py-1.5 text-sm text-slate-700 hover:bg-slate-50" key={location}><input checked={autoAssignLocations.includes(location)} className="mt-0.5 h-4 w-4 rounded border-slate-300 text-emerald-600" onChange={(event) => setAutoAssignLocations((current) => event.target.checked ? [...current, location] : current.filter((value) => value !== location))} type="checkbox" /><span>{location}</span></label>) : <div className="px-2 py-2 text-xs text-slate-500">No locations available.</div>}</div></fieldset>
                        </div>
                      </div>
                    ) : null}
                    <div className="mt-6 flex items-center justify-between gap-3"><div><h4 className="font-semibold text-slate-900">Courses</h4><p className="mt-0.5 text-xs text-slate-500">Add, rename, or remove courses.</p></div><button className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-emerald-700" onClick={() => setTopicEditor({ ...topicEditor, courses: [...topicEditor.courses, { id: '', title: '' }] })} type="button"><Plus className="h-4 w-4" />Add Course</button></div>
                    <div className="mt-3 space-y-2">{topicEditor.courses.map((course, index) => (
                      <div className="flex items-center gap-2" key={course.id || `new-monthly-course-${index}`}><input aria-label={`Monthly course ${index + 1}`} className="flex-1 rounded-lg border border-slate-200 px-3 py-2.5 text-sm" onChange={(event) => updateTopicCourse(index, event.target.value)} placeholder="Training course name" value={course.title} /><button aria-label={`Remove monthly course ${index + 1}`} className="rounded-lg p-2.5 text-red-500 hover:bg-red-50" onClick={() => setTopicEditor({ ...topicEditor, courses: topicEditor.courses.filter((_item, courseIndex) => courseIndex !== index) })} type="button"><Trash2 className="h-4 w-4" /></button></div>
                    ))}</div>
                    {topicPendingDelete?.id === topicEditor.id ? <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4"><div className="font-semibold text-red-800">Delete {topicEditor.name}?</div><p className="mt-1 text-sm text-red-700">Assigned employees keep their historical snapshot. Unassigned copies will be removed.</p><div className="mt-3 flex gap-2"><button className="rounded-lg bg-red-700 px-3 py-2 text-sm font-semibold text-white" disabled={isSavingTopic} onClick={deleteTopic} type="button">Confirm Delete</button><button className="rounded-lg border border-red-200 px-3 py-2 text-sm font-semibold text-red-700" onClick={() => setTopicPendingDelete(null)} type="button">Keep Topic</button></div></div> : null}
                    {topicError ? <div className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{topicError}</div> : null}
                    <div className="mt-6 flex justify-end gap-3 border-t border-slate-200 pt-4"><button className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700" onClick={() => setTopicEditor(null)} type="button">Cancel</button><button className="inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60" disabled={isSavingTopic} type="submit">{isSavingTopic ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Settings className="h-4 w-4" />}Save Topic</button></div>
                  </form>
                )}
              </div>
            </div>
          </section>
        </div>
      ) : null}

      {showOrientationSettings ? (
        <div className="fixed inset-0 z-[110] grid place-items-center bg-slate-950/60 p-4" role="presentation">
          <section aria-labelledby="library-settings-title" aria-modal="true" className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl" role="dialog">
            <div className="flex items-start justify-between border-b border-slate-200 px-6 py-5">
              <div>
                <h2 className="text-xl font-semibold text-slate-950" id="library-settings-title">Orientation Library Settings</h2>
                <p className="mt-1 text-sm text-slate-500">Manage library names, links, access codes, and training courses.</p>
              </div>
              <button aria-label="Close orientation library settings" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" onClick={() => setShowOrientationSettings(false)} type="button">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid min-h-0 flex-1 overflow-hidden lg:grid-cols-[300px_1fr]">
              <aside className="overflow-y-auto border-b border-slate-200 bg-slate-50 p-4 lg:border-b-0 lg:border-r">
                <button className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-700 px-3 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800" onClick={() => editLibrary()} type="button">
                  <Plus className="h-4 w-4" />
                  Add Library
                </button>
                <div className="mt-4 space-y-2">
                  {orientationLibraries.map((library) => (
                    <button
                      className={`w-full rounded-lg border p-3 text-left ${libraryEditor?.id === library.id ? 'border-emerald-400 bg-emerald-50' : 'border-slate-200 bg-white hover:border-emerald-200'}`}
                      key={library.id}
                      onClick={() => editLibrary(library)}
                      type="button"
                    >
                      <span className="block text-sm font-semibold text-slate-800">{library.name}</span>
                      <span className="mt-1 block text-xs text-slate-500">{library.courses.length} courses · {library.accessCode || 'No access code'}</span>
                    </button>
                  ))}
                </div>
              </aside>

              <div className="overflow-y-auto p-5 md:p-6">
                {!libraryEditor ? (
                  <div className="grid min-h-64 place-items-center rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
                    <div>
                      <Settings className="mx-auto h-10 w-10 text-slate-400" />
                      <div className="mt-3 font-semibold text-slate-800">Select a library to modify</div>
                      <p className="mt-1 text-sm text-slate-500">You can also add a new orientation library.</p>
                    </div>
                  </div>
                ) : (
                  <form onSubmit={saveLibrary}>
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="text-lg font-semibold text-slate-900">{isNewLibrary ? 'Add Orientation Library' : 'Edit Orientation Library'}</h3>
                      {!isNewLibrary ? (
                        <button className="inline-flex items-center gap-1.5 text-sm font-semibold text-red-600 hover:text-red-700" onClick={() => setLibraryPendingDelete(libraryEditor)} type="button">
                          <Trash2 className="h-4 w-4" />
                          Delete Library
                        </button>
                      ) : null}
                    </div>

                    <div className="mt-5 grid gap-4 sm:grid-cols-2">
                      <label className="block sm:col-span-2">
                        <span className="text-sm font-semibold text-slate-700">Library Name</span>
                        <input className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100" onChange={(event) => setLibraryEditor({ ...libraryEditor, name: event.target.value })} required value={libraryEditor.name} />
                      </label>
                      <label className="block">
                        <span className="text-sm font-semibold text-slate-700">Library Access Code</span>
                        <input className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2.5 font-mono text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100" onChange={(event) => setLibraryEditor({ ...libraryEditor, accessCode: event.target.value })} value={libraryEditor.accessCode} />
                      </label>
                      <label className="block">
                        <span className="text-sm font-semibold text-slate-700">Library Link</span>
                        <input className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100" onChange={(event) => setLibraryEditor({ ...libraryEditor, link: event.target.value })} placeholder="https://..." type="url" value={libraryEditor.link} />
                      </label>
                    </div>

                    <div className="mt-6 flex items-center justify-between gap-3">
                      <div>
                        <h4 className="font-semibold text-slate-900">Training Courses</h4>
                        <p className="mt-0.5 text-xs text-slate-500">Add, rename, or remove courses in this library.</p>
                      </div>
                      <button className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-50" onClick={() => setLibraryEditor({ ...libraryEditor, courses: [...libraryEditor.courses, { id: '', title: '' }] })} type="button">
                        <Plus className="h-4 w-4" />
                        Add Course
                      </button>
                    </div>
                    <div className="mt-3 space-y-2">
                      {libraryEditor.courses.map((course, index) => (
                        <div className="flex items-center gap-2" key={course.id || `new-course-${index}`}>
                          <input
                            aria-label={`Course ${index + 1}`}
                            className="flex-1 rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                            onChange={(event) => updateLibraryCourse(index, event.target.value)}
                            placeholder="Training course name"
                            value={course.title}
                          />
                          <button aria-label={`Remove course ${index + 1}`} className="rounded-lg p-2.5 text-red-500 hover:bg-red-50" onClick={() => removeLibraryCourse(index)} type="button">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      ))}
                    </div>

                    {libraryPendingDelete?.id === libraryEditor.id ? (
                      <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4">
                        <div className="font-semibold text-red-800">Delete {libraryEditor.name}?</div>
                        <p className="mt-1 text-sm text-red-700">This removes the library from employee assignments and may change their automatic Orientation status.</p>
                        <div className="mt-3 flex gap-2">
                          <button className="rounded-lg bg-red-700 px-3 py-2 text-sm font-semibold text-white hover:bg-red-800 disabled:opacity-50" disabled={isSavingLibrary} onClick={deleteLibrary} type="button">Confirm Delete</button>
                          <button className="rounded-lg border border-red-200 px-3 py-2 text-sm font-semibold text-red-700" onClick={() => setLibraryPendingDelete(null)} type="button">Keep Library</button>
                        </div>
                      </div>
                    ) : null}

                    {libraryError ? <div className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{libraryError}</div> : null}
                    <div className="mt-6 flex justify-end gap-3 border-t border-slate-200 pt-4">
                      <button className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50" onClick={() => setLibraryEditor(null)} type="button">Cancel</button>
                      <button className="inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-60" disabled={isSavingLibrary} type="submit">
                        {isSavingLibrary ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Settings className="h-4 w-4" />}
                        Save Library
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </div>
          </section>
        </div>
      ) : null}

      {orientationEmployee ? (
        <div className="fixed inset-0 z-[100] grid place-items-center bg-slate-950/60 p-4" role="presentation">
          <section
            aria-labelledby="orientation-title"
            aria-modal="true"
            className="flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
            role="dialog"
          >
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-5">
              <div>
                <h2 className="text-xl font-semibold text-slate-950" id="orientation-title">Orientation Training</h2>
                <p className="mt-1 text-sm text-slate-500">{orientationEmployee.employeeName}</p>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Automatic Status</div>
                  <div className={`mt-1 text-sm font-semibold ${orientationDraftStatus === 'Finished' ? 'text-emerald-700' : orientationDraftStatus === 'In Process' ? 'text-blue-700' : 'text-slate-600'}`}>
                    {orientationDraftStatus}
                    {orientationRequiredCount ? ` · ${orientationCompletedCount}/${orientationRequiredCount}` : ''}
                  </div>
                </div>
                <button
                  aria-label="Close orientation training"
                  className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
                  onClick={() => setOrientationEmployee(null)}
                  type="button"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            <div className="grid min-h-0 flex-1 overflow-hidden lg:grid-cols-[330px_1fr]">
              <aside className="overflow-y-auto border-b border-slate-200 bg-slate-50 p-5 lg:border-b-0 lg:border-r">
                <h3 className="font-semibold text-slate-900">Assign Libraries</h3>
                <p className="mt-1 text-xs leading-5 text-slate-500">Select one or more orientation programs for this employee.</p>
                <div className="mt-4 space-y-2">
                  {orientationLibraries.map((library) => (
                    <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 bg-white p-3 hover:border-emerald-300" key={library.id}>
                      <input
                        checked={assignedLibraryIds.includes(library.id)}
                        className="mt-1 h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                        onChange={() => toggleOrientationLibrary(library.id)}
                        type="checkbox"
                      />
                      <span>
                        <span className="block text-sm font-semibold text-slate-800">{library.name}</span>
                        <span className="mt-1 block text-xs text-slate-500">Access Code: <span className="font-mono font-semibold text-slate-700">{library.accessCode}</span></span>
                        <span className="mt-0.5 block text-xs text-slate-400">{library.courses.length} courses</span>
                      </span>
                    </label>
                  ))}
                </div>
              </aside>

              <div className="overflow-y-auto p-5 md:p-6">
                {!selectedOrientationLibraries.length ? (
                  <div className="grid min-h-64 place-items-center rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
                    <div>
                      <BookOpenCheck className="mx-auto h-10 w-10 text-slate-400" />
                      <div className="mt-3 font-semibold text-slate-800">No orientation library assigned</div>
                      <p className="mt-1 text-sm text-slate-500">Select one or more libraries from the left to begin tracking courses.</p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {selectedOrientationLibraries.map((library) => (
                      <section className="overflow-hidden rounded-xl border border-slate-200" key={library.id}>
                        <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-50 px-4 py-3">
                          <div>
                            <h3 className="font-semibold text-slate-900">{library.name}</h3>
                            <p className="mt-0.5 text-xs text-slate-500">Access Code: <span className="font-mono font-semibold text-slate-700">{library.accessCode}</span></p>
                            {library.link ? (
                              <a className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-blue-700 hover:text-blue-800" href={library.link} rel="noreferrer" target="_blank">
                                <ExternalLink className="h-3.5 w-3.5" />
                                Open Library
                              </a>
                            ) : null}
                          </div>
                          <div className="text-right">
                            <span className="block text-xs font-semibold text-slate-500">
                              {library.courses.filter((course) => {
                                const progress = courseProgress[`${library.id}:${course.id}`]
                                return progress?.completedAt && progress?.folderUpdated
                              }).length}/{library.courses.length} complete
                            </span>
                            <button className="mt-1 text-xs font-semibold text-red-600 hover:text-red-700" onClick={() => toggleOrientationLibrary(library.id)} type="button">Remove Assignment</button>
                          </div>
                        </div>
                        <div className="overflow-x-auto">
                          <table className="w-full min-w-[700px] text-sm">
                            <thead>
                              <tr className="border-y border-slate-200 bg-white text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                                <th className="px-4 py-2.5">Training Course</th>
                                <th className="w-48 px-4 py-2.5">Completion Date</th>
                                <th className="w-52 px-4 py-2.5">Training Folder Updated</th>
                              </tr>
                            </thead>
                            <tbody>
                              {library.courses.map((course) => {
                                const key = `${library.id}:${course.id}`
                                const progress = courseProgress[key] || { completedAt: null, folderUpdated: false }
                                const courseFinished = Boolean(progress.completedAt && progress.folderUpdated)
                                return (
                                  <tr className={courseFinished ? 'bg-emerald-50/50' : 'even:bg-slate-50/60'} key={key}>
                                    <td className="border-b border-slate-100 px-4 py-3 font-medium text-slate-800">{course.title}</td>
                                    <td className="border-b border-slate-100 px-4 py-3">
                                      <input
                                        aria-label={`${course.title} completion date`}
                                        className="w-full rounded-lg border border-slate-200 px-2.5 py-2 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                                        onChange={(event) => updateCourseProgress(key, { completedAt: event.target.value || null })}
                                        type="date"
                                        value={progress.completedAt || ''}
                                      />
                                    </td>
                                    <td className="border-b border-slate-100 px-4 py-3">
                                      <label className="inline-flex cursor-pointer items-center gap-2 text-sm font-medium text-slate-700">
                                        <input
                                          checked={progress.folderUpdated}
                                          className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                                          onChange={(event) => updateCourseProgress(key, { folderUpdated: event.target.checked })}
                                          type="checkbox"
                                        />
                                        {progress.folderUpdated ? 'Updated' : 'Not updated'}
                                      </label>
                                    </td>
                                  </tr>
                                )
                              })}
                            </tbody>
                          </table>
                        </div>
                      </section>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-white px-6 py-4">
              <div className="text-xs text-slate-500">A course is complete only after both its completion date and folder update are recorded.</div>
              <div className="flex gap-3">
                <button
                  className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  onClick={() => setOrientationEmployee(null)}
                  type="button"
                >
                  Cancel
                </button>
                <button
                  className="inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={isSavingOrientation}
                  onClick={saveOrientation}
                  type="button"
                >
                  {isSavingOrientation ? <RefreshCw className="h-4 w-4 animate-spin" /> : <BookOpenCheck className="h-4 w-4" />}
                  Save Orientation
                </button>
              </div>
              {orientationError ? <div className="w-full rounded-lg bg-red-50 p-3 text-sm text-red-700">{orientationError}</div> : null}
            </div>
          </section>
        </div>
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
