import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  ClipboardCheck,
  Download,
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
  payRateChangePending: boolean;
  payrollChangeDate: string;
  payrollChangeReason: string;
  firstPayrollDate: string;
  insuranceEffectiveDate: string;
  insuranceNotApplicable: boolean;
  retirementEffectiveDate: string;
  retirementNotApplicable: boolean;
  fileTracker: FileTracker;
  payrollCheckedAt: string | null;
  payrollCheckedBy: string;
  payrollFinalReviewedAt: string | null;
  payrollFinalReviewedBy: string;
  payrollChangeCheckedAt: string | null;
  payrollChangeCheckedBy: string;
  payrollChangeFinalReviewedAt: string | null;
  payrollChangeFinalReviewedBy: string;
  insuranceCheckedAt: string | null;
  insuranceCheckedBy: string;
  retirementCheckedAt: string | null;
  retirementCheckedBy: string;
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
  | "payRateChangePending"
  | "payrollChangeDate"
  | "payrollChangeReason"
  | "firstPayrollDate"
  | "insuranceEffectiveDate"
  | "insuranceNotApplicable"
  | "retirementEffectiveDate"
  | "retirementNotApplicable"
> & { insuranceApplicability: "" | "applicable" | "not-applicable"; retirementApplicability: "" | "applicable" | "not-applicable" };

const emptyRecord: EditableRecord = {
  employeeFolderUrl: "",
  payRateType: "",
  payRate: "",
  payRateChangePending: false,
  payrollChangeDate: "",
  payrollChangeReason: "",
  firstPayrollDate: "",
  insuranceEffectiveDate: "",
  insuranceNotApplicable: false,
  insuranceApplicability: "",
  retirementEffectiveDate: "",
  retirementNotApplicable: false,
  retirementApplicability: "",
};
const emptyFilters = {
  homeDepartment: "",
  jobTitle: "",
  location: "",
  supervisor: "",
  employmentCategory: "",
  payCategory: "",
  activated: "",
  hireDateFrom: "",
  hireDateTo: "",
};
const display = (value: string) => value || "??;
const dateDisplay = (value: string) => {
  if (!value) return "??;
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
  const [deletedTrackerFields, setDeletedTrackerFields] = useState<FileTrackerField[]>([]);
  const [currentUserEmail, setCurrentUserEmail] = useState("");
  const [showTrackerManager, setShowTrackerManager] = useState(false);
  const [showStatusReview, setShowStatusReview] = useState(false);
  const [showActionReports, setShowActionReports] = useState(false);
  const [newTrackerLabel, setNewTrackerLabel] = useState("");
  const [newTrackerOptions, setNewTrackerOptions] = useState("Yes, No");
  const [managerError, setManagerError] = useState("");
  const [pendingPayrollReview, setPendingPayrollReview] = useState<{ employee: NewHireEmployee; mode: "payroll-final" | "payroll-final-undo" | "payroll-change-final" } | null>(null);
  const [pendingStatusCheck, setPendingStatusCheck] = useState<{ employee: NewHireEmployee; action: "insurance-check" | "retirement-check" } | null>(null);
  const [statusCheckAcknowledged, setStatusCheckAcknowledged] = useState(false);
  const [showCatalogConfirmation, setShowCatalogConfirmation] = useState(false);
  const [catalogChangeAcknowledged, setCatalogChangeAcknowledged] = useState(false);
  const [payrollReviewAcknowledged, setPayrollReviewAcknowledged] = useState(false);

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
      setDeletedTrackerFields([]);
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
      if (filters.hireDateFrom && employee.hireDate.slice(0, 10) < filters.hireDateFrom) return false;
      if (filters.hireDateTo && employee.hireDate.slice(0, 10) > filters.hireDateTo) return false;
      return Object.entries(filters).every(([field, value]) =>
        ["hireDateFrom", "hireDateTo"].includes(field) || !value || String(employee[field as keyof NewHireEmployee] || "") === value,
      );
    });
  }, [employees, filters, query]);

  const mainEmployees = filteredEmployees
    .filter(
      (employee) =>
        !(
          (employee.fileTracker?.finalLockedAt ||
            employee.fileTracker?.confirmedAt) &&
          employee.payrollFinalReviewedAt && !employee.payRateChangePending && !isCurrentHireMonth(employee.hireDate)
        ),
    )
    .sort(
      (left, right) =>
        payrollUrgency(left) - payrollUrgency(right),
    );
  const insuranceEmployees = [...employees]
    .filter((employee) => employee.insuranceEffectiveDate && !employee.insuranceCheckedAt)
    .sort(
      (left, right) =>
        left.insuranceEffectiveDate.localeCompare(right.insuranceEffectiveDate) || left.name.localeCompare(right.name),
    );
  const retirementEmployees = [...employees]
    .filter((employee) => employee.retirementEffectiveDate && !employee.retirementCheckedAt)
    .sort(
      (left, right) =>
        left.retirementEffectiveDate.localeCompare(right.retirementEffectiveDate) || left.name.localeCompare(right.name),
    );
  const firstPayrollFinalPendingCount = mainEmployees.filter((employee) => !employee.payrollFinalReviewedAt).length;
  const futurePayrollChangeCount = mainEmployees.filter((employee) => employee.payRateChangePending).length;
  const currentMonthPrefix = new Date().toISOString().slice(0, 7);
  const monthlyActions = employees.flatMap((employee) => {
    const actions: { employee: NewHireEmployee; type: string; date: string; status: string }[] = [];
    if (employee.firstPayrollDate.startsWith(currentMonthPrefix) && !employee.payrollFinalReviewedAt) actions.push({ employee, type: "First Payroll", date: employee.firstPayrollDate, status: employee.payrollCheckedAt ? "Final Review Needed" : "Admin Action Needed" });
    if (employee.payRateChangePending && employee.payrollChangeDate.startsWith(currentMonthPrefix)) actions.push({ employee, type: "Payroll Change", date: employee.payrollChangeDate, status: employee.payrollChangeCheckedAt ? "Final Review Needed" : "Admin Action Needed" });
    if (employee.insuranceEffectiveDate.startsWith(currentMonthPrefix) && !employee.insuranceCheckedAt) actions.push({ employee, type: "Insurance", date: employee.insuranceEffectiveDate, status: "Action Needed" });
    if (employee.retirementEffectiveDate.startsWith(currentMonthPrefix) && !employee.retirementCheckedAt) actions.push({ employee, type: "401(k)", date: employee.retirementEffectiveDate, status: "Action Needed" });
    return actions;
  }).sort((left, right) => left.date.localeCompare(right.date) || left.employee.name.localeCompare(right.employee.name));
  const monthlyActionSummary = ["First Payroll", "Payroll Change", "Insurance", "401(k)"].map((type) => ({
    type,
    count: monthlyActions.filter((item) => item.type === type).length,
  }));

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
      payRateChangePending: employee.payRateChangePending,
      payrollChangeDate: employee.payrollChangeDate,
      payrollChangeReason: employee.payrollChangeReason,
      firstPayrollDate: employee.firstPayrollDate,
      insuranceEffectiveDate: employee.insuranceEffectiveDate,
      insuranceNotApplicable: employee.insuranceNotApplicable,
      insuranceApplicability: employee.insuranceNotApplicable ? "not-applicable" : employee.insuranceEffectiveDate ? "applicable" : "",
      retirementEffectiveDate: employee.retirementEffectiveDate,
      retirementNotApplicable: employee.retirementNotApplicable,
      retirementApplicability: employee.retirementNotApplicable ? "not-applicable" : employee.retirementEffectiveDate ? "applicable" : "",
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

  async function saveFileTracker(
    action: "save" | "submit" | "lock" | "comment" = "save",
  ) {
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

  async function completeCheck(
    employee: NewHireEmployee,
    action:
      | "payroll-check"
      | "payroll-final-review"
      | "payroll-final-review-undo"
      | "payroll-change-check"
      | "payroll-change-final-review"
      | "insurance-check"
      | "retirement-check",
  ) {
    setError("");
    try {
      const response = await api.put(
        `/hr-platform/new-hires/${employee.id}/checks`,
        { action },
      );
      setEmployees((current) =>
        current.map((item) =>
          item.id === employee.id ? { ...item, ...response.data } : item,
        ),
      );
      return true;
    } catch (requestError: any) {
      setError(
        requestError.response?.data?.error ||
          "The review check could not be saved.",
      );
      return false;
    }
  }

  function dateUrgency(value: string) {
    if (!value) return Number.MAX_SAFE_INTEGER;
    const time = new Date(`${value.slice(0, 10)}T00:00:00`).getTime();
    return Number.isNaN(time)
      ? Number.MAX_SAFE_INTEGER
      : Math.abs(time - Date.now());
  }

  function payrollUrgency(employee: NewHireEmployee) {
    const dates = [
      !employee.payrollFinalReviewedAt ? employee.firstPayrollDate : "",
      employee.payRateChangePending ? employee.payrollChangeDate : "",
    ].filter(Boolean);
    return dates.length ? Math.min(...dates.map(dateUrgency)) : Number.MAX_SAFE_INTEGER;
  }

  function isCurrentHireMonth(value: string) {
    const match = value.match(/^(\d{4})-(\d{2})/);
    if (!match) return false;
    const now = new Date();
    return Number(match[1]) === now.getFullYear() && Number(match[2]) === now.getMonth() + 1;
  }

  async function saveAllTrackerChanges() {
    setManagerError("");
    try {
      const savedFields: FileTrackerField[] = [];
      for (const field of trackerFields) {
        const response = await api.put(`/hr-platform/file-tracker-fields/${field.id}`, field);
        savedFields.push(response.data.field);
      }
      if (newTrackerLabel.trim()) {
        const response = await api.post("/hr-platform/file-tracker-fields", {
          label: newTrackerLabel,
          options: newTrackerOptions.split(",").map((value) => value.trim()).filter(Boolean),
        });
        savedFields.push(response.data.field);
        setNewTrackerLabel("");
        setNewTrackerOptions("Yes, No");
      }
      for (const field of deletedTrackerFields) {
        await api.delete(`/hr-platform/file-tracker-fields/${field.id}`);
      }
      setTrackerFields(savedFields);
      setDeletedTrackerFields([]);
      setShowCatalogConfirmation(false);
    } catch (requestError: any) {
      setManagerError(requestError.response?.data?.error || "The checklist changes could not be saved.");
      setShowCatalogConfirmation(false);
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
        <div>
          <button className="font-semibold text-emerald-700 hover:underline" onClick={() => openRecord(employee)} type="button">
            {employee.payRate ? `${employee.payRateType}: $${employee.payRate}` : "+ Add Pay Rate"}
          </button>
          {employee.payRateChangePending ? <div className="mt-1 text-xs font-bold text-orange-700">Pending to Change</div> : null}
        </div>
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
      "Payroll Change Date",
      (employee: NewHireEmployee) => employee.payRateChangePending ? (
        <button className="font-semibold text-orange-700 hover:underline" onClick={() => openRecord(employee)} title={employee.payrollChangeReason} type="button">
          {dateDisplay(employee.payrollChangeDate)}
        </button>
      ) : null,
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
      "File Tracker Final Review",
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
          <span className="font-semibold text-blue-700">
            Awaiting Upper-Level Manager
          </span>
        );
      },
    ],
    [
      "Payroll Check",
      (employee: NewHireEmployee) =>
        employee.payrollCheckedAt ? (
          <span className="font-semibold text-emerald-700">Checked</span>
        ) : (
          <button
            className="font-semibold text-amber-700 hover:underline"
            onClick={() => completeCheck(employee, "payroll-check")}
            type="button"
          >
            Check Payroll
          </button>
        ),
    ],
    [
      "Payroll Final Review",
      (employee: NewHireEmployee) =>
        employee.payrollFinalReviewedAt ? (
          <span className="inline-flex items-center gap-2"><span className="font-semibold text-emerald-700">Approved</span>{currentUserEmail === "myu@royaltrailersales.com" ? <button className="text-xs font-semibold text-slate-500 hover:text-red-700" onClick={() => { setPendingPayrollReview({ employee, mode: "payroll-final-undo" }); setPayrollReviewAcknowledged(false); }} type="button">Correct</button> : null}</span>
        ) : !employee.payrollCheckedAt ? (
          <span className="text-slate-400">Waiting for Payroll Check</span>
        ) : currentUserEmail === "myu@royaltrailersales.com" ? (
          <button
            className="font-semibold text-blue-700 hover:underline"
            onClick={() => { setPendingPayrollReview({ employee, mode: "payroll-final" }); setPayrollReviewAcknowledged(false); }}
            type="button"
          >
            Final Review
          </button>
        ) : (
          <span className="font-semibold text-blue-700">
            Awaiting Upper-Level Manager
          </span>
        ),
    ],
    [
      "Payroll Change Review",
      (employee: NewHireEmployee) => !employee.payRateChangePending ? null : employee.payrollChangeFinalReviewedAt ? (
        <span className="font-semibold text-emerald-700">Approved</span>
      ) : !employee.payrollChangeCheckedAt ? (
        <button className="font-semibold text-orange-700 hover:underline" onClick={() => completeCheck(employee, "payroll-change-check")} type="button">Admin Check</button>
      ) : currentUserEmail === "myu@royaltrailersales.com" ? (
        <button className="font-semibold text-blue-700 hover:underline" onClick={() => { setPendingPayrollReview({ employee, mode: "payroll-change-final" }); setPayrollReviewAcknowledged(false); }} type="button">Final Review</button>
      ) : (
        <span className="font-semibold text-blue-700">Awaiting Upper-Level Manager</span>
      ),
    ],
  ] as const;

  const trackerLocked = Boolean(tracker.finalLockedAt || tracker.confirmedAt);
  const trackerSubmitted = Boolean(tracker.submittedAt);
  const onboardingDetailsComplete = Boolean(record.payRateType && record.payRate && record.firstPayrollDate && (record.insuranceApplicability === "not-applicable" || (record.insuranceApplicability === "applicable" && record.insuranceEffectiveDate)) && (record.retirementApplicability === "not-applicable" || (record.retirementApplicability === "applicable" && record.retirementEffectiveDate)));
  const legacyDateCorrection = Boolean(editing && (
    record.firstPayrollDate !== editing.firstPayrollDate ||
    record.insuranceEffectiveDate !== editing.insuranceEffectiveDate ||
    record.insuranceNotApplicable !== editing.insuranceNotApplicable ||
    record.retirementEffectiveDate !== editing.retirementEffectiveDate ||
    record.retirementNotApplicable !== editing.retirementNotApplicable
  ));
  const effectiveTrackerFields: FileTrackerField[] =
    (trackerSubmitted || trackerLocked) && tracker.fieldsSnapshot
      ? tracker.fieldsSnapshot
      : trackerFields.filter((field) => field.active);

  return (
    <div className="space-y-6 pb-10">
      <section className="overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950 px-6 py-7 text-white shadow-2xl ring-1 ring-white/10">
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
              Employee File Checklist Manager
            </button>
            <button className="inline-flex items-center gap-2 rounded-lg border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold hover:bg-white/15" onClick={() => setShowActionReports(true)} type="button">
              <Download className="h-4 w-4" />
              Download Action Report
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

      <section className="overflow-hidden rounded-2xl border border-cyan-200 bg-white shadow-lg shadow-cyan-950/5">
        <div className="border-b border-cyan-200 bg-gradient-to-r from-cyan-50 via-sky-50 to-white px-5 py-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><div className="mb-2 inline-flex rounded-full bg-cyan-100 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-cyan-800">Monthly Priority View</div><h2 className="text-xl font-semibold text-cyan-950">This Month's New Hire/Insurance/401k Action Calendar</h2><p className="mt-1 text-sm text-cyan-800">First payroll, payroll changes, insurance, and 401(k) actions scheduled this month. Completed items disappear automatically.</p></div><span className="rounded-full border border-cyan-200 bg-white px-4 py-2 text-sm font-bold text-cyan-800 shadow-sm">{monthlyActions.length} Pending</span></div><div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">{monthlyActionSummary.map((item) => <div className="rounded-xl border border-white bg-white/80 px-3 py-2.5 shadow-sm" key={item.type}><div className="text-lg font-bold text-slate-950">{item.count}</div><div className="text-xs font-semibold text-slate-500">{item.type}</div></div>)}</div></div>
        <div className="max-h-[55vh] overflow-auto">
          <table className="w-full min-w-[820px] text-sm">
            <thead className="sticky top-0 z-10 bg-cyan-100 text-left text-xs uppercase text-cyan-800"><tr><th className="px-4 py-3">Action Date</th><th className="px-4 py-3">Employee</th><th className="px-4 py-3">Action Type</th><th className="px-4 py-3">Status</th></tr></thead>
            <tbody>{monthlyActions.length ? monthlyActions.map((item) => <tr className="bg-cyan-50/40" key={`${item.employee.id}:${item.type}`}><td className="border-t border-cyan-100 px-4 py-3 font-semibold">{dateDisplay(item.date)}</td><td className="border-t border-cyan-100 px-4 py-3 font-semibold text-slate-900">{item.employee.name}</td><td className="border-t border-cyan-100 px-4 py-3">{item.type}</td><td className="border-t border-cyan-100 px-4 py-3 font-semibold text-amber-700">{item.status}</td></tr>) : <tr><td className="px-4 py-8 text-center text-slate-500" colSpan={4}>No pending actions scheduled this month.</td></tr>}</tbody>
          </table>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-md shadow-slate-950/5">
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
            {mainEmployees.length} employees
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
              <label className="min-w-44 flex-1"><span className="mb-1 block text-xs font-semibold text-slate-500">Hire Date From</span><input className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm" onChange={(event) => setFilters((current) => ({ ...current, hireDateFrom: event.target.value }))} type="date" value={filters.hireDateFrom} /></label>
              <label className="min-w-44 flex-1"><span className="mb-1 block text-xs font-semibold text-slate-500">Hire Date To</span><input className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm" onChange={(event) => setFilters((current) => ({ ...current, hireDateTo: event.target.value }))} type="date" value={filters.hireDateTo} /></label>
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
      <section className="overflow-hidden rounded-2xl border border-blue-200 bg-white shadow-lg shadow-blue-950/5">
        <div className="border-b border-blue-200 bg-gradient-to-r from-blue-50 via-indigo-50 to-white px-5 py-5">
          <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-semibold text-blue-950">New Hire & Payroll Status</h2><p className="mt-1 text-sm text-blue-700">First payroll and future payroll changes are sorted together by the nearest pending date. Completed hires remain visible through their hire month.</p></div><div className="flex flex-wrap gap-2"><span className="rounded-full border border-red-300 bg-red-100 px-3 py-1.5 text-sm font-bold text-red-800">{firstPayrollFinalPendingCount} First Payroll Final Review Needed</span><span className="rounded-full border border-purple-300 bg-purple-100 px-3 py-1.5 text-sm font-bold text-purple-800">{futurePayrollChangeCount} Future Payroll Change</span></div></div>
        </div>
        <div className="max-h-[70vh] overflow-auto">
          <table className="min-w-[2500px] w-full border-separate border-spacing-0 text-sm">
            <thead className="sticky top-0 z-30 bg-blue-100 text-left text-xs uppercase tracking-wide text-blue-800">
              <tr>
                <th className="sticky left-0 z-40 min-w-52 border-b border-r border-blue-200 bg-blue-100 px-4 py-3">
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
              ) : mainEmployees.length ? (
                mainEmployees.map((employee) => (
                  <tr
                    className={`group ${!employee.payrollCheckedAt ? "bg-red-100 hover:bg-red-200" : !employee.payrollFinalReviewedAt ? "bg-orange-100 hover:bg-orange-200" : "hover:bg-emerald-50/40"}`}
                    key={employee.id}
                  >
                    <th
                      className={`sticky left-0 z-20 border-b border-r-4 px-4 py-3 text-left font-bold text-slate-950 ${!employee.payrollCheckedAt ? "border-red-500 bg-red-100 group-hover:bg-red-200" : !employee.payrollFinalReviewedAt ? "border-orange-500 bg-orange-100 group-hover:bg-orange-200" : "border-slate-200 bg-white group-hover:bg-emerald-50"}`}
                    >
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

      <section className="overflow-hidden rounded-2xl border border-violet-200 bg-white shadow-lg shadow-violet-950/5">
        <div className="border-b border-violet-200 bg-gradient-to-r from-violet-50 to-white px-5 py-5">
          <h2 className="text-xl font-semibold text-violet-950">
            Insurance Status
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Sorted by the nearest Insurance Effective Date.
          </p>
        </div>
        <div className="max-h-[55vh] overflow-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="sticky top-0 z-10 bg-violet-100 text-left text-xs uppercase text-violet-800">
              <tr>
                <th className="px-4 py-3">Employee</th>
                <th className="px-4 py-3">Effective Date</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Checked By</th>
                <th className="px-4 py-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {insuranceEmployees.length ? (
                insuranceEmployees.map((employee) => (
                  <tr
                    className={employee.insuranceCheckedAt ? "" : "bg-amber-50"}
                    key={employee.id}
                  >
                    <td className="border-t border-slate-100 px-4 py-3 font-semibold">
                      {employee.name}
                    </td>
                    <td className="border-t border-slate-100 px-4 py-3">
                      {dateDisplay(employee.insuranceEffectiveDate)}
                    </td>
                    <td className="border-t border-slate-100 px-4 py-3">
                      {employee.insuranceCheckedAt ? "Checked" : "Pending"}
                    </td>
                    <td className="border-t border-slate-100 px-4 py-3">
                      {display(employee.insuranceCheckedBy)}
                    </td>
                    <td className="border-t border-slate-100 px-4 py-3">
                      {employee.insuranceCheckedAt ? (
                        <span className="font-semibold text-emerald-700">
                          Complete
                        </span>
                      ) : (
                        <button
                          className="font-semibold text-blue-700 hover:underline"
                          onClick={() => {
                            setPendingStatusCheck({ employee, action: "insurance-check" });
                            setStatusCheckAcknowledged(false);
                          }}
                          type="button"
                        >
                          Confirm Action Taken
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    className="px-4 py-8 text-center text-slate-500"
                    colSpan={5}
                  >
                    No pending Insurance checks.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-emerald-200 bg-white shadow-lg shadow-emerald-950/5">
        <div className="border-b border-emerald-200 bg-gradient-to-r from-emerald-50 to-white px-5 py-5">
          <h2 className="text-xl font-semibold text-emerald-950">
            401(k) Status
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Sorted by the nearest 401(k) Effective Date.
          </p>
        </div>
        <div className="max-h-[55vh] overflow-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="sticky top-0 z-10 bg-emerald-100 text-left text-xs uppercase text-emerald-800">
              <tr>
                <th className="px-4 py-3">Employee</th>
                <th className="px-4 py-3">Effective Date</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Checked By</th>
                <th className="px-4 py-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {retirementEmployees.length ? (
                retirementEmployees.map((employee) => (
                  <tr
                    className={
                      employee.retirementCheckedAt ? "" : "bg-amber-50"
                    }
                    key={employee.id}
                  >
                    <td className="border-t border-slate-100 px-4 py-3 font-semibold">
                      {employee.name}
                    </td>
                    <td className="border-t border-slate-100 px-4 py-3">
                      {dateDisplay(employee.retirementEffectiveDate)}
                    </td>
                    <td className="border-t border-slate-100 px-4 py-3">
                      {employee.retirementCheckedAt ? "Checked" : "Pending"}
                    </td>
                    <td className="border-t border-slate-100 px-4 py-3">
                      {display(employee.retirementCheckedBy)}
                    </td>
                    <td className="border-t border-slate-100 px-4 py-3">
                      {employee.retirementCheckedAt ? (
                        <span className="font-semibold text-emerald-700">
                          Complete
                        </span>
                      ) : (
                        <button
                          className="font-semibold text-blue-700 hover:underline"
                          onClick={() => {
                            setPendingStatusCheck({ employee, action: "retirement-check" });
                            setStatusCheckAcknowledged(false);
                          }}
                          type="button"
                        >
                          Confirm Action Taken
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    className="px-4 py-8 text-center text-slate-500"
                    colSpan={5}
                  >
                    No pending 401(k) checks.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {showActionReports ? (
        <div aria-modal="true" className="fixed inset-0 z-50 grid place-items-center bg-slate-950/60 p-4" role="dialog">
          <section className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4"><div><h2 className="text-xl font-semibold text-slate-950">Download Action Report</h2><p className="mt-1 text-sm text-slate-500">Choose the employee action report you need.</p></div><button aria-label="Close Action Reports" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" onClick={() => setShowActionReports(false)} type="button"><X className="h-5 w-5" /></button></div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <a className="rounded-xl border border-amber-200 bg-amber-50 p-4 transition hover:border-amber-300 hover:shadow-md" href="/api/hr-platform/new-hires/reports/action-items.xlsx"><Download className="h-5 w-5 text-amber-700" /><h3 className="mt-3 font-semibold text-amber-950">Current & Future Actions</h3><p className="mt-1 text-sm text-amber-800">Employees with pending First Payroll, Payroll Change, Insurance, or 401(k) action.</p></a>
              <a className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 transition hover:border-emerald-300 hover:shadow-md" href="/api/hr-platform/new-hires/reports/completed-actions.xlsx"><Download className="h-5 w-5 text-emerald-700" /><h3 className="mt-3 font-semibold text-emerald-950">Completed Employee Actions</h3><p className="mt-1 text-sm text-emerald-800">Every completed First Payroll, Payroll Change, Insurance, and 401(k) action, grouped by employee.</p></a>
            </div>
            <div className="mt-5 flex justify-end"><button className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100" onClick={() => setShowActionReports(false)} type="button">Close</button></div>
          </section>
        </div>
      ) : null}

      {pendingStatusCheck ? (
        <div aria-modal="true" className="fixed inset-0 z-50 grid place-items-center bg-slate-950/60 p-4" role="dialog">
          <section className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4"><div><h2 className="text-xl font-semibold text-slate-950">Confirm {pendingStatusCheck.action === "insurance-check" ? "Insurance" : "401(k)"} Completion</h2><p className="mt-1 text-sm text-slate-500">Employee: <span className="font-semibold text-slate-800">{pendingStatusCheck.employee.name}</span></p></div><button aria-label="Close Status Check" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" onClick={() => setPendingStatusCheck(null)} type="button"><X className="h-5 w-5" /></button></div>
            <div className="mt-5 rounded-xl border border-amber-300 bg-amber-50 p-4"><p className="text-sm font-semibold text-slate-800">Confirm only after the required {pendingStatusCheck.action === "insurance-check" ? "Insurance" : "401(k)"} action has actually been completed. This employee will then leave the pending list.</p><label className="mt-4 flex items-start gap-2 text-sm font-semibold text-slate-700"><input checked={statusCheckAcknowledged} className="mt-0.5 h-4 w-4" onChange={(event) => setStatusCheckAcknowledged(event.target.checked)} type="checkbox" />I confirm the required action has been taken for this employee.</label></div>
            <div className="mt-6 flex justify-end gap-3"><button className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100" onClick={() => setPendingStatusCheck(null)} type="button">Cancel</button><button className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-50" disabled={!statusCheckAcknowledged} onClick={async () => { const success = await completeCheck(pendingStatusCheck.employee, pendingStatusCheck.action); if (success) setPendingStatusCheck(null); }} type="button">Confirm Action Taken</button></div>
          </section>
        </div>
      ) : null}

      {pendingPayrollReview ? (
        <div aria-modal="true" className="fixed inset-0 z-50 grid place-items-center bg-slate-950/60 p-4" role="dialog">
          <section className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4"><div><h2 className="text-xl font-semibold text-slate-950">{pendingPayrollReview.mode === "payroll-final-undo" ? "Correct Payroll Final Review" : pendingPayrollReview.mode === "payroll-change-final" ? "Confirm Payroll Change Review" : "Confirm Payroll Final Review"}</h2><p className="mt-1 text-sm text-slate-500">Employee: <span className="font-semibold text-slate-800">{pendingPayrollReview.employee.name}</span></p></div><button aria-label="Close Payroll Review" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" onClick={() => setPendingPayrollReview(null)} type="button"><X className="h-5 w-5" /></button></div>
            <div className={`mt-5 rounded-xl border p-4 ${pendingPayrollReview.mode === "payroll-final-undo" ? "border-red-200 bg-red-50" : "border-amber-200 bg-amber-50"}`}><p className="text-sm font-semibold text-slate-800">{pendingPayrollReview.mode === "payroll-final-undo" ? "This will remove the existing Payroll Final Review approval so it can be reviewed again." : pendingPayrollReview.mode === "payroll-change-final" ? `Confirm the payroll change scheduled for ${dateDisplay(pendingPayrollReview.employee.payrollChangeDate)}. Reason: ${pendingPayrollReview.employee.payrollChangeReason}` : "Confirm that the first payroll has been checked and this employee is ready for final payroll approval."}</p><label className="mt-4 flex items-start gap-2 text-sm font-semibold text-slate-700"><input checked={payrollReviewAcknowledged} className="mt-0.5 h-4 w-4" onChange={(event) => setPayrollReviewAcknowledged(event.target.checked)} type="checkbox" />I reviewed the employee name and understand this action.</label></div>
            <div className="mt-6 flex justify-end gap-3"><button className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100" onClick={() => setPendingPayrollReview(null)} type="button">Cancel</button><button className={`rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 ${pendingPayrollReview.mode === "payroll-final-undo" ? "bg-red-700 hover:bg-red-800" : "bg-blue-700 hover:bg-blue-800"}`} disabled={!payrollReviewAcknowledged} onClick={async () => { const action = pendingPayrollReview.mode === "payroll-final-undo" ? "payroll-final-review-undo" : pendingPayrollReview.mode === "payroll-change-final" ? "payroll-change-final-review" : "payroll-final-review"; const success = await completeCheck(pendingPayrollReview.employee, action); if (success) setPendingPayrollReview(null); }} type="button">{pendingPayrollReview.mode === "payroll-final-undo" ? "Confirm Correction" : "Confirm Final Review"}</button></div>
          </section>
        </div>
      ) : null}

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
                    Pay Type <span className="text-red-600">*</span>
                  </span>
                  <select
                    className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm"
                    onChange={(event) =>
                      setRecord((current) => ({
                        ...current,
                        payRateType: event.target.value,
                      }))
                    }
                    required
                    value={record.payRateType}
                  >
                    <option value="">Select...</option>
                    <option value="Hourly Rate">Hourly Rate</option>
                    <option value="Annual Salary">Annual Salary</option>
                  </select>
                </label>
                <label className="block">
                  <span className="text-sm font-semibold text-slate-700">
                    Pay Rate <span className="text-red-600">*</span>
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
                      required
                      step="0.01"
                      type="number"
                      value={record.payRate}
                    />
                  </div>
                </label>
              </div>
              <div className={`rounded-xl border p-4 ${record.payRateChangePending ? "border-orange-300 bg-orange-50" : "border-slate-200 bg-slate-50"}`}>
                <label className="flex items-center gap-3 text-sm font-semibold text-slate-800">
                  <input checked={record.payRateChangePending} className="h-4 w-4" onChange={(event) => setRecord((current) => ({ ...current, payRateChangePending: event.target.checked }))} type="checkbox" />
                  Pending to Change
                </label>
                {record.payRateChangePending ? (
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <label className="block"><span className="text-sm font-semibold text-slate-700">Payroll Change Date</span><input className="mt-1.5 w-full rounded-lg border border-orange-200 bg-white px-3 py-2.5 text-sm" onChange={(event) => setRecord((current) => ({ ...current, payrollChangeDate: event.target.value }))} required type="date" value={record.payrollChangeDate} /></label>
                    <label className="block"><span className="text-sm font-semibold text-slate-700">Reason</span><input className="mt-1.5 w-full rounded-lg border border-orange-200 bg-white px-3 py-2.5 text-sm" onChange={(event) => setRecord((current) => ({ ...current, payrollChangeReason: event.target.value }))} placeholder="Reason for pending pay change" required type="text" value={record.payrollChangeReason} /></label>
                  </div>
                ) : null}
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
              <label className="block"><span className="text-sm font-semibold text-slate-700">First Payroll Date <span className="text-red-600">*</span></span><input className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm" onChange={(event) => setRecord((current) => ({ ...current, firstPayrollDate: event.target.value }))} required type="date" value={record.firstPayrollDate} /></label>
              <div className="grid gap-4 sm:grid-cols-2">
                {([[
                  "Insurance", "insuranceEffectiveDate", "insuranceNotApplicable", "insuranceApplicability",
                ], [
                  "401(k)", "retirementEffectiveDate", "retirementNotApplicable", "retirementApplicability",
                ]] as const).map(([label, dateField, notApplicableField, applicabilityField]) => {
                  const status = record[applicabilityField];
                  return <div className="rounded-xl border border-slate-200 p-4" key={label}><label className="block"><span className="text-sm font-semibold text-slate-700">{label} <span className="text-red-600">*</span></span><select className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm" onChange={(event) => setRecord((current) => ({ ...current, [applicabilityField]: event.target.value, [notApplicableField]: event.target.value === "not-applicable", [dateField]: event.target.value === "applicable" ? current[dateField] : "" }))} required value={status}><option value="">Select...</option><option value="applicable">Applicable</option><option value="not-applicable">Not Applicable</option></select></label>{status === "applicable" ? <label className="mt-3 block"><span className="text-sm font-semibold text-slate-700">{label} Effective Date <span className="text-red-600">*</span></span><input className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm" onChange={(event) => setRecord((current) => ({ ...current, [dateField]: event.target.value }))} required type="date" value={record[dateField]} /></label> : null}</div>;
                })}
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
                disabled={saving || (!onboardingDetailsComplete && !legacyDateCorrection)}
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
                  This File Tracker is permanently locked and cannot be
                  modified.
                </p>
              </div>
            ) : trackerSubmitted ? (
              <div className="mt-5 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
                <div className="font-semibold">Confirmed for final review</div>
                <p className="mt-1">
                  Waiting for the upper-level manager to review and lock this
                  record.
                </p>
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
                        responses: {
                          ...(current.responses || {}),
                          [field.id]: event.target.value,
                        },
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
              <span className="mb-2 block text-sm font-semibold text-slate-700">
                Admin Comments
              </span>
              <textarea
                className="min-h-24 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm disabled:bg-slate-100"
                disabled={trackerLocked}
                onChange={(event) =>
                  setTracker((current) => ({
                    ...current,
                    comments: event.target.value,
                  }))
                }
                placeholder="Add notes or follow-up details for this employee file..."
                value={String(tracker.comments || "")}
              />
              {tracker.comments ? (
                <span className="mt-2 block text-xs text-slate-500">
                  Last updated by {tracker.commentsBy || "an administrator before comment tracking was enabled"}
                  {tracker.commentsUpdatedAt ? ` on ${new Date(tracker.commentsUpdatedAt).toLocaleString()}` : ""}
                </span>
              ) : null}
            </label>
            {!trackerLocked && !trackerSubmitted ? (
              <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4">
                <h3 className="font-semibold text-amber-950">
                  Confirm for Final Review
                </h3>
                <p className="mt-1 text-sm text-amber-800">
                  Confirm that the checklist is ready for upper-level management
                  review. Only the authorized upper-level manager can
                  permanently lock it.
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
              {!trackerLocked &&
              trackerSubmitted &&
              currentUserEmail === "myu@royaltrailersales.com" ? (
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
              {!trackerLocked && trackerSubmitted ? (
                <button
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                  disabled={savingTracker}
                  onClick={() => saveFileTracker("comment")}
                  type="button"
                >
                  <Save className="h-4 w-4" />
                  Save Comment
                </button>
              ) : null}
            </div>
          </section>
        </div>
      ) : null}

      {showStatusReview ? (
        <div
          aria-modal="true"
          className="fixed inset-0 z-50 grid place-items-center bg-slate-950/60 p-4"
          role="dialog"
        >
          <section className="max-h-[92vh] w-full max-w-4xl overflow-auto rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-slate-950">
                  New Hire File Tracker Status
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Review the current File Tracker stage for every new hire.
                </p>
              </div>
              <button
                aria-label="Close File Tracker Status"
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
                onClick={() => setShowStatusReview(false)}
                type="button"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              {[
                [
                  "Draft",
                  employees.filter(
                    (employee) =>
                      !employee.fileTracker?.submittedAt &&
                      !employee.fileTracker?.finalLockedAt &&
                      !employee.fileTracker?.confirmedAt,
                  ).length,
                  "bg-amber-50 text-amber-800",
                ],
                [
                  "Confirmed for Review",
                  employees.filter(
                    (employee) =>
                      employee.fileTracker?.submittedAt &&
                      !employee.fileTracker?.finalLockedAt &&
                      !employee.fileTracker?.confirmedAt,
                  ).length,
                  "bg-blue-50 text-blue-800",
                ],
                [
                  "Locked",
                  employees.filter(
                    (employee) =>
                      employee.fileTracker?.finalLockedAt ||
                      employee.fileTracker?.confirmedAt,
                  ).length,
                  "bg-emerald-50 text-emerald-800",
                ],
              ].map(([label, count, tone]) => (
                <div className={`rounded-xl p-4 ${tone}`} key={String(label)}>
                  <div className="text-2xl font-semibold">{count}</div>
                  <div className="mt-1 text-sm font-semibold">{label}</div>
                </div>
              ))}
            </div>
            <div className="mt-5 overflow-auto rounded-xl border border-slate-200">
              <table className="w-full min-w-[900px] text-sm">
                <thead className="bg-slate-100 text-left text-xs uppercase text-slate-600">
                  <tr>
                    <th className="px-4 py-3">Employee</th>
                    <th className="px-4 py-3">File / Checklist Item</th>
                    <th className="px-4 py-3">Completion Status</th>
                    <th className="px-4 py-3">Tracker Stage</th>
                    <th className="px-4 py-3">Admin Comments</th>
                  </tr>
                </thead>
                <tbody>
                  {employees.flatMap((employee) => {
                    const locked =
                      employee.fileTracker?.finalLockedAt ||
                      employee.fileTracker?.confirmedAt;
                    const stage = locked
                      ? "Locked"
                      : employee.fileTracker?.submittedAt
                        ? "Confirmed for Review"
                        : "Draft";
                    const fields: FileTrackerField[] = employee.fileTracker?.fieldsSnapshot || [];
                    return fields.map((field) => (
                      <tr key={`${employee.id}:${field.id}`}>
                        <td className="border-t border-slate-100 px-4 py-3 font-semibold text-slate-900">
                          {employee.name}
                        </td>
                        <td className="border-t border-slate-100 px-4 py-3">
                          {field.label}
                        </td>
                        <td className="border-t border-slate-100 px-4 py-3">
                          {employee.fileTracker?.responses?.[field.id] || <span className="font-semibold text-amber-700">Missing</span>}
                        </td>
                        <td className="border-t border-slate-100 px-4 py-3">
                          {stage}
                        </td>
                        <td className="border-t border-slate-100 px-4 py-3">
                          <div>{display(String(employee.fileTracker?.comments || ""))}</div>
                          {employee.fileTracker?.comments ? (
                            <div className="mt-1 text-xs text-slate-500">
                              By {employee.fileTracker?.commentsBy || "administrator (legacy record)"}
                              {employee.fileTracker?.commentsUpdatedAt ? ` 繚 ${new Date(employee.fileTracker.commentsUpdatedAt).toLocaleString()}` : ""}
                            </div>
                          ) : null}
                        </td>
                      </tr>
                    ));
                  })}
                </tbody>
              </table>
            </div>
            <div className="mt-5 flex flex-wrap justify-end gap-3">
              <a className="inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800" href="/api/hr-platform/new-hires/reports/file-tracker.xlsx">
                <Download className="h-4 w-4" />
                Download Historical Excel
              </a>
              <button
                className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100"
                onClick={() => setShowStatusReview(false)}
                type="button"
              >
                Close
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {showTrackerManager ? (
        <div
          aria-modal="true"
          className="fixed inset-0 z-50 grid place-items-center bg-slate-950/60 p-4"
          role="dialog"
        >
          <section className="max-h-[92vh] w-full max-w-3xl overflow-auto rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-slate-950">
                  Employee File Checklist Manager
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Changes apply only to future new hires. Existing File Trackers
                  keep their original checklist version.
                </p>
              </div>
              <button
                aria-label="Close Checklist Manager"
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
                onClick={() => setShowTrackerManager(false)}
                type="button"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="mt-5 space-y-3">
              {trackerFields.map((field) => (
                <div
                  className={`grid gap-2 rounded-lg border p-3 sm:grid-cols-[1fr_1.2fr_auto_auto] ${field.active ? "border-slate-200" : "border-slate-200 bg-slate-50 opacity-70"}`}
                  key={field.id}
                >
                  <input
                    aria-label={`${field.label} name`}
                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    onChange={(event) =>
                      setTrackerFields((current) =>
                        current.map((item) =>
                          item.id === field.id
                            ? { ...item, label: event.target.value }
                            : item,
                        ),
                      )
                    }
                    value={field.label}
                  />
                  <input
                    aria-label={`${field.label} options`}
                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    onChange={(event) =>
                      setTrackerFields((current) =>
                        current.map((item) =>
                          item.id === field.id
                            ? {
                                ...item,
                                options: event.target.value
                                  .split(",")
                                  .map((value) => value.trim())
                                  .filter(Boolean),
                              }
                            : item,
                        ),
                      )
                    }
                    value={field.options.join(", ")}
                  />
                  <label className="flex items-center gap-2 whitespace-nowrap text-sm font-semibold text-slate-600">
                    <input
                      checked={field.active}
                      onChange={(event) =>
                        setTrackerFields((current) =>
                          current.map((item) =>
                            item.id === field.id
                              ? { ...item, active: event.target.checked }
                              : item,
                          ),
                        )
                      }
                      type="checkbox"
                    />
                    Active
                  </label>
                  <button className="rounded-lg border border-red-200 px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-50" onClick={() => { setDeletedTrackerFields((current) => [...current, field]); setTrackerFields((current) => current.filter((item) => item.id !== field.id)); }} type="button">Delete</button>
                </div>
              ))}
            </div>
            {deletedTrackerFields.length ? <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4"><h3 className="text-sm font-semibold text-red-900">Pending Deletion</h3><div className="mt-2 space-y-2">{deletedTrackerFields.map((field) => <div className="flex items-center justify-between gap-3 rounded-lg bg-white px-3 py-2 text-sm" key={field.id}><span className="font-semibold text-slate-800">{field.label}</span><button className="font-semibold text-blue-700 hover:underline" onClick={() => { setTrackerFields((current) => [...current, field].sort((a, b) => a.order - b.order)); setDeletedTrackerFields((current) => current.filter((item) => item.id !== field.id)); }} type="button">Undo Delete</button></div>)}</div></div> : null}
            <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
              <h3 className="text-sm font-semibold text-emerald-950">
                Add Checklist Item
              </h3>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <input
                  className="rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm"
                  onChange={(event) => setNewTrackerLabel(event.target.value)}
                  placeholder="Checklist item name"
                  value={newTrackerLabel}
                />
                <input
                  className="rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm"
                  onChange={(event) => setNewTrackerOptions(event.target.value)}
                  placeholder="Options separated by commas"
                  value={newTrackerOptions}
                />
              </div>
            </div>
            {managerError ? (
              <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">
                {managerError}
              </p>
            ) : null}
            <div className="mt-5 flex justify-end gap-3">
              <button
                className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100"
                onClick={() => setShowTrackerManager(false)}
                type="button"
              >
                Close
              </button>
              <button className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800" onClick={() => { setShowCatalogConfirmation(true); setCatalogChangeAcknowledged(false); }} type="button">Review Changes & Confirm</button>
            </div>
          </section>
        </div>
      ) : null}

      {showCatalogConfirmation ? (
        <div aria-modal="true" className="fixed inset-0 z-[60] grid place-items-center bg-slate-950/70 p-4" role="dialog">
          <section className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4"><div><h2 className="text-xl font-semibold text-slate-950">Review Checklist Changes</h2><p className="mt-1 text-sm text-slate-500">Review the complete checklist before saving. Changes apply only to future employee File Trackers.</p></div><button aria-label="Close Checklist Confirmation" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" onClick={() => setShowCatalogConfirmation(false)} type="button"><X className="h-5 w-5" /></button></div>
            <div className="mt-5 max-h-72 space-y-2 overflow-auto rounded-xl border border-slate-200 bg-slate-50 p-3">{trackerFields.map((field) => <div className="rounded-lg bg-white px-3 py-2 text-sm" key={field.id}><span className="font-semibold text-slate-900">{field.label}</span><span className="ml-2 text-slate-500">{field.active ? "Active" : "Inactive"} 繚 {field.options.join(", ")}</span></div>)}{newTrackerLabel.trim() ? <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm"><span className="font-semibold text-emerald-900">New: {newTrackerLabel}</span><span className="ml-2 text-emerald-700">{newTrackerOptions}</span></div> : null}{deletedTrackerFields.map((field) => <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm" key={`deleted:${field.id}`}><span className="font-semibold text-red-900">Delete: {field.label}</span><span className="ml-2 text-red-700">Future checklists only</span></div>)}</div>
            <label className="mt-4 flex items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm font-semibold text-slate-700"><input checked={catalogChangeAcknowledged} className="mt-0.5 h-4 w-4" onChange={(event) => setCatalogChangeAcknowledged(event.target.checked)} type="checkbox" />I reviewed all checklist items and confirm these future changes are correct.</label>
            <div className="mt-6 flex justify-end gap-3"><button className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100" onClick={() => setShowCatalogConfirmation(false)} type="button">Back to Edit</button><button className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-50" disabled={!catalogChangeAcknowledged} onClick={saveAllTrackerChanges} type="button">Confirm & Save All Changes</button></div>
          </section>
        </div>
      ) : null}
    </div>
  );
}

