import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  Building2,
  CircleDollarSign,
  Info,
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
  const [analysis, setAnalysis] = useState<GrossPayAnalysis | null>(null);
  const [analysisError, setAnalysisError] = useState("");

  async function loadAnalysis() {
    setAnalysisError("");
    try {
      const response = await api.get<GrossPayAnalysis>("/compensation/gross-pay-analysis");
      setAnalysis(response.data);
    } catch {
      setAnalysisError("Gross pay analysis could not be loaded.");
    }
  }

  useEffect(() => {
    api.get("/compensation/overview").then(async () => {
      setState("authenticated");
      await loadAnalysis();
    }).catch(() => setState("signed-out"));
  }, []);

  async function logout() {
    await api.post("/compensation-auth/logout").catch(() => {});
    setState("signed-out");
  }

  if (state === "checking") return <div className="grid min-h-64 place-items-center rounded-2xl bg-white shadow-sm"><div className="text-center"><RefreshCw className="mx-auto h-7 w-7 animate-spin text-indigo-700" /><p className="mt-3 text-sm font-semibold text-slate-600">Checking Compensation access...</p></div></div>;
  if (state === "signed-out") return <CompensationLogin onLogin={() => { setState("authenticated"); void loadAnalysis(); }} />;

  return (
    <div className="space-y-7">
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-950 via-blue-950 to-slate-950 px-7 py-8 text-white shadow-xl">
        <div className="absolute right-0 top-0 h-64 w-64 rounded-full bg-fuchsia-500/20 blur-3xl" />
        <div className="relative flex flex-wrap items-start justify-between gap-5">
          <div><Link className="inline-flex items-center gap-2 text-sm font-semibold text-indigo-200 hover:text-white" to="/"><ArrowLeft className="h-4 w-4" />Back to HR &amp; Safety Platform</Link><div className="mt-7 flex items-center gap-4"><div className="grid h-14 w-14 place-items-center rounded-2xl bg-white/10"><BarChart3 className="h-7 w-7 text-cyan-300" /></div><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-200">Restricted Workspace</p><h1 className="mt-1 text-3xl font-bold md:text-4xl">Compensation Analysis Platform</h1></div></div><p className="mt-5 max-w-2xl text-sm leading-7 text-slate-300">Secure foundation for Royal’s compensation analysis and planning workflows.</p></div>
          <button className="inline-flex items-center gap-2 text-sm font-bold text-slate-300 hover:text-white" onClick={logout} type="button"><LogOut className="h-4 w-4" />Sign out</button>
        </div>
      </section>
      {analysisError && <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-800">{analysisError}</div>}
      {!analysis && !analysisError && <div className="grid min-h-48 place-items-center rounded-2xl bg-white shadow-sm"><RefreshCw className="h-7 w-7 animate-spin text-indigo-700" /></div>}
      {analysis && <GrossPayDashboard analysis={analysis} />}
    </div>
  );
}

type DistributionStats = {
  population: number;
  analyzed: number;
  noHistory: number;
  min: number;
  p25: number;
  median: number;
  average: number;
  p75: number;
  max: number;
};

type GrossPayAnalysis = {
  period: { start: string; end: string };
  generatedOn: string;
  basis: string;
  annualizedEmployees: number;
  insufficientHistoryEmployees: number;
  overall: DistributionStats;
  locations: Array<DistributionStats & { location: string }>;
  payTypes: Array<{ payType: "Hourly" | "Salary"; overall: DistributionStats; regularPay?: DistributionStats; locations: Array<DistributionStats & { location: string }>; jobTitles?: Array<DistributionStats & { jobTitle: string }> }>;
  noHistoryEmployees: Array<{ name: string; location: string; reason: string }>;
  insufficientHistory: Array<{ name: string; location: string; coveredDays: number; reason: string }>;
};

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const dateText = (value: string) => new Date(`${value}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

function GrossPayDashboard({ analysis }: { analysis: GrossPayAnalysis }) {
  const metrics = [
    ["Minimum", analysis.overall.min],
    ["25th Percentile", analysis.overall.p25],
    ["Median", analysis.overall.median],
    ["Average", analysis.overall.average],
    ["75th Percentile", analysis.overall.p75],
    ["Maximum", analysis.overall.max],
  ] as const;
  const maxLocationAverage = Math.max(...analysis.locations.map((row) => row.average));
  const locationAdjustments = [
    { location: "Dearborn", evidence: "Wayne County baseline", recommendation: "100%", note: "Reference location" },
    { location: "Warren", evidence: "About 3% above Wayne County basic-needs benchmark", recommendation: "100%–103%", note: "Same Detroit labor market" },
    { location: "Northville", evidence: "Wayne/Oakland County boundary; up to about 8% higher", recommendation: "100%–105%", note: "Confirm the applicable worksite county" },
    { location: "Wixom", evidence: "Oakland County basic-needs benchmark is about 8% higher", recommendation: "103%–105%", note: "Keep within the Detroit pay market" },
    { location: "Grand Rapids", evidence: "BEA metro prices about 5% lower; MIT basic needs about 14% higher", recommendation: "100%–105%", note: "Use recruiting data before applying a premium" },
    { location: "Hudsonville", evidence: "Ottawa County basic-needs benchmark is about 9% higher", recommendation: "103%–105%", note: "Review with Grand Rapids market data" },
    { location: "Gaylord", evidence: "Otsego County basic-needs benchmark is about 2% higher", recommendation: "100%–102%", note: "No material COLA indicated" },
    { location: "Ohio Cleveland", evidence: "BEA and MIT both indicate lower costs than Dearborn", recommendation: "100%", note: "Do not reduce current employee pay" },
  ];

  return <>
    <section className="rounded-3xl border border-indigo-100 bg-white p-6 shadow-sm md:p-7">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div><div className="flex items-center gap-2 text-sm font-bold text-indigo-700"><CircleDollarSign className="h-5 w-5" />Estimated Annual Gross Pay Distribution</div><h2 className="mt-2 text-2xl font-bold text-slate-950">Company overview</h2><p className="mt-2 text-sm text-slate-500">Based on the most current one-year history: {dateText(analysis.period.start)} – {dateText(analysis.period.end)}</p></div>
        <div className="flex gap-3"><div className="rounded-xl bg-indigo-50 px-4 py-3 text-center"><p className="text-2xl font-black text-indigo-950">{analysis.overall.population}</p><p className="text-xs font-bold uppercase tracking-wide text-indigo-600">Current Employees</p></div><div className="rounded-xl bg-emerald-50 px-4 py-3 text-center"><p className="text-2xl font-black text-emerald-950">{analysis.overall.analyzed}</p><p className="text-xs font-bold uppercase tracking-wide text-emerald-700">With Pay History</p></div></div>
      </div>
      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">{metrics.map(([label, value]) => <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4" key={label}><p className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</p><p className="mt-2 text-xl font-black text-slate-950">{money.format(value)}</p></div>)}</div>
      <div className="mt-5 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950"><Info className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" /><p>{analysis.annualizedEmployees} employees hired or rehired during the reporting period are annualized using actual Gross Pay ÷ covered employment days × 365. Employees need at least 90 days of pay history. {analysis.insufficientHistoryEmployees} employees have insufficient pay history, and {analysis.noHistoryEmployees.length} employees started after the reporting period; all remain in headcount but are excluded from the distribution.</p></div>
    </section>

    <section className="overflow-hidden rounded-3xl border border-indigo-100 bg-white shadow-sm">
      <div className="flex items-center gap-3 border-b border-slate-200 px-6 py-5"><span className="grid h-10 w-10 place-items-center rounded-xl bg-indigo-50 text-indigo-700"><Building2 className="h-5 w-5" /></span><div><h2 className="text-xl font-bold text-slate-950">Estimated annual gross pay by location</h2><p className="text-sm text-slate-500">Current roster locations with full-year estimates for partial-period employees.</p></div></div>
      <div className="overflow-x-auto">
        <table className="min-w-[1120px] w-full text-left text-sm">
          <thead className="bg-slate-900 text-xs uppercase tracking-wide text-white"><tr>{["Location", "Employees", "Analyzed", "Min", "25th", "Median", "Average", "75th", "Max", "Average comparison"].map((header) => <th className="whitespace-nowrap px-4 py-3" key={header}>{header}</th>)}</tr></thead>
          <tbody className="divide-y divide-slate-100">{analysis.locations.map((row) => <tr className="hover:bg-indigo-50/40" key={row.location}><td className="px-4 py-3 font-bold text-slate-950">{row.location}</td><td className="px-4 py-3 text-center">{row.population}</td><td className="px-4 py-3 text-center">{row.analyzed}{row.noHistory ? <span className="ml-1 text-xs font-bold text-amber-700">({row.noHistory} no history)</span> : null}</td>{[row.min, row.p25, row.median, row.average, row.p75, row.max].map((value, index) => <td className={`whitespace-nowrap px-4 py-3 ${index === 3 ? "font-black text-indigo-800" : "text-slate-700"}`} key={index}>{money.format(value)}</td>)}<td className="w-44 px-4 py-3"><div className="h-2.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-cyan-500" style={{ width: `${Math.max(5, (row.average / maxLocationAverage) * 100)}%` }} /></div></td></tr>)}</tbody>
        </table>
      </div>
    </section>

    <section className="overflow-hidden rounded-3xl border border-indigo-100 bg-white shadow-sm">
      <div className="border-b border-slate-200 bg-gradient-to-r from-indigo-950 to-slate-900 px-6 py-6 text-white">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-cyan-200">Dearborn = 100%</p>
        <h2 className="mt-2 text-2xl font-bold">Cost of living adjustment analysis</h2>
        <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-300">Government regional price data and current county-level living-wage research do not support large automatic location adjustments. Recommended ranges are planning guides, not automatic employee pay changes.</p>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-[980px] w-full text-left text-sm">
          <thead className="bg-slate-100 text-xs uppercase tracking-wide text-slate-700"><tr>{["Location", "External data signal", "Recommended index", "Management guidance"].map((header) => <th className="px-5 py-3" key={header}>{header}</th>)}</tr></thead>
          <tbody className="divide-y divide-slate-100">{locationAdjustments.map((row) => <tr className="hover:bg-indigo-50/40" key={row.location}><td className="px-5 py-4 font-bold text-slate-950">{row.location}</td><td className="px-5 py-4 text-slate-600">{row.evidence}</td><td className="px-5 py-4"><span className="inline-flex rounded-full bg-indigo-100 px-3 py-1 font-black text-indigo-900">{row.recommendation}</span></td><td className="px-5 py-4 text-slate-600">{row.note}</td></tr>)}</tbody>
        </table>
      </div>
      <div className="border-t border-slate-200 bg-slate-50 p-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-5"><h3 className="font-bold text-slate-950">Sources and limitation</h3><p className="mt-2 text-sm leading-6 text-slate-600">Based on U.S. Bureau of Economic Analysis Regional Price Parities and MIT Living Wage Calculator county benchmarks. Cost of living is only one pay factor; job market competition, performance, experience, commission, and overtime must be reviewed separately.</p><div className="mt-3 flex flex-wrap gap-3 text-xs font-bold"><a className="text-indigo-700 hover:underline" href="https://www.bea.gov/data/prices-inflation/regional-price-parities-state-and-metro-area" rel="noreferrer" target="_blank">BEA Regional Price Parities</a><a className="text-indigo-700 hover:underline" href="https://livingwage.mit.edu/" rel="noreferrer" target="_blank">MIT Living Wage Calculator</a></div></div>
      </div>
    </section>

    <section className="rounded-3xl border border-indigo-100 bg-white p-6 shadow-sm md:p-7">
      <div><p className="text-xs font-bold uppercase tracking-[0.15em] text-indigo-700">Detailed analysis workspaces</p><h2 className="mt-1 text-xl font-bold text-slate-950">Choose an employee pay group</h2><p className="mt-1 text-sm text-slate-500">Open a separate workspace for detailed hourly or salary analysis.</p></div>
      <div className="mt-5 grid gap-4 md:grid-cols-2">
        {analysis.payTypes.map((row) => <Link className={`group rounded-2xl border p-5 transition hover:-translate-y-0.5 hover:shadow-lg ${row.payType === "Hourly" ? "border-cyan-200 bg-gradient-to-br from-cyan-50 to-white" : "border-violet-200 bg-gradient-to-br from-violet-50 to-white"}`} key={row.payType} to={`/compensation-analysis/${row.payType.toLowerCase()}`}><div className="flex items-center justify-between gap-4"><div><p className={`text-xs font-bold uppercase tracking-[0.15em] ${row.payType === "Hourly" ? "text-cyan-700" : "text-violet-700"}`}>{row.payType} workforce</p><h3 className="mt-2 text-2xl font-black text-slate-950">{row.payType} Analysis</h3><p className="mt-2 text-sm text-slate-600">{row.overall.analyzed} analyzed of {row.overall.population} current employees</p></div><span className={`grid h-12 w-12 place-items-center rounded-full text-white ${row.payType === "Hourly" ? "bg-cyan-700" : "bg-violet-700"}`}><ArrowRight className="h-5 w-5 transition group-hover:translate-x-1" /></span></div><p className="mt-5 text-sm font-bold text-indigo-800">Open detailed {row.payType.toLowerCase()} analysis</p></Link>)}
      </div>
    </section>
  </>;
}

export function CompensationPayTypeAnalysis({ payType }: { payType: "Hourly" | "Salary" }) {
  const [state, setState] = useState<"checking" | "authenticated" | "signed-out">("checking");
  const [analysis, setAnalysis] = useState<GrossPayAnalysis | null>(null);
  const [error, setError] = useState("");

  async function load() {
    setError("");
    try {
      const response = await api.get<GrossPayAnalysis>("/compensation/gross-pay-analysis");
      setAnalysis(response.data);
    } catch {
      setError(`${payType} analysis could not be loaded.`);
    }
  }

  useEffect(() => {
    api.get("/compensation/overview").then(async () => { setState("authenticated"); await load(); }).catch(() => setState("signed-out"));
  }, [payType]);

  if (state === "checking") return <div className="grid min-h-64 place-items-center rounded-2xl bg-white shadow-sm"><RefreshCw className="h-7 w-7 animate-spin text-indigo-700" /></div>;
  if (state === "signed-out") return <CompensationLogin onLogin={() => { setState("authenticated"); void load(); }} />;

  const selected = analysis?.payTypes.find((row) => row.payType === payType);
  const accent = payType === "Hourly" ? "from-cyan-800 via-blue-900 to-slate-950" : "from-violet-800 via-indigo-950 to-slate-950";
  return <div className="space-y-7">
    <section className={`relative overflow-hidden rounded-3xl bg-gradient-to-br ${accent} px-7 py-8 text-white shadow-xl`}><div className="absolute -right-16 -top-20 h-64 w-64 rounded-full bg-white/10 blur-3xl" /><div className="relative"><Link className="inline-flex items-center gap-2 text-sm font-semibold text-white/80 hover:text-white" to="/compensation-analysis"><ArrowLeft className="h-4 w-4" />Back to Compensation Analysis</Link><p className="mt-7 text-xs font-bold uppercase tracking-[0.18em] text-cyan-200">Dedicated workspace</p><h1 className="mt-2 text-4xl font-black">{payType} Compensation Analysis</h1><p className="mt-3 max-w-2xl text-sm leading-7 text-slate-200">{payType === "Salary" ? "Detailed gross pay, regular pay, and job-title analysis for current salary employees." : "Detailed pay distribution and location comparison for current hourly employees."}</p></div></section>
    {error && <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-800">{error}</div>}
    {!analysis && !error && <div className="grid min-h-48 place-items-center rounded-2xl bg-white shadow-sm"><RefreshCw className="h-7 w-7 animate-spin text-indigo-700" /></div>}
    {analysis && selected && <>
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"><div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-sm font-bold text-indigo-700">{dateText(analysis.period.start)} – {dateText(analysis.period.end)}</p><h2 className="mt-1 text-2xl font-black text-slate-950">{payType} gross pay distribution</h2></div><div className="rounded-xl bg-slate-100 px-4 py-3 text-right"><p className="text-2xl font-black text-slate-950">{selected.overall.analyzed} / {selected.overall.population}</p><p className="text-xs font-bold uppercase tracking-wide text-slate-500">Analyzed employees</p></div></div><div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">{[["Minimum", selected.overall.min], ["25th Percentile", selected.overall.p25], ["Median", selected.overall.median], ["Average", selected.overall.average], ["75th Percentile", selected.overall.p75], ["Maximum", selected.overall.max]].map(([label, value]) => <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4" key={label}><p className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</p><p className="mt-2 text-xl font-black text-slate-950">{money.format(value as number)}</p></div>)}</div>{selected.overall.noHistory > 0 && <p className="mt-4 rounded-xl bg-amber-50 p-3 text-sm font-semibold text-amber-900">{selected.overall.noHistory} employees are retained in headcount but excluded because sufficient pay history is unavailable.</p>}</section>
      {payType === "Salary" && selected.regularPay && <section className="rounded-3xl border border-violet-200 bg-white p-6 shadow-sm"><div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-sm font-bold text-violet-700">November 1 salary rate × 24 payrolls</p><h2 className="mt-1 text-2xl font-black text-slate-950">Salary regular pay distribution</h2></div><div className="rounded-xl bg-violet-50 px-4 py-3 text-right"><p className="text-2xl font-black text-violet-950">{selected.regularPay.analyzed} / {selected.regularPay.population}</p><p className="text-xs font-bold uppercase tracking-wide text-violet-700">Rates available</p></div></div><div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">{[["Minimum", selected.regularPay.min], ["25th Percentile", selected.regularPay.p25], ["Median", selected.regularPay.median], ["Average", selected.regularPay.average], ["75th Percentile", selected.regularPay.p75], ["Maximum", selected.regularPay.max]].map(([label, value]) => <div className="rounded-2xl border border-violet-100 bg-violet-50/60 p-4" key={label}><p className="text-xs font-bold uppercase tracking-wide text-violet-700">{label}</p><p className="mt-2 text-xl font-black text-slate-950">{money.format(value as number)}</p></div>)}</div><p className="mt-4 rounded-xl bg-emerald-50 p-3 text-sm font-semibold text-emerald-900">Confirmed November 1 salary updates are included, including Levi Nation at $100,000 annually.</p><p className="mt-2 rounded-xl bg-amber-50 p-3 text-sm font-semibold text-amber-900">2 salary employees are excluded because the Pay Rate is zero or unavailable: Gary Grimes and Mark Stephens.</p></section>}
      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm"><div className="border-b border-slate-200 px-6 py-5"><h2 className="text-xl font-black text-slate-950">{payType === "Salary" ? "Salary analysis by job title" : "Hourly analysis by location"}</h2><p className="mt-1 text-sm text-slate-500">{payType === "Salary" ? "Job-title distribution for current salary employees, ranked by average gross pay from highest to lowest." : "Location-level distribution using the same 90-day pay-history rule."}</p></div><div className="overflow-x-auto"><table className="min-w-[980px] w-full text-left text-sm"><thead className="bg-slate-900 text-xs uppercase tracking-wide text-white"><tr>{[payType === "Salary" ? "Job Title" : "Location", "Employees", "Analyzed", "Min", "25th", "Median", "Average", "75th", "Max"].map((header) => <th className="whitespace-nowrap px-4 py-3" key={header}>{header}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{(payType === "Salary" ? [...(selected.jobTitles ?? [])].sort((a, b) => b.average - a.average) : selected.locations).map((row) => { const label = "jobTitle" in row ? row.jobTitle : row.location; return <tr className="hover:bg-indigo-50/40" key={label}><td className="px-4 py-3 font-bold text-slate-950">{label}</td><td className="px-4 py-3 text-center">{row.population}</td><td className="px-4 py-3 text-center">{row.analyzed}</td>{[row.min, row.p25, row.median, row.average, row.p75, row.max].map((value, index) => <td className={`whitespace-nowrap px-4 py-3 ${index === 3 ? "font-black text-indigo-800" : "text-slate-700"}`} key={index}>{money.format(value)}</td>)}</tr>; })}</tbody></table></div><p className="border-t border-slate-200 bg-slate-50 p-5 text-sm leading-6 text-slate-600">Gross Pay includes applicable overtime, commission, bonus, PTO, and other paid earnings. It should not be interpreted as base pay alone.</p></section>
    </>}
  </div>;
}
