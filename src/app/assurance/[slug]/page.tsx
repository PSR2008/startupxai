import { PublicAssurance } from '@/components/launchgate/public-results';
import '@/components/launchgate/launchgate.css';
export default async function Page({ params }: { params: Promise<{ slug: string }> }) { const { slug } = await params; return <PublicAssurance kind="assurance" reference={/^[a-f0-9]{32}$/.test(slug) ? slug : 'invalid'} />; }
