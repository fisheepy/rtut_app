const ROSTER_FIELDS = ['jobTitle', 'location', 'department'];

function cleanEmployeeFieldLabel(value) {
  return String(value ?? '')
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/\s*\/\s*/g, '/');
}

function normalizeEmployeeFieldValue(value) {
  return cleanEmployeeFieldLabel(value).toLocaleLowerCase();
}

function labelQuality(label) {
  const letters = label.replace(/[^a-z]/gi, '');
  const isAllUppercase = Boolean(letters) && letters === letters.toUpperCase();
  const capitalizedParts = label.split('/').filter(Boolean).filter((part) => /^[A-Z]/.test(part)).length;
  return (isAllUppercase ? 0 : 10) + capitalizedParts;
}

function canonicalizeEmployeeRosterFields(employees, fields = ROSTER_FIELDS) {
  const maps = Object.fromEntries(fields.map((field) => {
    const labelsByKey = new Map();
    for (const employee of employees) {
      const label = cleanEmployeeFieldLabel(employee[field]);
      if (!label) continue;
      const key = normalizeEmployeeFieldValue(label);
      const current = labelsByKey.get(key);
      if (!current || labelQuality(label) > labelQuality(current)) labelsByKey.set(key, label);
    }
    return [field, labelsByKey];
  }));

  return employees.map((employee) => {
    const canonical = { ...employee };
    for (const field of fields) {
      const key = normalizeEmployeeFieldValue(employee[field]);
      if (key) canonical[field] = maps[field].get(key);
    }
    return canonical;
  });
}

module.exports = {
  canonicalizeEmployeeRosterFields,
  cleanEmployeeFieldLabel,
  normalizeEmployeeFieldValue,
  ROSTER_FIELDS,
};
