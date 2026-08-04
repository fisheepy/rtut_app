const test = require('node:test');
const assert = require('node:assert/strict');
const { isAllowedFolderUrl } = require('./folderLink');

test('accepts only secure Royal Truck SharePoint links', () => {
  assert.equal(isAllowedFolderUrl('https://royaltruck.sharepoint.com/sites/Safety/folder'), true);
  assert.equal(isAllowedFolderUrl('https://royaltruck-my.sharepoint.com/shared?id=employee-folder'), true);
  assert.equal(isAllowedFolderUrl(''), true);
  assert.equal(isAllowedFolderUrl('http://royaltruck.sharepoint.com/sites/Safety/folder'), false);
  assert.equal(isAllowedFolderUrl('https://example.com/folder'), false);
  assert.equal(isAllowedFolderUrl('not a URL'), false);
});
