import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, RefreshCw, Search } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "../shared/api";
import { CompensationLogin, dateText, hourlyExternalBenchmark, hourlyInternalBenchmark, hourlyMoney, percentile } from "./CompensationAnalysis";
import type { GrossPayAnalysis } from "./CompensationAnalysis";

const grossMoney = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

export default function HourlyEmployeeDirectory() {
  const [params, setParams] = useSearchParams();
  const [state, setState] = useState<"checking" | "authenticated" | "signed-out">("checking");
  const [analysis, setAnalysis] = useState<GrossPayAnalysis | null>(null);
  const [search, setSearch] = useState(params.get("q") ?? "");
  const [titles, setTitles] = useState<string[]>(params.getAll("title"));
  const [locations, setLocations] = useState<string[]>(params.getAll("location"));
  const [internalBenchmarks, setInternalBenchmarks] = useState<string[]>(params.getAll("internal"));
  const [externalBenchmarks, setExternalBenchmarks] = useState<string[]>(params.getAll("external"));
  const [sort, setSort] = useState(params.get("sort") ?? "name");
  const topScroll = useRef<HTMLDivElement>(null);
  const tableScroll = useRef<HTMLDivElement>(null);

  async function load() { setAnalysis((await api.get<GrossPayAnalysis>("/compensation/gross-pay-analysis")).data); }
  useEffect(() => { api.get("/compensation/overview").then(async () => { setState("authenticated"); await load(); }).catch(() => setState("signed-out")); }, []);
  useEffect(() => {
    const next = new URLSearchParams();
    if (search) next.set("q", search); titles.forEach((value) => next.append("title", value)); locations.forEach((value) => next.append("location", value)); internalBenchmarks.forEach((value) => next.append("internal", value)); externalBenchmarks.forEach((value) => next.append("external", value)); if (sort !== "name") next.set("sort", sort);
    if (next.toString() !== params.toString()) setParams(next, { replace: true });
  }, [search, titles, locations, internalBenchmarks, externalBenchmarks, sort, params, setParams]);

  if (state === "checking") return <div className="grid min-h-64 place-items-center"><RefreshCw className="h-7 w-7 animate-spin text-cyan-700" /></div>;
  if (state === "signed-out") return <CompensationLogin onLogin={() => { setState("authenticated"); void load(); }} />;
  if (!analysis) return null;
  const employees = analysis.hourlyEmployees;
  const rateValues = employees.map((employee) => employee.hourlyRate);
  const grossValues = employees.flatMap((employee) => employee.grossPay == null ? [] : [employee.grossPay]);
  const query = search.trim().toLowerCase();
  const internalOptions = [...new Set(employees.map((employee) => hourlyInternalBenchmark(employee, employees)).filter(Boolean))].sort();
  const externalOptions = [...new Set(employees.map((employee) => hourlyExternalBenchmark(employee)))].sort();
  const filtered = employees.filter((employee) => (!query || [employee.name, employee.jobTitle, employee.department, employee.location].some((value) => value.toLowerCase().includes(query))) && (!titles.length || titles.includes(employee.jobTitle)) && (!locations.length || locations.includes(employee.location)) && (!internalBenchmarks.length || internalBenchmarks.includes(hourlyInternalBenchmark(employee, employees))) && (!externalBenchmarks.length || externalBenchmarks.includes(hourlyExternalBenchmark(employee))));
  const sorted = [...filtered].sort((a, b) => {
    const direction = sort.endsWith("-desc") ? -1 : 1;
    const key = sort.replace(/-(asc|desc)$/, "");
    if (key === "rate") return direction * (a.hourlyRate - b.hourlyRate);
    if (key === "gross") return direction * ((a.grossPay ?? (direction === 1 ? Infinity : -1)) - (b.grossPay ?? (direction === 1 ? Infinity : -1)));
    if (key === "title") return direction * a.jobTitle.localeCompare(b.jobTitle) || a.name.localeCompare(b.name);
    if (key === "location") return direction * a.location.localeCompare(b.location) || a.name.localeCompare(b.name);
    if (key === "internal") return direction * hourlyInternalBenchmark(a, employees).localeCompare(hourlyInternalBenchmark(b, employees)) || a.name.localeCompare(b.name);
    if (key === "external") return direction * hourlyExternalBenchmark(a).localeCompare(hourlyExternalBenchmark(b)) || a.name.localeCompare(b.name);
    return direction * a.name.localeCompare(b.name);
  });
  const sortHeader = (label: string, key: string) => {
    const active = sort === key || sort.startsWith(`${key}-`);
    const descending = sort.endsWith("-desc");
    const next = active ? `${key}-${descending ? "asc" : "desc"}` : `${key}-${key === "rate" || key === "gross" ? "desc" : "asc"}`;
    return <button className={`inline-flex items-center gap-2 whitespace-nowrap font-black ${active ? "text-cyan-200" : "text-white"}`} onClick={() => setSort(next)} type="button">{label}<span>{active ? descending ? "↓" : "↑" : "↕"}</span></button>;
  };
  const benchmarkTone = (status: string) => status.includes("Unavailable") || status.includes("Insufficient") ? "bg-slate-100 text-slate-700" : status.includes("Low Position") || status.includes("Below 50th") ? "bg-amber-100 text-amber-950" : "bg-emerald-100 text-emerald-950";
  const returnSearch = params.toString();

  return <div className="space-y-7">
    <section className="rounded-3xl bg-gradient-to-br from-cyan-950 via-slate-950 to-indigo-950 px-7 py-8 text-white shadow-xl"><Link className="inline-flex items-center gap-2 text-sm font-bold text-cyan-200 hover:text-white" to="/compensation-analysis/hourly"><ArrowLeft className="h-4 w-4" />Back to Hourly Analysis</Link><p className="mt-7 text-xs font-black uppercase tracking-[0.18em] text-cyan-200">Employee-level workspace</p><h1 className="mt-2 text-4xl font-black">Hourly Employee Group Table</h1><p className="mt-3 max-w-4xl text-sm leading-7 text-slate-200">Hourly-rate and annual-gross-pay percentiles, same-job internal hourly-rate comparison, and job-family external total-pay comparison.</p></section>
    <section className="overflow-hidden rounded-3xl border border-cyan-200 bg-white shadow-sm">
      <div className="border-b border-cyan-100 bg-gradient-to-r from-cyan-50 to-slate-50 p-5">
      <div className="flex flex-wrap items-end gap-3">
        <label className="relative min-w-[260px] flex-[1.4]"><span className="mb-1.5 block text-xs font-black uppercase tracking-wide text-cyan-900">Employee Search</span><Search className="absolute left-3 top-[38px] h-4 w-4 text-slate-400" /><input className="w-full rounded-xl border border-cyan-200 bg-white py-2.5 pl-9 pr-3 text-sm shadow-sm outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100" onChange={(event) => setSearch(event.target.value)} placeholder="Name, title, department, or location" value={search} /></label>
        <MultiFilter label="Job Title" options={[...new Set(employees.map((employee) => employee.jobTitle))].sort()} selected={titles} onChange={setTitles} />
        <MultiFilter label="Location" options={[...new Set(employees.map((employee) => employee.location))].sort()} selected={locations} onChange={setLocations} />
        <MultiFilter label="Internal Benchmark" options={internalOptions} selected={internalBenchmarks} onChange={setInternalBenchmarks} />
        <MultiFilter label="External Benchmark" options={externalOptions} selected={externalBenchmarks} onChange={setExternalBenchmarks} />
        <label className="min-w-[210px] flex-1"><span className="mb-1.5 block text-xs font-black uppercase tracking-wide text-cyan-900">Sort Order</span><select className="w-full rounded-xl border border-cyan-200 bg-white px-3 py-2.5 text-sm font-bold shadow-sm" onChange={(event) => setSort(event.target.value)} value={sort}><option value="name">Employee</option><option value="title-asc">Job title: A to Z</option><option value="location-asc">Location: A to Z</option><option value="internal-asc">Internal benchmark</option><option value="external-asc">External benchmark</option><option value="rate-desc">Hourly rate: High to low</option><option value="rate-asc">Hourly rate: Low to high</option><option value="gross-desc">Gross pay: High to low</option><option value="gross-asc">Gross pay: Low to high</option></select></label>
        <button className="rounded-xl border border-cyan-300 bg-white px-4 py-2.5 text-sm font-black text-cyan-900 shadow-sm transition hover:bg-cyan-100" onClick={() => { setSearch(""); setTitles([]); setLocations([]); setInternalBenchmarks([]); setExternalBenchmarks([]); setSort("name"); }} type="button">Reset Filters</button>
      </div>
      <p className="mt-3 text-sm font-semibold text-slate-600">Showing <span className="font-black text-cyan-900">{sorted.length}</span> of {employees.length} hourly employees</p>
    </div>
      <div className="border-b border-cyan-100 bg-slate-50 px-1 pt-2"><p className="px-4 pb-1 text-xs font-bold text-slate-500">Drag horizontally to view all columns</p><div className="overflow-x-auto" onScroll={(event) => { if (tableScroll.current) tableScroll.current.scrollLeft = event.currentTarget.scrollLeft; }} ref={topScroll}><div className="h-1 min-w-[1540px]" /></div></div>
      <div className="overflow-x-auto" onScroll={(event) => { if (topScroll.current) topScroll.current.scrollLeft = event.currentTarget.scrollLeft; }} ref={tableScroll}><table className="min-w-[1540px] w-full text-left text-sm"><thead className="bg-slate-900 text-xs uppercase tracking-wide text-white"><tr><th className="px-4 py-3">{sortHeader("Employee", "name")}</th><th className="px-4 py-3">{sortHeader("Job Title", "title")}</th><th className="px-4 py-3">{sortHeader("Location", "location")}</th><th className="px-4 py-3">{sortHeader("Hourly Rate", "rate")}</th><th className="px-4 py-3">Rate Percentile</th><th className="px-4 py-3">{sortHeader("Annual Gross Pay", "gross")}<span className="mt-1 block whitespace-nowrap text-[10px] font-semibold normal-case tracking-normal text-slate-300">{dateText(analysis.period.start)} – {dateText(analysis.period.end)}</span></th><th className="px-4 py-3">Gross Percentile</th><th className="px-4 py-3">{sortHeader("Internal Benchmark", "internal")}</th><th className="px-4 py-3">{sortHeader("External Benchmark", "external")}</th></tr></thead><tbody className="divide-y divide-slate-100">{sorted.map((employee) => { const internalStatus = hourlyInternalBenchmark(employee, employees); const externalStatus = hourlyExternalBenchmark(employee); return <tr className="group hover:bg-cyan-50/60" key={employee.id}><td className="sticky left-0 bg-white px-4 py-3 font-black text-cyan-900 group-hover:bg-cyan-50"><Link className="inline-flex items-center gap-2 hover:underline" to={`/compensation-analysis/hourly/employees/${employee.id}${returnSearch ? `?${returnSearch}` : ""}`}>{employee.name}<ArrowRight className="h-4 w-4" /></Link></td><td className="px-4 py-3 font-semibold">{employee.jobTitle}</td><td className="px-4 py-3 text-slate-600">{employee.location}</td><td className="px-4 py-3 font-black">{hourlyMoney.format(employee.hourlyRate)}</td><td className="px-4 py-3"><Badge>{percentile(rateValues, employee.hourlyRate)}th</Badge></td><td className="px-4 py-3 font-bold">{employee.grossPay == null ? "Unavailable" : grossMoney.format(employee.grossPay)}</td><td className="px-4 py-3"><Badge>{employee.grossPay == null ? "—" : `${percentile(grossValues, employee.grossPay)}th`}</Badge></td><td className="max-w-[250px] px-4 py-3">{internalStatus ? <span className={`inline-flex rounded-full px-3 py-1.5 text-xs font-black ${benchmarkTone(internalStatus)}`}>{internalStatus}</span> : null}</td><td className="max-w-[250px] px-4 py-3"><span className={`inline-flex rounded-full px-3 py-1.5 text-xs font-black ${benchmarkTone(externalStatus)}`}>{externalStatus}</span></td></tr>; })}</tbody></table></div>
      <div className="border-t border-cyan-100 bg-slate-50 p-5 text-sm leading-6 text-slate-600"><strong>Hourly Rate Percentile</strong> compares the employee with all current Royal hourly employees. <strong>Gross Pay Percentile</strong> compares annualized gross pay with current Royal hourly employees who have at least 90 days of data for {dateText(analysis.period.start)} – {dateText(analysis.period.end)}. <strong>Internal Benchmark</strong> compares hourly rate only with the same job title; when at least five employees share that title, a rate below the median is shown as <strong>Hourly Rate Below the 50th Percentile for the Same Position</strong>. <strong>External Benchmark</strong> uses Total Gross Pay for commission-eligible technical roles and Hourly Rate for all other roles.</div>
    </section>
  </div>;
}

function MultiFilter({ label, options, selected, onChange }: { label: string; options: string[]; selected: string[]; onChange: (values: string[]) => void }) {
  return <details className="group relative min-w-[210px] flex-1"><summary className="list-none"><span className="mb-1.5 block text-xs font-black uppercase tracking-wide text-cyan-900">{label}</span><span className="flex cursor-pointer items-center justify-between rounded-xl border border-cyan-200 bg-white px-3 py-2.5 text-sm font-bold text-slate-800 shadow-sm transition hover:border-cyan-500"><span>{selected.length ? `${selected.length} selected` : `All ${label}`}</span><span className="text-cyan-700 transition group-open:rotate-180">⌄</span></span></summary><div className="absolute left-0 z-50 mt-2 max-h-80 min-w-full overflow-y-auto rounded-2xl border border-cyan-200 bg-white p-3 shadow-2xl"><div className="mb-2 flex items-center justify-between border-b border-cyan-100 pb-2"><span className="text-xs font-black uppercase tracking-wide text-cyan-950">Select {label}</span>{selected.length > 0 && <button className="text-xs font-black text-cyan-700 hover:underline" onClick={() => onChange([])} type="button">Clear</button>}</div>{options.map((option) => <label className="flex cursor-pointer items-start gap-2 rounded-lg px-2 py-2 text-sm leading-5 hover:bg-cyan-50" key={option}><input checked={selected.includes(option)} className="mt-0.5 h-4 w-4 shrink-0 accent-cyan-700" onChange={() => onChange(selected.includes(option) ? selected.filter((value) => value !== option) : [...selected, option])} type="checkbox" /><span>{option}</span></label>)}</div></details>;
}
function Badge({ children }: { children: React.ReactNode }) { return <span className="rounded-full bg-cyan-100 px-3 py-1 font-black text-cyan-900">{children}</span>; }
