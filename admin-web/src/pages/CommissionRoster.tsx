import { useEffect, useMemo, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { AlertTriangle, ArrowRight, CheckCircle2, FileSpreadsheet, FileText, RefreshCw, UsersRound } from 'lucide-react'
import { api } from '../shared/api'

type CommissionRosterSummary = {
  rosterEmployees: number
  quarterlyRows: number
  finalRosterCommissionRows: number
  reviewRows: number
  removedNoCommission: number
  matched: number
  reportMarkedDeparted: number
  missingInRoster: number
  ambiguous: number
  terminatedIssues: number
  duplicateRosterNames: number
  activeServiceRosterOnly: number
  issues: number
  totalReportCommission: number
  totalMappedCommission: number
}

type CommissionRosterJob = {
  jobId: string
  status: 'completed' | 'failed'
  createdAt: string
  completedAt?: string
  rosterFileName: string
  quarterlyReportFileName: string
  reportUrl?: string
  htmlReportUrl?: string
  summary?: CommissionRosterSummary
  error?: string
}

function money(value?: number) {
  if (typeof value !== 'number') return '-'
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value)
}

function compactDate(value?: string) {
  if (!value) return '-'
  return new Date(value).toLocaleString([], {
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function FileDrop({
  label,
  caption,
  file,
  onChange,
  accent,
  icon,
}: {
  label: string
  caption: string
  file: File | null
  onChange: (file: File | null) => void
  accent: 'teal' | 'blue'
  icon: ReactNode
}) {
  const styles = {
    teal: {
      ring: 'border-teal-200 bg-teal-50/80 hover:border-teal-400 hover:bg-teal-50',
      badge: 'bg-teal-700 text-white',
      icon: 'bg-teal-700 text-white',
      text: 'text-teal-700',
    },
    blue: {
      ring: 'border-blue-200 bg-blue-50/80 hover:border-blue-400 hover:bg-blue-50',
      badge: 'bg-blue-600 text-white',
      icon: 'bg-blue-600 text-white',
      text: 'text-blue-700',
    },
  }[accent]

  return (
    <label className={`group relative flex min-h-48 cursor-pointer flex-col justify-between overflow-hidden rounded-xl border p-5 shadow-sm transition ${styles.ring}`}>
      <span className="absolute right-4 top-4 rounded-full bg-white/80 px-2.5 py-1 text-xs font-semibold text-slate-500 shadow-sm">Excel</span>
      <span>
        <span className={`grid h-12 w-12 place-items-center rounded-lg shadow-sm ${styles.icon}`}>{icon}</span>
        <span className="mt-5 block text-lg font-semibold text-slate-950">{label}</span>
        <span className="mt-1 block text-sm text-slate-600">{caption}</span>
      </span>
      <span className="mt-6 flex items-center justify-between gap-3 rounded-lg border border-white/80 bg-white px-3 py-3 shadow-sm">
        <span className="min-w-0 truncate text-sm font-medium text-slate-800">{file?.name || 'Choose file'}</span>
        <span className={`shrink-0 rounded-md px-3 py-1.5 text-xs font-semibold ${styles.badge}`}>Browse</span>
      </span>
      <input className="sr-only" type="file" accept=".xls,.xlsx" onChange={(event) => onChange(event.target.files?.[0] || null)} />
      <span className={`mt-3 text-xs font-medium ${styles.text}`}>{file ? 'Ready for processing' : 'Required input'}</span>
    </label>
  )
}

function Metric({ label, value, tone = 'text-slate-950' }: { label: string; value: string | number; tone?: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="text-xs font-semibold uppercase text-slate-500">{label}</div>
      <div className={`mt-2 text-2xl font-semibold ${tone}`}>{value}</div>
    </div>
  )
}

function ReportActions({ job }: { job: CommissionRosterJob | null }) {
  if (!job || job.status !== 'completed') return null

  return (
    <div className="flex flex-wrap gap-2">
      {job.htmlReportUrl ? (
        <a
          className="inline-flex items-center gap-2 rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-600"
          href={job.htmlReportUrl}
          target="_blank"
          rel="noreferrer"
        >
          <FileText className="h-4 w-4" />
          View HTML
        </a>
      ) : null}
      {job.reportUrl ? (
        <a
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 shadow-sm transition hover:border-blue-200 hover:text-blue-700"
          href={job.reportUrl}
        >
          <FileSpreadsheet className="h-4 w-4" />
          Excel
        </a>
      ) : null}
    </div>
  )
}

export default function CommissionRoster() {
  const [rosterFile, setRosterFile] = useState<File | null>(null)
  const [quarterlyReportFile, setQuarterlyReportFile] = useState<File | null>(null)
  const [currentJob, setCurrentJob] = useState<CommissionRosterJob | null>(null)
  const [jobs, setJobs] = useState<CommissionRosterJob[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function loadJobs() {
    const res = await api.get('/commission-roster/jobs')
    setJobs(res.data)
  }

  useEffect(() => {
    loadJobs().catch(() => {})
  }, [])

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!rosterFile || !quarterlyReportFile) {
      setError('Both files are required.')
      return
    }

    const formData = new FormData()
    formData.append('rosterFile', rosterFile)
    formData.append('quarterlyReportFile', quarterlyReportFile)

    setIsSubmitting(true)
    setError(null)

    try {
      const res = await api.post('/commission-roster/jobs', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      setCurrentJob(res.data)
      await loadJobs()
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Report generation failed.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const summary = currentJob?.summary
  const latestJob = currentJob || jobs[0] || null
  const issueCount = summary?.issues ?? latestJob?.summary?.issues ?? 0
  const ready = Boolean(rosterFile && quarterlyReportFile)
  const statusCopy = useMemo(() => {
    if (isSubmitting) return 'Processing'
    if (error) return 'Needs attention'
    if (latestJob?.status === 'completed') return issueCount ? 'Review required' : 'Clean mapping'
    return 'Waiting for files'
  }, [error, isSubmitting, issueCount, latestJob?.status])

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-2xl border border-white/70 bg-white shadow-xl">
        <div className="grid lg:grid-cols-[1.1fr_0.9fr]">
          <div className="relative overflow-hidden bg-slate-950 p-6 text-white md:p-8">
            <div className="absolute -right-16 -top-20 h-64 w-64 rounded-full bg-teal-500/30 blur-3xl" />
            <div className="absolute -bottom-20 left-20 h-56 w-56 rounded-full bg-blue-400/25 blur-3xl" />
            <div className="relative">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-semibold text-teal-100">
                <UsersRound className="h-4 w-4" />
                Commission Operations Tool
              </div>
              <h1 className="mt-5 max-w-2xl text-4xl font-semibold tracking-normal md:text-5xl">Commission Roster Mapping</h1>
              <p className="mt-4 max-w-2xl text-base leading-7 text-slate-300">
                Map quarterly commission rows back to the roster, highlight departed markers, spelling differences, missing roster records, and manual review items.
              </p>
              <div className="mt-7 flex flex-wrap gap-2">
                <ReportActions job={latestJob} />
              </div>
            </div>
          </div>

          <div className="bg-white p-6 md:p-8">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase text-slate-500">Current Run</p>
                <h2 className="mt-1 text-2xl font-semibold text-slate-950">{statusCopy}</h2>
              </div>
              <div className={`grid h-12 w-12 place-items-center rounded-xl ${issueCount ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                {issueCount ? <AlertTriangle className="h-6 w-6" /> : <CheckCircle2 className="h-6 w-6" />}
              </div>
            </div>
            <div className="mt-6 grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-slate-50 p-4">
                <div className="text-xs font-semibold uppercase text-slate-500">Issues</div>
                <div className="mt-2 text-3xl font-semibold text-slate-950">{issueCount}</div>
              </div>
              <div className="rounded-xl bg-slate-50 p-4">
                <div className="text-xs font-semibold uppercase text-slate-500">Last Run</div>
                <div className="mt-2 text-lg font-semibold text-slate-950">{compactDate(latestJob?.createdAt)}</div>
              </div>
            </div>
            {latestJob?.summary ? (
              <div className="mt-5 space-y-2 rounded-xl border border-slate-200 p-4 text-sm">
                <div className="flex justify-between gap-3"><span className="text-slate-500">Final rows</span><span className="font-semibold">{latestJob.summary.finalRosterCommissionRows}</span></div>
                <div className="flex justify-between gap-3"><span className="text-slate-500">Review rows</span><span className="font-semibold">{latestJob.summary.reviewRows}</span></div>
                <div className="flex justify-between gap-3 border-t pt-2"><span className="text-slate-500">Report commission</span><span className="font-semibold">{money(latestJob.summary.totalReportCommission)}</span></div>
              </div>
            ) : null}
          </div>
        </div>
      </section>

      <form className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm" onSubmit={handleSubmit}>
        <div className="grid gap-5 lg:grid-cols-2">
          <FileDrop
            label="Commission Roster"
            caption="Roster export with payroll names, status, location, department, and manager"
            file={rosterFile}
            onChange={setRosterFile}
            accent="teal"
            icon={<UsersRound className="h-6 w-6" />}
          />
          <FileDrop
            label="Technician Quarterly Report"
            caption="Department manager commission summary with employee names and amounts"
            file={quarterlyReportFile}
            onChange={setQuarterlyReportFile}
            accent="blue"
            icon={<FileSpreadsheet className="h-6 w-6" />}
          />
        </div>
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-slate-50 px-4 py-3">
          <div className="text-sm text-slate-600">
            <span className="font-semibold text-slate-950">Matching rule:</span> exact name first, then nickname and spelling-tolerant matching with review flags.
          </div>
          <button
            className="inline-flex items-center gap-2 rounded-lg bg-slate-950 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-700 disabled:cursor-not-allowed disabled:bg-slate-300"
            type="submit"
            disabled={isSubmitting || !ready}
          >
            {isSubmitting ? 'Generating...' : 'Generate Reports'}
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </form>

      {error ? <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}

      {summary ? (
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <Metric label="Final Rows" value={summary.finalRosterCommissionRows} tone="text-emerald-600" />
          <Metric label="Review Rows" value={summary.reviewRows} tone={summary.reviewRows ? 'text-amber-600' : 'text-slate-950'} />
          <Metric label="Missing Roster" value={summary.missingInRoster} tone={summary.missingInRoster ? 'text-red-600' : 'text-slate-950'} />
          <Metric label="Removed" value={summary.removedNoCommission} tone="text-slate-950" />
          <Metric label="Report Total" value={money(summary.totalReportCommission)} tone="text-slate-950" />
        </section>
      ) : null}

      {latestJob?.status === 'completed' ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase text-teal-700">Latest Output</p>
              <h3 className="mt-1 text-xl font-semibold text-slate-950">Report package is ready</h3>
              <p className="mt-1 text-sm text-slate-600">{latestJob.rosterFileName} paired with {latestJob.quarterlyReportFileName}</p>
            </div>
            <ReportActions job={latestJob} />
          </div>
        </section>
      ) : null}

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
          <div>
            <h3 className="text-lg font-semibold text-slate-950">Recent Reports</h3>
            <p className="mt-1 text-sm text-slate-500">Last 20 generated report packages</p>
          </div>
          <button className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50" type="button" onClick={() => loadJobs()}>
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
        </div>
        <div className="overflow-auto">
          <table className="min-w-[980px] w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="border-b px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">Created</th>
                <th className="border-b px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">Status</th>
                <th className="border-b px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">Files</th>
                <th className="border-b px-4 py-3 text-right text-xs font-semibold uppercase text-slate-500">Final Rows</th>
                <th className="border-b px-4 py-3 text-right text-xs font-semibold uppercase text-slate-500">Issues</th>
                <th className="border-b px-4 py-3 text-right text-xs font-semibold uppercase text-slate-500">Removed</th>
                <th className="border-b px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">Open</th>
              </tr>
            </thead>
            <tbody>
              {jobs.length ? jobs.map((job) => (
                <tr key={job.jobId} className="even:bg-slate-50/60">
                  <td className="border-b px-4 py-3 text-slate-700">{compactDate(job.createdAt)}</td>
                  <td className="border-b px-4 py-3">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${job.status === 'completed' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                      {job.status}
                    </span>
                  </td>
                  <td className="border-b px-4 py-3">
                    <div className="max-w-[360px] truncate font-medium text-slate-900">{job.rosterFileName}</div>
                    <div className="max-w-[360px] truncate text-xs text-slate-500">{job.quarterlyReportFileName}</div>
                  </td>
                  <td className="border-b px-4 py-3 text-right tabular-nums">{job.summary?.finalRosterCommissionRows ?? '-'}</td>
                  <td className="border-b px-4 py-3 text-right tabular-nums">{job.summary?.issues ?? '-'}</td>
                  <td className="border-b px-4 py-3 text-right tabular-nums">{job.summary?.removedNoCommission ?? '-'}</td>
                  <td className="border-b px-4 py-3">
                    {job.htmlReportUrl || job.reportUrl ? (
                      <div className="flex gap-3">
                        {job.htmlReportUrl ? <a className="font-semibold text-teal-700 hover:text-teal-600" href={job.htmlReportUrl} target="_blank" rel="noreferrer">HTML</a> : null}
                        {job.reportUrl ? <a className="font-semibold text-blue-700 hover:text-blue-600" href={job.reportUrl}>Excel</a> : null}
                      </div>
                    ) : job.error || '-'}
                  </td>
                </tr>
              )) : (
                <tr>
                  <td className="px-4 py-8 text-center text-slate-500" colSpan={7}>No reports yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
