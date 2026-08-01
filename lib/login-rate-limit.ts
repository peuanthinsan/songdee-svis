import { createHmac } from 'node:crypto';

export const LOGIN_WINDOW_MINUTES = 15;
export const ACCOUNT_IP_LIMIT = 5;
export const IP_LIMIT = 20;
export const ACCOUNT_LIMIT = 30;

export type LoginRateLimitCounts = {
  accountIpFailures: number;
  ipFailures: number;
  accountFailures: number;
};

type RequestHeaders = Record<string, string | string[] | undefined>;

function firstHeaderValue(value: string | string[] | undefined): string | undefined {
  const first = Array.isArray(value) ? value[0] : value;
  return first?.split(',')[0]?.trim() || undefined;
}

/**
 * Vercel supplies x-vercel-forwarded-for independently of an upstream proxy's
 * x-forwarded-for value. Fall back for local development and non-Vercel hosts.
 */
export function requestIp(headers: RequestHeaders): string {
  return (
    firstHeaderValue(headers['x-vercel-forwarded-for'])
    ?? firstHeaderValue(headers['x-forwarded-for'])
    ?? firstHeaderValue(headers['x-real-ip'])
    ?? 'unknown'
  );
}

export function normalizedLoginIdentity(companySlug: string, username: string): string {
  return `${companySlug.trim().toLowerCase()}:${username.trim().toLowerCase()}`;
}

/** Store only a domain-separated HMAC of login identifiers and client IPs. */
export function privateLoginHash(value: string, secret: string): string {
  return createHmac('sha256', secret)
    .update('svis-login-rate-limit:v1\0')
    .update(value)
    .digest('hex');
}

export function isLoginRateLimited(counts: LoginRateLimitCounts): boolean {
  return (
    counts.accountIpFailures >= ACCOUNT_IP_LIMIT
    || counts.ipFailures >= IP_LIMIT
    || counts.accountFailures >= ACCOUNT_LIMIT
  );
}
