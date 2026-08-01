import type { VercelRequest, VercelResponse } from '@vercel/node';
import { neon } from '@neondatabase/serverless';
import bcrypt from 'bcryptjs';
import { getJwtSecret, signToken } from '../../lib/api-auth';
import { logAudit } from '../../lib/audit';
import {
  ACCOUNT_IP_LIMIT,
  ACCOUNT_LIMIT,
  IP_LIMIT,
  LOGIN_WINDOW_MINUTES,
  isLoginRateLimited,
  normalizedLoginIdentity,
  privateLoginHash,
  requestIp,
  type LoginRateLimitCounts,
} from '../../lib/login-rate-limit';
import { isNonEmptyString } from '../../lib/validate';

// Cost 12, matching BCRYPT_ROUNDS. Comparing against a fixed dummy hash keeps
// missing-user and wrong-password requests close in computational cost without
// generating a new expensive salt for every unknown username.
const DUMMY_PASSWORD_HASH = '$2b$12$ZDu6soVPAgm90napnL14H.r322LBQWe5pPY64HZzMTjTpDFEdGtEG';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  res.setHeader('Cache-Control', 'no-store');

  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const { username, password, companySlug = 'dhl' } = body;
  if (!isNonEmptyString(username, 100) || !isNonEmptyString(password, 200)) {
    return res.status(400).json({ error: 'Username and password required' });
  }
  if (!isNonEmptyString(companySlug, 100)) {
    return res.status(400).json({ error: 'Company required' });
  }

  const loginUsername = username.trim();
  const loginCompanySlug = companySlug.trim();
  const sql = neon(process.env.DATABASE_URL!);

  try {
    const rateLimitSecret = process.env.LOGIN_RATE_LIMIT_SECRET || getJwtSecret();
    const usernameHash = privateLoginHash(
      normalizedLoginIdentity(loginCompanySlug, loginUsername),
      rateLimitSecret,
    );
    const ipHash = privateLoginHash(requestIp(req.headers), rateLimitSecret);

    // Reserve one attempt before checking credentials. The three advisory locks
    // serialize every request that shares an account, IP, or account/IP pair;
    // the count and reservation therefore cannot race across serverless workers.
    // A successful login deletes only its own reservation below.
    const rateLimitRows = await sql`
      WITH lock_keys AS (
        SELECT key
        FROM unnest(ARRAY[
          ${`account:${usernameHash}`},
          ${`account-ip:${usernameHash}:${ipHash}`},
          ${`ip:${ipHash}`}
        ]::text[]) AS lock_value(key)
      ),
      acquired AS MATERIALIZED (
        SELECT pg_advisory_xact_lock(hashtextextended(key, 0))
        FROM lock_keys
        ORDER BY key
      ),
      recent AS MATERIALIZED (
        SELECT
          COUNT(*) FILTER (
            WHERE username_hash = ${usernameHash} AND ip_hash = ${ipHash}
          )::int AS account_ip_failures,
          COUNT(*) FILTER (
            WHERE ip_hash = ${ipHash}
          )::int AS ip_failures,
          COUNT(*) FILTER (
            WHERE username_hash = ${usernameHash}
          )::int AS account_failures
        FROM auth_login_failures
        CROSS JOIN (SELECT COUNT(*) FROM acquired) AS held_locks
        WHERE attempted_at > NOW() - (${LOGIN_WINDOW_MINUTES} * INTERVAL '1 minute')
      ),
      reservation AS (
        INSERT INTO auth_login_failures (company_slug, username_hash, ip_hash)
        SELECT ${loginCompanySlug.toLowerCase()}, ${usernameHash}, ${ipHash}
        FROM recent
        WHERE account_ip_failures < ${ACCOUNT_IP_LIMIT}
          AND ip_failures < ${IP_LIMIT}
          AND account_failures < ${ACCOUNT_LIMIT}
        RETURNING id
      )
      SELECT
        recent.account_ip_failures,
        recent.ip_failures,
        recent.account_failures,
        reservation.id AS reservation_id
      FROM recent
      LEFT JOIN reservation ON TRUE
    `;
    const rateLimit = rateLimitRows[0];
    const counts: LoginRateLimitCounts = {
      accountIpFailures: Number(rateLimit.account_ip_failures),
      ipFailures: Number(rateLimit.ip_failures),
      accountFailures: Number(rateLimit.account_failures),
    };
    const reservationId = rateLimit.reservation_id;
    const limited = isLoginRateLimited(counts);
    if (limited !== (reservationId == null)) {
      throw new Error('Login rate-limit reservation invariant failed');
    }
    if (limited) {
      console.warn('[auth/login] Rate limit exceeded', {
        account_ip_failures: counts.accountIpFailures,
        ip_failures: counts.ipFailures,
        account_failures: counts.accountFailures,
      });
      res.setHeader('Retry-After', String(LOGIN_WINDOW_MINUTES * 60));
      return res.status(429).json({ error: 'Too many login attempts. Try again later.' });
    }

    const users = await sql`
      SELECT
        u.*,
        c.slug AS company_slug,
        c.name AS company_name,
        c.primary_color AS company_primary_color,
        c.accent_color AS company_accent_color
      FROM users u
      JOIN companies c ON c.id = u.company_id
      WHERE u.username = ${loginUsername}
        AND c.slug = ${loginCompanySlug}
        AND c.is_active
    `;
    if (users.length === 0) {
      await bcrypt.compare(password, DUMMY_PASSWORD_HASH);
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = users[0];
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Deactivated staff keep their row (audit history references it) but cannot sign in.
    // Same generic message as a bad password so the response can't enumerate accounts.
    if (user.is_active === false) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    await sql`
      DELETE FROM auth_login_failures
      WHERE id = ${reservationId}
    `;

    const token = signToken({
      userId: user.id,
      username: user.username,
      role: user.role,
      fleetId: user.fleet_id,
      companyId: user.company_id,
      companySlug: user.company_slug,
      companyName: user.company_name,
      firstName: user.first_name,
      lastName: user.last_name,
    });

    await logAudit({
      userId: user.id,
      username: user.username,
      action: 'login',
      entityType: 'user',
      entityId: user.id,
    });

    res.status(200).json({
      token,
      user: {
        id: user.id,
        username: user.username,
        firstName: user.first_name,
        lastName: user.last_name,
        role: user.role,
        fleetId: user.fleet_id,
        companyId: user.company_id,
        companySlug: user.company_slug,
        companyName: user.company_name,
        primaryColor: user.company_primary_color,
        accentColor: user.company_accent_color,
      },
    });
  } catch (error: any) {
    console.error('[API] Login error:', error.message);
    res.status(500).json({ error: 'Internal server error' });
  }
}
