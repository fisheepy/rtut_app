import { useQuery } from '@tanstack/react-query'
import { api } from '../shared/api'

type Employee = {
  ['First Name']: string
  ['Last Name']: string
  Department?: string
  ['Account Active']: string
  [key: string]: any
}

export default function Employees() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['employees'],
    queryFn: async (): Promise<Employee[]> => {
      // 如果要带 query 参数（例如 loginName），可在 params 填上
      const res = await api.get('/employees', {
        params: { query: {
          'firstName': 'Xuan',
          'lastName': 'Yu',
        } }, // 临时写死一个管理员测试
      })
      return res.data
    },
  })

  if (isLoading) return <div className="p-6">Loading…</div>
  if (error) return <div className="p-6 text-red-600">Error: {(error as any).message}</div>

  return (
    <div className="p-6 space-y-3">
      <h2 className="text-xl font-semibold">Employees</h2>
      <div className="overflow-auto rounded border bg-white">
        <table className="min-w-[640px] w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-2 border-b text-left">First Name</th>
              <th className="px-3 py-2 border-b text-left">Last Name</th>
              <th className="px-3 py-2 border-b text-left">Department</th>
              <th className="px-3 py-2 border-b text-left">Status</th>
            </tr>
          </thead>
          <tbody>
            {data?.map((e, i) => (
              <tr key={i} className="even:bg-gray-50/40">
                <td className="px-3 py-2 border-b">{e['First Name']}</td>
                <td className="px-3 py-2 border-b">{e['Last Name']}</td>
                <td className="px-3 py-2 border-b">{e['Department'] ?? '-'}</td>
                <td className="px-3 py-2 border-b">{e['Account Active']}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
