import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import AuthHeader from "@/components/AuthHeader";
import SignOutButton from "@/components/SignOutButton";
import NotificationBell from "@/components/NotificationBell";
import CoachNav from "@/components/CoachNav";
import { isCoach } from "@/lib/coach";
import { getUnreadNotificationCount } from "@/lib/notifications";
import { createClient } from "@/lib/supabase/server";

export default async function CoachLayout({ children }: { children: ReactNode }) {
  const allowed = await isCoach();
  if (!allowed) redirect("/account");

  const unreadCount = await getUnreadNotificationCount();
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();

  return (
    <div className="auth-body">
      <AuthHeader>
        <div className="auth-header-actions">
          <NotificationBell userId={userData?.user?.id ?? ""} initialCount={unreadCount} href="/coach/notifications" />
          <SignOutButton />
        </div>
      </AuthHeader>

      <div className="coach-shell">
        <CoachNav />
        <main className="coach-content">{children}</main>
      </div>
    </div>
  );
}
