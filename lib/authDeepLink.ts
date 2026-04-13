import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { devLog } from '@/utils/logger';

function parseFragmentParams(url: string): Record<string, string> {
  const hashIndex = url.indexOf('#');
  if (hashIndex === -1) return {};
  const fragment = url.slice(hashIndex + 1);
  const params = new URLSearchParams(fragment);
  const out: Record<string, string> = {};
  params.forEach((value, key) => {
    out[key] = value;
  });
  return out;
}

function getQueryParam(url: string, key: string): string | null {
  try {
    const noHash = url.split('#')[0];
    const queryIndex = noHash.indexOf('?');
    if (queryIndex === -1) return null;
    const query = noHash.slice(queryIndex + 1);
    const params = new URLSearchParams(query);
    return params.get(key);
  } catch {
    return null;
  }
}

/**
 * Handles Supabase auth redirects (signup confirm, password recovery) opened via the app URL scheme.
 * Returns true when the URL was consumed as an auth callback.
 */
export async function handleSupabaseAuthUrl(url: string): Promise<boolean> {
  const parsed = Linking.parse(url);
  const codeFromQuery =
    (typeof parsed.queryParams?.code === 'string' ? parsed.queryParams.code : null) ??
    getQueryParam(url, 'code');

  if (codeFromQuery) {
    const { error } = await supabase.auth.exchangeCodeForSession(codeFromQuery);
    if (error) {
      devLog('authDeepLink: exchangeCodeForSession', error.message);
      return false;
    }
    const path = parsed.path ?? '';
    const isResetPath = path.includes('reset-password') || url.includes('reset-password');
    if (isResetPath) {
      router.replace('/(auth)/reset-password');
      return true;
    }
    router.replace('/(tabs)');
    return true;
  }

  const fragmentParams = parseFragmentParams(url);
  const access_token = fragmentParams.access_token;
  const refresh_token = fragmentParams.refresh_token;

  if (!access_token || !refresh_token) {
    return false;
  }

  const { error } = await supabase.auth.setSession({
    access_token,
    refresh_token,
  });

  if (error) {
    devLog('authDeepLink: setSession', error.message);
    return false;
  }

  const type = fragmentParams.type;

  if (type === 'recovery') {
    router.replace('/(auth)/reset-password');
    return true;
  }

  router.replace('/(tabs)');
  return true;
}

export function looksLikeSupabaseAuthCallback(url: string): boolean {
  if (url.includes('code=')) return true;
  if (url.includes('access_token=')) return true;
  return false;
}
