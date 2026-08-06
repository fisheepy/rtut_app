import { AlertTriangle, ArrowRight, CheckCircle2, Clock3, LogIn, X } from 'lucide-react'
import { Link } from 'react-router-dom'

export type TaskTone = 'file' | 'payroll' | 'insurance' | 'retirement' | 'followup'

export function isAuthenticationError(message: string) {
  return /auth|sign.?in|session|login/i.test(message)
}

export function isCurrentMonth(value?: string | null) {
  if (!value) return false
  const date = new Date(value)
  const now = new Date()
  return !Number.isNaN(date.getTime()) && date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth()
}

export function dueLabel(value?: string | null) {
  if (!value) return { label: 'Date Required', className: 'bg-red-100 text-red-800 ring-red-200' }
  const due = new Date(`${String(value).slice(0, 10)}T23:59:59`)
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const days = Math.ceil((due.getTime() - today.getTime()) / 86400000)
  if (days < 0) return { label: 'Overdue', className: 'bg-red-100 text-red-800 ring-red-200' }
  if (days === 0) return { label: 'Due Today', className: 'bg-orange-100 text-orange-800 ring-orange-200' }
  if (days <= 7) return { label: 'Due This Week', className: 'bg-amber-100 text-amber-800 ring-amber-200' }
  return { label: 'Upcoming', className: 'bg-blue-100 text-blue-800 ring-blue-200' }
}

export function TaskStatus({ complete = false, checked = false, date, finalRequired = false }: { complete?: boolean; checked?: boolean; date?: string | null; finalRequired?: boolean }) {
  if (complete) return <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-800"><CheckCircle2 className="h-3.5 w-3.5" />Completed</span>
  if (checked && finalRequired) return <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2.5 py-1 text-xs font-bold text-blue-800"><Clock3 className="h-3.5 w-3.5" />Final Review Needed</span>
  const due = dueLabel(date)
  return <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold ring-1 ${due.className}`}><AlertTriangle className="h-3.5 w-3.5" />{due.label}</span>
}

export function SessionExpired() {
  return <section className="mx-auto max-w-xl rounded-3xl border border-amber-200 bg-white p-9 text-center shadow-xl"><div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-amber-100 text-amber-800"><LogIn className="h-7 w-7" /></div><h1 className="mt-5 text-2xl font-bold text-slate-950">Your session has expired</h1><p className="mt-2 text-sm leading-6 text-slate-600">Please sign in again to securely load employee information and HR tasks.</p><Link className="mt-6 inline-flex items-center gap-2 rounded-xl bg-blue-700 px-5 py-3 text-sm font-bold text-white shadow hover:bg-blue-800" to="/">Sign In Again<ArrowRight className="h-4 w-4" /></Link></section>
}

export function RequiredFieldsNote() {
  return <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">Fields marked with <strong>*</strong> are required before task actions can be completed.</div>
}

export function ConfirmActionModal({ employee, action, final = false, onCancel, onConfirm }: { employee: string; action: string; final?: boolean; onCancel: () => void; onConfirm: () => void | Promise<void> }) {
  return <div aria-modal="true" className="fixed inset-0 z-[70] grid place-items-center bg-slate-950/65 p-4" role="dialog"><div className="w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl"><div className={`h-2 ${final ? 'bg-violet-600' : 'bg-emerald-600'}`} /><div className="p-6"><div className="flex items-start justify-between gap-4"><div><div className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${final ? 'bg-violet-100 text-violet-800' : 'bg-emerald-100 text-emerald-800'}`}>{final ? 'Final Review Confirmation' : 'Action Confirmation'}</div><h2 className="mt-4 text-xl font-bold text-slate-950">Confirm action completed</h2></div><button aria-label="Close confirmation" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" onClick={onCancel}><X className="h-5 w-5" /></button></div><p className="mt-4 text-sm leading-6 text-slate-600"><strong className="text-slate-950">{employee}</strong><br />{action}</p><p className="mt-3 rounded-xl bg-slate-50 p-3 text-xs leading-5 text-slate-600">Your administrator email and the completion time will be recorded.</p><div className="mt-6 flex justify-end gap-3"><button className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-bold text-slate-700" onClick={onCancel}>Cancel</button><button className={`rounded-xl px-4 py-2.5 text-sm font-bold text-white ${final ? 'bg-violet-700 hover:bg-violet-800' : 'bg-emerald-700 hover:bg-emerald-800'}`} onClick={onConfirm}>{final ? 'Confirm Final Review' : 'Yes, Action Completed'}</button></div></div></div></div>
}

