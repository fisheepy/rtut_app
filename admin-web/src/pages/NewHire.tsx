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
const display = (value: string) => value || "--";
const dateDisplay = (value: string) => {
  if (!value) return "--";
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

  const hireDateRangeActive = Boolean(filters.hireDateFrom || filters.hireDateTo);
  const mainEmployees = filteredEmployees
    .filter(
      (employee) =>
        hireDateRangeActive ||
        !(
          (employee.fileTracker?.finalLockedAt ||
            employee.fileTracker?.confirmedAt) &&
          employee.payrollFinalReviewedAt &&
          !employee.payRateChangePending &&
          !isCurrentMonth(employee.payrollFinalReviewedAt) &&
          !isCurrentHireMonth(employee.hireDate)
        ),
    )
    .sort(
      (left, right) =>
        payrollSequenceDate(left).localeCompare(payrollSequenceDate(right)) ||
        left.name.localeCompare(right.name),
    );
  const statusTableEmployees = hireDateRangeActive ? filteredEmployees : employees;
  const insuranceEmployees = [...statusTableEmployees]
    .filter((employee) => employee.insuranceEffectiveDate && (hireDateRangeActive || !employee.insuranceCheckedAt))
    .sort(
      (left, right) =>
        left.insuranceEffectiveDate.localeCompare(right.insuranceEffectiveDate) || left.name.localeCompare(right.name),
    );
  const retirementEmployees = [...statusTableEmployees]
    .filter((employee) => employee.retirementEffectiveDate && (hireDateRangeActive || !employee.retirementCheckedAt))
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

  function payrollSequenceDate(employee: NewHireEmployee) {
    const dates = [
      !employee.payrollFinalReviewedAt ? employee.firstPayrollDate : "",
      employee.payRateChangePending ? employee.payrollChangeDate : "",
    ].filter(Boolean);
    if (dates.length) return dates.sort()[0];
    return employee.firstPayrollDate || "9999-12-31";
  }

  function isCurrentMonth(value: string | null) {
    if (!value) return false;
    const date = new Date(value);
    const now = new Date();
    return !Number.isNaN(date.getTime()) && date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
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
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${locked ? "bg-emerald-100 text-emerald-800" : employee.fileTracker?.submittedAt ? "bg-blue-100 …11524 tokens truncated…  <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4">
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
                              {employee.fileTracker?.commentsUpdatedAt ? ` - ${new Date(employee.fileTracker.commentsUpdatedAt).toLocaleString()}` : ""}
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
            <div className="mt-5 max-h-72 space-y-2 overflow-auto rounded-xl border border-slate-200 bg-slate-50 p-3">{trackerFields.map((field) => <div className="rounded-lg bg-white px-3 py-2 text-sm" key={field.id}><span className="font-semibold text-slate-900">{field.label}</span><span className="ml-2 text-slate-500">{field.active ? "Active" : "Inactive"} - {field.options.join(", ")}</span></div>)}{newTrackerLabel.trim() ? <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm"><span className="font-semibold text-emerald-900">New: {newTrackerLabel}</span><span className="ml-2 text-emerald-700">{newTrackerOptions}</span></div> : null}{deletedTrackerFields.map((field) => <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm" key={`deleted:${field.id}`}><span className="font-semibold text-red-900">Delete: {field.label}</span><span className="ml-2 text-red-700">Future checklists only</span></div>)}</div>
            <label className="mt-4 flex items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm font-semibold text-slate-700"><input checked={catalogChangeAcknowledged} className="mt-0.5 h-4 w-4" onChange={(event) => setCatalogChangeAcknowledged(event.target.checked)} type="checkbox" />I reviewed all checklist items and confirm these future changes are correct.</label>
            <div className="mt-6 flex justify-end gap-3"><button className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100" onClick={() => setShowCatalogConfirmation(false)} type="button">Back to Edit</button><button className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-50" disabled={!catalogChangeAcknowledged} onClick={saveAllTrackerChanges} type="button">Confirm & Save All Changes</button></div>
          </section>
        </div>
      ) : null}
    </div>
  );
}

