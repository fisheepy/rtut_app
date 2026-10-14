const COMPENSATION_GROSS_PAY_SNAPSHOT = Object.freeze({
  period: Object.freeze({ start: '2025-09-30', end: '2026-09-29' }),
  generatedOn: '2026-10-14',
  basis: 'Estimated annual gross pay for current employees. Actual gross pay is annualized by covered employment days for employees hired or rehired during the reporting period, after at least 90 days of pay history.',
  annualizedEmployees: 14,
  insufficientHistoryEmployees: 2,
  overall: Object.freeze({ population: 208, analyzed: 203, noHistory: 5, min: 13287.78, p25: 51462.23, median: 67688.04, average: 83003.45, p75: 88423.2, max: 393845.76 }),
  locations: Object.freeze([
    Object.freeze({ location: 'Dearborn', population: 57, analyzed: 55, noHistory: 2, min: 22506.25, p25: 45852.96, median: 56608.48, average: 63465.57, p75: 71969.71, max: 242090.39 }),
    Object.freeze({ location: 'Gaylord', population: 7, analyzed: 7, noHistory: 0, min: 41138.51, p25: 56288.43, median: 63190.78, average: 61334.65, p75: 68561.7, max: 75312.97 }),
    Object.freeze({ location: 'Grand Rapids', population: 41, analyzed: 40, noHistory: 1, min: 14685, p25: 58910.14, median: 77157.43, average: 93150.54, p75: 91726.17, max: 281995.18 }),
    Object.freeze({ location: 'Hudsonville', population: 28, analyzed: 28, noHistory: 0, min: 13287.78, p25: 58790.86, median: 68853.07, average: 73585.81, p75: 79072.16, max: 153942.3 }),
    Object.freeze({ location: 'Northville', population: 36, analyzed: 36, noHistory: 0, min: 13554.6, p25: 61899.51, median: 97842.18, average: 121598.99, p75: 153252.45, max: 393845.76 }),
    Object.freeze({ location: 'Ohio Cleveland', population: 8, analyzed: 7, noHistory: 1, min: 52439.13, p25: 58457.74, median: 75956.5, average: 128135.33, p75: 174773.82, max: 302088.59 }),
    Object.freeze({ location: 'Warren', population: 23, analyzed: 22, noHistory: 1, min: 22805.08, p25: 53657.27, median: 64595.23, average: 67450.85, p75: 81844.24, max: 122125.4 }),
    Object.freeze({ location: 'Wixom', population: 8, analyzed: 8, noHistory: 0, min: 21425, p25: 31912.5, median: 46823.36, average: 48112.16, p75: 63714.71, max: 79101.01 }),
  ]),
  payTypes: Object.freeze([
    Object.freeze({
      payType: 'Hourly',
      overall: Object.freeze({ population: 134, analyzed: 129, noHistory: 5, min: 13287.78, p25: 45835.1, median: 58497.44, average: 57653.15, p75: 69124.43, max: 125653.81 }),
      locations: Object.freeze([
        Object.freeze({ location: 'Dearborn', population: 47, analyzed: 45, noHistory: 2, min: 27097.8, p25: 44641.52, median: 53590.46, average: 55592.58, p75: 65418.49, max: 94274.16 }),
        Object.freeze({ location: 'Gaylord', population: 4, analyzed: 4, noHistory: 0, min: 41138.51, p25: 47679.97, median: 56525.62, average: 55555.35, p75: 64400.99, max: 68031.64 }),
        Object.freeze({ location: 'Grand Rapids', population: 24, analyzed: 23, noHistory: 1, min: 14685, p25: 52824.54, median: 60935.95, average: 60559.56, p75: 72716.01, max: 93559.24 }),
        Object.freeze({ location: 'Hudsonville', population: 23, analyzed: 23, noHistory: 0, min: 13287.78, p25: 51280.86, median: 67688.04, average: 62781.76, p75: 73037.81, max: 106495.28 }),
        Object.freeze({ location: 'Northville', population: 7, analyzed: 7, noHistory: 0, min: 13554.6, p25: 40186.88, median: 47202.8, average: 51873.97, p75: 48166.4, max: 125653.81 }),
        Object.freeze({ location: 'Ohio Cleveland', population: 5, analyzed: 4, noHistory: 1, min: 52439.13, p25: 56119.08, median: 58457.74, average: 61327.78, p75: 63666.44, max: 75956.5 }),
        Object.freeze({ location: 'Warren', population: 17, analyzed: 16, noHistory: 1, min: 22805.08, p25: 45783.44, median: 62642.54, average: 59700.16, p75: 70510.17, max: 87952.1 }),
        Object.freeze({ location: 'Wixom', population: 7, analyzed: 7, noHistory: 0, min: 21425, p25: 28882.5, median: 35896.6, average: 44698.2, p75: 59349.88, max: 79101.01 }),
      ]),
    }),
    Object.freeze({
      payType: 'Salary',
      overall: Object.freeze({ population: 74, analyzed: 74, noHistory: 0, min: 22506.25, p25: 74213.01, median: 100930.7, average: 127195.19, p75: 148644.07, max: 393845.76 }),
      locations: Object.freeze([
        Object.freeze({ location: 'Dearborn', population: 10, analyzed: 10, noHistory: 0, min: 22506.25, p25: 74212.58, median: 96896.24, average: 98894.06, p75: 112079.19, max: 242090.39 }),
        Object.freeze({ location: 'Gaylord', population: 3, analyzed: 3, noHistory: 0, min: 62716.41, p25: 65904.08, median: 69091.76, average: 69040.38, p75: 72202.36, max: 75312.97 }),
        Object.freeze({ location: 'Grand Rapids', population: 17, analyzed: 17, noHistory: 0, min: 68923.15, p25: 87232.5, median: 119218.28, average: 137244.22, p75: 183386.16, max: 281995.18 }),
        Object.freeze({ location: 'Hudsonville', population: 5, analyzed: 5, noHistory: 0, min: 66583.34, p25: 129003.36, median: 129893.83, average: 123284.47, p75: 136999.52, max: 153942.3 }),
        Object.freeze({ location: 'Northville', population: 29, analyzed: 29, noHistory: 0, min: 41353.81, p25: 72471.5, median: 108384.6, average: 138429.17, p75: 184628.54, max: 393845.76 }),
        Object.freeze({ location: 'Ohio Cleveland', population: 3, analyzed: 3, noHistory: 0, min: 145353.67, p25: 174773.82, median: 204193.96, average: 217212.07, p75: 253141.28, max: 302088.59 }),
        Object.freeze({ location: 'Warren', population: 6, analyzed: 6, noHistory: 0, min: 53793.09, p25: 71267.88, median: 87467.82, average: 88119.37, p75: 105862.58, max: 122125.4 }),
        Object.freeze({ location: 'Wixom', population: 1, analyzed: 1, noHistory: 0, min: 72009.92, p25: 72009.92, median: 72009.92, average: 72009.92, p75: 72009.92, max: 72009.92 }),
      ]),
    }),
  ]),
  noHistoryEmployees: Object.freeze([
    Object.freeze({ name: 'Noah Haase', location: 'Dearborn', reason: 'Hired after the reporting period ended' }),
    Object.freeze({ name: 'William McCullough', location: 'Ohio Cleveland', reason: 'Hired after the reporting period ended' }),
    Object.freeze({ name: 'Mark Nash', location: 'Warren', reason: 'Rehired after the reporting period ended' }),
  ]),
  insufficientHistory: Object.freeze([
    Object.freeze({ name: 'Ryan Russell Jr.', location: 'Grand Rapids', coveredDays: 30, reason: 'Less than 90 days of pay history in the reporting period' }),
    Object.freeze({ name: 'Dominic Sabo', location: 'Dearborn', coveredDays: 12, reason: 'Less than 90 days of pay history in the reporting period' }),
  ]),
});

function getCompensationGrossPayAnalysis() {
  return COMPENSATION_GROSS_PAY_SNAPSHOT;
}

module.exports = { COMPENSATION_GROSS_PAY_SNAPSHOT, getCompensationGrossPayAnalysis };
