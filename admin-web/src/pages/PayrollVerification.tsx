import { useEffect, useState } from 'react'
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
  summary?: PayrollSummary
  error?: string
}

function money(value?: number) {
  if (typeof value !== 'number') return '-'
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value)
}

function Stat({ label, value, tone = 'text-slate-900' }: { label: string; value: string | number; tone?: string }) {
  return (
    <div className="border bg-white p-4 shadow-sm">
      <p className="text-xs uppercase text-gray-500">{label}</p>
      <p className={`mt-2 text-xl font-semibold ${tone}`}>{value}</p>
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
      setError('Please select both files before generating the report.')
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

  return (
    <div className="space-y-6">
      <div className="border bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold">Payroll Verification</h2>
            <p className="mt-1 text-sm text-gray-600">Upload commission reference and payroll register files to generate a downloadable reconciliation report.</p>
          </div>
          {currentJob?.reportUrl ? (
            <a className="border bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700" href={currentJob.reportUrl}>
              Download Report
            </a>
          ) : null}
        </div>
      </div>

      <form className="grid gap-4 bg-white p-5 shadow-sm md:grid-cols-2" onSubmit={handleSubmit}>
        <label className="block border border-dashed border-gray-300 p-4">
          <span className="text-sm font-medium text-gray-900">Commission Reference</span>
          <input
            className="mt-3 block w-full text-sm"
            type="file"
            accept=".xls,.xlsx"
            onChange={(event) => setCommissionFile(event.target.files?.[0] || null)}
          />
          <span className="mt-2 block truncate text-xs text-gray-500">{commissionFile?.name || 'No file selected'}</span>
        </label>

        <label className="block border border-dashed border-gray-300 p-4">
          <span className="text-sm font-medium text-gray-900">Payroll Register</span>
          <input
            className="mt-3 block w-full text-sm"
            type="file"
            accept=".xls,.xlsx"
            onChange={(event) => setPayrollFile(event.target.files?.[0] || null)}
          />
          <span className="mt-2 block truncate text-xs text-gray-500">{payrollFile?.name || 'No file selected'}</span>
        </label>

        <div className="md:col-span-2 flex flex-wrap items-center justify-between gap-3 border-t pt-4">
          <p className="text-sm text-gray-600">The report compares HR commission amounts against payroll earning code COM.</p>
          <button
            className="bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:bg-gray-300"
            type="submit"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Generating...' : 'Generate Report'}
          </button>
        </div>
      </form>

      {error ? <div className="border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div> : null}

      {summary ? (
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <Stat label="Matched" value={summary.matched} tone="text-emerald-600" />
          <Stat label="Mismatched" value={summary.mismatched} tone={summary.mismatched ? 'text-red-600' : 'text-slate-900'} />
          <Stat label="Missing Payroll" value={summary.missingInPayroll} />
          <Stat label="Missing HR" value={summary.missingInHr} />
          <Stat label="Total Difference" value={money(summary.totalDifference)} tone={summary.totalDifference ? 'text-red-600' : 'text-emerald-600'} />
        </section>
      ) : null}

      <section className="bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-lg font-semibold">Recent Reports</h3>
          <button className="border px-3 py-1.5 text-sm hover:bg-gray-50" type="button" onClick={() => loadJobs()}>
            Refresh
          </button>
        </div>
        <div className="mt-4 overflow-auto border">
          <table className="min-w-[760px] w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="border-b px-3 py-2 text-left">Created</th>
                <th className="border-b px-3 py-2 text-left">Status</th>
                <th className="border-b px-3 py-2 text-left">Commission File</th>
                <th className="border-b px-3 py-2 text-left">Payroll File</th>
                <th className="border-b px-3 py-2 text-right">Matched</th>
                <th className="border-b px-3 py-2 text-right">Exceptions</th>
                <th className="border-b px-3 py-2 text-left">Report</th>
              </tr>
            </thead>
            <tbody>
              {jobs.length ? jobs.map((job) => (
                <tr key={job.jobId} className="even:bg-gray-50/50">
                  <td className="border-b px-3 py-2">{new Date(job.createdAt).toLocaleString()}</td>
                  <td className="border-b px-3 py-2">{job.status}</td>
                  <td className="border-b px-3 py-2">{job.commissionFileName}</td>
                  <td className="border-b px-3 py-2">{job.payrollFileName}</td>
                  <td className="border-b px-3 py-2 text-right">{job.summary?.matched ?? '-'}</td>
                  <td className="border-b px-3 py-2 text-right">{job.summary?.exceptions ?? '-'}</td>
                  <td className="border-b px-3 py-2">
                    {job.reportUrl ? <a className="underline" href={job.reportUrl}>Download</a> : job.error || '-'}
                  </td>
                </tr>
              )) : (
                <tr>
                  <td className="px-3 py-6 text-center text-gray-500" colSpan={7}>No reports yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
