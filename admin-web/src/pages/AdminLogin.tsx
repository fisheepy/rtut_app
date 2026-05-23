import { useEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { KeyRound, Mail, ShieldCheck } from 'lucide-react'
import { api } from '../shared/api'

type AdminUser = {
  firstName?: string
  lastName?: string
  email?: string
  type?: string
  expiresAt?: string
}

type AdminLoginProps = {
  onLogin: (user: AdminUser) => void
}

declare global {
  interface Window {
    google?: any
  }
}

export default function AdminLogin({ onLogin }: AdminLoginProps) {
  const googleButtonRef = useRef<HTMLDivElement | null>(null)
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [enteredCode, setEnteredCode] = useState('')
  const [googleClientId, setGoogleClientId] = useState('')
  const [message, setMessage] = useState('')
  const [isRequestingCode, setIsRequestingCode] = useState(false)
  const [isLoggingIn, setIsLoggingIn] = useState(false)

  const canRequestCode = useMemo(() => firstName.trim() && lastName.trim() && !isRequestingCode, [firstName, lastName, isRequestingCode])
  const canLogin = useMemo(() => firstName.trim() && lastName.trim() && enteredCode.trim() && !isLoggingIn, [firstName, lastName, enteredCode, isLoggingIn])

  useEffect(() => {
    api.get('/admin-auth/config')
      .then((res) => setGoogleClientId(res.data.googleClientId || ''))
      .catch(() => setGoogleClientId(''))
  }, [])

  useEffect(() => {
    if (!googleClientId) return

    const scriptId = 'google-identity-services'
    const initialize = () => {
      if (!window.google || !googleButtonRef.current) return
      window.google.accounts.id.initialize({
        client_id: googleClientId,
        callback: async (response: { credential: string }) => {
          try {
            setMessage('Validating Google account...')
            const res = await api.post('/admin-auth/google', { credential: response.credential })
            onLogin(res.data.user)
          } catch (error: any) {
            setMessage(error.response?.data?.error || 'Google sign-in failed.')
          }
        },
      })
      googleButtonRef.current.innerHTML = ''
      window.google.accounts.id.renderButton(googleButtonRef.current, {
        theme: 'outline',
        size: 'large',
        width: 320,
        text: 'signin_with',
      })
    }

    if (!document.getElementById(scriptId)) {
      const script = document.createElement('script')
      script.id = scriptId
      script.src = 'https://accounts.google.com/gsi/client'
      script.async = true
      script.defer = true
      script.onload = initialize
      document.head.appendChild(script)
    } else {
      initialize()
    }
  }, [googleClientId, onLogin])

  async function requestCode(event: FormEvent) {
    event.preventDefault()
    if (!canRequestCode) return
    setIsRequestingCode(true)
    setMessage('Requesting one-time code...')
    try {
      await api.post('/admin-auth/request-code', {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
      })
      setMessage('A one-time code has been sent.')
    } catch (error: any) {
      setMessage(error.response?.data?.error || 'Unable to send code.')
    } finally {
      setIsRequestingCode(false)
    }
  }

  async function loginWithCode(event: FormEvent) {
    event.preventDefault()
    if (!canLogin) return
    setIsLoggingIn(true)
    setMessage('Validating code...')
    try {
      const res = await api.post('/admin-auth/otp-login', {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        enteredCode: enteredCode.trim(),
      })
      onLogin(res.data.user)
    } catch (error: any) {
      setMessage(error.response?.data?.error || 'Invalid code or code expired.')
    } finally {
      setIsLoggingIn(false)
    }
  }

  return (
    <div className="grid min-h-screen place-items-center bg-[radial-gradient(circle_at_top_left,#dbeafe_0,#f3f6fb_30%,#eef2f7_100%)] px-4 py-10">
      <div className="w-full max-w-5xl overflow-hidden rounded-2xl border border-white/70 bg-white shadow-2xl">
        <div className="grid lg:grid-cols-[0.95fr_1.05fr]">
          <section className="relative overflow-hidden bg-slate-950 p-8 text-white">
            <div className="absolute -right-20 -top-20 h-72 w-72 rounded-full bg-blue-500/35 blur-3xl" />
            <div className="absolute -bottom-24 left-12 h-64 w-64 rounded-full bg-cyan-400/25 blur-3xl" />
            <div className="relative">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-semibold text-blue-100">
                <ShieldCheck className="h-4 w-4" />
                Secure Admin Access
              </div>
              <h1 className="mt-5 text-4xl font-semibold tracking-normal">RTUT Admin Tools</h1>
              <p className="mt-4 max-w-md text-sm leading-6 text-slate-300">
                Sign in with a verified admin session. Sessions are issued by the backend and expire automatically.
              </p>
            </div>
          </section>

          <section className="p-6 md:p-8">
            <div>
              <h2 className="text-2xl font-semibold text-slate-950">Sign in</h2>
              <p className="mt-1 text-sm text-slate-500">Use Google Workspace or request a one-time code.</p>
            </div>

            <div className="mt-6 rounded-xl border border-slate-200 p-4">
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-lg bg-blue-100 text-blue-700">
                  <Mail className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-950">Google sign-in</h3>
                  <p className="text-sm text-slate-500">Authorized Gmail or company Google Workspace account.</p>
                </div>
              </div>
              <div className="mt-4 min-h-11" ref={googleButtonRef}>
                {!googleClientId ? <p className="text-sm text-slate-500">Google sign-in is not configured yet.</p> : null}
              </div>
            </div>

            <div className="my-5 flex items-center gap-3 text-xs font-semibold uppercase text-slate-400">
              <span className="h-px flex-1 bg-slate-200" />
              or
              <span className="h-px flex-1 bg-slate-200" />
            </div>

            <form className="space-y-4" onSubmit={loginWithCode}>
              <div className="grid gap-3 sm:grid-cols-2">
                <input className="rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-blue-400" placeholder="First Name" value={firstName} onChange={(event) => setFirstName(event.target.value)} />
                <input className="rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-blue-400" placeholder="Last Name" value={lastName} onChange={(event) => setLastName(event.target.value)} />
              </div>
              <div className="flex flex-wrap gap-3">
                <button className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 shadow-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50" type="button" disabled={!canRequestCode} onClick={requestCode}>
                  <KeyRound className="h-4 w-4" />
                  {isRequestingCode ? 'Sending...' : 'Request Code'}
                </button>
              </div>
              <input className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-blue-400" placeholder="One-time code" value={enteredCode} onChange={(event) => setEnteredCode(event.target.value)} />
              <button className="w-full rounded-lg bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-600 disabled:cursor-not-allowed disabled:bg-slate-300" type="submit" disabled={!canLogin}>
                {isLoggingIn ? 'Signing in...' : 'Sign in with code'}
              </button>
            </form>

            {message ? <p className="mt-4 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">{message}</p> : null}
          </section>
        </div>
      </div>
    </div>
  )
}
