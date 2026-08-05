const clean = value => String(value || '').trim().replace(/\s+/g, ' ').toLocaleLowerCase();
const phoneDigits = value => String(value || '').replace(/\D/g, '');

export function employeeMatchReasons(employee = {}, candidate = {}) {
  const reasons = [];
  const sameName = clean(employee['First Name']) === clean(candidate.firstName)
    && clean(employee['Last Name']) === clean(candidate.lastName)
    && Boolean(clean(candidate.firstName) && clean(candidate.lastName));
  const existingPhone = phoneDigits(employee.Phone);
  const candidatePhone = phoneDigits(candidate.phone);
  const existingEmail = clean(employee.Email);
  const candidateEmail = clean(candidate.email);
  if (sameName) reasons.push('name');
  if (existingPhone && candidatePhone && existingPhone === candidatePhone) reasons.push('phone');
  if (existingEmail && candidateEmail && existingEmail === candidateEmail) reasons.push('email');
  return reasons;
}
