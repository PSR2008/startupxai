import { Workspace } from "@/components/launchgate/workspace";
export default async function Page({ params }: { params: Promise<{ segments?: string[] }> }) { const { segments = [] } = await params; return <Workspace segments={segments} />; }
