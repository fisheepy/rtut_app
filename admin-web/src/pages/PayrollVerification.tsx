import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { api } from '../shared/api'

type PayrollSummary = {
  totalHrEmployees: number
  payrollComEmployees: number
  matched: number
  mismatched: number
  missingInPayroll: number
  missingInHr: number
  exceptions: number
  totalHrCommission: number
  totalPayrollCommission: number
  totalDifference: number
}

type PayrollJob = {
  jobId: string
  status: 'completed' | 'failed'
  createdAt: string
  completedAt?: string
  commissionFileName: string
  payrollFileName: string
  reportUrl?: string
  htmlReportUrl?: string
  summary?: PayrollSummary
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
}: {
  label: string
  caption: string
  file: File | null
  onChange: (file: File | null) => void
}) {
  return (
    <label className="group flex min-h-36 cursor-pointer flex-col justify-between rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-4 transition hover:border-blue-400 hover:bg-blue-50/60">
      <span>
        <span className="block text-sm font-semibold text-slate-950">{label}</span>
        <span className="mt-1 block text-xs text-slate-500">{caption}</span>
      </span>
      <span className="mt-5 flex items-center justify-between gap-3 rounded-md border bg-white px-3 py-2 shadow-sm">
        <span className="min-w-0 truncate text-sm text-slate-700">{file?.name || 'Select Excel file'}</span>
        <span className="shrink-0 rounded-md bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white group-hover:bg-blue-600">Browse</span>
      </span>
      <input
        className="sr-only"
        type="file"
        accept=".xls,.xlsx"
        onChange={(event) => onChange(event.target.files?.[0] || null)}
      />
    </label>
  )
}

function Metric({
  label,
  value,
  tone = 'text-slate-950',
}: {
  label: string
  value: string | number
  tone?: string
}) {
  return (
    <div className="rounded-lg border bg-white px-4 py-3 shadow-sm">
      <div className="text-xs font-medium uppercase text-slate-500">{label}</div>
      <div className={`mt-1 text-2xl font-semibold ${tone}`}>{value}</div>
    </div>
  )
}

function ReportActions({ job }: { job: PayrollJob | null }) {
  if (!job || job.status !== 'completed') return null

  return (
    <div className="flex flex-wrap gap-2">
      {job.htmlReportUrl ? (
        <a
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-500"
          href={job.htmlReportUrl}
          target="_blank"
          rel="noreferrer"
        >
          View HTML Report
        </a>
      ) : null}
      {job.reportUrl ? (
        <a
          className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 shadow-sm transition hover:bg-slate-50"
          href={job.reportUrl}
        >
          Download Excel
        </a>
      ) : null}
    </div>
  )
}

export default function PayrollVerification() {
  const [commissionFile, setCommissionFile] = useState<File | null>(null)
  const [payrollFile, setPayrollFile] = useState<File | null>(null)
  const [currentJob, setCurrentJob] = useState<PayrollJob | null>(null)
  const [jobs, setJobs] = useState<PayrollJob[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function loadJobs() {
    const res = await api.get('/payroll-verification/jobs')
    setJobs(res.data)
  }

  useEffect(() => {
    loadJobs().catch(() => {})
  }, [])

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!commissionFile || !payrollFile) {
      setError('Both files are required.')
      return
    }

    const formData = new FormData()
    formData.append('commissionFile', commissionFile)
    formData.append('payrollFile', payrollFile)

    setIsSubmitting(true)
    setError(null)

    try {
      const res = await api.post('/payroll-verification/jobs', formData, {
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
  const issueCount = summary?.exceptions ?? latestJob?.summary?.exceptions ?? 0
  const ready = Boolean(commissionFile && payrollFile)
  const statusCopy = useMemo(() => {
    if (isSubmitting) return 'Processing files'
    if (error) return 'Needs attention'
    if (latestJob?.status === 'completed') return issueCount ? 'Review required' : 'Ready to approve'
    return 'Standing by'
  }, [error, isSubmitting, issueCount, latestJob?.status])

  return (
    <div className="space-y-6">
      <div className="rounded-lg border bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b px-5 py-4">
          <div>
            <p className="text-xs font-semibold uppercase text-blue-600">Finance Operations</p>
            <h2 className="mt-1 text-2xl font-semibold text-slate-950">Payroll Verification</h2>
          </div>
          <ReportActions job={latestJob} />
        </div>

        <div className="grid gap-0 lg:grid-cols-[1.35fr_0.65fr]">
          <form className="grid gap-4 border-b p-5 lg:grid-cols-2 lg:border-b-0 lg:border-r" onSubmit={handleSubmit}>
            <FileDrop
              label="Commission Reference"
              caption="HR commission list"
              file={commissionFile}
              onChange={setCommissionFile}
            />
            <FileDrop
              label="Payroll Register"
              caption="ADP payroll export"
              file={payrollFile}
              onChange={setPayrollFile}
            />
            <div className="flex flex-wrap items-center justify-between gap-3 lg:col-span-2">
              <div className="text-sm text-slate-600">
                <span className="font-medium text-slate-900">Rule:</span> compare HR commission to payroll earning code COM.
              </div>
              <button
                className="rounded-md bg-slate-950 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-600 disabled:cursor-not-allowed disabled:bg-slate-300"
                type="submit"
                disabled={isSubmitting || !ready}
              >
                {isSubmitting ? 'Generating...' : 'Generate Reports'}
              </button>
            </div>
          </form>

          <aside className="bg-slate-950 p-5 text-white">
            <div className="text-xs font-semibold uppercase text-blue-200">Current Run</div>
            <div className="mt-2 text-2xl font-semibold">{statusCopy}</div>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <div className="rounded-lg bg-white/10 p-3">
                <div className="text-xs text-slate-300">Issues</div>
                <div className="mt-1 text-2xl font-semibold">{issueCount}</div>
              </div>
              <div className="rounded-lg bg-white/10 p-3">
                <div className="text-xs text-slate-300">Last Run</div>
                <div className="mt-1 text-sm font-semibold">{compactDate(latestJob?.createdAt)}</div>
              </div>
            </div>
            {latestJob?.summary ? (
              <div className="mt-5 border-t border-white/15 pt-4 text-sm text-slate-200">
                <div className="flex justify-between gap-3"><span>HR total</span><span>{money(latestJob.summary.totalHrCommission)}</span></div>
                <div className="mt-2 flex justify-between gap-3"><span>Payroll total</span><span>{money(latestJob.summary.totalPayrollCommission)}</span></div>
                <div className="mt-2 flex justify-between gap-3 font-semibold text-white"><span>Difference</span><span>{money(latestJob.summary.totalDifference)}</span></div>
              </div>
            ) : null}
          </aside>
        </div>
      </div>

      {error ? <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}

      {summary ? (
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <Metric label="Matched" value={summary.matched} tone="text-emerald-600" />
          <Metric label="Mismatched" value={summary.mismatched} tone={summary.mismatched ? 'text-red-600' : 'text-slate-950'} />
          <Metric label="Missing Payroll" value={summary.missingInPayroll} tone={summary.missingInPayroll ? 'text-amber-600' : 'text-slate-950'} />
          <Metric label="Missing HR" value={summary.missingInHr} tone={summary.missingInHr ? 'text-amber-600' : 'text-slate-950'} />
          <Metric label="Difference" value={money(summary.totalDifference)} tone={summary.totalDifference ? 'text-red-600' : 'text-emerald-600'} />
        </section>
      ) : null}

      {latestJob?.status === 'completed' ? (
        <section className="rounded-lg border bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h3 className="text-lg font-semibold text-slate-950">Latest Report</h3>
              <p className="mt-1 text-sm text-slate-600">{latestJob.commissionFileName} paired with {latestJob.payrollFileName}</p>
            </div>
            <ReportActions job={latestJob} />
          </div>
        </section>
      ) : null}

      <section className="rounded-lg border bg-white shadow-sm">
        <div className="flex items-center justify-between gap-3 border-b px-5 py-4">
          <div>
            <h3 className="text-lg font-semibold text-slate-950">Recent Reports</h3>
            <p className="mt-1 text-sm text-slate-500">Last 20 generated reports</p>
          </div>
          <button className="rounded-md border px-3 py-1.5 text-sm font-semibold hover:bg-slate-50" type="button" onClick={() => loadJobs()}>
            Refresh
          </button>
        </div>
        <div className="overflow-auto">
          <table className="min-w-[900px] w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="border-b px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">Created</th>
                <th className="border-b px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">Status</th>
                <th className="border-b px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">Files</th>
                <th className="border-b px-4 py-3 text-right text-xs font-semibold uppercase text-slate-500">Matched</th>
                <th className="border-b px-4 py-3 text-right text-xs font-semibold uppercase text-slate-500">Issues</th>
                <th className="border-b px-4 py-3 text-right text-xs font-semibold uppercase text-slate-500">Difference</th>
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
                    <div className="max-w-[360px] truncate font-medium text-slate-900">{job.commissionFileName}</div>
                    <div className="max-w-[360px] truncate text-xs text-slate-500">{job.payrollFileName}</div>
                  </td>
                  <td className="border-b px-4 py-3 text-right tabular-nums">{job.summary?.matched ?? '-'}</td>
                  <td className="border-b px-4 py-3 text-right tabular-nums">{job.summary?.exceptions ?? '-'}</td>
                  <td className="border-b px-4 py-3 text-right tabular-nums">{money(job.summary?.totalDifference)}</td>
                  <td className="border-b px-4 py-3">
                    {job.htmlReportUrl || job.reportUrl ? (
                      <div className="flex gap-3">
                        {job.htmlReportUrl ? <a className="font-semibold text-blue-600 hover:text-blue-500" href={job.htmlReportUrl} target="_blank" rel="noreferrer">HTML</a> : null}
                        {job.reportUrl ? <a className="font-semibold text-slate-700 hover:text-slate-950" href={job.reportUrl}>Excel</a> : null}
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
