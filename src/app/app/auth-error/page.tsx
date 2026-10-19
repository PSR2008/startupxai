import Link from "next/link";
import { Brand, Empty } from "@/components/launchgate/ui";
export default function Page(){return <main className="lg-content"><Brand/><Empty title="This sign-in link is unavailable" action={<Link href="/app/login" className="lg-button lg-primary">Return to sign in</Link>}>The link may have expired or already been used. Sign in again or request a new password reset link.</Empty></main>;}
