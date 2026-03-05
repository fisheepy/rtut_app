import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '../shared/api'

type HealthData = {
  status?: string
  uptime?: number
  timestamp?: string
  [key: string]: unknown
}

type TimeRange = 'today' | '7d' | '30d'

function formatRelativeUptime(uptime?: number) {
  if (typeof uptime !== 'number' || Number.isNaN(uptime)) return 'N/A'
  const hours = Math.floor(uptime / 3600)
  if (hours < 1) return `${Math.floor(uptime / 60)}m`
  const days = Math.floor(hours / 24)
  if (days < 1) return `${hours}h`
  return `${days}d ${hours % 24}h`
}

export default function Dashboard() {
  const [timeRange, setTimeRange] = useState<TimeRange>('7d')

  const { data, isLoading, error, isFetching } = useQuery<HealthData>({
    queryKey: ['health'],
    queryFn: async () => (await api.get('/health')).data,
    refetchInterval: 60_000,
  })

  const kpis = useMemo(() => {
    const isHealthy = data?.status === 'ok' || data?.status === 'healthy'
    return [
      { label: 'System Health', value: isHealthy ? 'Healthy' : data?.status ?? 'Unknown', tone: isHealthy ? 'text-emerald-600' : 'text-amber-600' },
      { label: 'Server Uptime', value: formatRelativeUptime(data?.uptime), tone: 'text-slate-900' },
      { label: 'Data Freshness', value: isFetching ? 'Refreshing…' : 'Live', tone: isFetching ? 'text-amber-600' : 'text-emerald-600' },
      { label: 'Current Focus', value: 'Operational Overview', tone: 'text-slate-900' },
    ]
  }, [data, isFetching])

  const quickActions = [
    { label: 'Employee Management', to: '/employees', note: 'Review active roster and status', external: false },
    { label: 'Send Notification', to: '/old', note: 'Use legacy module for broadcast messages', external: true },
    { label: 'Review Survey History', to: '/old', note: 'Track participation and trends', external: true },
  ]

  return (
    <div className="space-y-6">
      <div className="rounded-xl border bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold">Operations Dashboard</h2>
            <p className="mt-1 text-sm text-gray-600">A concise snapshot for managers to monitor system and operations status.</p>
          </div>
          <div className="flex items-center gap-2 rounded-lg border bg-gray-50 p-1 text-sm">
            {(['today', '7d', '30d'] as TimeRange[]).map((range) => (
              <button
                key={range}
                type="button"
                onClick={() => setTimeRange(range)}
                className={`rounded-md px-3 py-1.5 transition ${timeRange === range ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
              >
                {range.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
      </div>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">Health endpoint unavailable: {(error as Error).message}</div>
      ) : null}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {kpis.map((kpi) => (
          <article key={kpi.label} className="rounded-xl border bg-white p-4 shadow-sm">
            <p className="text-xs uppercase tracking-wide text-gray-500">{kpi.label}</p>
            <p className={`mt-2 text-xl font-semibold ${kpi.tone}`}>{isLoading ? 'Loading…' : kpi.value}</p>
          </article>
        ))}
      </section>

      <section className="grid gap-4 xl:grid-cols-3">
        <article className="rounded-xl border bg-white p-5 shadow-sm xl:col-span-2">
          <h3 className="text-lg font-semibold">Manager Notes</h3>
          <ul className="mt-3 space-y-2 text-sm text-gray-700">
            <li>• Dashboard V1 focuses on reliability and quick action links.</li>
            <li>• Next step: add employee, notification, survey, and event KPI integrations.</li>
            <li>• Selected range: <span className="font-medium">{timeRange.toUpperCase()}</span>.</li>
          </ul>
          <div className="mt-4 rounded-lg bg-gray-50 p-3 text-xs text-gray-500">
            Last health payload: {data ? JSON.stringify(data) : 'No data loaded yet.'}
          </div>
        </article>

        <article className="rounded-xl border bg-white p-5 shadow-sm">
          <h3 className="text-lg font-semibold">Quick Actions</h3>
          <div className="mt-3 space-y-3">
            {quickActions.map((action) => (
              action.external ? (
                <a key={action.label} href={action.to} className="block rounded-lg border p-3 transition hover:bg-gray-50">
                  <p className="text-sm font-medium text-gray-900">{action.label}</p>
                  <p className="mt-1 text-xs text-gray-600">{action.note}</p>
                </a>
              ) : (
                <Link key={action.label} to={action.to} className="block rounded-lg border p-3 transition hover:bg-gray-50">
                  <p className="text-sm font-medium text-gray-900">{action.label}</p>
                  <p className="mt-1 text-xs text-gray-600">{action.note}</p>
                </Link>
              )
            ))}
          </div>
        </article>
      </section>
    </div>
  )
}
