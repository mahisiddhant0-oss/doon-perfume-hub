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

const tryExtractUploadedUrl = (payload = {}) => {
  const directCandidates = [
    payload?.file?.url,
    payload?.file?.fileUrl,
    payload?.file?.mediaUrl,
    payload?.file?.media?.url,
    payload?.file?.image?.url,
    payload?.url,
    payload?.fileUrl,
    payload?.mediaUrl,
    payload?.media?.url,
    payload?.image?.url,
  ];

  for (const candidate of directCandidates) {
    const normalized = toHttpMediaUrl(candidate);
    if (normalized) return normalized;
  }

  return '';
};

const requestWithAuthVariants = async (endpoint, init = {}) => {
  const authVariants = makeAuthVariants();
  let lastError = null;
  const failures = [];

  for (const headers of authVariants) {
    try {
      const response = await fetch(endpoint, {
        ...init,
        headers: {
          ...(init.headers || {}),
          ...headers,
        },
      });

      if (!response.ok) {
        const text = await response.text().catch(() => '');
        failures.push(`(${response.status}) ${text || response.statusText}`);
        continue;
      }

      return response;
    } catch (error) {
      lastError = error;
    }
  }

  if (lastError) {
    throw new Error(lastError.message || 'Wix request failed');
  }
  throw new Error(`Wix request failed: ${failures.join(' ; ')}`);
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

const uploadBufferToWix = async ({ fileName, mimeType, buffer }) => {
  const apiKey = String(process.env.WIX_API_KEY || '').trim();
  if (!apiKey) throw new Error('WIX_API_KEY is not configured');
  if (!buffer || !Buffer.isBuffer(buffer) || buffer.length === 0) {
    throw new Error('Upload buffer is empty');
  }

  const safeFileName = String(fileName || `upload-${Date.now()}.bin`)
    .replace(/[^\w.\-]/g, '_')
    .slice(0, 120);
  const safeMimeType = String(mimeType || 'application/octet-stream').trim() || 'application/octet-stream';

  const generatePayloads = [
    { mimeType: safeMimeType, fileName: safeFileName },
    { mimeType: safeMimeType, filename: safeFileName },
    { file: { mimeType: safeMimeType, fileName: safeFileName } },
  ];

  let uploadUrl = '';
  let lastGenerateError = null;

  for (const payload of generatePayloads) {
    try {
      const generateRes = await requestWithAuthVariants(`${WIX_API_BASE}/site-media/v1/files/generate-upload-url`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const generateJson = await generateRes.json().catch(() => ({}));
      uploadUrl =
        String(generateJson?.uploadUrl || '').trim() ||
        String(generateJson?.url || '').trim() ||
        String(generateJson?.upload?.url || '').trim();
      if (uploadUrl) break;
    } catch (error) {
      lastGenerateError = error;
    }
  }

  if (!uploadUrl) {
    throw new Error(lastGenerateError?.message || 'Failed to generate Wix upload URL');
  }

  const parsedUploadUrl = new URL(uploadUrl);
  if (!parsedUploadUrl.searchParams.has('filename')) {
    parsedUploadUrl.searchParams.set('filename', safeFileName);
  }

  const uploadRes = await fetch(parsedUploadUrl.toString(), {
    method: 'PUT',
    headers: {
      'Content-Type': safeMimeType,
    },
    body: buffer,
  });

  if (!uploadRes.ok) {
    const text = await uploadRes.text().catch(() => '');
    throw new Error(`Wix upload failed (${uploadRes.status}): ${text || uploadRes.statusText}`);
  }

  const uploadJson = await uploadRes.json().catch(() => ({}));
  const directUrl = tryExtractUploadedUrl(uploadJson);
  if (directUrl) {
    return directUrl;
  }

  // Fallback: search recently uploaded files and match by filename.
  const files = await queryWixFiles();
  const normalizedTarget = normalize(safeFileName);
  const candidate = files
    .map(extractFileMeta)
    .filter((item) => item.mediaUrl && normalize(item.name) === normalizedTarget)
    .pop();

  if (candidate?.mediaUrl) return candidate.mediaUrl;
  throw new Error('Wix upload succeeded but media URL could not be resolved');
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
  uploadBufferToWix,
};
