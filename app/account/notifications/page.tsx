import Link from "next/link";
import { redirect } from "next/navigation";
import AuthHeader from "@/components/AuthHeader";
import SignOutButton from "@/components/SignOutButton";
import NotificationBell from "@/components/NotificationBell";
import { isCoach } from "@/lib/coach";
import { getMyNotifications, getUnreadNotificationCount } from "@/lib/notifications";
import { markNotificationRead, markAllNotificationsRead } from "@/lib/actions/notifications";
import { createClient } from "@/lib/supabase/server";

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default async function AccountNotificationsPage() {
  if (await isCoach()) redirect("/coach/notifications");

  const [notifications, unreadCount] = await Promise.all([getMyNotifications(), getUnreadNotificationCount()]);
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();

  return (
    <div className="auth-body">
      <AuthHeader>
        <div className="auth-header-actions">
          <NotificationBell userId={userData?.user?.id ?? ""} initialCount={unreadCount} href="/account/notifications" />
          <SignOutButton />
        </div>
      </AuthHeader>

      <main className="auth-main">
        <div className="auth-card account-card">
          <p className="eyebrow">
            <Link href="/account">← Account</Link>
          </p>
          <h1>Notifications.</h1>

          {unreadCount > 0 && (
            <form action={markAllNotificationsRead} style={{ marginBottom: 20 }}>
              <input type="hidden" name="returnTo" value="/account/notifications" />
              <button className="text-button" type="submit">
                Mark all as read
              </button>
            </form>
          )}

          {notifications.length === 0 ? (
            <p>Nothing yet — you&apos;ll see updates from your coach here.</p>
          ) : (
            <ul className="trial-slot-list">
              {notifications.map((n) => (
                <li key={n.id} className="trial-slot-row" style={{ opacity: n.read ? 0.6 : 1 }}>
                  <div className="trial-slot-info">
                    <strong>{n.title}</strong>
                    {n.body && <span>{n.body}</span>}
                    <span>{formatWhen(n.createdAt)}</span>
                  </div>
                  <div className="session-row-actions">
                    {n.url && (
                      <Link className="text-button" href={n.url}>
                        View
                      </Link>
                    )}
                    {!n.read && (
                      <form action={markNotificationRead}>
                        <input type="hidden" name="id" value={n.id} />
                        <input type="hidden" name="returnTo" value="/account/notifications" />
                        <button className="text-button" type="submit">
                          Mark read
                        </button>
                      </form>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>
    </div>
  );
}
