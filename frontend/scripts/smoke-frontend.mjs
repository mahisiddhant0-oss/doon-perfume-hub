/* eslint-disable no-console */
const FRONTEND_URL = (process.env.FRONTEND_BASE_URL || 'http://localhost:3000').replace(/\/+$/, '');
const ADMIN_USERNAME = process.env.ADMIN_ACCESS_USERNAME || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_ACCESS_PASSWORD || '';

const checks = [];

const addCheck = (name, passed, details = '') => {
  checks.push({ name, passed, details });
  const label = passed ? 'PASS' : 'FAIL';
  console.log(`[${label}] ${name}${details ? ` - ${details}` : ''}`);
};

const run = async () => {
  console.log(`Running frontend smoke tests against: ${FRONTEND_URL}`);

  try {
    const homeRes = await fetch(`${FRONTEND_URL}/`);
    addCheck('GET /', homeRes.ok, `status=${homeRes.status}`);
  } catch (error) {
    addCheck('GET /', false, error.message);
  }

  try {
    const productsRes = await fetch(`${FRONTEND_URL}/products`);
    addCheck('GET /products', productsRes.ok, `status=${productsRes.status}`);
  } catch (error) {
    addCheck('GET /products', false, error.message);
  }

  try {
    const adminResNoAuth = await fetch(`${FRONTEND_URL}/admin`, { redirect: 'manual' });
    addCheck('GET /admin without auth', adminResNoAuth.status === 401, `status=${adminResNoAuth.status}`);
  } catch (error) {
    addCheck('GET /admin without auth', false, error.message);
  }

  if (ADMIN_PASSWORD) {
    try {
      const credentials = Buffer.from(`${ADMIN_USERNAME}:${ADMIN_PASSWORD}`).toString('base64');
      const adminResWithAuth = await fetch(`${FRONTEND_URL}/admin`, {
        headers: {
          Authorization: `Basic ${credentials}`,
        },
      });
      addCheck('GET /admin with auth', adminResWithAuth.ok, `status=${adminResWithAuth.status}`);
    } catch (error) {
      addCheck('GET /admin with auth', false, error.message);
    }
  } else {
    console.log('[SKIP] GET /admin with auth - set ADMIN_ACCESS_PASSWORD to run this check');
  }

  const failed = checks.filter((check) => !check.passed);
  console.log(`\nSmoke test summary: ${checks.length - failed.length}/${checks.length} passed`);

  if (failed.length > 0) {
    process.exitCode = 1;
  }
};

run().catch((error) => {
  console.error('Frontend smoke test runner failed:', error);
  process.exit(1);
});
