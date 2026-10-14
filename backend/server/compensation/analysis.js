const COMPENSATION_GROSS_PAY_SNAPSHOT = Object.freeze({
  period: Object.freeze({ start: '2025-09-30', end: '2026-09-29' }),
  generatedOn: '2026-10-14',
  basis: 'Actual gross pay for current employees; employees without pay history in the period are excluded from distribution statistics.',
  overall: Object.freeze({ population: 208, analyzed: 205, noHistory: 3, min: 300, p25: 47860.4, median: 65617.91, average: 80404.14, p75: 88231, max: 393845.76 }),
  locations: Object.freeze([
    Object.freeze({ location: 'Dearborn', population: 57, analyzed: 56, noHistory: 1, min: 300, p25: 43092.86, median: 53613.76, average: 60451.04, p75: 67872.52, max: 242090.39 }),
    Object.freeze({ location: 'Gaylord', population: 7, analyzed: 7, noHistory: 0, min: 19160.4, p25: 56288.43, median: 63190.78, average: 58194.92, p75: 68561.7, max: 75312.97 }),
    Object.freeze({ location: 'Grand Rapids', population: 41, analyzed: 41, noHistory: 0, min: 2010.6, p25: 58497.44, median: 76728.43, average: 88771.86, p75: 91115.15, max: 281995.18 }),
    Object.freeze({ location: 'Hudsonville', population: 28, analyzed: 28, noHistory: 0, min: 8227.5, p25: 53933.07, median: 68134.88, average: 71452.48, p75: 79072.16, max: 153942.3 }),
    Object.freeze({ location: 'Northville', population: 36, analyzed: 36, noHistory: 0, min: 13554.6, p25: 60887.23, median: 97842.18, average: 120672.65, p75: 153252.45, max: 393845.76 }),
    Object.freeze({ location: 'Ohio Cleveland', population: 8, analyzed: 7, noHistory: 1, min: 17383.93, p25: 58457.74, median: 75956.5, average: 123127.45, p75: 174773.82, max: 302088.59 }),
    Object.freeze({ location: 'Warren', population: 23, analyzed: 22, noHistory: 1, min: 10374.15, p25: 53657.27, median: 64595.23, average: 66313.84, p75: 81844.24, max: 122125.4 }),
    Object.freeze({ location: 'Wixom', population: 8, analyzed: 8, noHistory: 0, min: 21425, p25: 31912.5, median: 46823.36, average: 48112.16, p75: 63714.71, max: 79101.01 }),
  ]),
  noHistoryEmployees: Object.freeze([
    Object.freeze({ name: 'Noah Haase', location: 'Dearborn', reason: 'Hired after the reporting period ended' }),
    Object.freeze({ name: 'William McCullough', location: 'Ohio Cleveland', reason: 'Hired after the reporting period ended' }),
    Object.freeze({ name: 'Mark Nash', location: 'Warren', reason: 'Rehired after the reporting period ended' }),
  ]),
});

function getCompensationGrossPayAnalysis() {
  return COMPENSATION_GROSS_PAY_SNAPSHOT;
}

module.exports = { COMPENSATION_GROSS_PAY_SNAPSHOT, getCompensationGrossPayAnalysis };
