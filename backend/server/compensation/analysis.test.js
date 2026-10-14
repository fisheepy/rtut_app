const test = require('node:test');
const assert = require('node:assert/strict');
const { getCompensationGrossPayAnalysis } = require('./analysis');

test('gross pay analysis covers the current roster and reconciles location populations', () => {
  const analysis = getCompensationGrossPayAnalysis();
  assert.equal(analysis.overall.population, 208);
  assert.equal(analysis.overall.analyzed, 205);
  assert.equal(analysis.overall.noHistory, 3);
  assert.equal(analysis.locations.reduce((sum, row) => sum + row.population, 0), 208);
  assert.equal(analysis.locations.reduce((sum, row) => sum + row.analyzed, 0), 205);
});

test('gross pay percentiles are ordered for every population', () => {
  const analysis = getCompensationGrossPayAnalysis();
  for (const row of [analysis.overall, ...analysis.locations]) {
    assert.ok(row.min <= row.p25);
    assert.ok(row.p25 <= row.median);
    assert.ok(row.median <= row.p75);
    assert.ok(row.p75 <= row.max);
  }
});
