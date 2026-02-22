export function buildRecipientPreview(selectedEmployees = []) {
  return selectedEmployees
    .map((employee) => {
      const firstName = employee['First Name'] || employee.firstName || '';
      const lastName = employee['Last Name'] || employee.lastName || '';
      const fullName = `${firstName} ${lastName}`.trim() || employee.Name || 'Unknown Name';
      const location = employee.Location || employee.location || '-';
      const department = employee['Home Department'] || employee.homeDepartment || '-';
      const id = employee.username || employee._id || `${fullName}-${location}`;
      return { id, fullName, location, department };
    })
    .sort((a, b) => a.fullName.localeCompare(b.fullName));
}
