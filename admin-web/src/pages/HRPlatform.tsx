import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, ArrowRight, BriefcaseBusiness, HeartPulse, RefreshCw, Repeat2, UserMinus, UserPlus } from 'lucide-react'
import { api } from '../shared/api'

const workflows = [
  { title: 'New Hire', description: 'Create and track new employee onboarding records.', icon: UserPlus, tone: 'from-emerald-600 to-teal-500', to: '/hr-platform/new-hire' },
  { title: 'Termination', description: 'Document employee separations and required follow-up.', icon: UserMinus, tone: 'from-rose-600 to-orange-500', to: '/hr-platform/termination' },
  { title: 'Employment Change', description: 'Record changes to an employee’s role, department, location, supervisor, pay, or status.', icon: Repeat2, tone: 'from-blue-600 to-cyan-500', to: '/hr-platform/employment-change' },
  { title: 'FMLA / ADA / Medical Leave', description: 'Manage leave requests, important dates, documentation, and case status.', icon: HeartPulse, tone: 'from-violet-600 to-fuchsia-500' },
]

export default function HRPlatform() {
  const [access, setAccess] = useState<'checking' | 'allowed' | 'denied'>('checking')

  useEffect(() => {
    api.get('/hr-tools-auth/me').then(() => setAccess('allowed')).catch(() => setAccess('denied'))
  }, [])

  if (access === 'checking') {
    return <div className="grid min-h-64 place-items-center rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="text-center"><RefreshCw className="mx-auto h-7 w-7 animate-spin text-amber-600" /><p className="mt-3 text-sm font-semibold text-slate-700">Checking secure access...</p></div></div>
  }

  if (access === 'denied') {
    return (
      <section className="mx-auto max-w-xl rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-lg">
        <BriefcaseBusiness className="mx-auto h-11 w-11 text-amber-600" />
        <h1 className="mt-4 text-2xl font-semibold text-slate-950">Sign-in required</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">Please sign in through HR Tools before opening the HR Platform.</p>
        <Link className="mt-6 inline-flex items-center gap-2 rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-800" to="/">Go to HR Tools sign-in<ArrowRight className="h-4 w-4" /></Link>
      </section>
    )
  }

  return (
    <div className="space-y-7">
      <section className="relative overflow-hidden rounded-2xl border border-white/70 bg-slate-950 px-6 py-8 text-white shadow-xl md:px-8">
        <div className="absolute inset-y-0 right-0 w-1/2 bg-[radial-gradient(circle_at_center,#f59e0b_0,transparent_55%)] opacity-25" />
        <div className="relative">
          <Link className="inline-flex items-center gap-2 text-sm font-semibold text-slate-300 hover:text-white" to="/"><ArrowLeft className="h-4 w-4" />Back to HR Tools</Link>
          <div className="mt-7 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-semibold text-amber-100"><BriefcaseBusiness className="h-4 w-4" />Employee Lifecycle Management</div>
          <h1 className="mt-5 text-4xl font-semibold tracking-normal md:text-5xl">HR Platform</h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-slate-300">One secure place to manage employee lifecycle changes and leave records.</p>
        </div>
      </section>

      <section className="grid gap-5 md:grid-cols-2">
        {workflows.map((workflow) => {
          const Icon = workflow.icon
          return (
            <article className={`overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm ${workflow.to ? 'transition hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-lg' : ''}`} key={workflow.title}>
              <div className={`h-2 bg-gradient-to-r ${workflow.tone}`} />
              <div className="p-6">
                <div className="flex items-start justify-between gap-4"><div className={`grid h-12 w-12 place-items-center rounded-lg bg-gradient-to-br ${workflow.tone} text-white shadow-sm`}><Icon className="h-6 w-6" /></div><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${workflow.to ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>{workflow.to ? 'Available' : 'Coming Soon'}</span></div>
                <h2 className="mt-5 text-xl font-semibold text-slate-950">{workflow.title}</h2>
                <p className="mt-2 min-h-12 text-sm leading-6 text-slate-600">{workflow.description}</p>
                {workflow.to ? <Link className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-emerald-700" to={workflow.to}>Open {workflow.title}<ArrowRight className="h-4 w-4" /></Link> : null}
              </div>
            </article>
          )
        })}
      </section>
    </div>
  )
}

