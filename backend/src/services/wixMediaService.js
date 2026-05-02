const WIX_API_BASE = 'https://www.wixapis.com';

const normalize = (value = '') =>
  String(value || '')
    .trim()
    .toLowerCase();

const toHttpMediaUrl = (value = '') => {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (/^https?:\/\//i.test(raw)) return raw;

  // Convert wix:image://v1/<mediaId>/<name>#... to https://static.wixstatic.com/media/<mediaId>
  if (raw.startsWith('wix:image://v1/')) {
    const segment = raw.replace('wix:image://v1/', '').split('/')[0];
    if (segment) return `https://static.wixstatic.com/media/${segment}`;
  }

  return '';
};

const makeAuthVariants = () => {
  const apiKey = String(process.env.WIX_API_KEY || '').trim();
  const siteId = String(process.env.WIX_SITE_ID || '').trim();
  const accountId = String(process.env.WIX_ACCOUNT_ID || '').trim();

  const baseHeaders = {
    'Content-Type': 'application/json',
  };

  // Wix API key calls should include either wix-site-id OR wix-account-id, not both.
  const contextHeaders = siteId
    ? { 'wix-site-id': siteId }
    : accountId
      ? { 'wix-account-id': accountId }
      : {};

  const withContext = (headers) => ({
    ...headers,
    ...contextHeaders,
  });

  return [
    withContext({ ...baseHeaders, Authorization: apiKey }),
    withContext({ ...baseHeaders, Authorization: `Bearer ${apiKey}` }),
    withContext({ ...baseHeaders, 'x-wix-api-key': apiKey }),
  ];
};

const queryWixFiles = async () => {
  const apiKey = String(process.env.WIX_API_KEY || '').trim();
  if (!apiKey) {
    throw new Error('WIX_API_KEY is not configured');
  }

  const endpoints = [
    {
      method: 'POST',
      url: `${WIX_API_BASE}/site-media/v1/files/search`,
      body: JSON.stringify({
        query: {
          paging: {
            limit: 200,
          },
        },
      }),
    },
    {
      method: 'GET',
      url: `${WIX_API_BASE}/site-media/v1/files?limit=1000`,
      body: undefined,
    },
  ];

  const authVariants = makeAuthVariants();
  let lastError = null;
  const failures = [];

  for (const endpoint of endpoints) {
    for (const headers of authVariants) {
      try {
        const response = await fetch(endpoint.url, {
          method: endpoint.method,
          headers,
          ...(endpoint.body ? { body: endpoint.body } : {}),
        });

        if (!response.ok) {
          const text = await response.text().catch(() => '');
          const failure = `(${response.status}) ${endpoint.method} ${endpoint.url}`;
          failures.push(failure);
          lastError = new Error(`Wix media query failed ${failure}: ${text || response.statusText}`);
          continue;
        }

        const payload = await response.json();
        const files = payload?.files || payload?.items || payload?.results || [];
        if (Array.isArray(files)) {
          return files;
        }
      } catch (error) {
        lastError = error;
      }
    }
  }

  if (lastError) {
    throw new Error(`${lastError.message}${failures.length ? ` | attempts: ${failures.join(' ; ')}` : ''}`);
  }
  throw new Error('Unable to query Wix media files');
};

const extractFileMeta = (file = {}) => {
  const name =
    file?.displayName ||
    file?.name ||
    file?.title ||
    file?.fileName ||
    file?.originalFileName ||
    file?.labels?.fileName ||
    '';

  const directUrl =
    file?.url ||
    file?.fileUrl ||
    file?.mediaUrl ||
    file?.media?.url ||
    file?.image?.url ||
    file?.resource?.url ||
    '';

  const mediaUrl = toHttpMediaUrl(directUrl);
  const parentFolderName = file?.parentFolderName || file?.folderName || file?.folder?.name || file?.path || '';
  const parentFolderId = file?.parentFolderId || file?.folderId || file?.folder?.id || '';

  return {
    raw: file,
    name: String(name || '').trim(),
    normalizedName: normalize(name),
    mediaUrl,
    parentFolderName: String(parentFolderName || ''),
    parentFolderId: String(parentFolderId || ''),
  };
};

module.exports = {
  queryWixFiles,
  extractFileMeta,
};
