const COMPENSATION_GROSS_PAY_SNAPSHOT = Object.freeze({
  period: Object.freeze({ start: '2025-09-30', end: '2026-09-29' }),
  generatedOn: '2026-10-14',
  basis: 'Estimated annual gross pay for current employees. Actual gross pay is annualized by covered employment days for employees hired or rehired during the reporting period, after at least one 14-day payroll cycle.',
  annualizedEmployees: 15,
  insufficientHistoryEmployees: 1,
  overall: Object.freeze({ population: 208, analyzed: 204, noHistory: 4, min: 13287.78, p25: 50476.46, median: 67668.14, average: 82716.49, p75: 88327.1, max: 393845.76 }),
  locations: Object.freeze([
    Object.freeze({ location: 'Dearborn', population: 57, analyzed: 55, noHistory: 2, min: 22506.25, p25: 45852.96, median: 56608.48, average: 63465.57, p75: 71969.71, max: 242090.39 }),
    Object.freeze({ location: 'Gaylord', population: 7, analyzed: 7, noHistory: 0, min: 41138.51, p25: 56288.43, median: 63190.78, average: 61334.65, p75: 68561.7, max: 75312.97 }),
    Object.freeze({ location: 'Grand Rapids', population: 41, analyzed: 41, noHistory: 0, min: 14685, p25: 58497.44, median: 76728.43, average: 91475.22, p75: 91115.15, max: 281995.18 }),
    Object.freeze({ location: 'Hudsonville', population: 28, analyzed: 28, noHistory: 0, min: 13287.78, p25: 58790.86, median: 68853.07, average: 73585.81, p75: 79072.16, max: 153942.3 }),
    Object.freeze({ location: 'Northville', population: 36, analyzed: 36, noHistory: 0, min: 13554.6, p25: 61899.51, median: 97842.18, average: 121598.99, p75: 153252.45, max: 393845.76 }),
    Object.freeze({ location: 'Ohio Cleveland', population: 8, analyzed: 7, noHistory: 1, min: 52439.13, p25: 58457.74, median: 75956.5, average: 128135.33, p75: 174773.82, max: 302088.59 }),
    Object.freeze({ location: 'Warren', population: 23, analyzed: 22, noHistory: 1, min: 22805.08, p25: 53657.27, median: 64595.23, average: 67450.85, p75: 81844.24, max: 122125.4 }),
    Object.freeze({ location: 'Wixom', population: 8, analyzed: 8, noHistory: 0, min: 21425, p25: 31912.5, median: 46823.36, average: 48112.16, p75: 63714.71, max: 79101.01 }),
  ]),
  noHistoryEmployees: Object.freeze([
    Object.freeze({ name: 'Noah Haase', location: 'Dearborn', reason: 'Hired after the reporting period ended' }),
    Object.freeze({ name: 'William McCullough', location: 'Ohio Cleveland', reason: 'Hired after the reporting period ended' }),
    Object.freeze({ name: 'Mark Nash', location: 'Warren', reason: 'Rehired after the reporting period ended' }),
  ]),
  insufficientHistory: Object.freeze([
    Object.freeze({ name: 'Dominic Sabo', location: 'Dearborn', coveredDays: 12, reason: 'Less than one 14-day payroll cycle in the reporting period' }),
  ]),
});

function getCompensationGrossPayAnalysis() {
  return COMPENSATION_GROSS_PAY_SNAPSHOT;
}

module.exports = { COMPENSATION_GROSS_PAY_SNAPSHOT, getCompensationGrossPayAnalysis };
