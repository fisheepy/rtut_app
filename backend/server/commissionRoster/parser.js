const path = require('path');
const XLSX = require('xlsx');

const SUFFIX_TOKENS = new Set(['jr', 'sr', 'ii', 'iii', 'iv', 'v']);
const FIRST_NAME_ALIASES = {
  anthony: ['tony'],
  tony: ['anthony'],
  daniel: ['dan'],
  dan: ['daniel'],
  david: ['dave'],
  dave: ['david'],
  james: ['jim', 'jimmy'],
  jim: ['james'],
  jimmy: ['james'],
  william: ['bill', 'billy'],
  bill: ['william'],
  robert: ['bob', 'bobby', 'rob'],
  bob: ['robert'],
  michael: ['mike'],
  mike: ['michael'],
  christopher: ['chris'],
  chris: ['christopher'],
  charles: ['charlie', 'chuck'],
  charlie: ['charles'],
  nicholas: ['nick', 'nicolas'],
  nicolas: ['nicholas', 'nick'],
  nick: ['nicholas', 'nicolas'],
  johnathan: ['jonathan', 'john'],
  jonathan: ['johnathan', 'john'],
  matthew: ['matt'],
  matt: ['matthew'],
  steven: ['steve'],
  steve: ['steven'],
};

const LOCATION_NAMES = {
  AGR: 'Grand Rapids',
  DBN: 'Dearborn',
  GAY: 'Gaylord',
  HUD: 'Hudsonville',
  WAR: 'Warren',
  WIX: 'Wixom',
  COR: 'Corporate',
  EM: 'Equipment',
};

function cellText(value) {
  if (value === null || value === undefined) return '';
  return String(value).replace(/\r/g, '').trim();
}

function normalizeSpaces(value) {
  return cellText(value).replace(/\s+/g, ' ').trim();
}

function parseMoney(value) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number' && Number.isFinite(value)) return value;

  const raw = String(value).trim();
  const isNegative = /^\(.*\)$/.test(raw) || raw.includes('-');
  const cleaned = raw.replace(/[^0-9.]/g, '');
  if (!cleaned) return null;

  const parsed = Number.parseFloat(cleaned);
  if (!Number.isFinite(parsed)) return null;
  return isNegative ? -parsed : parsed;
}

function roundMoney(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

function readWorkbook(filePath) {
  return XLSX.readFile(filePath, { cellDates: true });
}

function normalizeToken(value) {
  return cellText(value)
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function nameTokens(value) {
  return normalizeToken(value)
    .split(' ')
    .filter(Boolean)
    .filter((token) => !SUFFIX_TOKENS.has(token));
}

function parseRosterName(value) {
  const text = normalizeSpaces(value);
  if (!text) return { displayName: '', firstName: '', lastName: '', normalizedName: '', canonicalKey: '' };

  const [lastPart, firstPart = ''] = text.split(',').map((part) => normalizeSpaces(part));
  const firstTokens = nameTokens(firstPart);
  const lastTokens = nameTokens(lastPart);
  const firstName = firstTokens[0] || '';
  const lastName = lastTokens[0] || '';
  const displayName = [firstPart, lastPart].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim() || text;

  return {
    displayName,
    firstName,
    lastName,
    normalizedName: normalizeToken(displayName),
    canonicalKey: [firstName, lastName].filter(Boolean).join(' '),
  };
}

function parseReportName(value) {
  const raw = normalizeSpaces(value);
  const reportFlagged = /^\*+/.test(raw);
  const stripped = raw.replace(/^\*+/, '').trim();
  const tokens = nameTokens(stripped);
  const firstName = tokens[0] || '';
  const lastName = tokens.length > 1 ? tokens[tokens.length - 1] : '';

  return {
    rawName: raw,
    displayName: stripped.replace(/\s+/g, ' ').trim(),
    firstName,
    lastName,
    normalizedName: normalizeToken(stripped),
    canonicalKey: [firstName, lastName].filter(Boolean).join(' '),
    reportFlagged,
  };
}

function levenshtein(a, b) {
  if (a === b) return 0;
  if (!a) return b.length;
  if (!b) return a.length;

  const previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  const current = Array(b.length + 1);

  for (let i = 1; i <= a.length; i += 1) {
    current[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      current[j] = Math.min(current[j - 1] + 1, previous[j] + 1, previous[j - 1] + cost);
    }
    for (let j = 0; j <= b.length; j += 1) previous[j] = current[j];
  }

  return previous[b.length];
}

function namesCompatible(a, b) {
  if (!a || !b) return false;
  return a === b || FIRST_NAME_ALIASES[a]?.includes(b) || FIRST_NAME_ALIASES[b]?.includes(a);
}

function locationText(row) {
  return normalizeToken([
    row.location,
    LOCATION_NAMES[row.locationCode],
    row.department,
  ].filter(Boolean).join(' '));
}

function scoreMatch(reportRow, rosterRow) {
  let score = 0;
  const sameLast = reportRow.lastName && rosterRow.lastName && reportRow.lastName === rosterRow.lastName;
  const lastDistance = levenshtein(reportRow.lastName, rosterRow.lastName);
  const firstCompatible = namesCompatible(reportRow.firstName, rosterRow.firstName);
  const fullDistance = levenshtein(reportRow.canonicalKey, rosterRow.canonicalKey);

  if (reportRow.canonicalKey && reportRow.canonicalKey === rosterRow.canonicalKey) score = 100;
  else if (sameLast && firstCompatible) score = 96;
  else if (lastDistance <= 1 && firstCompatible) score = 92;
  else if (sameLast && reportRow.firstName[0] && reportRow.firstName[0] === rosterRow.firstName[0]) score = 86;
  else if (fullDistance <= 2) score = 84;
  else {
    const maxLength = Math.max(reportRow.canonicalKey.length, rosterRow.canonicalKey.length, 1);
    const similarity = 1 - fullDistance / maxLength;
    if (similarity >= 0.88) score = Math.round(similarity * 90);
  }

  if (score > 0) {
    const reportLocation = normalizeToken(reportRow.location);
    if (reportLocation && locationText(rosterRow).includes(reportLocation)) score += 2;
    if (rosterRow.positionStatus.toLowerCase() === 'active') score += 1;
  }

  return Math.min(score, 100);
}

function readRows(filePath) {
  const workbook = readWorkbook(filePath);
  const sheetName = workbook.SheetNames[0];
  return {
    sheetName,
    rows: XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: null, raw: false, blankrows: false }),
    matrix: XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1, defval: null, raw: false, blankrows: false }),
  };
}

function parseRoster(filePath) {
  const { sheetName, rows } = readRows(filePath);
  const normalizedRows = rows.map((row, index) => {
    const parsedName = parseRosterName(row['Payroll Name']);
    return {
      sourceRow: index + 2,
      positionStatus: normalizeSpaces(row['Position Status']),
      payrollName: normalizeSpaces(row['Payroll Name']),
      rosterDisplayName: parsedName.displayName,
      firstName: parsedName.firstName,
      lastName: parsedName.lastName,
      normalizedName: parsedName.normalizedName,
      canonicalKey: parsedName.canonicalKey,
      locationCode: normalizeSpaces(row['Location Code']),
      location: LOCATION_NAMES[normalizeSpaces(row['Location Code'])] || '',
      department: normalizeSpaces(row['Home Department Description']),
      basisOfPay: normalizeSpaces(row['Basis of Pay']),
      reportsToName: normalizeSpaces(row['Reports To Name']),
    };
  }).filter((row) => row.payrollName);

  const keyCounts = normalizedRows.reduce((acc, row) => {
    acc[row.canonicalKey] = (acc[row.canonicalKey] || 0) + 1;
    return acc;
  }, {});
  const activeKeyCounts = normalizedRows.reduce((acc, row) => {
    if (row.positionStatus.toLowerCase() === 'active') {
      acc[row.canonicalKey] = (acc[row.canonicalKey] || 0) + 1;
    }
    return acc;
  }, {});

  normalizedRows.forEach((row) => {
    row.duplicateRosterName = keyCounts[row.canonicalKey] > 1;
    row.duplicateActiveRosterName = activeKeyCounts[row.canonicalKey] > 1;
  });

  return { sheetName, rows: normalizedRows };
}

function parseQuarterlyReport(filePath) {
  const { sheetName, matrix } = readRows(filePath);
  const reportRows = [];
  const exceptions = [];

  matrix.forEach((row, index) => {
    const sourceRow = index + 1;
    const rawName = normalizeSpaces(row[0]);
    const location = normalizeSpaces(row[1]);
    const commission = parseMoney(row[2]);
    const rowText = row.map(cellText).join(' ').trim();

    if (!rowText) return;
    if (/entered into adp/i.test(rowText) || /^total:?$/i.test(rawName) || /^https?:\/\//i.test(rawName)) return;

    if (!rawName) {
      exceptions.push({
        type: 'Blank Report Name',
        name: '',
        source: `Quarterly row ${sourceRow}`,
        details: `Row has location "${location}" and commission ${commission === null ? 'blank' : commission}, but no employee name.`,
        action: 'Review quarterly report row; add employee name or remove placeholder row.',
      });
      return;
    }

    const parsedName = parseReportName(rawName);
    reportRows.push({
      sourceRow,
      ...parsedName,
      location,
      commission: commission === null ? null : roundMoney(commission),
      rawCommission: row[2],
    });
  });

  return { sheetName, rows: reportRows, exceptions };
}

function selectRosterMatch(reportRow, rosterRows) {
  const candidates = rosterRows
    .map((rosterRow) => ({ rosterRow, score: scoreMatch(reportRow, rosterRow) }))
    .filter((candidate) => candidate.score >= 82)
    .sort((a, b) => b.score - a.score);

  if (!candidates.length) {
    return { status: 'Missing in Roster', candidates: [] };
  }

  const topScore = candidates[0].score;
  const closeCandidates = candidates.filter((candidate) => topScore - candidate.score <= 3);
  const uniqueKeys = new Set(closeCandidates.map((candidate) => [
    candidate.rosterRow.canonicalKey,
    candidate.rosterRow.positionStatus,
    candidate.rosterRow.locationCode,
    candidate.rosterRow.department,
  ].join('|')));

  if (uniqueKeys.size > 1) {
    const activeClose = closeCandidates.filter((candidate) => candidate.rosterRow.positionStatus.toLowerCase() === 'active');
    if (activeClose.length === 1 && activeClose[0].score >= topScore - 1) {
      return { status: 'Matched', match: activeClose[0].rosterRow, score: activeClose[0].score, candidates };
    }

    return { status: 'Ambiguous Roster Match', match: candidates[0].rosterRow, score: topScore, candidates: closeCandidates };
  }

  return { status: 'Matched', match: candidates[0].rosterRow, score: topScore, candidates };
}

function statusFor(reportRow, matchResult) {
  if (matchResult.status !== 'Matched') return matchResult.status;
  const rosterRow = matchResult.match;
  const rosterTerminated = rosterRow.positionStatus.toLowerCase() !== 'active';

  if (reportRow.reportFlagged && rosterTerminated) return 'Report Flagged Departed';
  if (reportRow.reportFlagged) return 'Report Flagged - Roster Active';
  if (rosterTerminated && (reportRow.commission || 0) !== 0) return 'Terminated in Roster With Commission';
  if (rosterTerminated) return 'Terminated in Roster';
  return 'Matched';
}

function actionFor(status, reportRow, rosterRow) {
  switch (status) {
    case 'Matched':
      return rosterRow?.duplicateRosterName ? 'Matched, but roster has duplicate rows for this name; verify duplicates are intentional.' : 'No update needed.';
    case 'Report Flagged Departed':
      return 'Report is marked with ** and roster is not active; verify final commission handling and no reactivation is needed.';
    case 'Report Flagged - Roster Active':
      return 'Report is marked with ** but roster is active; verify whether roster should be updated to terminated or marker should be removed.';
    case 'Terminated in Roster With Commission':
      return 'Roster shows terminated but quarterly report has commission; verify final payout and employee status.';
    case 'Terminated in Roster':
      return 'Roster shows terminated; verify whether zero commission row should remain in report.';
    case 'Missing in Roster':
      return 'Add or update roster record, or correct the quarterly report spelling/name.';
    case 'Ambiguous Roster Match':
      return 'Multiple roster records look plausible; manually choose the correct employee before updating.';
    default:
      return reportRow.reportFlagged ? 'Review report-side ** marker.' : 'Review row.';
  }
}

function buildRosterCommissionOutputs({ rosterRows, mapping, quarterlyExceptions, activeServiceRosterOnly, duplicateExceptionRows }) {
  const outputByRosterRow = new Map();
  const reviewRows = [];
  const mappedRosterRows = new Set();

  mapping.forEach((row) => {
    if (row.rosterRow) mappedRosterRows.add(row.rosterRow);

    const hasCommission = (row.reportCommission || 0) !== 0;
    const hasError = row.status !== 'Matched';
    const isDefinitiveRosterMatch = Boolean(row.rosterRow) && row.status !== 'Missing in Roster' && row.status !== 'Ambiguous Roster Match';

    if (isDefinitiveRosterMatch && hasCommission) {
      const existing = outputByRosterRow.get(row.rosterRow);
      const combinedCommission = roundMoney((existing?.commission || 0) + (row.reportCommission || 0));
      const combinedError = [existing?.error, hasError ? row.status : ''].filter(Boolean).join('; ');
      const combinedAction = [existing?.recommendedAction, hasError ? row.action : ''].filter(Boolean).join('; ');
      const combinedReportRows = [existing?.reportRows, row.reportRow].filter(Boolean).join(', ');

      outputByRosterRow.set(row.rosterRow, {
        positionStatus: row.rosterStatus,
        payrollName: row.rosterName,
        locationCode: row.rosterLocationCode,
        homeDepartmentDescription: row.rosterDepartment,
        basisOfPay: row.rosterBasisOfPay,
        reportsToName: row.rosterReportsTo,
        commission: combinedCommission,
        error: combinedError,
        recommendedAction: combinedAction || 'Ready to update.',
        reportName: [existing?.reportName, row.reportName].filter(Boolean).join('; '),
        reportMarkedDeparted: [existing?.reportMarkedDeparted, row.reportMarkedDeparted === 'Yes' ? 'Yes' : ''].filter(Boolean).join('; ') || 'No',
        reportRows: combinedReportRows,
        rosterRow: row.rosterRow,
        matchScore: row.matchScore,
      });
    }

    if (hasError || !hasCommission) {
      reviewRows.push({
        reviewType: hasError ? 'Error / Needs Review' : 'Removed - No Commission',
        status: hasError ? row.status : 'No Commission',
        reason: hasError ? row.action : 'Matched to roster, but quarterly report commission is blank or zero, so this employee was removed from the final roster output.',
        reportName: row.reportName,
        reportRawName: row.reportRawName,
        reportMarkedDeparted: row.reportMarkedDeparted,
        reportLocation: row.reportLocation,
        reportCommission: row.reportCommission,
        reportRow: row.reportRow,
        rosterName: row.rosterName,
        rosterStatus: row.rosterStatus,
        rosterLocationCode: row.rosterLocationCode,
        rosterDepartment: row.rosterDepartment,
        rosterReportsTo: row.rosterReportsTo,
        rosterRow: row.rosterRow,
        matchCandidates: row.matchCandidates,
        notes: row.notes,
      });
    }
  });

  activeServiceRosterOnly.forEach((row) => {
    reviewRows.push({
      reviewType: 'Removed - Not In Quarterly Report',
      status: 'No Commission',
      reason: 'Roster employee was not matched to a quarterly report commission row, so this employee was removed from the final roster output.',
      reportName: '',
      reportRawName: '',
      reportMarkedDeparted: 'No',
      reportLocation: '',
      reportCommission: null,
      reportRow: '',
      rosterName: row.payrollName,
      rosterStatus: row.positionStatus,
      rosterLocationCode: row.locationCode,
      rosterDepartment: row.department,
      rosterReportsTo: row.reportsToName,
      rosterRow: row.sourceRow,
      matchCandidates: '',
      notes: row.note,
    });
  });

  quarterlyExceptions.forEach((exception) => {
    reviewRows.push({
      reviewType: 'Error / Needs Review',
      status: exception.type,
      reason: exception.action,
      reportName: exception.name,
      reportRawName: '',
      reportMarkedDeparted: '',
      reportLocation: '',
      reportCommission: null,
      reportRow: exception.source,
      rosterName: '',
      rosterStatus: '',
      rosterLocationCode: '',
      rosterDepartment: '',
      rosterReportsTo: '',
      rosterRow: '',
      matchCandidates: '',
      notes: exception.details,
    });
  });

  duplicateExceptionRows.forEach((row) => {
    reviewRows.push({
      reviewType: 'Error / Needs Review',
      status: 'Duplicate Roster Name',
      reason: row.duplicateActiveRosterName
        ? 'Roster contains more than one active row with the same normalized employee name.'
        : 'This employee also has historical duplicate roster rows.',
      reportName: '',
      reportRawName: '',
      reportMarkedDeparted: '',
      reportLocation: '',
      reportCommission: null,
      reportRow: '',
      rosterName: row.payrollName,
      rosterStatus: row.positionStatus,
      rosterLocationCode: row.locationCode,
      rosterDepartment: row.department,
      rosterReportsTo: row.reportsToName,
      rosterRow: row.sourceRow,
      matchCandidates: '',
      notes: 'Verify duplicate roster rows are expected; remove stale duplicates if needed.',
    });
  });


  rosterRows
    .filter((row) => !mappedRosterRows.has(row.sourceRow))
    .filter((row) => !activeServiceRosterOnly.some((activeOnly) => activeOnly.sourceRow === row.sourceRow))
    .forEach((row) => {
      reviewRows.push({
        reviewType: 'Removed - Not In Quarterly Report',
        status: 'No Commission',
        reason: 'Roster employee was not matched to a quarterly report commission row, so this employee was removed from the final roster output.',
        reportName: '',
        reportRawName: '',
        reportMarkedDeparted: 'No',
        reportLocation: '',
        reportCommission: null,
        reportRow: '',
        rosterName: row.payrollName,
        rosterStatus: row.positionStatus,
        rosterLocationCode: row.locationCode,
        rosterDepartment: row.department,
        rosterReportsTo: row.reportsToName,
        rosterRow: row.sourceRow,
        matchCandidates: '',
        notes: '',
      });
    });

  const rosterCommissionRows = Array.from(outputByRosterRow.values())
    .sort((a, b) => a.payrollName.localeCompare(b.payrollName));

  reviewRows.sort((a, b) => {
    const typeSort = a.reviewType.localeCompare(b.reviewType);
    if (typeSort) return typeSort;
    return String(a.rosterName || a.reportName).localeCompare(String(b.rosterName || b.reportName));
  });

  return { rosterCommissionRows, reviewRows };
}

function compareCommissionRosterFiles({ rosterFilePath, quarterlyReportFilePath }) {
  const roster = parseRoster(rosterFilePath);
  const quarterly = parseQuarterlyReport(quarterlyReportFilePath);
  const matchedRosterRows = new Set();
  const mapping = [];
  const exceptions = [...quarterly.exceptions];

  quarterly.rows.forEach((reportRow) => {
    const matchResult = selectRosterMatch(reportRow, roster.rows);
    const rosterRow = matchResult.match || null;
    const status = statusFor(reportRow, matchResult);
    if (rosterRow) matchedRosterRows.add(rosterRow.sourceRow);

    const candidateText = (matchResult.candidates || [])
      .slice(0, 5)
      .map((candidate) => `${candidate.rosterRow.payrollName} (${candidate.rosterRow.positionStatus}, row ${candidate.rosterRow.sourceRow}, score ${candidate.score})`)
      .join('; ');

    const notes = [
      reportRow.reportFlagged ? 'Quarterly report name starts with **; treated as a report-side departure/special-status marker.' : '',
      rosterRow?.duplicateRosterName ? 'Roster contains duplicate rows for this matched name.' : '',
      status === 'Ambiguous Roster Match' ? `Close candidates: ${candidateText}` : '',
    ].filter(Boolean).join(' ');

    mapping.push({
      status,
      action: actionFor(status, reportRow, rosterRow),
      reportName: reportRow.displayName,
      reportRawName: reportRow.rawName,
      reportMarkedDeparted: reportRow.reportFlagged ? 'Yes' : 'No',
      reportLocation: reportRow.location,
      reportCommission: reportRow.commission,
      reportRow: reportRow.sourceRow,
      rosterName: rosterRow?.payrollName || '',
      rosterDisplayName: rosterRow?.rosterDisplayName || '',
      rosterStatus: rosterRow?.positionStatus || '',
      rosterLocationCode: rosterRow?.locationCode || '',
      rosterLocation: rosterRow?.location || '',
      rosterDepartment: rosterRow?.department || '',
      rosterBasisOfPay: rosterRow?.basisOfPay || '',
      rosterReportsTo: rosterRow?.reportsToName || '',
      rosterRow: rosterRow?.sourceRow || '',
      matchScore: matchResult.score || null,
      matchCandidates: candidateText,
      notes,
    });
  });

  const activeServiceRosterOnly = roster.rows
    .filter((row) => !matchedRosterRows.has(row.sourceRow))
    .filter((row) => row.positionStatus.toLowerCase() === 'active')
    .filter((row) => /service/i.test(row.department))
    .map((row) => ({
      payrollName: row.payrollName,
      rosterDisplayName: row.rosterDisplayName,
      positionStatus: row.positionStatus,
      locationCode: row.locationCode,
      location: row.location,
      department: row.department,
      basisOfPay: row.basisOfPay,
      reportsToName: row.reportsToName,
      sourceRow: row.sourceRow,
      note: 'Active service roster employee did not appear in the quarterly report. This may be normal, but review if they should receive commission.',
    }));

  mapping.filter((row) => row.status !== 'Matched').forEach((row) => {
    exceptions.push({
      type: row.status,
      name: row.reportName || row.rosterName,
      source: `Quarterly row ${row.reportRow}`,
      details: row.notes || row.action,
      action: row.action,
    });
  });

  const matchedDuplicateRosterRows = roster.rows.filter((row) => matchedRosterRows.has(row.sourceRow) && row.duplicateRosterName);
  const activeDuplicateRosterRows = roster.rows.filter((row) => row.duplicateActiveRosterName);
  const duplicateExceptionRows = [...new Map([...matchedDuplicateRosterRows, ...activeDuplicateRosterRows]
    .map((row) => [row.sourceRow, row])).values()];

  duplicateExceptionRows.forEach((row) => {
    exceptions.push({
      type: 'Duplicate Roster Name',
      name: row.payrollName,
      source: `Roster row ${row.sourceRow}`,
      details: row.duplicateActiveRosterName
        ? 'Roster contains more than one active row with the same normalized employee name.'
        : 'This matched employee also has historical duplicate roster rows.',
      action: 'Verify duplicate roster rows are expected; remove stale duplicates if needed.',
    });
  });

  const issueRows = mapping.filter((row) => row.status !== 'Matched');
  const { rosterCommissionRows, reviewRows } = buildRosterCommissionOutputs({
    rosterRows: roster.rows,
    mapping,
    quarterlyExceptions: quarterly.exceptions,
    activeServiceRosterOnly,
    duplicateExceptionRows,
  });
  const summary = {
    rosterEmployees: roster.rows.length,
    quarterlyRows: quarterly.rows.length,
    finalRosterCommissionRows: rosterCommissionRows.length,
    reviewRows: reviewRows.length,
    removedNoCommission: reviewRows.filter((row) => row.reviewType.startsWith('Removed')).length,
    matched: mapping.filter((row) => row.status === 'Matched').length,
    reportMarkedDeparted: mapping.filter((row) => row.reportMarkedDeparted === 'Yes').length,
    missingInRoster: mapping.filter((row) => row.status === 'Missing in Roster').length,
    ambiguous: mapping.filter((row) => row.status === 'Ambiguous Roster Match').length,
    terminatedIssues: mapping.filter((row) => row.status.includes('Terminated') || row.status.includes('Flagged')).length,
    duplicateRosterNames: duplicateExceptionRows.length,
    activeServiceRosterOnly: activeServiceRosterOnly.length,
    issues: issueRows.length + quarterly.exceptions.length,
    totalReportCommission: roundMoney(quarterly.rows.reduce((sum, row) => sum + (row.commission || 0), 0)),
    totalMappedCommission: roundMoney(mapping.filter((row) => row.rosterName).reduce((sum, row) => sum + (row.reportCommission || 0), 0)),
  };

  return {
    summary,
    mapping,
    rosterCommissionRows,
    reviewRows,
    issues: issueRows,
    activeServiceRosterOnly,
    rosterRows: roster.rows,
    reportRows: quarterly.rows,
    exceptions,
    metadata: {
      rosterFileName: path.basename(rosterFilePath),
      quarterlyReportFileName: path.basename(quarterlyReportFilePath),
      rosterSheetName: roster.sheetName,
      quarterlyReportSheetName: quarterly.sheetName,
      generatedAt: new Date().toISOString(),
      ruleVersion: 'commission-roster-v1',
    },
  };
}

module.exports = {
  compareCommissionRosterFiles,
  parseRoster,
  parseQuarterlyReport,
  parseMoney,
  roundMoney,
};
