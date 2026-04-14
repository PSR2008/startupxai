// /login redirects to /signin — canonical auth URL is /signin
import { redirect } from "next/navigation";

export default function LoginPage() {
  redirect("/signin");
}
