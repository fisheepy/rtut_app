import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  ClipboardCheck,
  ExternalLink,
  Filter,
  Lock,
  RefreshCw,
  RotateCcw,
  Save,
  Search,
  UserPlus,
  X,
} from "lucide-react";
import { api } from "../shared/api";

type NewHireEmployee = {
  id: string;
  name: string;
  email: string;
  phone: string;
  hireDate: string;
  homeDepartment: string;
  jobTitle: string;
  location: string;
  supervisor: string;
  eeoc: string;
  employmentCategory: string;
  payCategory: string;
  positionStatus: string;
  accountActive: string;
  activated: string;
  employeeFolderUrl: string;
  payRateType: string;
  payRate: string;
  firstPayrollDate: string;
  insuranceEffectiveDate: string;
  retirementEffectiveDate: string;
  fileTracker: FileTracker;
};

type FileTracker = Record<string, any>;
type FileTrackerField = {
  id: string;
  label: string;
  options: string[];
  order: number;
  active: boolean;
};
type EditableRecord = Pick<
  NewHireEmployee,
  | "employeeFolderUrl"
  | "payRateType"
  | "payRate"
  | "firstPayrollDate"
  | "insuranceEffectiveDate"
  | "retirementEffectiveDate"
>;

const emptyRecord: EditableRecord = {
  employeeFolderUrl: "",
  payRateType: "",
  payRate: "",
  firstPayrollDate: "",
  insuranceEffectiveDate: "",
  retirementEffectiveDate: "",
};
const emptyFilters = {
  homeDepartment: "",
  jobTitle: "",
  location: "",
  supervisor: "",
  employmentCategory: "",
  payCategory: "",
  activated: "",
};
const display = (value: string) => value || "—";
const dateDisplay = (value: string) => {
  if (!value) return "—";
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? `${match[2]}/${match[3]}/${match[1]}` : value;
};
export default function NewHire() {
  const [employees, setEmployees] = useState<NewHireEmployee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState(emptyFilters);
  const [showFilters, setShowFilters] = useState(false);
  const [editing, setEditing] = useState<NewHireEmployee | null>(null);
  const [record, setRecord] = useState<EditableRecord>(emptyRecord);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [trackerEmployee, setTrackerEmployee] =
    useState<NewHireEmployee | null>(null);
  const [tracker, setTracker] = useState<FileTracker>({});
  const [confirmationDate, setConfirmationDate] = useState("");
  const [acknowledged, setAcknowledged] = useState(false);
  const [trackerError, setTrackerError] = useState("");
  const [savingTracker, setSavingTracker] = useState(false);
  const [trackerFields, setTrackerFields] = useState<FileTrackerField[]>([]);
  const [currentUserEmail, setCurrentUserEmail] = useState("");
  const [showTrackerManager, setShowTrackerManager] = useState(false);
  const [showStatusReview, setShowStatusReview] = useState(false);
  const [newTrackerLabel, setNewTrackerLabel] = useState("");
  const [newTrackerOptions, setNewTrackerOptions] = useState("Yes, No");
  const [managerError, setManagerError] = useState("");

  async function loadEmployees() {
    setLoading(true);
    setError("");
    try {
      const [response, fieldsResponse, authResponse] = await Promise.all([
        api.get("/hr-platform/new-hires"),
        api.get("/hr-platform/file-tracker-fields", {
          params: { includeInactive: true },
        }),
        api.get("/hr-tools-auth/me"),
      ]);
      setEmployees(response.data || []);
      setTrackerFields(fieldsResponse.data.fields || []);
      setCurrentUserEmail(authResponse.data.email || "");
    } catch (requestError: any) {
      setError(
        requestError.response?.data?.error ||
          "New Hire records could not be loaded.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadEmployees();
  }, []);

  const filteredEmployees = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return employees.filter((employee) => {
      if (
        needle &&
        !Object.values(employee).some((value) =>
          String(value || "")
            .toLowerCase()
            .includes(needle),
        )
      )
        return false;
      return Object.entries(filters).every(
        ([field, value]) =>
          !value ||
          String(employee[field as keyof NewHireEmployee] || "") === value,
      );
    });
  }, [employees, filters, query]);

  const filterFields = [
    ["homeDepartment", "Home Department"],
    ["jobTitle", "Job Title"],
    ["location", "Location"],
    ["supervisor", "Supervisor"],
    ["employmentCategory", "Employment Category"],
    ["payCategory", "Pay Category"],
    ["activated", "App Activated"],
  ] as const;

  const filterOptions = useMemo(
    () =>
      Object.fromEntries(
        filterFields.map(([field]) => [
          field,
          [
            ...new Set(
              employees.map((employee) => employee[field]).filter(Boolean),
            ),
          ].sort((left, right) => left.localeCompare(right)),
        ]),
      ),
    [employees],
  ) as Record<keyof typeof emptyFilters, string[]>;

  function openRecord(employee: NewHireEmployee) {
    setEditing(employee);
    setRecord({
      employeeFolderUrl: employee.employeeFolderUrl,
      payRateType: employee.payRateType,
      payRate: employee.payRate,
      firstPayrollDate: employee.firstPayrollDate,
      insuranceEffectiveDate: employee.insuranceEffectiveDate,
      retirementEffectiveDate: employee.retirementEffectiveDate,
    });
    setSaveError("");
  }

  function openTracker(employee: NewHireEmployee) {
    setTrackerEmployee(employee);
    setTracker(employee.fileTracker || {});
    setConfirmationDate(
      employee.fileTracker?.confirmationDate ||
        new Date().toISOString().slice(0, 10),
    );
    setAcknowledged(false);
    setTrackerError("");
  }

  async function saveFileTracker(action: "save" | "submit" | "lock" = "save") {
    if (!trackerEmployee) return;
    setSavingTracker(true);
    setTrackerError("");
    try {
      const response = await api.put(
        `/hr-platform/new-hires/${trackerEmployee.id}/file-tracker`,
        { fileTracker: tracker, action, confirmationDate },
      );
      setEmployees((current) =>
        current.map((employee) =>
          employee.id === trackerEmployee.id
            ? { ...employee, fileTracker: response.data.fileTracker }
            : employee,
        ),
      );
      setTracker(response.data.fileTracker);
      if (action !== "save") setAcknowledged(false);
    } catch (requestError: any) {
      setTrackerError(
        requestError.response?.data?.error ||
          "The File Tracker could not be saved.",
      );
    } finally {
      setSavingTracker(false);
    }
  }

  async function addTrackerField() {
    setManagerError("");
    try {
      const response = await api.post("/hr-platform/file-tracker-fields", {
        label: newTrackerLabel,
        options: newTrackerOptions
          .split(",")
          .map((value) => value.trim())
          .filter(Boolean),
      });
      setTrackerFields((current) => [...current, response.data.field]);
      setNewTrackerLabel("");
      setNewTrackerOptions("Yes, No");
    } catch (requestError: any) {
      setManagerError(
        requestError.response?.data?.error ||
          "The checklist item could not be added.",
      );
    }
  }

  async function saveTrackerField(field: FileTrackerField) {
    setManagerError("");
    try {
      const response = await api.put(
        `/hr-platform/file-tracker-fields/${field.id}`,
        field,
      );
      setTrackerFields((current) =>
        current.map((item) =>
          item.id === field.id ? response.data.field : item,
        ),
      );
    } catch (requestError: any) {
      setManagerError(
        requestError.response?.data?.error ||
          "The checklist item could not be updated.",
      );
    }
  }

  async function saveRecord() {
    if (!editing) return;
    setSaving(true);
    setSaveError("");
    try {
      const response = await api.put(
        `/hr-platform/new-hires/${editing.id}`,
        record,
      );
      setEmployees((current) =>
        current.map((employee) =>
          employee.id === editing.id
            ? { ...employee, ...response.data }
            : employee,
        ),
      );
      setEditing(null);
    } catch (requestError: any) {
      setSaveError(
        requestError.response?.data?.error ||
          "The New Hire record could not be saved.",
      );
    } finally {
      setSaving(false);
    }
  }

  const columns = [
    [
      "Hire Date",
      (employee: NewHireEmployee) => dateDisplay(employee.hireDate),
    ],
    ["Email", (employee: NewHireEmployee) => display(employee.email)],
    ["Phone", (employee: NewHireEmployee) => display(employee.phone)],
    [
      "Home Department",
      (employee: NewHireEmployee) => display(employee.homeDepartment),
    ],
    ["Job Title", (employee: NewHireEmployee) => display(employee.jobTitle)],
    ["Location", (employee: NewHireEmployee) => display(employee.location)],
    ["Supervisor", (employee: NewHireEmployee) => display(employee.supervisor)],
    [
      "Employment Category",
      (employee: NewHireEmployee) => display(employee.employmentCategory),
    ],
    [
      "App Activated",
      (employee: NewHireEmployee) => display(employee.activated),
    ],
    [
      "Pay Category",
      (employee: NewHireEmployee) => display(employee.payCategory),
    ],
    [
      "Pay Rate",
      (employee: NewHireEmployee) => (
        <button
          className="font-semibold text-emerald-700 hover:underline"
          onClick={() => openRecord(employee)}
          type="button"
        >
          {employee.payRate
            ? `${employee.payRateType}: $${employee.payRate}`
            : "+ Add Pay Rate"}
        </button>
      ),
    ],
    [
      "Employee Folder",
      (employee: NewHireEmployee) =>
        employee.employeeFolderUrl ? (
          <span className="inline-flex items-center gap-2">
            <a
              className="inline-flex items-center gap-1 font-semibold text-blue-700 hover:underline"
              href={employee.employeeFolderUrl}
              rel="noreferrer"
              target="_blank"
            >
              Open
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
            <button
              className="text-xs font-semibold text-slate-500 hover:text-emerald-700"
              onClick={() => openRecord(employee)}
              type="button"
            >
              Edit
            </button>
          </span>
        ) : (
          <button
            className="font-semibold text-emerald-700 hover:underline"
            onClick={() => openRecord(employee)}
            type="button"
          >
            + Add Link
          </button>
        ),
    ],
    [
      "First Payroll Date",
      (employee: NewHireEmployee) => (
        <button
          className="font-semibold text-emerald-700 hover:underline"
          onClick={() => openRecord(employee)}
          type="button"
        >
          {employee.firstPayrollDate
            ? dateDisplay(employee.firstPayrollDate)
            : "+ Add Date"}
        </button>
      ),
    ],
    [
      "Insurance Effective Date",
      (employee: NewHireEmployee) => (
        <button
          className="font-semibold text-emerald-700 hover:underline"
          onClick={() => openRecord(employee)}
          type="button"
        >
          {employee.insuranceEffectiveDate
            ? dateDisplay(employee.insuranceEffectiveDate)
            : "+ Add Date"}
        </button>
      ),
    ],
    [
      "401(k) Effective Date",
      (employee: NewHireEmployee) => (
        <button
          className="font-semibold text-emerald-700 hover:underline"
          onClick={() => openRecord(employee)}
          type="button"
        >
          {employee.retirementEffectiveDate
            ? dateDisplay(employee.retirementEffectiveDate)
            : "+ Add Date"}
        </button>
      ),
    ],
    [
      "File Tracker",
      (employee: NewHireEmployee) => {
        const locked =
          employee.fileTracker?.finalLockedAt ||
          employee.fileTracker?.confirmedAt;
        return (
          <button
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${locked ? "bg-emerald-100 text-emerald-800" : employee.fileTracker?.submittedAt ? "bg-blue-100 text-blue-800" : "bg-amber-100 text-amber-800"}`}
            onClick={() => openTracker(employee)}
            type="button"
          >
            {locked ? (
              <Lock className="h-3.5 w-3.5" />
            ) : (
              <ClipboardCheck className="h-3.5 w-3.5" />
            )}
            {locked
              ? "Locked"
              : employee.fileTracker?.submittedAt
                ? "Confirmed"
                : "Manage"}
          </button>
        );
      },
    ],
    [
      "Final Review",
      (employee: NewHireEmployee) => {
        const locked =
          employee.fileTracker?.finalLockedAt ||
          employee.fileTracker?.confirmedAt;
        if (locked)
          return <span className="font-semibold text-emerald-700">Locked</span>;
        if (!employee.fileTracker?.submittedAt)
          return <span className="text-slate-400">Not Ready</span>;
        return currentUserEmail === "myu@royaltrailersales.com" ? (
          <button
            className="font-semibold text-blue-700 hover:underline"
            onClick={() => openTracker(employee)}
            type="button"
          >
            Review & Lock
          </button>
        ) : (
          <span className="font-semibold text-blue-700">Awaiting Upper-Level Manager</span>
        );
      },
    ],
  ] as const;

  const trackerLocked = Boolean(tracker.finalLockedAt || tracker.confirmedAt);
  const trackerSubmitted = Boolean(tracker.submittedAt);
  const effectiveTrackerFields: FileTrackerField[] =
    (trackerSubmitted || trackerLocked) && tracker.fieldsSnapshot
      ? tracker.fieldsSnapshot
      : trackerFields.filter((field) => field.active);

  return (
    <div className="space-y-6">
      <section className="rounded-2xl bg-slate-950 px-6 py-7 text-white shadow-xl">
        <Link
          className="inline-flex items-center gap-2 text-sm font-semibold text-slate-300 hover:text-white"
          to="/hr-platform"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to HR Platform
        </Link>
        <div className="mt-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-emerald-500/15 px-3 py-1.5 text-xs font-semibold text-emerald-200">
              <UserPlus className="h-4 w-4" />
              New Hire Only
            </div>
            <h1 className="mt-4 text-4xl font-semibold">New Hire</h1>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              Only employees added through Company App after this feature was
              enabled appear here. Existing employees are not imported.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              className="inline-flex items-center gap-2 rounded-lg border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold hover:bg-white/15"
              onClick={() => setShowStatusReview(true)}
              type="button"
            >
              <ClipboardCheck className="h-4 w-4" />
              Review File Tracker Status
            </button>
            <button
              className="inline-flex items-center gap-2 rounded-lg border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold hover:bg-white/15"
              onClick={() => setShowTrackerManager(true)}
              type="button"
            >
              <ClipboardCheck className="h-4 w-4" />
              Checklist Manager
            </button>
            <button
              className="inline-flex items-center gap-2 rounded-lg border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold hover:bg-white/15 disabled:opacity-50"
              disabled={loading}
              onClick={loadEmployees}
              type="button"
            >
              <RefreshCw
                className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
              />
              Refresh from Company App
            </button>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <label className="relative min-w-64 flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search new hire records"
              value={query}
            />
          </label>
          <button
            className={`inline-flex items-center gap-2 rounded-lg border px-3.5 py-2 text-sm font-semibold ${showFilters || Object.values(filters).some(Boolean) ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"}`}
            onClick={() => setShowFilters((current) => !current)}
            type="button"
          >
            <Filter className="h-4 w-4" />
            Filters
            {Object.values(filters).filter(Boolean).length
              ? ` (${Object.values(filters).filter(Boolean).length})`
              : ""}
          </button>
          <span className="ml-auto whitespace-nowrap text-sm font-semibold text-slate-500">
            {filteredEmployees.length} employees
          </span>
        </div>
        {showFilters ? (
          <div className="mt-3 rounded-lg bg-slate-50 p-3">
            <div className="flex flex-wrap gap-2">
              {filterFields.map(([field, label]) => (
                <select
                  aria-label={label}
                  className="min-w-40 flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                  key={field}
                  onChange={(event) =>
                    setFilters((current) => ({
                      ...current,
                      [field]: event.target.value,
                    }))
                  }
                  value={filters[field]}
                >
                  <option value="">{label}: All</option>
                  {filterOptions[field].map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              ))}
              <button
                className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold text-slate-500 hover:bg-white hover:text-emerald-700"
                onClick={() => {
                  setFilters(emptyFilters);
                  setQuery("");
                }}
                type="button"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Reset
              </button>
            </div>
          </div>
        ) : null}
      </section>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">
          {error}
        </div>
      ) : null}
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="max-h-[70vh] overflow-auto">
          <table className="min-w-[2500px] w-full border-separate border-spacing-0 text-sm">
            <thead className="sticky top-0 z-30 bg-slate-100 text-left text-xs uppercase tracking-wide text-slate-600">
              <tr>
                <th className="sticky left-0 z-40 min-w-52 border-b border-r border-slate-200 bg-slate-100 px-4 py-3">
                  Name
                </th>
                {columns.map(([label]) => (
                  <th
                    className="whitespace-nowrap border-b border-slate-200 px-4 py-3"
                    key={label}
                  >
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td
                    className="px-4 py-12 text-center text-slate-500"
                    colSpan={columns.length + 1}
                  >
                    Loading Company App employees...
                  </td>
                </tr>
              ) : filteredEmployees.length ? (
                filteredEmployees.map((employee) => (
                  <tr
                    className="group hover:bg-emerald-50/40"
                    key={employee.id}
                  >
                    <th className="sticky left-0 z-20 border-b border-r border-slate-200 bg-white px-4 py-3 text-left font-semibold text-slate-950 group-hover:bg-emerald-50">
                      {employee.name}
                    </th>
                    {columns.map(([label, value]) => (
                      <td
                        className="whitespace-nowrap border-b border-slate-100 px-4 py-3 text-slate-700"
                        key={label}
                      >
                        {value(employee)}
                      </td>
                    ))}
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    className="px-4 py-12 text-center text-slate-500"
                    colSpan={columns.length + 1}
                  >
                    No employees match this search.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {editing ? (
        <div
          aria-modal="true"
          className="fixed inset-0 z-50 grid place-items-center bg-slate-950/60 p-4"
          role="dialog"
        >
          <section className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-slate-950">
                  Onboarding Details
                </h2>
                <p className="mt-1 text-sm text-slate-500">{editing.name}</p>
              </div>
              <button
                aria-label="Close"
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
                onClick={() => setEditing(null)}
                type="button"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="mt-6 space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="text-sm font-semibold text-slate-700">
                    Pay Type
                  </span>
                  <select
                    className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm"
                    onChange={(event) =>
                      setRecord((current) => ({
                        ...current,
                        payRateType: event.target.value,
                      }))
                    }
                    value={record.payRateType}
                  >
                    <option value="">Select...</option>
                    <option value="Hourly Rate">Hourly Rate</option>
                    <option value="Annual Salary">Annual Salary</option>
                  </select>
                </label>
                <label className="block">
                  <span className="text-sm font-semibold text-slate-700">
                    Pay Rate
                  </span>
                  <div className="relative mt-1.5">
                    <span className="absolute left-3 top-2.5 text-sm text-slate-500">
                      $
                    </span>
                    <input
                      className="w-full rounded-lg border border-slate-200 py-2.5 pl-7 pr-3 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                      min="0"
                      onChange={(event) =>
                        setRecord((current) => ({
                          ...current,
                          payRate: event.target.value,
                        }))
                      }
                      placeholder="0.00"
                      step="0.01"
                      type="number"
                      value={record.payRate}
                    />
                  </div>
                </label>
              </div>
              <label className="block">
                <span className="text-sm font-semibold text-slate-700">
                  Employee Folder Link
                </span>
                <input
                  className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                  onChange={(event) =>
                    setRecord((current) => ({
                      ...current,
                      employeeFolderUrl: event.target.value,
                    }))
                  }
                  placeholder="https://royaltruck.sharepoint.com/ or https://royaltruck-my.sharepoint.com/..."
                  type="url"
                  value={record.employeeFolderUrl}
                />
              </label>
              <div className="grid gap-4 sm:grid-cols-3">
                {(
                  [
                    ["firstPayrollDate", "First Payroll Date"],
                    ["insuranceEffectiveDate", "Insurance Effective Date"],
                    ["retirementEffectiveDate", "401(k) Effective Date"],
                  ] as const
                ).map(([field, label]) => (
                  <label className="block" key={field}>
                    <span className="text-sm font-semibold text-slate-700">
                      {label}
                    </span>
                    <input
                      className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                      onChange={(event) =>
                        setRecord((current) => ({
                          ...current,
                          [field]: event.target.value,
                        }))
                      }
                      type="date"
                      value={record[field]}
                    />
                  </label>
                ))}
              </div>
              {saveError ? (
                <p className="rounded-lg bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">
                  {saveError}
                </p>
              ) : null}
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button
                className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100"
                onClick={() => setEditing(null)}
                type="button"
              >
                Cancel
              </button>
              <button
                className="inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
                disabled={saving}
                onClick={saveRecord}
                type="button"
              >
                <Save className="h-4 w-4" />
                {saving ? "Saving..." : "Save Details"}
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {trackerEmployee ? (
        <div
          aria-modal="true"
          className="fixed inset-0 z-50 grid place-items-center bg-slate-950/60 p-4"
          role="dialog"
        >
          <section className="max-h-[92vh] w-full max-w-3xl overflow-auto rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-slate-950">
                  File Tracker
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  {trackerEmployee.name}
                </p>
              </div>
              <button
                aria-label="Close File Tracker"
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
                onClick={() => setTrackerEmployee(null)}
                type="button"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            {trackerLocked ? (
              <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
                <div className="flex items-center gap-2 font-semibold">
                  <Lock className="h-4 w-4" />
                  Finally locked on{" "}
                  {dateDisplay(String(tracker.confirmationDate || ""))}
                </div>
                <p className="mt-1">
                  This File Tracker is permanently locked and cannot be modified.
                </p>
              </div>
            ) : trackerSubmitted ? (
              <div className="mt-5 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
                <div className="font-semibold">Confirmed for final review</div>
                <p className="mt-1">Waiting for the upper-level manager to review and lock this record.</p>
              </div>
            ) : null}
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {effectiveTrackerFields.map((field) => (
                  <label
                    className="rounded-lg border border-slate-200 p-3"
                    key={field.id}
                  >
                    <span className="mb-2 block text-sm font-semibold text-slate-700">
                      {field.label}
                    </span>
                    <select
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm disabled:bg-slate-100"
                      disabled={trackerLocked || trackerSubmitted}
                      onChange={(event) =>
                        setTracker((current) => ({
                          ...current,
                          responses: { ...(current.responses || {}), [field.id]: event.target.value },
                        }))
                      }
                      value={String(tracker.responses?.[field.id] || "")}
                    >
                      <option value="">Select...</option>
                      {field.options.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                    {field.id === "handbookSignoff" &&
                    tracker.responses?.handbookSignoff === "Yes" ? (
                      <input
                        className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm disabled:bg-slate-100"
                        disabled={trackerLocked || trackerSubmitted}
                        onChange={(event) =>
                          setTracker((current) => ({
                            ...current,
                            handbookVersion: event.target.value,
                          }))
                        }
                        placeholder="Handbook version"
                        value={String(tracker.handbookVersion || "")}
                      />
                    ) : null}
                  </label>
                ))}
            </div>
            <label className="mt-4 block rounded-lg border border-slate-200 p-3">
              <span className="mb-2 block text-sm font-semibold text-slate-700">Admin Comments</span>
              <textarea
                className="min-h-24 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm disabled:bg-slate-100"
                disabled={trackerLocked || trackerSubmitted}
                onChange={(event) => setTracker((current) => ({ ...current, comments: event.target.value }))}
                placeholder="Add notes or follow-up details for this employee file..."
                value={String(tracker.comments || "")}
              />
            </label>
            {!trackerLocked && !trackerSubmitted ? (
              <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4">
                <h3 className="font-semibold text-amber-950">
                  Confirm for Final Review
                </h3>
                <p className="mt-1 text-sm text-amber-800">
                  Confirm that the checklist is ready for upper-level management review. Only the authorized upper-level manager can permanently lock it.
                </p>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <label>
                    <span className="text-sm font-semibold text-slate-700">
                      Confirmation Date
                    </span>
                    <input
                      className="mt-1 w-full rounded-lg border border-amber-200 bg-white px-3 py-2 text-sm"
                      onChange={(event) =>
                        setConfirmationDate(event.target.value)
                      }
                      type="date"
                      value={confirmationDate}
                    />
                  </label>
                  <label className="flex items-end gap-2 pb-2 text-sm font-semibold text-slate-700">
                    <input
                      checked={acknowledged}
                      className="h-4 w-4"
                      onChange={(event) =>
                        setAcknowledged(event.target.checked)
                      }
                      type="checkbox"
                    />
                    I confirm this checklist is ready for final review.
                  </label>
                </div>
              </div>
            ) : null}
            {trackerError ? (
              <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">
                {trackerError}
              </p>
            ) : null}
            <div className="mt-6 flex flex-wrap justify-end gap-3">
              <button
                className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100"
                onClick={() => setTrackerEmployee(null)}
                type="button"
              >
                Close
              </button>
              {!trackerLocked && !trackerSubmitted ? (
                <>
                  <button
                    className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                    disabled={savingTracker}
                    onClick={() => saveFileTracker("save")}
                    type="button"
                  >
                    <Save className="h-4 w-4" />
                    Save Progress
                  </button>
                  <button
                    className="inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
                    disabled={
                      savingTracker || !acknowledged || !confirmationDate
                    }
                    onClick={() => saveFileTracker("submit")}
                    type="button"
                  >
                    <Lock className="h-4 w-4" />
                    Confirm for Review
                  </button>
                </>
              ) : null}
              {!trackerLocked && trackerSubmitted && currentUserEmail === "myu@royaltrailersales.com" ? (
                <button
                  className="inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
                  disabled={savingTracker}
                  onClick={() => saveFileTracker("lock")}
                  type="button"
                >
                  <Lock className="h-4 w-4" />
                  Final Review & Lock
                </button>
              ) : null}
            </div>
          </section>
        </div>
      ) : null}

      {showStatusReview ? (
        <div aria-modal="true" className="fixed inset-0 z-50 grid place-items-center bg-slate-950/60 p-4" role="dialog">
          <section className="max-h-[92vh] w-full max-w-4xl overflow-auto rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div><h2 className="text-xl font-semibold text-slate-950">New Hire File Tracker Status</h2><p className="mt-1 text-sm text-slate-500">Review the current File Tracker stage for every new hire.</p></div>
              <button aria-label="Close File Tracker Status" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" onClick={() => setShowStatusReview(false)} type="button"><X className="h-5 w-5" /></button>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              {[
                ["Draft", employees.filter((employee) => !employee.fileTracker?.submittedAt && !employee.fileTracker?.finalLockedAt && !employee.fileTracker?.confirmedAt).length, "bg-amber-50 text-amber-800"],
                ["Confirmed for Review", employees.filter((employee) => employee.fileTracker?.submittedAt && !employee.fileTracker?.finalLockedAt && !employee.fileTracker?.confirmedAt).length, "bg-blue-50 text-blue-800"],
                ["Locked", employees.filter((employee) => employee.fileTracker?.finalLockedAt || employee.fileTracker?.confirmedAt).length, "bg-emerald-50 text-emerald-800"],
              ].map(([label, count, tone]) => <div className={`rounded-xl p-4 ${tone}`} key={String(label)}><div className="text-2xl font-semibold">{count}</div><div className="mt-1 text-sm font-semibold">{label}</div></div>)}
            </div>
            <div className="mt-5 overflow-auto rounded-xl border border-slate-200">
              <table className="w-full min-w-[760px] text-sm"><thead className="bg-slate-100 text-left text-xs uppercase text-slate-600"><tr><th className="px-4 py-3">Employee</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Confirmation Date</th><th className="px-4 py-3">Confirmed By</th><th className="px-4 py-3">Final Locked By</th></tr></thead><tbody>{employees.map((employee) => { const locked = employee.fileTracker?.finalLockedAt || employee.fileTracker?.confirmedAt; const status = locked ? "Locked" : employee.fileTracker?.submittedAt ? "Confirmed for Review" : "Draft"; return <tr key={employee.id}><td className="border-t border-slate-100 px-4 py-3 font-semibold text-slate-900">{employee.name}</td><td className="border-t border-slate-100 px-4 py-3">{status}</td><td className="border-t border-slate-100 px-4 py-3">{dateDisplay(String(employee.fileTracker?.confirmationDate || ""))}</td><td className="border-t border-slate-100 px-4 py-3">{display(String(employee.fileTracker?.submittedBy || ""))}</td><td className="border-t border-slate-100 px-4 py-3">{display(String(employee.fileTracker?.finalLockedBy || employee.fileTracker?.confirmedBy || ""))}</td></tr>})}</tbody></table>
            </div>
            <div className="mt-5 flex justify-end"><button className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100" onClick={() => setShowStatusReview(false)} type="button">Close</button></div>
          </section>
        </div>
      ) : null}

      {showTrackerManager ? (
        <div aria-modal="true" className="fixed inset-0 z-50 grid place-items-center bg-slate-950/60 p-4" role="dialog">
          <section className="max-h-[92vh] w-full max-w-3xl overflow-auto rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div><h2 className="text-xl font-semibold text-slate-950">File Tracker Checklist Manager</h2><p className="mt-1 text-sm text-slate-500">Changes apply only to future new hires. Existing File Trackers keep their original checklist version.</p></div>
              <button aria-label="Close Checklist Manager" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" onClick={() => setShowTrackerManager(false)} type="button"><X className="h-5 w-5" /></button>
            </div>
            <div className="mt-5 space-y-3">
              {trackerFields.map((field) => (
                <div className={`grid gap-2 rounded-lg border p-3 sm:grid-cols-[1fr_1.2fr_auto_auto] ${field.active ? "border-slate-200" : "border-slate-200 bg-slate-50 opacity-70"}`} key={field.id}>
                  <input aria-label={`${field.label} name`} className="rounded-lg border border-slate-200 px-3 py-2 text-sm" onChange={(event) => setTrackerFields((current) => current.map((item) => item.id === field.id ? { ...item, label: event.target.value } : item))} value={field.label} />
                  <input aria-label={`${field.label} options`} className="rounded-lg border border-slate-200 px-3 py-2 text-sm" onChange={(event) => setTrackerFields((current) => current.map((item) => item.id === field.id ? { ...item, options: event.target.value.split(",").map((value) => value.trim()).filter(Boolean) } : item))} value={field.options.join(", ")} />
                  <label className="flex items-center gap-2 whitespace-nowrap text-sm font-semibold text-slate-600"><input checked={field.active} onChange={(event) => setTrackerFields((current) => current.map((item) => item.id === field.id ? { ...item, active: event.target.checked } : item))} type="checkbox" />Active</label>
                  <button className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50" onClick={() => saveTrackerField(field)} type="button">Save</button>
                </div>
              ))}
            </div>
            <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
              <h3 className="text-sm font-semibold text-emerald-950">Add Checklist Item</h3>
              <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_1.2fr_auto]"><input className="rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm" onChange={(event) => setNewTrackerLabel(event.target.value)} placeholder="Checklist item name" value={newTrackerLabel} /><input className="rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm" onChange={(event) => setNewTrackerOptions(event.target.value)} placeholder="Options separated by commas" value={newTrackerOptions} /><button className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800" onClick={addTrackerField} type="button">Add Item</button></div>
            </div>
            {managerError ? <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{managerError}</p> : null}
            <div className="mt-5 flex justify-end"><button className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100" onClick={() => setShowTrackerManager(false)} type="button">Close</button></div>
          </section>
        </div>
      ) : null}
    </div>
  );
}
