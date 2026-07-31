import AppTopbar from "@/components/app/AppTopbar";
import AuthGate from "@/components/app/AuthGate";
import { AuthenticatedPrismBackground } from "@/components/app-background";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGate>
      <div className="sx-app-shell flex min-h-screen">
        <AuthenticatedPrismBackground />
        <div className="sx-app-shell__content flex-1 flex flex-col min-w-0">
          <AppTopbar />
          <main className="flex-1 overflow-auto">
            {children}
          </main>
        </div>
      </div>
    </AuthGate>
  );
}
