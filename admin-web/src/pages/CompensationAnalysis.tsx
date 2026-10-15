import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
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
  Search,
  ShieldCheck,
} from "lucide-react";
import { api } from "../shared/api";

export function CompensationLogin({ onLogin }: { onLogin: () => void }) {
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

type NullableDistributionStats = Omit<DistributionStats, "min" | "p25" | "median" | "average" | "p75" | "max"> & {
  min: number | null;
  p25: number | null;
  median: number | null;
  average: number | null;
  p75: number | null;
  max: number | null;
};

export type GrossPayAnalysis = {
  period: { start: string; end: string };
  generatedOn: string;
  basis: string;
  annualizedEmployees: number;
  insufficientHistoryEmployees: number;
  overall: DistributionStats;
  locations: Array<DistributionStats & { location: string }>;
  payTypes: Array<{ payType: "Hourly" | "Salary"; overall: DistributionStats; hourlyRate?: DistributionStats; regularPay?: DistributionStats; locations: Array<DistributionStats & { location: string }>; jobTitles?: Array<DistributionStats & { jobTitle: string }>; jobTitlesRegularPay?: Array<DistributionStats & { jobTitle: string }>; jobTitlesHourlyRate?: Array<NullableDistributionStats & { jobTitle: string }>; jobTitlesAnnualGross?: Array<NullableDistributionStats & { jobTitle: string }> }>;
  noHistoryEmployees: Array<{ name: string; location: string; reason: string }>;
  insufficientHistory: Array<{ name: string; location: string; coveredDays: number; reason: string }>;
  salaryEmployees: SalaryEmployee[];
  hourlyEmployees: HourlyEmployee[];
};

export type SalaryEmployee = {
  id: string;
  name: string;
  jobTitle: string;
  department: string;
  location: string;
  hireDate: string;
  jobFamily: string;
  regularPay: number | null;
  grossPay: number;
};

export type HourlyEmployee = {
  id: string;
  name: string;
  jobTitle: string;
  department: string;
  location: string;
  hireDate: string;
  hourlyRate: number;
  grossPay: number | null;
  coveredDays: number;
};

export const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
export const hourlyMoney = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const dateText = (value: string) => new Date(`${value}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
const salaryJobFamilies = [
  { family: "Executive Leadership", employees: 4, jobs: "CEO, COO, CFO, CLO", regular: "$210,000–$420,000", gross: "$203,415–$393,846", market: "Base: $209,000–$338,000 · Bonus/LTI: company-specific" },
  { family: "Enterprise Leadership", employees: 4, jobs: "VP Trailers, VP Aftermarket, HR Director, Procurement & IT Director", regular: "$130,000–$165,000", gross: "$128,077–$185,595", market: "Base: $146,000–$186,000 · Incentive: role-specific" },
  { family: "Management Level 1 · General & Business Unit Leadership", employees: 10, jobs: "General Managers, Specialty Equipment Service Manager, Outside Parts Sales Manager, Trailer Sales Manager", regular: "$62,500–$150,000", gross: "$62,716–$281,995", market: "Base: $93,000–$150,000 · Branch incentive varies" },
  { family: "Management Level 2A · Service Operations Leadership", employees: 5, jobs: "Truck and trailer Service Managers", regular: "$72,500–$140,000", gross: "$75,313–$137,846", market: "Base: $90,000–$130,000 · Total cash: $105,000–$155,000+" },
  { family: "Management Level 2B · Parts & Leasing Operations", employees: 5, jobs: "Parts Managers and Leasing Manager", regular: "$70,000–$100,000", gross: "$66,583–$129,003", market: "Base: $52,000–$100,000 · Role-specific" },
  { family: "Management Level 3A · Corporate Functional Management", employees: 3, jobs: "Accounting Manager, Human Resources Manager, Safety and Compliance Manager", regular: "$88,000–$110,000", gross: "$100,646–$108,385", market: "Base: $100,000–$114,000" },
  { family: "Management Level 3B · IT & Systems Management", employees: 2, jobs: "IT Managers", regular: "$95,000–$100,000", gross: "$88,615–$95,038", market: "Base: $105,000–$141,000 · Scope-sensitive" },
  { family: "Management Level 3C · Warehouse Operations Leadership", employees: 1, jobs: "Warehouse Lead", regular: "$95,000", gross: "$96,896", market: "Base: $65,000–$95,000" },
  { family: "Capital Equipment & Trailer Sales", employees: 16, jobs: "Trailer sales, equipment sales, trailer & equipment sales, equipment design consultant", regular: "$60,000–$200,000", gross: "$84,199–$302,089", market: "Base: $60,000–$100,000 · Commission: plan-dependent" },
  { family: "Parts & Relationship Sales", employees: 13, jobs: "Outside parts sales, inside parts sales, aftermarket liaison", regular: "$42,000–$80,000", gross: "$22,506–$87,233", market: "Base: $43,000–$70,000 · Commission: plan-dependent" },
  { family: "Finance, Procurement & Administration", employees: 4, jobs: "Corporate Buyers, Staff Accountant, Office Administrator", regular: "$65,000–$90,000", gross: "$64,500–$91,115", market: "Base: $50,000–$100,000" },
  { family: "People, Safety, Marketing & Creative", employees: 3, jobs: "HR and Safety Specialist, Marketing Coordinator, Graphic Designer", regular: "$55,000–$75,000", gross: "$53,793–$70,423", market: "Base: $50,000–$80,000" },
  { family: "Senior Service Advisory", employees: 1, jobs: "Senior Service Advisor", regular: "$75,000", gross: "$73,775", market: "Base: $65,000–$85,000" },
  { family: "Upfit, Technical & Field Support", employees: 3, jobs: "Senior Upfit Specialist, Truck Upfit Specialist, Trailer Sales Driver", regular: "$75,000–$100,000", gross: "$73,846–$127,546", market: "Base: $60,000–$105,000" },
] as const;

const hourlyJobFamilies = [
  { family: "Skilled Trailer Service & Upfit", level: "Advanced technical", employees: 58, jobs: "Trailer Mechanic / Technician, Truck Upfit Specialist, Van Upfitter", profile: "High technical depth · High scarcity · Direct effect on safety, uptime, quality, and service revenue", royalRate: "$18.00–$32.00 · Avg $26.70", royalGross: "$35,388–$106,495 · Avg $67,735", marketRate: "$25.00–$36.00 / hour", marketTotal: "$57,000–$85,000 / year" },
  { family: "Service Technician Development", level: "Entry technical", employees: 5, jobs: "Apprentice Service Technician", profile: "Developing technical skill · Moderate-to-high scarcity · Feeder pipeline for skilled service roles", royalRate: "$18.00–$24.00 · Avg $22.00", royalGross: "$39,430–$59,048 · Avg $51,419", marketRate: "$19.00–$26.00 / hour", marketTotal: "$42,000–$59,000 / year" },
  { family: "Service Operations & Technical Coordination", level: "Experienced coordination", employees: 11, jobs: "Service Shop Supervisor, Service Writer, Senior Service Advisor, Project Specialist", profile: "High workflow and customer complexity · Moderate scarcity · Strong effect on throughput, margin, and customer retention", royalRate: "$15.00–$32.00 · Avg $27.45", royalGross: "$22,805–$88,231 · Avg $68,257", marketRate: "$24.00–$36.00 / hour", marketTotal: "$52,000–$95,000 / year" },
  { family: "Parts Sales & Sales Coordination", level: "Product and customer specialist", employees: 10, jobs: "Inside Parts Sales, Sales Coordinator", profile: "Product knowledge and customer skill · Moderate scarcity · Direct effect on parts revenue and service support", royalRate: "$20.00–$30.00 · Avg $24.75", royalGross: "$21,425–$72,402 · Avg $51,985", marketRate: "$21.00–$29.00 / hour base", marketTotal: "$49,000–$70,000 / year" },
  { family: "Warehouse, Inventory & Parts Logistics", level: "Operations support", employees: 28, jobs: "Warehouse Manager, Warehouse Lead, Warehouse Associate, Warehouse Associate / Parts Driver", profile: "Inventory and material-flow skill · Standard-to-moderate scarcity · Direct effect on parts availability and branch productivity", royalRate: "$18.00–$26.00 · Avg $21.66", royalGross: "$27,098–$67,796 · Avg $44,965", marketRate: "$18.00–$30.00 / hour by level", marketTotal: "$42,000–$70,000 / year" },
  { family: "Equipment, Trailer & Service Delivery", level: "Field delivery", employees: 11, jobs: "Sales Driver - Equipment, Sales Driver - Trailer, Service Driver", profile: "Equipment handling and customer-contact skill · Moderate scarcity · Safety and delivery reliability impact", royalRate: "$22.00–$30.00 · Avg $25.09", royalGross: "$14,685–$63,503 · Avg $47,016", marketRate: "$20.00–$31.00 / hour", marketTotal: "$47,000–$73,000 / year" },
  { family: "Finance, Administration & Transaction Support", level: "Business support", employees: 7, jobs: "Accounts Payable, Accounts Receivable, Administrative Assistant, Office Administrator, Title Processing, Buyer Trainee", profile: "Process accuracy and system knowledge · Standard-to-moderate scarcity · Financial control and transaction-cycle impact", royalRate: "$20.00–$29.00 · Avg $24.43", royalGross: "$13,555–$54,939 · Avg $41,772", marketRate: "$22.00–$30.00 / hour", marketTotal: "$46,000–$66,000 / year" },
  { family: "Facilities & Workplace Support", level: "Facilities support", employees: 3, jobs: "Building Maintenance, Commercial Cleaner", profile: "Site-specific maintenance and support skill · Standard scarcity · Workplace continuity and safety impact", royalRate: "$18.00–$26.00 · Avg $23.00", royalGross: "$13,288–$29,579 · Avg $23,295", marketRate: "$18.00–$28.00 / hour", marketTotal: "$40,000–$64,000 / year" },
] as const;

export const hourlyMarketTotalRanges: Record<string, { min: number; max: number }> = Object.fromEntries(hourlyJobFamilies.map((row) => {
  const values = row.marketTotal.match(/[\d,]+/g)?.map((value) => Number(value.replace(/,/g, ""))) ?? [];
  return [row.family, { min: values[0] ?? 0, max: values[1] ?? 0 }];
}));

export const hourlyMarketRateRanges: Record<string, { min: number; max: number }> = Object.fromEntries(hourlyJobFamilies.map((row) => {
  const values = row.marketRate.match(/[\d,.]+/g)?.map((value) => Number(value.replace(/,/g, ""))).filter(Number.isFinite) ?? [];
  return [row.family, { min: values[0] ?? 0, max: values[1] ?? 0 }];
}));

const totalPayComparisonTitles = new Set(["Trailer Mechanic / Technician", "Truck Upfit Specialist", "Van Upfitter", "Apprentice Service Technician", "Service Shop Supervisor"]);

export function hourlyExternalBasis(jobTitle: string) {
  return totalPayComparisonTitles.has(jobTitle) ? "Total Pay vs External Estimated Total Pay" : "Hourly Rate vs External Base Hourly Rate";
}

const hourlyTitlesByFamily: Record<string, string[]> = {
  "Skilled Trailer Service & Upfit": ["Trailer Mechanic / Technician", "Truck Upfit Specialist", "Van Upfitter"],
  "Service Technician Development": ["Apprentice Service Technician"],
  "Service Operations & Technical Coordination": ["Service Shop Supervisor", "Service Writer", "Sr. Service Advisor", "Project Specialist"],
  "Parts Sales & Sales Coordination": ["Inside Parts Sales", "Sales Coordinator"],
  "Warehouse, Inventory & Parts Logistics": ["Warehouse Manager", "Warehouse Lead", "Warehouse Associate", "Warehouse Associate / Parts Driver"],
  "Equipment, Trailer & Service Delivery": ["Sales Driver - Equipment", "Sales Driver - Trailer", "Service Driver"],
  "Finance, Administration & Transaction Support": ["Accounts Payable Associate", "Accounts Receivable Specialist", "Administrative Assistant", "Office Administrator", "Title Processing Clerk", "Corporate Buyer Trainee"],
  "Facilities & Workplace Support": ["Building Maintenance", "Commercial Cleaner"],
};

export function hourlyJobFamily(jobTitle: string) {
  return Object.entries(hourlyTitlesByFamily).find(([, titles]) => titles.includes(jobTitle))?.[0] ?? "Other Hourly Roles";
}

export function hourlyAlignment(employee: HourlyEmployee, employees: HourlyEmployee[]) {
  return `${hourlyInternalBenchmark(employee, employees)}; ${hourlyExternalBenchmark(employee)}`;
}

export function hourlyInternalBenchmark(employee: HourlyEmployee, employees: HourlyEmployee[]) {
  const sameTitle = employees.filter((item) => item.jobTitle === employee.jobTitle && Number.isFinite(item.hourlyRate));
  const titleMedian = sameTitle.length >= 5 ? quantile(sameTitle.map((item) => item.hourlyRate), 0.5) : null;
  if (titleMedian == null) return "Insufficient Same-Title Sample";
  return employee.hourlyRate < titleMedian ? "Hourly Rate Below 50th Percentile" : "Hourly Rate At or Above 50th Percentile";
}

export function hourlyExternalBenchmark(employee: HourlyEmployee) {
  const family = hourlyJobFamily(employee.jobTitle);
  const usesTotalPay = totalPayComparisonTitles.has(employee.jobTitle);
  const market = usesTotalPay ? hourlyMarketTotalRanges[family] : hourlyMarketRateRanges[family];
  const externalValue = usesTotalPay ? employee.grossPay : employee.hourlyRate;
  const externalMetric = usesTotalPay ? "Total Pay" : "Hourly Rate";
  const externalLow = externalValue != null && market && externalValue < market.min;
  if (usesTotalPay && employee.grossPay == null) return "Gross Pay Data Unavailable";
  if (externalLow) return `External ${externalMetric} Low Position`;
  return `External ${externalMetric} Market Aligned`;
}

function HourlyJobArchitecture() {
  const topScrollRef = useRef<HTMLDivElement>(null);
  const tableScrollRef = useRef<HTMLDivElement>(null);
  const syncingScrollRef = useRef(false);

  function syncHorizontalScroll(source: "top" | "table") {
    if (syncingScrollRef.current) return;
    syncingScrollRef.current = true;
    const sourceElement = source === "top" ? topScrollRef.current : tableScrollRef.current;
    const targetElement = source === "top" ? tableScrollRef.current : topScrollRef.current;
    if (sourceElement && targetElement) targetElement.scrollLeft = sourceElement.scrollLeft;
    requestAnimationFrame(() => { syncingScrollRef.current = false; });
  }

  return <section className="overflow-hidden rounded-3xl border border-cyan-200 bg-white shadow-sm">
    <div className="bg-gradient-to-r from-cyan-950 via-slate-900 to-indigo-950 px-6 py-6 text-white">
      <p className="text-xs font-black uppercase tracking-[0.16em] text-cyan-200">Royal hourly job architecture</p>
      <h2 className="mt-2 text-2xl font-black">Job Families and Michigan Market Benchmarks</h2>
      <p className="mt-2 max-w-5xl text-sm leading-6 text-cyan-50">Hourly positions are grouped by skill complexity, labor-market scarcity, customer and safety responsibility, and enterprise impact. The external ranges emphasize Michigan and Detroit labor data, current truck and trailer recruiting, ADP metro benchmarks, and trailer-dealer industry references.</p>
    </div>
    <div className="grid gap-3 border-b border-cyan-100 bg-cyan-50/60 p-5 md:grid-cols-3">
      <div className="rounded-2xl bg-white p-4"><p className="text-xs font-black uppercase tracking-wide text-cyan-800">1 · Skill complexity</p><p className="mt-2 text-sm leading-6 text-slate-600">Technical diagnosis, fabrication, equipment handling, systems knowledge, independent judgment, and customer coordination.</p></div>
      <div className="rounded-2xl bg-white p-4"><p className="text-xs font-black uppercase tracking-wide text-cyan-800">2 · Market scarcity</p><p className="mt-2 text-sm leading-6 text-slate-600">Michigan recruiting supply, required experience or credentials, and the difficulty of replacing productive employees.</p></div>
      <div className="rounded-2xl bg-white p-4"><p className="text-xs font-black uppercase tracking-wide text-cyan-800">3 · Enterprise impact</p><p className="mt-2 text-sm leading-6 text-slate-600">Effect on safety, service throughput, revenue, customer retention, inventory availability, and financial control.</p></div>
    </div>
    <div className="border-b border-cyan-100 bg-white px-1 pt-2">
      <div className="overflow-x-auto" onScroll={() => syncHorizontalScroll("top")} ref={topScrollRef}>
        <div className="h-1 min-w-[1480px]" />
      </div>
      <p className="px-3 pb-2 text-[11px] font-bold uppercase tracking-wide text-slate-400">Scroll horizontally here or below the table · First two columns stay visible</p>
    </div>
    <div className="overflow-x-auto" onScroll={() => syncHorizontalScroll("table")} ref={tableScrollRef}><table className="min-w-[1480px] w-full table-fixed text-left text-sm"><thead className="bg-cyan-50 text-xs uppercase tracking-wide text-cyan-950"><tr>
      <th className="sticky left-0 z-30 w-[300px] border-r border-cyan-100 bg-cyan-50 px-4 py-3">Job Family / Level / Employees</th>
      <th className="sticky left-[300px] z-30 w-[320px] border-r-2 border-cyan-200 bg-cyan-50 px-4 py-3 shadow-[8px_0_12px_-12px_rgba(15,23,42,0.7)]">Included Royal Roles</th>
      <th className="w-[300px] px-4 py-3">Classification Basis</th><th className="w-[280px] px-4 py-3">Royal Internal Pay</th><th className="w-[280px] px-4 py-3">External Market Pay</th>
    </tr></thead><tbody className="divide-y divide-slate-100">{hourlyJobFamilies.map((row) => <tr className="group align-top hover:bg-cyan-50/50" key={row.family}>
      <td className="sticky left-0 z-20 w-[300px] border-r border-slate-100 bg-white px-4 py-4 group-hover:bg-cyan-50"><p className="font-black text-slate-950">{row.family}</p><p className="mt-1.5 text-xs font-bold uppercase tracking-wide text-cyan-800">{row.level}</p><p className="mt-2 inline-flex rounded-full bg-cyan-100 px-2.5 py-1 text-xs font-black text-cyan-900">{row.employees} employees</p></td>
      <td className="sticky left-[300px] z-20 w-[320px] border-r-2 border-cyan-100 bg-white px-4 py-4 leading-6 text-slate-600 shadow-[8px_0_12px_-12px_rgba(15,23,42,0.7)] group-hover:bg-cyan-50">{row.jobs}</td>
      <td className="w-[300px] px-4 py-4 leading-6 text-slate-600">{row.profile}</td><td className="w-[280px] px-4 py-4"><p className="text-xs font-black uppercase tracking-wide text-slate-500">Hourly rate</p><p className="mt-1 font-bold text-slate-900">{row.royalRate}</p><p className="mt-3 text-xs font-black uppercase tracking-wide text-indigo-500">Annual gross pay</p><p className="mt-1 font-bold text-indigo-800">{row.royalGross}</p></td><td className="w-[280px] px-4 py-4"><p className="text-xs font-black uppercase tracking-wide text-emerald-600">Base hourly rate</p><p className="mt-1 font-black text-emerald-800">{row.marketRate}</p><p className="mt-3 text-xs font-black uppercase tracking-wide text-teal-600">Estimated total pay</p><p className="mt-1 font-black text-teal-800">{row.marketTotal}</p></td>
    </tr>)}</tbody></table></div>
    <div className="border-t border-cyan-100 bg-slate-50 p-6">
      <h3 className="font-black text-slate-950">External sources and limitations</h3>
      <p className="mt-2 text-sm leading-6 text-slate-600">Royal Annual Gross Pay is the employee-level gross-pay range for Sep. 30, 2025–Sep. 29, 2026. Employees with at least 90 days but less than a full year are annualized; employees with less than 90 days are excluded. External base figures are practical hourly reference ranges, not a single survey's percentile band. External Estimated Total Pay converts the base range to full-time annual pay and adds market-supported typical overtime or variable-pay opportunity where applicable. It is a comparison range—not a guaranteed earnings range. Official Michigan and Detroit occupational data are the primary anchors. Current Indeed postings and salary pages test recruiting reality, including Michigan trailer-technician, technician overtime, parts, service-writer, and warehouse data. ADP Metro Area median benchmarks as of August 31, 2026 provide a second check for credible role matches. NTDA trailer-dealer compensation references add industry context, but its publicly available detailed guide is older and national, so it is used only as secondary validation. Role scope, CDL requirements, certifications, shift premiums, incentive plans, and actual overtime can materially change total pay.</p>
      <div className="mt-4 flex flex-wrap gap-3 text-xs font-black"><a className="text-cyan-800 hover:underline" href="https://www.bls.gov/regions/midwest/news-release/OccupationalEmploymentAndWages_Detroit.htm" rel="noreferrer" target="_blank">BLS Detroit 2025 Wages</a><a className="text-cyan-800 hover:underline" href="https://www.michigan.gov/mcda/labor-market-information/oews" rel="noreferrer" target="_blank">Michigan 2025 OEWS</a><a className="text-cyan-800 hover:underline" href="https://www.michigan.gov/mcda/labor-market-information/2026-michigan-manufacturing-industry-workforce-analysis-report/key-occupations" rel="noreferrer" target="_blank">Michigan Manufacturing Workforce Analysis</a><a className="text-cyan-800 hover:underline" href="https://www.indeed.com/q-trailer-technician-l-michigan-jobs.html" rel="noreferrer" target="_blank">Michigan Trailer Technician Recruiting</a><a className="text-cyan-800 hover:underline" href="https://www.indeed.com/career/service-writer/salaries/MI" rel="noreferrer" target="_blank">Michigan Service Writer Market</a><a className="text-cyan-800 hover:underline" href="https://www.indeed.com/career/warehouse-worker/salaries/MI" rel="noreferrer" target="_blank">Michigan Warehouse Market</a><a className="text-cyan-800 hover:underline" href="https://ntda.site-ym.com/page/DealerSurveys" rel="noreferrer" target="_blank">NTDA Dealer Surveys</a></div>
    </div>
  </section>;
}

export const externalBaseRanges: Record<string, { min: number; max: number; note: string }> = {
  "Executive Leadership": { min: 209000, max: 338000, note: "Executive base reference; bonus and long-term incentives require separate review." },
  "Enterprise Leadership": { min: 146000, max: 186000, note: "Enterprise-leadership base reference; annual incentives vary by role." },
  "Management Level 1 · General & Business Unit Leadership": { min: 93000, max: 150000, note: "General and business-unit leadership base reference." },
  "Management Level 2A · Service Operations Leadership": { min: 90000, max: 130000, note: "Grand Rapids truck and trailer service-leadership recruiting range." },
  "Management Level 2B · Parts & Leasing Operations": { min: 52000, max: 100000, note: "Role-specific parts and leasing management reference." },
  "Management Level 3A · Corporate Functional Management": { min: 100000, max: 114000, note: "Corporate functional-management base reference." },
  "Management Level 3B · IT & Systems Management": { min: 105000, max: 141000, note: "Local operational IT-management reference; scope materially affects pay." },
  "Management Level 3C · Warehouse Operations Leadership": { min: 65000, max: 95000, note: "Warehouse operations leadership base reference." },
  "Capital Equipment & Trailer Sales": { min: 60000, max: 100000, note: "Base salary only. Commission and total cash opportunity require plan-level review." },
  "Parts & Relationship Sales": { min: 43000, max: 70000, note: "Base salary only. Commission and territory economics require separate review." },
  "Finance, Procurement & Administration": { min: 50000, max: 100000, note: "Role-specific professional base reference." },
  "People, Safety, Marketing & Creative": { min: 50000, max: 80000, note: "Role-specific professional base reference." },
  "Senior Service Advisory": { min: 65000, max: 85000, note: "Senior service-advisory base reference." },
  "Upfit, Technical & Field Support": { min: 60000, max: 105000, note: "Technical and field-support base reference." },
};

const crossPayTypeJobTitles = [
  { title: "Inside Parts Sales", salary: "Brandon Neeb; Jeffery Guldenstein; Benjamin Tuinstra", hourly: "Thomas Collins; Michael Davis; John King; Benjamin Morris; Robert Mullen; Jeffrey Pilch; Cooper Start; Christopher Watts; Dennis Whisman" },
  { title: "Office Administrator", salary: "Yvonne Witham", hourly: "Andrea Babikian" },
  { title: "Sales Driver - Trailer", salary: "John Robbins", hourly: "Christopher Walters" },
  { title: "Sr. Service Advisor", salary: "Robert Pelkey", hourly: "John Fell" },
  { title: "Truck Upfit Specialist", salary: "Christopher Veltri", hourly: "Timothy Lee; William McCullough; Jeff Puetz; David Robertson; Ryan Russell; Charlie Ulven; Charles Vogel" },
  { title: "Warehouse Lead", salary: "Michael Griffiths", hourly: "Stephan Kaser" },
];

export const percentile = (values: number[], value: number | null) => {
  if (value == null || values.length === 0) return null;
  const below = values.filter((item) => item < value).length;
  const equal = values.filter((item) => item === value).length;
  return Math.round(((below + equal * 0.5) / values.length) * 100);
};

export const quantile = (values: number[], point: number) => {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = (sorted.length - 1) * point;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (index - lower);
};

export const alignment = (value: number | null, min: number, max: number) => {
  if (value == null) return "Missing Regular Pay";
  const tolerance = 0.05;
  if (value < min * (1 + tolerance)) return "External Base Pay Low Position";
  if (value > max * (1 + tolerance)) return "External Market Base Pay Leading";
  return "Market Aligned";
};

export const employeeExternalAlignment = (employee: SalaryEmployee) => {
  if (employee.regularPay == null) return "Missing Regular Pay";
  const market = externalBaseRanges[employee.jobFamily];
  if (!market) return "External Benchmark Unavailable";
  return alignment(employee.regularPay, market.min, market.max);
};

const isInternalLowPosition = (employee: SalaryEmployee, employees: SalaryEmployee[]) => {
  if (employee.regularPay == null) return false;
  const sameTitle = employees.filter((item) => item.jobTitle === employee.jobTitle);
  const values = sameTitle.flatMap((item) => item.regularPay == null ? [] : [item.regularPay]);
  return values.length >= 5 && employee.regularPay < quantile(values, .5);
};

export const employeeBaseAlignment = (employee: SalaryEmployee, employees: SalaryEmployee[]) => {
  if (employee.regularPay == null) return "Missing Regular Pay";
  const market = externalBaseRanges[employee.jobFamily];
  if (!market) return "External Benchmark Unavailable";
  const internalLow = isInternalLowPosition(employee, employees);
  const externalLow = employee.regularPay < market.min * 1.05;
  const external = alignment(employee.regularPay, market.min, market.max);
  if (internalLow && externalLow) return "Internal Base Pay Low Position; External Base Pay Low Position";
  if (internalLow && external === "Market Aligned") return "Internal Base Pay Low Position, External Market Aligned";
  if (external === "External Market Base Pay Leading") return external;
  if (internalLow) return `Internal Base Pay Low Position; ${external}`;
  if (externalLow) return "External Base Pay Low Position";
  return external;
};

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

type SalaryFilterKey = "title" | "department" | "location" | "externalAlignment";
type SalaryFilters = Record<SalaryFilterKey, string[]>;

function CheckboxFilter({ label, options, selected, onChange }: { label: string; options: string[]; selected: string[]; onChange: (values: string[]) => void }) {
  return <details className="group relative min-w-[190px] flex-1"><summary className="flex cursor-pointer list-none items-center justify-between rounded-xl border border-violet-200 bg-white px-3 py-3 text-sm font-bold text-slate-800 shadow-sm transition hover:border-violet-400"><span>{selected.length ? `${label} (${selected.length})` : `All ${label}`}</span><span className="ml-3 text-violet-600 transition group-open:rotate-180">⌄</span></summary><div className="absolute left-0 z-40 mt-2 max-h-72 min-w-full overflow-y-auto rounded-2xl border border-violet-200 bg-white p-3 shadow-2xl"><div className="mb-2 flex items-center justify-between border-b border-violet-100 pb-2"><span className="text-xs font-black uppercase tracking-wide text-violet-950">{label}</span>{selected.length > 0 && <button className="text-xs font-bold text-violet-700 hover:underline" onClick={() => onChange([])} type="button">Clear</button>}</div>{options.map((option) => <label className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-2 text-sm hover:bg-violet-50" key={option}><input checked={selected.includes(option)} className="h-4 w-4 accent-violet-700" onChange={() => onChange(selected.includes(option) ? selected.filter((value) => value !== option) : [...selected, option])} type="checkbox" /><span>{option}</span></label>)}</div></details>;
}

function IndividualSalaryTable({ employees, allEmployees, regularValues, grossValues, search, setSearch, sortBy, setSortBy, period, filters, filterOptions, setFilter, resetFilters, totalEmployees, returnSearch }: { employees: SalaryEmployee[]; allEmployees: SalaryEmployee[]; regularValues: number[]; grossValues: number[]; search: string; setSearch: (value: string) => void; sortBy: string; setSortBy: (value: string) => void; period: GrossPayAnalysis["period"]; filters: SalaryFilters; filterOptions: { titles: string[]; departments: string[]; locations: string[]; alignments: string[] }; setFilter: (key: SalaryFilterKey, value: string[]) => void; resetFilters: () => void; totalEmployees: number; returnSearch: string }) {
  const sortHeader = (label: string, key: "name" | "title" | "location" | "regular" | "gross") => {
    const active = sortBy.startsWith(`${key}-`);
    const direction = active ? sortBy.split("-")[1] : null;
    const next = active ? `${key}-${direction === "asc" ? "desc" : "asc"}` : `${key}-${key === "regular" || key === "gross" ? "desc" : "asc"}`;
    return <button className={`inline-flex items-center gap-2 whitespace-nowrap font-black transition hover:text-indigo-700 ${active ? "text-indigo-800" : "text-violet-950"}`} onClick={() => setSortBy(next)} type="button">{label}<span aria-hidden="true" className={`text-sm ${active ? "text-indigo-700" : "text-slate-400"}`}>{direction === "asc" ? "↑" : direction === "desc" ? "↓" : "↕"}</span></button>;
  };
  return <section className="overflow-hidden rounded-3xl border border-violet-200 bg-white shadow-sm">
    <div className="border-b border-violet-100 bg-gradient-to-r from-violet-950 to-indigo-900 px-6 py-6 text-white"><div className="flex flex-wrap items-end justify-between gap-5"><div><p className="text-xs font-black uppercase tracking-[0.16em] text-cyan-200">Employee-level review</p><h2 className="mt-2 text-2xl font-black">Individual Salary Employee Analysis</h2><p className="mt-2 max-w-3xl text-sm leading-6 text-violet-100">Compare each employee's current regular pay and one-year gross pay percentile, then open a detailed internal and external alignment review.</p><div className="mt-4 flex flex-wrap gap-2"><span className="rounded-full border border-violet-300/40 bg-white/10 px-3 py-1.5 text-xs font-black text-violet-50">Regular Pay: annual salary effective November 1, 2026</span><span className="rounded-full border border-cyan-300/40 bg-cyan-300/10 px-3 py-1.5 text-xs font-black text-cyan-50">Gross Pay data period: {dateText(period.start)} – {dateText(period.end)}</span></div></div><label className="relative block min-w-[280px]"><span className="sr-only">Search salary employees</span><Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" /><input className="w-full rounded-xl border border-white/20 bg-white py-2.5 pl-9 pr-3 text-sm font-semibold text-slate-950 outline-none placeholder:text-slate-400 focus:ring-2 focus:ring-violet-300" onChange={(event) => setSearch(event.target.value)} placeholder="Search name, title, department, location" value={search} /></label></div></div>
    <div className="border-b border-violet-100 bg-violet-50/70 px-6 py-5">
      <div className="flex flex-wrap items-end gap-3">
        {([
          ["Job Title", "title", filterOptions.titles],
          ["Department", "department", filterOptions.departments],
          ["Location", "location", filterOptions.locations],
          ["Base Alignment", "externalAlignment", filterOptions.alignments],
        ] as const).map(([label, key, options]) => <CheckboxFilter key={key} label={label} options={[...options]} selected={filters[key]} onChange={(values) => setFilter(key, values)} />)}
        <button className="rounded-xl border border-violet-200 bg-white px-4 py-2.5 text-sm font-black text-violet-800 transition hover:bg-violet-100" onClick={resetFilters} type="button">Reset Filters</button>
      </div>
      <p className="mt-3 text-sm font-semibold text-slate-600">Showing <span className="font-black text-violet-900">{employees.length}</span> of {totalEmployees} salary employees</p>
    </div>
    <div className="overflow-x-auto"><table className="min-w-[1280px] w-full text-left text-sm"><thead className="bg-violet-50 text-xs uppercase tracking-wide text-violet-950"><tr><th className="px-4 py-3">{sortHeader("Employee", "name")}</th><th className="px-4 py-3">{sortHeader("Job Title", "title")}</th><th className="px-4 py-3">{sortHeader("Location", "location")}</th><th className="px-4 py-3">{sortHeader("Regular Pay", "regular")}</th><th className="px-4 py-3">{sortHeader("Regular Percentile", "regular")}</th><th className="px-4 py-3">{sortHeader("Total Gross Pay", "gross")}</th><th className="px-4 py-3">{sortHeader("Gross Percentile", "gross")}</th><th className="whitespace-nowrap px-4 py-3">Base Alignment</th></tr></thead><tbody className="divide-y divide-slate-100">{employees.map((employee) => { const marketStatus = employeeBaseAlignment(employee, allEmployees); return <tr className="group hover:bg-violet-50/50" key={employee.id}><td className="sticky left-0 z-10 bg-white px-4 py-3 font-black text-indigo-800 shadow-[1px_0_0_#e2e8f0] group-hover:bg-violet-50"><Link className="inline-flex items-center gap-2 hover:underline" to={`/compensation-analysis/salary/employees/${employee.id}${returnSearch ? `?${returnSearch}` : ""}`}>{employee.name}<ArrowRight className="h-4 w-4" /></Link></td><td className="px-4 py-3 font-semibold text-slate-800">{employee.jobTitle}</td><td className="px-4 py-3 text-slate-600">{employee.location}</td><td className="whitespace-nowrap px-4 py-3 font-black text-slate-950">{employee.regularPay == null ? "Unavailable" : money.format(employee.regularPay)}</td><td className="whitespace-nowrap px-4 py-3"><span className="rounded-full bg-violet-100 px-3 py-1 font-black text-violet-900">{employee.regularPay == null ? "—" : `${percentile(regularValues, employee.regularPay)}th`}</span></td><td className="whitespace-nowrap px-4 py-3 font-bold text-slate-800">{money.format(employee.grossPay)}</td><td className="whitespace-nowrap px-4 py-3"><span className="rounded-full bg-slate-100 px-3 py-1 font-black text-slate-800">{percentile(grossValues, employee.grossPay)}th</span></td><td className="px-4 py-3"><span className={`inline-flex rounded-full px-3 py-1 text-xs font-black ${marketStatus.includes("Market Aligned") ? "bg-emerald-100 text-emerald-900" : marketStatus.includes("Market Review Suggested") ? "bg-amber-100 text-amber-900" : marketStatus.includes("Base Pay Leading") ? "bg-blue-100 text-blue-900" : marketStatus.includes("Scope Adjustment Needed") ? "bg-violet-100 text-violet-900" : "bg-slate-100 text-slate-600"}`}>{marketStatus}</span></td></tr>; })}</tbody></table></div>
    <div className="border-t border-violet-100 bg-slate-50 px-6 py-4 text-sm leading-6 text-slate-600">Percentiles compare Royal's current salary workforce. Gross pay covers {dateText(period.start)} – {dateText(period.end)} and may include commission, bonus, PTO, and other earnings. Alignment labels are screening indicators, not legal pay-equity conclusions.</div>
  </section>;
}

export function SalaryIndividualDirectory() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [state, setState] = useState<"checking" | "authenticated" | "signed-out">("checking");
  const [analysis, setAnalysis] = useState<GrossPayAnalysis | null>(null);
  const [error, setError] = useState("");
  const [search, setSearch] = useState(() => searchParams.get("q") ?? "");
  const [sortBy, setSortBy] = useState(() => searchParams.get("sort") ?? "name-asc");
  const emptyFilters = (): SalaryFilters => ({ title: [], department: [], location: [], externalAlignment: [] });
  const [filters, setFilters] = useState<SalaryFilters>(() => ({
    title: searchParams.getAll("title"),
    department: searchParams.getAll("department"),
    location: searchParams.getAll("location"),
    externalAlignment: searchParams.getAll("alignment"),
  }));
  async function load() { try { setAnalysis((await api.get<GrossPayAnalysis>("/compensation/gross-pay-analysis")).data); } catch { setError("Individual salary analysis could not be loaded."); } }
  useEffect(() => { api.get("/compensation/overview").then(async () => { setState("authenticated"); await load(); }).catch(() => setState("signed-out")); }, []);
  useEffect(() => {
    const next = new URLSearchParams();
    if (search.trim()) next.set("q", search);
    if (sortBy !== "name-asc") next.set("sort", sortBy);
    filters.title.forEach((value) => next.append("title", value));
    filters.department.forEach((value) => next.append("department", value));
    filters.location.forEach((value) => next.append("location", value));
    filters.externalAlignment.forEach((value) => next.append("alignment", value));
    if (next.toString() !== searchParams.toString()) setSearchParams(next, { replace: true });
  }, [filters, search, searchParams, setSearchParams, sortBy]);
  if (state === "checking") return <div className="grid min-h-64 place-items-center rounded-2xl bg-white shadow-sm"><RefreshCw className="h-7 w-7 animate-spin text-indigo-700" /></div>;
  if (state === "signed-out") return <CompensationLogin onLogin={() => { setState("authenticated"); void load(); }} />;
  const employees = analysis?.salaryEmployees ?? [];
  const query = search.trim().toLowerCase();
  const filterOptions = {
    titles: [...new Set(employees.map((employee) => employee.jobTitle))].sort((a, b) => a.localeCompare(b)),
    departments: [...new Set(employees.map((employee) => employee.department))].sort((a, b) => a.localeCompare(b)),
    locations: [...new Set(employees.map((employee) => employee.location))].sort((a, b) => a.localeCompare(b)),
    alignments: [...new Set(employees.map((employee) => employeeBaseAlignment(employee, employees)))].sort((a, b) => a.localeCompare(b)),
  };
  const filtered = employees.filter((employee) => {
    const marketStatus = employeeBaseAlignment(employee, employees);
    return (!query || [employee.name, employee.jobTitle, employee.department, employee.location].some((value) => value.toLowerCase().includes(query)))
      && (!filters.title.length || filters.title.includes(employee.jobTitle))
      && (!filters.department.length || filters.department.includes(employee.department))
      && (!filters.location.length || filters.location.includes(employee.location))
      && (!filters.externalAlignment.length || filters.externalAlignment.includes(marketStatus));
  });
  const sorted = [...filtered].sort((a, b) => {
    if (sortBy === "regular-desc" || sortBy === "regular-asc") {
      if (a.regularPay == null) return 1;
      if (b.regularPay == null) return -1;
      return sortBy === "regular-desc" ? b.regularPay - a.regularPay : a.regularPay - b.regularPay;
    }
    if (sortBy === "gross-desc") return b.grossPay - a.grossPay;
    if (sortBy === "gross-asc") return a.grossPay - b.grossPay;
    if (sortBy === "title-asc") return a.jobTitle.localeCompare(b.jobTitle) || a.name.localeCompare(b.name);
    if (sortBy === "location-asc") return a.location.localeCompare(b.location) || a.name.localeCompare(b.name);
    return a.name.localeCompare(b.name);
  });
  return <div className="space-y-7"><section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-violet-900 via-indigo-950 to-slate-950 px-7 py-8 text-white shadow-xl"><div className="absolute -right-16 -top-20 h-64 w-64 rounded-full bg-fuchsia-400/20 blur-3xl" /><div className="relative"><Link className="inline-flex items-center gap-2 text-sm font-semibold text-violet-200 hover:text-white" to="/compensation-analysis/salary"><ArrowLeft className="h-4 w-4" />Back to Salary Analysis</Link><p className="mt-7 text-xs font-black uppercase tracking-[0.18em] text-cyan-200">Dedicated employee workspace</p><h1 className="mt-2 text-4xl font-black">Individual Salary Employee Analysis</h1><p className="mt-3 max-w-3xl text-sm leading-7 text-slate-200">Employee-level percentiles, internal peer comparisons, external benchmarks, and compensation alignment review.</p></div></section>{error && <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 font-semibold text-rose-800">{error}</div>}{analysis && <IndividualSalaryTable employees={sorted} allEmployees={employees} regularValues={employees.flatMap((employee) => employee.regularPay == null ? [] : [employee.regularPay])} grossValues={employees.map((employee) => employee.grossPay)} search={search} setSearch={setSearch} sortBy={sortBy} setSortBy={setSortBy} period={analysis.period} filters={filters} filterOptions={filterOptions} setFilter={(key, value) => setFilters((current) => ({ ...current, [key]: value }))} resetFilters={() => { setSearch(""); setSortBy("name-asc"); setFilters(emptyFilters()); }} totalEmployees={employees.length} returnSearch={searchParams.toString()} />}</div>;
}

export function CompensationPayTypeAnalysis({ payType }: { payType: "Hourly" | "Salary" }) {
  const [state, setState] = useState<"checking" | "authenticated" | "signed-out">("checking");
  const [analysis, setAnalysis] = useState<GrossPayAnalysis | null>(null);
  const [error, setError] = useState("");
  const [jobTitleBasis, setJobTitleBasis] = useState<"gross" | "regular">("gross");
  const [hourlyJobTitleBasis, setHourlyJobTitleBasis] = useState<"rate" | "gross">("rate");

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
  const jobTitleRows = payType === "Salary"
    ? [...(jobTitleBasis === "regular" ? (selected?.jobTitlesRegularPay ?? []) : (selected?.jobTitles ?? []))].sort((a, b) => b.average - a.average)
    : [];
  const hourlyJobTitleRows = payType === "Hourly"
    ? [...(hourlyJobTitleBasis === "rate" ? (selected?.jobTitlesHourlyRate ?? []) : (selected?.jobTitlesAnnualGross ?? []))].sort((a, b) => (b.average ?? -Infinity) - (a.average ?? -Infinity))
    : [];
  const formatJobTitleValue = (value: number | null) => value == null ? "—" : payType === "Hourly" && hourlyJobTitleBasis === "rate" ? `${hourlyMoney.format(value)} / hr` : money.format(value);
  const accent = payType === "Hourly" ? "from-cyan-800 via-blue-900 to-slate-950" : "from-violet-800 via-indigo-950 to-slate-950";
  return <div className="space-y-7">
    <section className={`relative overflow-hidden rounded-3xl bg-gradient-to-br ${accent} px-7 py-8 text-white shadow-xl`}><div className="absolute -right-16 -top-20 h-64 w-64 rounded-full bg-white/10 blur-3xl" /><div className="relative"><Link className="inline-flex items-center gap-2 text-sm font-semibold text-white/80 hover:text-white" to="/compensation-analysis"><ArrowLeft className="h-4 w-4" />Back to Compensation Analysis</Link><p className="mt-7 text-xs font-bold uppercase tracking-[0.18em] text-cyan-200">Dedicated workspace</p><h1 className="mt-2 text-4xl font-black">{payType} Compensation Analysis</h1><p className="mt-3 max-w-2xl text-sm leading-7 text-slate-200">{payType === "Salary" ? "Detailed gross pay, regular pay, and job-title analysis for current salary employees." : "Detailed pay distribution and location comparison for current hourly employees."}</p></div></section>
    {error && <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-800">{error}</div>}
    {!analysis && !error && <div className="grid min-h-48 place-items-center rounded-2xl bg-white shadow-sm"><RefreshCw className="h-7 w-7 animate-spin text-indigo-700" /></div>}
    {analysis && selected && <>
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"><div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-sm font-bold text-indigo-700">{dateText(analysis.period.start)} – {dateText(analysis.period.end)}</p><h2 className="mt-1 text-2xl font-black text-slate-950">{payType} gross pay distribution</h2></div><div className="rounded-xl bg-slate-100 px-4 py-3 text-right"><p className="text-2xl font-black text-slate-950">{selected.overall.analyzed} / {selected.overall.population}</p><p className="text-xs font-bold uppercase tracking-wide text-slate-500">Analyzed employees</p></div></div><div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">{[["Minimum", selected.overall.min], ["25th Percentile", selected.overall.p25], ["Median", selected.overall.median], ["Average", selected.overall.average], ["75th Percentile", selected.overall.p75], ["Maximum", selected.overall.max]].map(([label, value]) => <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4" key={label}><p className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</p><p className="mt-2 text-xl font-black text-slate-950">{money.format(value as number)}</p></div>)}</div>{selected.overall.noHistory > 0 && <p className="mt-4 rounded-xl bg-amber-50 p-3 text-sm font-semibold text-amber-900">{selected.overall.noHistory} employees are retained in headcount but excluded because sufficient pay history is unavailable.</p>}</section>
      {payType === "Hourly" && selected.hourlyRate && <section className="rounded-3xl border border-cyan-200 bg-white p-6 shadow-sm"><div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-sm font-bold text-cyan-800">Current valid hourly rates</p><h2 className="mt-1 text-2xl font-black text-slate-950">Hourly rate distribution</h2></div><div className="rounded-xl bg-cyan-50 px-4 py-3 text-right"><p className="text-2xl font-black text-cyan-950">{selected.hourlyRate.analyzed} / {selected.hourlyRate.population}</p><p className="text-xs font-bold uppercase tracking-wide text-cyan-700">Rates available</p></div></div><div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">{[["Minimum", selected.hourlyRate.min], ["25th Percentile", selected.hourlyRate.p25], ["Median", selected.hourlyRate.median], ["Average", selected.hourlyRate.average], ["75th Percentile", selected.hourlyRate.p75], ["Maximum", selected.hourlyRate.max]].map(([label, value]) => <div className="rounded-2xl border border-cyan-100 bg-cyan-50/60 p-4" key={label}><p className="text-xs font-bold uppercase tracking-wide text-cyan-800">{label}</p><p className="mt-2 text-xl font-black text-slate-950">{hourlyMoney.format(value as number)}<span className="ml-1 text-xs font-bold text-slate-500">/ hour</span></p></div>)}</div><p className="mt-4 rounded-xl bg-amber-50 p-3 text-sm font-semibold text-amber-900">2 employees remain in hourly headcount but are excluded from this distribution because a valid current hourly rate is unavailable: Noah Haase and William McCullough.</p></section>}
      {payType === "Salary" && selected.regularPay && <section className="rounded-3xl border border-violet-200 bg-white p-6 shadow-sm"><div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-sm font-bold text-violet-700">November 1 salary rate × 24 payrolls</p><h2 className="mt-1 text-2xl font-black text-slate-950">Salary regular pay distribution</h2></div><div className="rounded-xl bg-violet-50 px-4 py-3 text-right"><p className="text-2xl font-black text-violet-950">{selected.regularPay.analyzed} / {selected.regularPay.population}</p><p className="text-xs font-bold uppercase tracking-wide text-violet-700">Rates available</p></div></div><div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">{[["Minimum", selected.regularPay.min], ["25th Percentile", selected.regularPay.p25], ["Median", selected.regularPay.median], ["Average", selected.regularPay.average], ["75th Percentile", selected.regularPay.p75], ["Maximum", selected.regularPay.max]].map(([label, value]) => <div className="rounded-2xl border border-violet-100 bg-violet-50/60 p-4" key={label}><p className="text-xs font-bold uppercase tracking-wide text-violet-700">{label}</p><p className="mt-2 text-xl font-black text-slate-950">{money.format(value as number)}</p></div>)}</div><p className="mt-4 rounded-xl bg-emerald-50 p-3 text-sm font-semibold text-emerald-900">Confirmed November 1 salary updates are included, including Levi Nation at $100,000 annually.</p><p className="mt-2 rounded-xl bg-amber-50 p-3 text-sm font-semibold text-amber-900">2 salary employees are excluded because the Pay Rate is zero or unavailable: Gary Grimes and Mark Stephens.</p></section>}
      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm"><div className="border-b border-slate-200 px-6 py-5"><div className="flex flex-wrap items-end justify-between gap-4"><div><h2 className="text-xl font-black text-slate-950">{payType === "Salary" ? "Royal Internal Salary Data by Job Title" : "Royal Internal Hourly Analysis by Job Title"}</h2><p className="mt-1 text-sm text-slate-500">Job-title distributions ranked by average from highest to lowest.</p><p className={`mt-2 inline-flex rounded-full px-3 py-1 text-xs font-black ${payType === "Hourly" && hourlyJobTitleBasis === "rate" ? "bg-cyan-100 text-cyan-900" : payType === "Salary" && jobTitleBasis === "regular" ? "bg-violet-100 text-violet-800" : "bg-slate-100 text-slate-700"}`}>{payType === "Hourly" ? hourlyJobTitleBasis === "rate" ? "Current hourly rates" : `Annual gross pay: ${dateText(analysis.period.start)} – ${dateText(analysis.period.end)}` : jobTitleBasis === "gross" ? `Data period: ${dateText(analysis.period.start)} – ${dateText(analysis.period.end)}` : "New salary effective November 1, 2026"}</p></div>{payType === "Salary" ? <div className="inline-flex rounded-xl bg-slate-100 p-1" role="tablist" aria-label="Salary job title pay basis"><button aria-selected={jobTitleBasis === "gross"} className={`rounded-lg px-4 py-2 text-sm font-bold transition ${jobTitleBasis === "gross" ? "bg-slate-900 text-white shadow" : "text-slate-600 hover:text-slate-950"}`} onClick={() => setJobTitleBasis("gross")} role="tab" type="button">Gross Pay Distribution</button><button aria-selected={jobTitleBasis === "regular"} className={`rounded-lg px-4 py-2 text-sm font-bold transition ${jobTitleBasis === "regular" ? "bg-violet-700 text-white shadow" : "text-slate-600 hover:text-slate-950"}`} onClick={() => setJobTitleBasis("regular")} role="tab" type="button">Regular Pay Distribution</button></div> : <div className="inline-flex rounded-xl bg-slate-100 p-1" role="tablist" aria-label="Hourly job title pay basis"><button aria-selected={hourlyJobTitleBasis === "rate"} className={`rounded-lg px-4 py-2 text-sm font-bold transition ${hourlyJobTitleBasis === "rate" ? "bg-cyan-800 text-white shadow" : "text-slate-600 hover:text-slate-950"}`} onClick={() => setHourlyJobTitleBasis("rate")} role="tab" type="button">Hourly Rate</button><button aria-selected={hourlyJobTitleBasis === "gross"} className={`rounded-lg px-4 py-2 text-sm font-bold transition ${hourlyJobTitleBasis === "gross" ? "bg-slate-900 text-white shadow" : "text-slate-600 hover:text-slate-950"}`} onClick={() => setHourlyJobTitleBasis("gross")} role="tab" type="button">Annual Gross Pay</button></div>}</div></div><div className="overflow-x-auto"><table className="min-w-[980px] w-full text-left text-sm"><thead className="bg-slate-900 text-xs uppercase tracking-wide text-white"><tr>{["Job Title", "Employees", "Analyzed", "Min", "25th", "Median", "Average", "75th", "Max"].map((header) => <th className="whitespace-nowrap px-4 py-3" key={header}>{header}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{(payType === "Salary" ? jobTitleRows : hourlyJobTitleRows).map((row) => <tr className="hover:bg-indigo-50/40" key={row.jobTitle}><td className="px-4 py-3 font-bold text-slate-950">{row.jobTitle}</td><td className="px-4 py-3 text-center">{row.population}</td><td className="px-4 py-3 text-center">{row.analyzed}</td>{[row.min, row.p25, row.median, row.average, row.p75, row.max].map((value, index) => <td className={`whitespace-nowrap px-4 py-3 ${index === 3 ? "font-black text-indigo-800" : "text-slate-700"}`} key={index}>{formatJobTitleValue(value)}</td>)}</tr>)}</tbody></table></div><p className="border-t border-slate-200 bg-slate-50 p-5 text-sm leading-6 text-slate-600">{payType === "Hourly" ? hourlyJobTitleBasis === "rate" ? "Hourly Rate uses Regular Pay Rate Amount directly. Employees without a valid current hourly rate remain in headcount but are excluded from the statistics." : "Annual Gross Pay includes overtime and other paid earnings. Employees with at least 90 days but less than a full year are annualized; employees with less than 90 days are excluded." : jobTitleBasis === "regular" ? "Regular Pay uses the confirmed annual salaries effective November 1, 2026, or the current Salary Pay Rate × 24 payrolls. Employees without a valid Pay Rate remain in headcount but are excluded from the statistics." : "Gross Pay includes applicable overtime, commission, bonus, PTO, and other paid earnings. It should not be interpreted as base pay alone."}</p></section>
      {payType === "Salary" && <section className="overflow-hidden rounded-3xl border border-amber-200 bg-white shadow-sm"><div className="border-b border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50 px-6 py-6"><p className="text-xs font-black uppercase tracking-[0.16em] text-amber-800">FLSA classification review</p><h2 className="mt-2 text-2xl font-black text-slate-950">Same job titles across Salary and Hourly employees</h2><p className="mt-2 max-w-5xl text-sm leading-6 text-slate-700">The current roster contains six job titles used for both Salary and Hourly employees. Salary status alone does not remove overtime eligibility. We should document the actual duties supporting each Salary employee's exempt classification. When relying on the executive exemption, the employee's primary duty must be management and the position must satisfy the applicable supervision and authority requirements. Other exemptions require their own duties tests.</p></div><div className="overflow-x-auto"><table className="min-w-[1080px] w-full text-left text-sm"><thead className="bg-amber-950 text-xs uppercase tracking-wide text-white"><tr><th className="px-4 py-3">Job Title</th><th className="px-4 py-3">Salary Employees</th><th className="px-4 py-3">Hourly Employees</th><th className="px-4 py-3">Compliance Review</th></tr></thead><tbody className="divide-y divide-amber-100">{crossPayTypeJobTitles.map((row) => <tr className="align-top hover:bg-amber-50/60" key={row.title}><td className="px-4 py-4 font-black text-slate-950">{row.title}</td><td className="px-4 py-4 leading-6 text-slate-700">{row.salary}</td><td className="px-4 py-4 leading-6 text-slate-700">{row.hourly}</td><td className="px-4 py-4 leading-6 text-amber-950">Document material differences in primary duties, discretion, supervision, decision authority, and other applicable exemption factors.</td></tr>)}</tbody></table></div><div className="border-t border-amber-200 bg-amber-50 px-6 py-5 text-sm leading-6 text-amber-950"><p><strong>Review priority:</strong> Similar titles do not automatically require the same classification, but different overtime treatment should be supported by current job descriptions and a documented duties analysis. Job title and salary payment method alone do not establish exempt status.</p><div className="mt-3 flex flex-wrap gap-4 text-xs font-black"><a className="text-amber-900 underline decoration-amber-400 underline-offset-4" href="https://www.dol.gov/agencies/whd/fact-sheets/17a-overtime" rel="noreferrer" target="_blank">U.S. DOL Fact Sheet 17A</a><a className="text-amber-900 underline decoration-amber-400 underline-offset-4" href="https://www.dol.gov/agencies/whd/fact-sheets/17b-overtime-executive" rel="noreferrer" target="_blank">U.S. DOL Executive Exemption</a></div></div></section>}
      {payType === "Salary" && <section className="overflow-hidden rounded-3xl border border-indigo-200 bg-white shadow-sm"><div className="bg-gradient-to-r from-indigo-950 to-violet-900 px-6 py-6 text-white"><p className="text-xs font-black uppercase tracking-[0.16em] text-cyan-200">Royal job architecture</p><h2 className="mt-2 text-2xl font-black">Job family and focused market analysis</h2><p className="mt-2 max-w-5xl text-sm leading-6 text-indigo-100">Salary positions are grouped by enterprise impact, decision scope, skill depth, revenue responsibility, and market scarcity. Each benchmark combines the closest available industry anchor—motor-vehicle parts or durable-goods wholesale—with Detroit/Michigan occupational data, Royal recruiting experience, and current recruiting-market checks for a Michigan truck, trailer, parts, and service employer of approximately 210 employees.</p></div><div className="grid gap-3 border-b border-indigo-100 bg-indigo-50/60 p-5 md:grid-cols-3"><div className="rounded-2xl bg-white p-4"><p className="text-xs font-black uppercase tracking-wide text-indigo-700">1 · Industry match</p><p className="mt-2 text-sm leading-6 text-slate-600">Motor Vehicle & Parts Wholesale, Durable Goods Wholesale, and NTDA trailer-dealer data provide the closest published industry anchors.</p></div><div className="rounded-2xl bg-white p-4"><p className="text-xs font-black uppercase tracking-wide text-indigo-700">2 · Local labor market</p><p className="mt-2 text-sm leading-6 text-slate-600">Detroit–Warren–Dearborn, Michigan, and the Grand Rapids service-leadership recruiting market are used where relevant.</p></div><div className="rounded-2xl bg-white p-4"><p className="text-xs font-black uppercase tracking-wide text-indigo-700">3 · Pay-design adjustment</p><p className="mt-2 text-sm leading-6 text-slate-600">Commission, branch size, multi-site scope, specialist scarcity, and hybrid responsibilities are evaluated separately from base pay.</p></div></div><div className="overflow-x-auto"><table className="min-w-[1240px] w-full text-left text-sm"><thead className="bg-indigo-50 text-xs uppercase tracking-wide text-indigo-950"><tr>{["Job Family", "Employees", "Included Roles", "Royal Regular Pay", "Royal Gross Pay", "External Pay Reference & Structure"].map((header) => <th className="px-4 py-3" key={header}>{header}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{salaryJobFamilies.map((row) => <tr className="align-top hover:bg-indigo-50/40" key={row.family}><td className="px-4 py-4 font-black text-slate-950">{row.family}</td><td className="px-4 py-4 text-center font-bold text-indigo-800">{row.employees}</td><td className="max-w-xs px-4 py-4 leading-6 text-slate-600">{row.jobs}</td><td className="whitespace-nowrap px-4 py-4 font-bold text-violet-800">{row.regular}</td><td className="whitespace-nowrap px-4 py-4 font-bold text-slate-800">{row.gross}</td><td className="min-w-[250px] px-4 py-4 font-bold leading-6 text-emerald-800">{row.market}</td></tr>)}</tbody></table></div><div className="border-t border-indigo-100 bg-slate-50 p-6"><h3 className="font-black text-slate-950">External sources and limitations</h3><p className="mt-2 text-sm leading-6 text-slate-600">The industry and geographic series are complementary: BLS does not publish a statistically reliable Michigan-by-industry-by-occupation table for every Royal role. Motor-vehicle-parts wholesale figures are national industry estimates; Detroit figures cover all industries. Indeed and Salary.com are recruiting-market cross-checks, not controlled compensation surveys. ADP Workforce Compensation Benchmark uses Metro Area base-salary medians as of August 31, 2026; it does not provide full pay ranges, and only credible matches are included. NTDA's public 2021 Service Department Labor Hours Guide provides highly relevant nationwide trailer-dealer reference ranges for service managers, parts managers, parts salespeople, and operations managers. Because those figures are older, national, and presented as broad guide ranges, they are used as a secondary industry validation rather than as a replacement for current Michigan benchmarks. NTDA also lists a broader Dealer Compensation Survey, but the latest publicly identified edition is the member-only 2018 report. The Royal-provided Grand Rapids staffing-firm report remains the primary source for truck and trailer service leadership: Service Manager base pay is $90,000–$130,000, with total cash of $105,000–$155,000+. BDO and Deloitte private-company surveys confirm that executive packages commonly separate base salary, annual incentive, long-term incentive or equity, and other compensation, but company-size-specific numeric cuts are not available in the current source set. Sales commission is plan-dependent and is not separately published as a reliable dollar range in ADP or BLS. IT management is now benchmarked to local operational-manager scope rather than the broader BLS computer-and-information-systems-manager category.</p><div className="mt-4 flex flex-wrap gap-3 text-xs font-black"><a className="text-indigo-700 hover:underline" href="https://www.michigan.gov/mcda/labor-market-information/oews" rel="noreferrer" target="_blank">Michigan 2025 OEWS</a><a className="text-indigo-700 hover:underline" href="https://www.bls.gov/oes/2023/may/oes_19820.htm" rel="noreferrer" target="_blank">BLS Detroit Detailed Occupations</a><a className="text-indigo-700 hover:underline" href="https://www.bls.gov/iag/tgs/iag42.htm" rel="noreferrer" target="_blank">BLS Wholesale Trade</a><a className="text-indigo-700 hover:underline" href="https://www.bls.gov/ooh/sales/wholesale-and-manufacturing-sales-representatives.htm" rel="noreferrer" target="_blank">BLS Wholesale Sales Pay Structure</a><a className="text-indigo-700 hover:underline" href="https://ntda.site-ym.com/page/DealerSurveys" rel="noreferrer" target="_blank">NTDA Dealer Surveys</a><a className="text-indigo-700 hover:underline" href="https://www.ftesalesinventory.com/siteart/NTDA-2021-Srvc-Dpt-Labor-Hours-Guide-Final-041821.pdf" rel="noreferrer" target="_blank">NTDA 2021 Dealer Compensation References</a><a className="text-indigo-700 hover:underline" href="https://www.salary.com/research/salary/benchmark/information-technology-manager-salary/grand-rapids-mi" rel="noreferrer" target="_blank">Grand Rapids IT Manager Market</a><a className="text-indigo-700 hover:underline" href="https://insights.bdo.com/Private-Company-Executive-Compensation-Survey-Insights-Report-2025.html" rel="noreferrer" target="_blank">BDO Private Company Executive Compensation</a><a className="text-indigo-700 hover:underline" href="https://www.deloitte.com/us/en/services/tax/articles/private-company-executive-compensation-survey.html" rel="noreferrer" target="_blank">Deloitte Private Company Executive Compensation</a></div></div></section>}
      {payType === "Salary" && <Link className="group flex flex-wrap items-center justify-between gap-5 rounded-3xl border border-violet-200 bg-gradient-to-r from-violet-950 via-indigo-950 to-slate-950 p-7 text-white shadow-xl transition hover:-translate-y-0.5 hover:shadow-2xl" to="/compensation-analysis/salary/individual"><div><p className="text-xs font-black uppercase tracking-[0.16em] text-cyan-200">Employee-level workspace</p><h2 className="mt-2 text-2xl font-black">Open Individual Salary Employee Analysis</h2><p className="mt-2 max-w-3xl text-sm leading-6 text-violet-100">Review each employee's regular pay and gross pay percentile, internal peer comparison, external market alignment, and compensation equity screening.</p></div><span className="inline-flex items-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-black text-indigo-950">Enter Individual Analysis<ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" /></span></Link>}
      {payType === "Hourly" && <><HourlyJobArchitecture /><Link className="group flex flex-wrap items-center justify-between gap-5 rounded-3xl border border-cyan-200 bg-gradient-to-r from-cyan-950 via-slate-950 to-indigo-950 p-7 text-white shadow-xl transition hover:-translate-y-0.5 hover:shadow-2xl" to="/compensation-analysis/hourly/individual"><div><p className="text-xs font-black uppercase tracking-[0.16em] text-cyan-200">Employee-level workspace</p><h2 className="mt-2 text-2xl font-black">Open Hourly Employee Group Table</h2><p className="mt-2 max-w-3xl text-sm leading-6 text-cyan-50">Review each employee's hourly-rate and gross-pay percentile, same-job internal hourly-rate position, external total-pay alignment, and individual compensation report.</p></div><span className="inline-flex items-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-black text-cyan-950">Enter Employee Analysis<ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" /></span></Link></>}
    </>}
  </div>;
}
