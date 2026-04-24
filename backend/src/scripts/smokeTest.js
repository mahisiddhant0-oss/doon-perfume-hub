/* eslint-disable no-console */
require('dotenv').config();

const BASE_URL = (process.env.BACKEND_BASE_URL || 'http://localhost:5000').replace(/\/+$/, '');
const TEST_PHONE = process.env.SMOKE_TEST_PHONE || '';

const checks = [];

const addCheck = (name, passed, details = '') => {
  checks.push({ name, passed, details });
  const label = passed ? 'PASS' : 'FAIL';
  console.log(`[${label}] ${name}${details ? ` - ${details}` : ''}`);
};

const safeJson = async (response) => {
  try {
    return await response.json();
  } catch {
    return null;
  }
};

const run = async () => {
  console.log(`Running backend smoke tests against: ${BASE_URL}`);

  try {
    const healthRes = await fetch(`${BASE_URL}/health`);
    const healthData = await safeJson(healthRes);
    addCheck('GET /health', healthRes.ok, `status=${healthRes.status} env=${healthData?.environment || 'n/a'}`);
  } catch (error) {
    addCheck('GET /health', false, error.message);
  }

  try {
    const productsRes = await fetch(`${BASE_URL}/api/products`);
    const productsData = await safeJson(productsRes);
    const isArray = Array.isArray(productsData);
    addCheck('GET /api/products', productsRes.ok && isArray, `status=${productsRes.status} count=${isArray ? productsData.length : 'n/a'}`);
  } catch (error) {
    addCheck('GET /api/products', false, error.message);
  }

  try {
    const longQuery = 'x'.repeat(5000);
    const searchRes = await fetch(`${BASE_URL}/api/products?keyword=${encodeURIComponent(longQuery)}`);
    addCheck('GET /api/products long keyword', searchRes.ok, `status=${searchRes.status}`);
  } catch (error) {
    addCheck('GET /api/products long keyword', false, error.message);
  }

  if (TEST_PHONE) {
    try {
      const otpRes = await fetch(`${BASE_URL}/api/auth/otp/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: TEST_PHONE }),
      });
      const otpData = await safeJson(otpRes);
      addCheck('POST /api/auth/otp/send', otpRes.ok, `status=${otpRes.status} message=${otpData?.message || 'n/a'}`);
    } catch (error) {
      addCheck('POST /api/auth/otp/send', false, error.message);
    }
  } else {
    console.log('[SKIP] POST /api/auth/otp/send - set SMOKE_TEST_PHONE to run this check');
  }

  const failed = checks.filter((check) => !check.passed);
  console.log(`\nSmoke test summary: ${checks.length - failed.length}/${checks.length} passed`);

  if (failed.length > 0) {
    process.exitCode = 1;
  }
};

run().catch((error) => {
  console.error('Smoke test runner failed:', error);
  process.exit(1);
});
