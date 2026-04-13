/**
 * Creates local manual-testing auth accounts via Supabase Admin API after `supabase db reset`.
 * The auth.users trigger creates matching public.users rows.
 *
 * Optional env vars (.env or process env):
 * - LOCAL_TESTING_EMAIL — template with a single "!" placeholder, e.g. email!@hotmail.com
 *   becomes email0@..., email1@..., etc. If there is no "!", the index is inserted before "@"
 *   (user@x.com -> user0@x.com).
 * - LOCAL_TESTING_PASSWORD — shared password for all test accounts.
 * - LOCAL_TESTING_USER_COUNT — defaults to 4.
 *
 * Required when the above are set:
 * - EXPO_PUBLIC_SUPABASE_URL
 * - SUPABASE_SERVICE_ROLE_KEY
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';

const ROOT = resolve(process.cwd());
const ENV_PATH = resolve(ROOT, '.env');

function loadDotenvIfPresent() {
  let raw;
  try {
    raw = readFileSync(ENV_PATH, 'utf8');
  } catch {
    return;
  }

  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;

    const key = trimmed.slice(0, eq).trim();
    if (process.env[key] !== undefined) continue;

    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

function requireEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`[local-test-users-seed] Missing required env var: ${name}`);
  }
  return value;
}

function buildTestEmail(template, index) {
  if (template.includes('!')) {
    return template.replace('!', String(index));
  }

  const at = template.indexOf('@');
  if (at === -1) {
    throw new Error(
      '[local-test-users-seed] LOCAL_TESTING_EMAIL must contain @ or a "!" placeholder.'
    );
  }

  return template.slice(0, at) + index + template.slice(at);
}

async function parseBodySafe(response) {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

async function requestJson(url, options) {
  const response = await fetch(url, options);
  const body = await parseBodySafe(response);
  if (!response.ok) {
    const detail =
      typeof body === 'string' ? body : JSON.stringify(body ?? {}, null, 2);
    throw new Error(
      `[local-test-users-seed] ${options.method} ${url} failed (${response.status}): ${detail}`
    );
  }
  return body;
}

function isAlreadyRegisteredError(error) {
  const msg = String(error?.message || '').toLowerCase();
  return (
    msg.includes('already been registered') ||
    msg.includes('already registered') ||
    msg.includes('user already exists')
  );
}

async function listAdminUsers(baseUrl, headers) {
  const perPage = 1000;
  let page = 1;
  const users = [];

  while (true) {
    const url = `${baseUrl}/auth/v1/admin/users?page=${page}&per_page=${perPage}`;
    const body = await requestJson(url, { method: 'GET', headers });
    const pageUsers = Array.isArray(body?.users)
      ? body.users
      : Array.isArray(body)
        ? body
        : [];

    users.push(...pageUsers);
    if (pageUsers.length < perPage) break;
    page += 1;
  }

  return users;
}

async function ensureAuthUser(baseUrl, headers, email, password) {
  const createPayload = { email, password, email_confirm: true };
  try {
    const created = await requestJson(`${baseUrl}/auth/v1/admin/users`, {
      method: 'POST',
      headers,
      body: JSON.stringify(createPayload),
    });

    const createdId = created?.id || created?.user?.id;
    if (!createdId) {
      throw new Error(
        '[local-test-users-seed] Admin create-user response did not include an id.'
      );
    }
    return createdId;
  } catch (error) {
    if (!isAlreadyRegisteredError(error)) {
      throw error;
    }
  }

  const users = await listAdminUsers(baseUrl, headers);
  const existing = users.find(
    (u) => String(u?.email || '').toLowerCase() === email.toLowerCase()
  );
  if (!existing?.id) {
    throw new Error(
      `[local-test-users-seed] User already exists but could not find id for email: ${email}`
    );
  }

  await requestJson(`${baseUrl}/auth/v1/admin/users/${existing.id}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({
      password,
      email_confirm: true,
    }),
  });

  return existing.id;
}

async function main() {
  loadDotenvIfPresent();

  const emailTemplate = process.env.LOCAL_TESTING_EMAIL?.trim();
  const password = process.env.LOCAL_TESTING_PASSWORD?.trim();
  const countRaw = process.env.LOCAL_TESTING_USER_COUNT?.trim();
  const count = countRaw ? Number.parseInt(countRaw, 10) : 4;

  if (!emailTemplate || !password) {
    console.log(
      '[local-test-users-seed] Skipping (set LOCAL_TESTING_EMAIL and LOCAL_TESTING_PASSWORD to create test users).'
    );
    return;
  }

  if (!Number.isFinite(count) || count < 1 || count > 50) {
    throw new Error(
      '[local-test-users-seed] LOCAL_TESTING_USER_COUNT must be between 1 and 50.'
    );
  }

  const supabaseUrl = requireEnv('EXPO_PUBLIC_SUPABASE_URL').replace(/\/+$/, '');
  const serviceRoleKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY');

  const headers = {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
    'Content-Type': 'application/json',
  };

  const emails = [];
  for (let i = 0; i < count; i += 1) {
    const email = buildTestEmail(emailTemplate, i);
    const userId = await ensureAuthUser(supabaseUrl, headers, email, password);
    emails.push({ email, userId });
    console.log(`[local-test-users-seed] Ensured ${email} (${userId}).`);
  }

  console.log(
    `[local-test-users-seed] Done: ${emails.length} account(s) ready for manual testing.`
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
