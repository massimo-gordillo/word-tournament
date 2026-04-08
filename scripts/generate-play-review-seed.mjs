/**
 * Creates/updates the Google Play review auth account via Supabase Admin API,
 * then upserts the matching public.users profile row.
 *
 * Required env vars (.env or process env):
 * - SUPABASE_URL
 * - SUPABASE_SERVICE_ROLE_KEY
 * - SUPABASE_PLAY_REVIEW_EMAIL
 * - SUPABASE_PLAY_REVIEW_PASSWORD
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';

const ROOT = resolve(process.cwd());
const ENV_PATH = resolve(ROOT, '.env');
const PLAY_REVIEW_DISPLAY_NAME = 'Google Play Review';

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
    throw new Error(`[play-review-seed] Missing required env var: ${name}`);
  }
  return value;
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
      `[play-review-seed] ${options.method} ${url} failed (${response.status}): ${detail}`
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

async function ensurePlayReviewAuthUser(baseUrl, headers, email, password) {
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
        '[play-review-seed] Admin create-user response did not include an id.'
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
      `[play-review-seed] User already exists but could not find id for email: ${email}`
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

async function upsertPublicProfile(baseUrl, headers, userId) {
  await requestJson(`${baseUrl}/rest/v1/users?on_conflict=id`, {
    method: 'POST',
    headers: {
      ...headers,
      Prefer: 'resolution=merge-duplicates,return=minimal',
    },
    body: JSON.stringify([
      {
        id: userId,
        display_name: PLAY_REVIEW_DISPLAY_NAME,
      },
    ]),
  });
}

async function main() {
  loadDotenvIfPresent();

  const supabaseUrl = requireEnv('EXPO_PUBLIC_SUPABASE_URL').replace(/\/+$/, '');
  const serviceRoleKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY');
  const email = requireEnv('SUPABASE_PLAY_REVIEW_EMAIL');
  const password = requireEnv('SUPABASE_PLAY_REVIEW_PASSWORD');

  const headers = {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
    'Content-Type': 'application/json',
  };

  const userId = await ensurePlayReviewAuthUser(
    supabaseUrl,
    headers,
    email,
    password
  );
  await upsertPublicProfile(supabaseUrl, headers, userId);

  console.log(
    `[play-review-seed] Ensured auth + profile for ${email} (user id: ${userId}).`
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
