export const FILTER_NORMALIZED_COLUMNS = [
    'Position Status',
    'Home Department',
    'Job Title',
    'Location',
    'Supervisor',
    'Worker Category',
    'Pay Category',
    'EEOC Establishment',
];

export const cleanFilterLabel = (value) => String(value ?? '')
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/\s*\/\s*/g, '/');

export const normalizeFilterValue = (value) => cleanFilterLabel(value).toLocaleLowerCase();

const labelQuality = (label) => {
    const letters = label.replace(/[^a-z]/gi, '');
    const isAllUppercase = letters && letters === letters.toUpperCase();
    const parts = label.split('/').filter(Boolean);
    const capitalizedParts = parts.filter((part) => /^[A-Z]/.test(part)).length;
    return (isAllUppercase ? 0 : 10) + capitalizedParts;
};

export const buildCanonicalLabelMap = (data, columns = FILTER_NORMALIZED_COLUMNS) => {
    const maps = {};

    columns.forEach((column) => {
        const labelsByKey = new Map();
        data.forEach((employee) => {
            const label = cleanFilterLabel(employee[column]);
            if (!label) return;
            const key = normalizeFilterValue(label);
            const current = labelsByKey.get(key);
            if (!current || labelQuality(label) > labelQuality(current)) {
                labelsByKey.set(key, label);
            }
        });
        maps[column] = labelsByKey;
    });

    return maps;
};

export const canonicalizeEmployeeFilters = (data, columns = FILTER_NORMALIZED_COLUMNS) => {
    const canonicalMaps = buildCanonicalLabelMap(data, columns);
    return data.map((employee) => {
        const normalizedEmployee = { ...employee };
        columns.forEach((column) => {
            const key = normalizeFilterValue(employee[column]);
            if (key) normalizedEmployee[column] = canonicalMaps[column].get(key);
        });
        return normalizedEmployee;
    });
};
