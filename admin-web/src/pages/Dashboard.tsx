import { Link } from 'react-router-dom'
import { ArrowRight, Bell, UsersRound } from 'lucide-react'

const tools = [
  {
    title: 'Employee Management',
    description: 'Review employee records and account status from the admin roster.',
    to: '/employees',
    icon: UsersRound,
    tone: 'from-emerald-600 to-teal-500',
    status: 'Available',
  },
  {
    title: 'App Console',
    description: 'Open the existing RTUT admin console for notifications, surveys, events, and employee utility workflows.',
    to: '/app-console',
    icon: Bell,
    tone: 'from-amber-500 to-fuchsia-500',
    status: 'Module',
  },
]

export default function Dashboard() {
  return (
    <div className="space-y-7">
      <section className="relative overflow-hidden rounded-2xl border border-white/70 bg-slate-950 px-6 py-7 text-white shadow-xl">
        <div className="absolute inset-y-0 right-0 w-1/2 bg-[radial-gradient(circle_at_center,#2563eb_0,transparent_52%)] opacity-40" />
        <div className="relative max-w-3xl">
          <p className="text-sm font-semibold uppercase text-cyan-200">Admin Tool Hub</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-normal md:text-5xl">One workspace for operational tools.</h1>
          <p className="mt-4 max-w-2xl text-base text-slate-300">
            Admin-only access stays here. Public HR utilities live on direct links outside the login workspace.
          </p>
        </div>
      </section>

      <section className="grid gap-5 md:grid-cols-2">
        {tools.map((tool) => {
          const Icon = tool.icon
          const external = tool.to === '/app-console'
          const content = (
            <article className="group h-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-lg">
              <div className={`h-2 bg-gradient-to-r ${tool.tone}`} />
              <div className="p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className={`grid h-12 w-12 place-items-center rounded-lg bg-gradient-to-br ${tool.tone} text-white shadow-sm`}>
                    <Icon className="h-6 w-6" />
                  </div>
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">{tool.status}</span>
                </div>
                <h2 className="mt-5 text-xl font-semibold text-slate-950">{tool.title}</h2>
                <p className="mt-2 min-h-12 text-sm leading-6 text-slate-600">{tool.description}</p>
                <div className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-blue-700">
                  Open tool
                  <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
                </div>
              </div>
            </article>
          )

          return external ? (
            <a key={tool.title} href={tool.to}>
              {content}
            </a>
          ) : (
            <Link key={tool.title} to={tool.to}>
              {content}
            </Link>
          )
        })}
      </section>
    </div>
  )
}
