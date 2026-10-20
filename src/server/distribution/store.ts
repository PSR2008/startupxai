import 'server-only';
import { createHmac } from 'node:crypto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { configuredValue } from '../env';
import { ApiError } from '../http/api-error';
/** Privileged gateway exposes only the two constrained distribution RPCs.
 * No table client, unrestricted RPC, secret material or user impersonation escapes. */
export function distributionService(): Pick<SupabaseClient, 'rpc'> {
  const url = configuredValue('NEXT_PUBLIC_SUPABASE_URL'), key = configuredValue('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) throw new ApiError('CONFIGURATION_UNAVAILABLE');
  const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  return { rpc: ((name: string, args: Record<string, unknown>) => {
    if (!['lg_distribution_machine', 'lg_public_distribution'].includes(name)) throw new ApiError('ACCESS_DENIED');
    return client.rpc(name, args);
  }) as SupabaseClient['rpc'] };
}
export function anonymousQuotaIdentity(request: Request) {
  const identity = process.env.VERCEL === '1' ? request.headers.get('x-vercel-forwarded-for')?.slice(0, 128) ?? 'shared' : 'shared';
  return createHmac('sha256', configuredValue('SUPABASE_SERVICE_ROLE_KEY') || 'local').update(identity).digest('hex');
}
