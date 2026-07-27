import { neon } from '@neondatabase/serverless';

export async function logAudit({
  userId,
  username,
  action,
  entityType,
  entityId,
  details,
}: {
  userId?: string;
  username: string;
  action: string;
  entityType: string;
  entityId?: string;
  details?: Record<string, any>;
}) {
  try {
    const sql = neon(process.env.DATABASE_URL!);
    await sql`
      INSERT INTO audit_log (user_id, username, action, entity_type, entity_id, details)
      VALUES (${userId || null}, ${username}, ${action}, ${entityType}, ${entityId || null}, ${JSON.stringify(details || {})})
    `;
  } catch (err) {
    console.warn('[Audit] Failed to log:', (err as Error).message);
  }
}
