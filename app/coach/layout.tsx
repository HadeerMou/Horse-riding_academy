import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import AuthHeader from "@/components/AuthHeader";
import SignOutButton from "@/components/SignOutButton";
import CoachNav from "@/components/CoachNav";
import { isCoach } from "@/lib/coach";

export default async function CoachLayout({ children }: { children: ReactNode }) {
  const allowed = await isCoach();
  if (!allowed) redirect("/account");

  return (
    <div className="auth-body">
      <AuthHeader>
        <SignOutButton />
      </AuthHeader>

      <div className="coach-shell">
        <CoachNav />
        <main className="coach-content">{children}</main>
      </div>
    </div>
  );
}
