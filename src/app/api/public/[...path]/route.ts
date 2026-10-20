import { publicDistribution } from '@/server/launchgate/public-distribution';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(request: Request) { try { return await publicDistribution(request); } catch { return Response.json({ error: 'UNAVAILABLE' }, { status: 503, headers: { 'Cache-Control': 'no-store' } }); } }
export const POST = GET;
