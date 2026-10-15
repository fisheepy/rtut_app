import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, RefreshCw, Search } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "../shared/api";
import { CompensationLogin, dateText, hourlyAlignment, hourlyMoney, percentile } from "./CompensationAnalysis";
import type { GrossPayAnalysis } from "./CompensationAnalysis";

const grossMoney = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

export default function HourlyEmployeeDirectory() {
  const [params, setParams] = useSearchParams();
  const [state, setState] = useState<"checking" | "authenticated" | "signed-out">("checking");
  const [analysis, setAnalysis] = useState<GrossPayAnalysis | null>(null);
  const [search, setSearch] = useState(params.get("q") ?? "");
  const [title, setTitle] = useState(params.get("title") ?? "");
  const [location, setLocation] = useState(params.get("location") ?? "");
  const [alignment, setAlignment] = useState(params.get("alignment") ?? "");
  const [sort, setSort] = useState(params.get("sort") ?? "name");

  async function load() { setAnalysis((await api.get<GrossPayAnalysis>("/compensation/gross-pay-analysis")).data); }
  useEffect(() => { api.get("/compensation/overview").then(async () => { setState("authenticated"); await load(); }).catch(() => setState("signed-out")); }, []);
  useEffect(() => {
    const next = new URLSearchParams();
    if (search) next.set("q", search); if (title) next.set("title", title); if (location) next.set("location", location); if (alignment) next.set("alignment", alignment); if (sort !== "name") next.set("sort", sort);
    if (next.toString() !== params.toString()) setParams(next, { replace: true });
  }, [search, title, location, alignment, sort, params, setParams]);

  if (state === "checking") return <div className="grid min-h-64 place-items-center"><RefreshCw className="h-7 w-7 animate-spin text-cyan-700" /></div>;
  if (state === "signed-out") return <CompensationLogin onLogin={() => { setState("authenticated"); void load(); }} />;
  if (!analysis) return null;
  const employees = analysis.hourlyEmployees;
  const rateValues = employees.map((employee) => employee.hourlyRate);
  const grossValues = employees.flatMap((employee) => employee.grossPay == null ? [] : [employee.grossPay]);
  const query = search.trim().toLowerCase();
  const statuses = [...new Set(employees.map((employee) => hourlyAlignment(employee, employees)))].sort();
  const filtered = employees.filter((employee) => (!query || [employee.name, employee.jobTitle, employee.department, employee.location].some((value) => value.toLowerCase().includes(query))) && (!title || employee.jobTitle === title) && (!location || employee.location === location) && (!alignment || hourlyAlignment(employee, employees) === alignment));
  const sorted = [...filtered].sort((a, b) => {
    const direction = sort.endsWith("-desc") ? -1 : 1;
    const key = sort.replace(/-(asc|desc)$/, "");
    if (key === "rate") return direction * (a.hourlyRate - b.hourlyRate);
    if (key === "gross") return direction * ((a.grossPay ?? (direction === 1 ? Infinity : -1)) - (b.grossPay ?? (direction === 1 ? Infinity : -1)));
    if (key === "title") return direction * a.jobTitle.localeCompare(b.jobTitle) || a.name.localeCompare(b.name);
    if (key === "location") return direction * a.location.localeCompare(b.location) || a.name.localeCompare(b.name);
    if (key === "alignment") return direction * hourlyAlignment(a, employees).localeCompare(hourlyAlignment(b, employees)) || a.name.localeCompare(b.name);
    return direction * a.name.localeCompare(b.name);
  });
  const sortHeader = (label: string, key: string) => {
    const active = sort === key || sort.startsWith(`${key}-`);
    const descending = sort.endsWith("-desc");
    const next = active ? `${key}-${descending ? "asc" : "desc"}` : `${key}-${key === "rate" || key === "gross" ? "desc" : "asc"}`;
    return <button className={`inline-flex items-center gap-2 whitespace-nowrap font-black ${active ? "text-cyan-200" : "text-white"}`} onClick={() => setSort(next)} type="button">{label}<span>{active ? descending ? "↓" : "↑" : "↕"}</span></button>;
  };
  const benchmarkTone = (status: string) => status.includes("Data Unavailable") ? "bg-slate-100 text-slate-700" : status.includes("Low Position") ? "bg-amber-100 text-amber-950" : "bg-emerald-100 text-emerald-950";
  const returnSearch = params.toString();

  return <div className="space-y-7">
    <section className="rounded-3xl bg-gradient-to-br from-cyan-950 via-slate-950 to-indigo-950 px-7 py-8 text-white shadow-xl"><Link className="inline-flex items-center gap-2 text-sm font-bold text-cyan-200 hover:text-white" to="/compensation-analysis/hourly"><ArrowLeft className="h-4 w-4" />Back to Hourly Analysis</Link><p className="mt-7 text-xs font-black uppercase tracking-[0.18em] text-cyan-200">Employee-level workspace</p><h1 className="mt-2 text-4xl font-black">Hourly Employee Group Table</h1><p className="mt-3 max-w-4xl text-sm leading-7 text-slate-200">Hourly-rate and annual-gross-pay percentiles, same-job internal hourly-rate comparison, and job-family external total-pay comparison.</p></section>
    <section className="overflow-hidden rounded-3xl border border-cyan-200 bg-white shadow-sm">
      <div className="border-b border-cyan-100 bg-cyan-50/70 p-5"><div className="grid gap-3 lg:grid-cols-[1.5fr_repeat(4,1fr)]"><label className="relative"><Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" /><input className="w-full rounded-xl border border-cyan-200 py-2.5 pl-9 pr-3 text-sm" onChange={(event) => setSearch(event.target.value)} placeholder="Search employee" value={search} /></label><Select label="All job titles" value={title} onChange={setTitle} options={[...new Set(employees.map((employee) => employee.jobTitle))].sort()} /><Select label="All locations" value={location} onChange={setLocation} options={[...new Set(employees.map((employee) => employee.location))].sort()} /><Select label="All benchmark conclusions" value={alignment} onChange={setAlignment} options={statuses} /><select className="rounded-xl border border-cyan-200 px-3 py-2.5 text-sm font-bold" onChange={(event) => setSort(event.target.value)} value={sort}><option value="name">Sort: Employee</option><option value="title-asc">Job title: A to Z</option><option value="location-asc">Location: A to Z</option><option value="alignment-asc">Benchmark conclusion</option><option value="rate-desc">Hourly rate: High to low</option><option value="rate-asc">Hourly rate: Low to high</option><option value="gross-desc">Gross pay: High to low</option><option value="gross-asc">Gross pay: Low to high</option></select></div><p className="mt-3 text-sm font-semibold text-slate-600">Showing {sorted.length} of {employees.length} hourly employees</p></div>
      <div className="overflow-x-auto"><table className="min-w-[1320px] w-full text-left text-sm"><thead className="bg-slate-900 text-xs uppercase tracking-wide text-white"><tr><th className="px-4 py-3">{sortHeader("Employee", "name")}</th><th className="px-4 py-3">{sortHeader("Job Title", "title")}</th><th className="px-4 py-3">{sortHeader("Location", "location")}</th><th className="px-4 py-3">{sortHeader("Hourly Rate", "rate")}</th><th className="px-4 py-3">Rate Percentile</th><th className="px-4 py-3">{sortHeader("Annual Gross Pay", "gross")}</th><th className="px-4 py-3">Gross Percentile</th><th className="px-4 py-3">{sortHeader("Internal and External Benchmark", "alignment")}</th></tr></thead><tbody className="divide-y divide-slate-100">{sorted.map((employee) => { const status = hourlyAlignment(employee, employees); return <tr className="group hover:bg-cyan-50/60" key={employee.id}><td className="sticky left-0 bg-white px-4 py-3 font-black text-cyan-900 group-hover:bg-cyan-50"><Link className="inline-flex items-center gap-2 hover:underline" to={`/compensation-analysis/hourly/employees/${employee.id}${returnSearch ? `?${returnSearch}` : ""}`}>{employee.name}<ArrowRight className="h-4 w-4" /></Link></td><td className="px-4 py-3 font-semibold">{employee.jobTitle}</td><td className="px-4 py-3 text-slate-600">{employee.location}</td><td className="px-4 py-3 font-black">{hourlyMoney.format(employee.hourlyRate)}</td><td className="px-4 py-3"><Badge>{percentile(rateValues, employee.hourlyRate)}th</Badge></td><td className="px-4 py-3 font-bold">{employee.grossPay == null ? "Unavailable" : grossMoney.format(employee.grossPay)}</td><td className="px-4 py-3"><Badge>{employee.grossPay == null ? "—" : `${percentile(grossValues, employee.grossPay)}th`}</Badge></td><td className="max-w-sm px-4 py-3"><span className={`inline-flex rounded-full px-3 py-1.5 text-xs font-black ${benchmarkTone(status)}`}>{status}</span></td></tr>; })}</tbody></table></div>
      <div className="border-t border-cyan-100 bg-slate-50 p-5 text-sm leading-6 text-slate-600"><strong>Hourly Rate Percentile</strong> compares the employee with all current Royal hourly employees. <strong>Gross Pay Percentile</strong> compares annualized gross pay with current Royal hourly employees who have at least 90 days of data for {dateText(analysis.period.start)} – {dateText(analysis.period.end)}. Internal equity compares hourly rate only with the same job title and flags below-median rates only when at least five employees share that title. External equity compares annual gross pay with the estimated total-pay range for the employee's assigned hourly job family.</div>
    </section>
  </div>;
}

function Select({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (value: string) => void }) { return <select className="min-w-0 rounded-xl border border-cyan-200 px-3 py-2.5 text-sm font-bold" onChange={(event) => onChange(event.target.value)} value={value}><option value="">{label}</option>{options.map((option) => <option key={option} value={option}>{option}</option>)}</select>; }
function Badge({ children }: { children: React.ReactNode }) { return <span className="rounded-full bg-cyan-100 px-3 py-1 font-black text-cyan-900">{children}</span>; }
