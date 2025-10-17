import { useQuery } from '@tanstack/react-query'
import { api } from '../shared/api'

export default function Dashboard() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['health'],
    // 如果你后端没有 /api/health，就在下面⑤里加；或换成现有的任意 GET 接口
    queryFn: async () => (await api.get('/health')).data,
  })

  if (isLoading) return <div className="p-6">Loading…</div>
  if (error) return <div className="p-6 text-red-600">Error: {(error as any).message}</div>

  return (
    <div className="p-6 space-y-3">
      <h2 className="text-xl font-semibold">Health</h2>
      <pre className="rounded bg-white p-4 shadow">{JSON.stringify(data, null, 2)}</pre>
    </div>
  )
}
