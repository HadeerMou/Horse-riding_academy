import Link from "next/link";
import { getMyNotifications, getUnreadNotificationCount } from "@/lib/notifications";
import { markNotificationRead, markAllNotificationsRead } from "@/lib/actions/notifications";

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default async function CoachNotificationsPage() {
  const [notifications, unreadCount] = await Promise.all([getMyNotifications(), getUnreadNotificationCount()]);

  return (
    <>
      <p className="eyebrow">
        <span></span> Coach dashboard
      </p>
      <h1>Notifications.</h1>
      <p className="auth-sub">What riders have done — marking out, booking makeups, enrolling, and booking trials.</p>

      {unreadCount > 0 && (
        <form action={markAllNotificationsRead} style={{ marginBottom: 20 }}>
          <input type="hidden" name="returnTo" value="/coach/notifications" />
          <button className="text-button" type="submit">
            Mark all as read
          </button>
        </form>
      )}

      {notifications.length === 0 ? (
        <p>Nothing yet — you&apos;ll see rider activity here.</p>
      ) : (
        <ul className="trial-slot-list">
          {notifications.map((n) => (
            <li key={n.id} className="coach-row" style={{ opacity: n.read ? 0.6 : 1 }}>
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
                    <input type="hidden" name="returnTo" value="/coach/notifications" />
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
    </>
  );
}
