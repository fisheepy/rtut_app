import {
    canonicalizeEmployeeFilters,
    cleanFilterLabel,
    normalizeFilterValue,
} from './employeeFilterUtils';

test('ignores case, extra whitespace, and slash formatting in filter values', () => {
    expect(normalizeFilterValue(' OFFICE / ADMIN ')).toBe('office/admin');
    expect(normalizeFilterValue('Office/admin')).toBe('office/admin');
    expect(normalizeFilterValue('Dearborn  ')).toBe('dearborn');
});

test('uses one polished display label for equivalent department and location values', () => {
    const result = canonicalizeEmployeeFilters([
        { 'Home Department': 'OFFICE/ADMIN', Location: 'Dearborn ' },
        { 'Home Department': 'Office/Admin', Location: 'Dearborn' },
        { 'Home Department': 'Office/admin', Location: 'DEARBORN' },
    ], ['Home Department', 'Location']);

    expect(new Set(result.map((employee) => employee['Home Department']))).toEqual(new Set(['Office/Admin']));
    expect(new Set(result.map((employee) => employee.Location))).toEqual(new Set(['Dearborn']));
});
