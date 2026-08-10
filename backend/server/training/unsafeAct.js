const { randomUUID } = require('crypto');
const { isAllowedFolderUrl } = require('./folderLink');

function sanitizeUnsafeActs(input) {
  if (!Array.isArray(input)) return { error: 'Unsafe act records must be provided as a list.' };
  const records = [];
  for (const item of input) {
    const writeUpDate = String(item?.writeUpDate || '').trim();
    const description = String(item?.description || '').trim();
    const documentationLink = String(item?.documentationLink || '').trim();
    const repeated = item?.repeated === true || item?.repeated === 'Yes';
    const repeatedAnswerProvided = ['Yes', 'No', true, false].includes(item?.repeated);
    const lastSameUnsafeActDate = repeated ? String(item?.lastSameUnsafeActDate || '').trim() : '';
    if (!repeatedAnswerProvided) return { error: 'Confirm whether every unsafe act is repeated.' };
    if (!/^\d{4}-\d{2}-\d{2}$/.test(writeUpDate)) return { error: 'Every unsafe act needs a valid write-up date.' };
    if (!description) return { error: 'Every unsafe act needs a description.' };
    if (!documentationLink || !isAllowedFolderUrl(documentationLink)) return { error: 'Every unsafe act needs a valid Royal SharePoint documentation link.' };
    if (repeated && !/^\d{4}-\d{2}-\d{2}$/.test(lastSameUnsafeActDate)) return { error: 'Enter the last same unsafe act date for repeated unsafe acts.' };
    if (repeated && lastSameUnsafeActDate >= writeUpDate) return { error: 'The last same unsafe act date must be earlier than the current write-up date.' };
    records.push({
      id: String(item?.id || randomUUID()),
      writeUpDate,
      description,
      documentationLink,
      repeated,
      lastSameUnsafeActDate: repeated ? lastSameUnsafeActDate : null,
    });
  }
  records.sort((left, right) => right.writeUpDate.localeCompare(left.writeUpDate));
  return { records };
}

module.exports = { sanitizeUnsafeActs };
