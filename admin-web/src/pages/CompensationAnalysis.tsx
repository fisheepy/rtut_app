import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  BarChart3,
  KeyRound,
  LockKeyhole,
  LogOut,
  Mail,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import { api } from "../shared/api";

function CompensationLogin({ onLogin }: { onLogin: () => void }) {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      if (!codeSent) {
        await api.post("/compensation-auth/request-code", { email: email.trim() });
        setCodeSent(true);
        setMessage("A 6-digit code was sent to your authorized email. It expires in 10 minutes.");
      } else {
        await api.post("/compensation-auth/verify-code", { email: email.trim(), code: code.trim() });
        onLogin();
      }
    } catch (error: any) {
      setMessage(error.response?.data?.error || "Secure access could not be completed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl overflow-hidden rounded-3xl border border-white/80 bg-white shadow-2xl">
      <div className="grid lg:grid-cols-[1.05fr_0.95fr]">
        <section className="relative overflow-hidden bg-gradient-to-br from-indigo-950 via-blue-950 to-slate-950 p-8 text-white md:p-12">
          <div className="absolute -right-20 -top-20 h-72 w-72 rounded-full bg-fuchsia-500/25 blur-3xl" />
          <div className="relative">
            <Link className="inline-flex items-center gap-2 text-sm font-semibold text-indigo-200 hover:text-white" to="/"><ArrowLeft className="h-4 w-4" />Back to HR &amp; Safety Platform</Link>
            <div className="mt-10 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-cyan-100"><ShieldCheck className="h-4 w-4" />Restricted Compensation Data</div>
            <BarChart3 className="mt-7 h-12 w-12 text-cyan-300" />
            <h1 className="mt-5 text-4xl font-bold leading-tight">Compensation Analysis Platform</h1>
            <p className="mt-4 max-w-lg text-sm leading-7 text-slate-300">A secure workspace for compensation analysis, pay planning, internal equity review, and leadership reporting.</p>
          </div>
        </section>
        <section className="p-7 md:p-12">
          <LockKeyhole className="h-9 w-9 text-indigo-700" />
          <h2 className="mt-5 text-2xl font-bold text-slate-950">Authorized access</h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">Use an approved company email. Existing authorized HR Tools sessions are reused automatically.</p>
          <form className="mt-7 space-y-4" onSubmit={submit}>
            <label className="block text-sm font-bold text-slate-700">Company email
              <span className="relative mt-2 block"><Mail className="absolute left-3 top-3 h-4 w-4 text-slate-400" /><input className="w-full rounded-xl border border-slate-200 py-2.5 pl-9 pr-3 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100" onChange={(event) => setEmail(event.target.value)} placeholder="name@royaltrailersales.com" type="email" value={email} /></span>
            </label>
            {codeSent && <label className="block text-sm font-bold text-slate-700">6-digit code<input autoFocus className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-center text-xl font-bold tracking-[0.35em] outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100" inputMode="numeric" maxLength={6} onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))} value={code} /></label>}
            <button className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-700 px-4 py-3 text-sm font-bold text-white hover:bg-indigo-800 disabled:opacity-50" disabled={busy || !email.trim() || (codeSent && code.length !== 6)} type="submit"><KeyRound className="h-4 w-4" />{busy ? "Please wait..." : codeSent ? "Sign in securely" : "Email me a code"}</button>
          </form>
          {message && <p className="mt-4 rounded-xl bg-slate-50 p-3 text-sm font-semibold text-slate-700">{message}</p>}
        </section>
      </div>
    </div>
  );
}

export default function CompensationAnalysis() {
  const [state, setState] = useState<"checking" | "authenticated" | "signed-out">("checking");

  useEffect(() => {
    api.get("/compensation/overview").then(() => setState("authenticated")).catch(() => setState("signed-out"));
  }, []);

  async function logout() {
    await api.post("/compensation-auth/logout").catch(() => {});
    setState("signed-out");
  }

  if (state === "checking") return <div className="grid min-h-64 place-items-center rounded-2xl bg-white shadow-sm"><div className="text-center"><RefreshCw className="mx-auto h-7 w-7 animate-spin text-indigo-700" /><p className="mt-3 text-sm font-semibold text-slate-600">Checking Compensation access...</p></div></div>;
  if (state === "signed-out") return <CompensationLogin onLogin={() => setState("authenticated")} />;

  return (
    <div className="space-y-7">
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-950 via-blue-950 to-slate-950 px-7 py-8 text-white shadow-xl">
        <div className="absolute right-0 top-0 h-64 w-64 rounded-full bg-fuchsia-500/20 blur-3xl" />
        <div className="relative flex flex-wrap items-start justify-between gap-5">
          <div><Link className="inline-flex items-center gap-2 text-sm font-semibold text-indigo-200 hover:text-white" to="/"><ArrowLeft className="h-4 w-4" />Back to HR &amp; Safety Platform</Link><div className="mt-7 flex items-center gap-4"><div className="grid h-14 w-14 place-items-center rounded-2xl bg-white/10"><BarChart3 className="h-7 w-7 text-cyan-300" /></div><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-200">Restricted Workspace</p><h1 className="mt-1 text-3xl font-bold md:text-4xl">Compensation Analysis Platform</h1></div></div><p className="mt-5 max-w-2xl text-sm leading-7 text-slate-300">Secure foundation for Royal’s compensation analysis and planning workflows.</p></div>
          <button className="inline-flex items-center gap-2 text-sm font-bold text-slate-300 hover:text-white" onClick={logout} type="button"><LogOut className="h-4 w-4" />Sign out</button>
        </div>
      </section>
      <section className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
        {["Compensation Data", "Internal Equity", "Pay Planning", "Analysis & Reports"].map((title, index) => <article className="rounded-2xl border border-indigo-100 bg-white p-5 shadow-sm" key={title}><span className="grid h-9 w-9 place-items-center rounded-lg bg-indigo-50 text-sm font-black text-indigo-700">{index + 1}</span><h2 className="mt-4 text-lg font-bold text-slate-950">{title}</h2><p className="mt-2 text-sm leading-6 text-slate-500">Platform module ready for detailed workflow requirements.</p><span className="mt-5 inline-flex rounded-full bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-800">Configuration Pending</span></article>)}
      </section>
    </div>
  );
}
