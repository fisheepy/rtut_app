const clean = value => value == null ? '' : String(value).trim();
const normalize = value => clean(value).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const employeeName = employee => [clean(employee['First Name']), clean(employee['Last Name'])].filter(Boolean).join(' ');
const QUESTION_WORDS = new Set(['about', 'current', 'data', 'date', 'does', 'employee', 'find', 'for', 'give', 'have', 'her', 'hire', 'his', 'how', 'information', 'last', 'location', 'manager', 'much', 'pay', 'paid', 'please', 'rate', 'salary', 'show', 'status', 'tell', 'the', 'what', 'when', 'where', 'which', 'with']);

function editDistance(left, right) {
  const a = normalize(left);
  const b = normalize(right);
  if (!a) return b.length;
  if (!b) return a.length;
  const row = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i += 1) {
    let previous = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const saved = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, previous + (a[i - 1] === b[j - 1] ? 0 : 1));
      previous = saved;
    }
  }
  return row[b.length];
}

function tokenScore(queryToken, nameToken, isLastName) {
  if (queryToken === nameToken) return isLastName ? 50 : 45;
  if (queryToken.length >= 3 && nameToken.length >= 3 && (nameToken.startsWith(queryToken) || queryToken.startsWith(nameToken))) return isLastName ? 36 : 32;
  const tolerance = Math.max(queryToken.length, nameToken.length) >= 7 ? 2 : 1;
  if (queryToken.length >= 4 && nameToken.length >= 4 && editDistance(queryToken, nameToken) <= tolerance) return isLastName ? 34 : 30;
  return 0;
}

function findEmployeeMatches(employees, input) {
  const query = normalize(input);
  if (!query) return [];
  const paddedQuery = ` ${query} `;
  const exact = employees.filter(employee => paddedQuery.includes(` ${normalize(employeeName(employee))} `));
  if (exact.length) {
    const longest = Math.max(...exact.map(employee => normalize(employeeName(employee)).length));
    return exact.filter(employee => normalize(employeeName(employee)).length === longest);
  }

  const queryTokens = query.split(' ').filter(token => token.length >= 3 && !QUESTION_WORDS.has(token));
  const scored = employees.map(employee => {
    const firstTokens = normalize(employee['First Name']).split(' ').filter(Boolean);
    const lastTokens = normalize(employee['Last Name']).split(' ').filter(Boolean);
    const matchedQueryTokens = new Set();
    let score = 0;
    for (const queryToken of queryTokens) {
      let best = 0;
      for (const token of firstTokens) best = Math.max(best, tokenScore(queryToken, token, false));
      for (const token of lastTokens) best = Math.max(best, tokenScore(queryToken, token, true));
      if (best) {
        score += best;
        matchedQueryTokens.add(queryToken);
      }
    }
    const matchedFirst = firstTokens.some(token => queryTokens.some(queryToken => tokenScore(queryToken, token, false) > 0));
    const matchedLast = lastTokens.some(token => queryTokens.some(queryToken => tokenScore(queryToken, token, true) > 0));
    if (matchedFirst && matchedLast) score += 40;
    return { employee, score, matchedTokenCount: matchedQueryTokens.size };
  }).filter(item => item.score >= 30 && item.matchedTokenCount > 0);

  if (!scored.length) return [];
  const highest = Math.max(...scored.map(item => item.score));
  return scored.filter(item => item.score === highest).map(item => item.employee);
}

module.exports = { editDistance, findEmployeeMatches };
