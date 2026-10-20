import { PublicAssurance } from '@/components/launchgate/public-results';
import '@/components/launchgate/launchgate.css';
export const metadata = { robots: { index: false, follow: false }, referrer: 'no-referrer' as const };
export default async function Page({ params }: { params: Promise<{ token: string }> }) { const { token } = await params; return <PublicAssurance kind="shares" reference={/^[a-f0-9]{64}$/.test(token) ? token : 'invalid'} />; }
