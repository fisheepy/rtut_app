function isAllowedFolderUrl(value) {
  if (!value) return true;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && [
      'royaltruck.sharepoint.com',
      'royaltruck-my.sharepoint.com',
    ].includes(url.hostname.toLowerCase());
  } catch (_error) {
    return false;
  }
}

module.exports = { isAllowedFolderUrl };
