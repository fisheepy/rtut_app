function isAllowedFolderUrl(value) {
  if (!value) return true;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.hostname.toLowerCase() === 'royaltruck.sharepoint.com';
  } catch (_error) {
    return false;
  }
}

module.exports = { isAllowedFolderUrl };
