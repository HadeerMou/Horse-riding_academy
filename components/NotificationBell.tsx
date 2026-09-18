"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function NotificationBell({
  userId,
  initialCount,
  href,
}: {
  userId: string;
  initialCount: number;
  href: string;
}) {
  const [count, setCount] = useState(initialCount);

  // The server-rendered count is only as fresh as the last page load —
  // keep it as the count until a live change tells us otherwise.
  useEffect(() => {
    setCount(initialCount);
  }, [initialCount]);

  useEffect(() => {
    const supabase = createClient();

    async function refreshCount() {
      const { count: unread } = await supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("read", false);
      setCount(unread ?? 0);
    }

    // Re-fetch rather than incrementing/decrementing from the payload —
    // a "mark all read" touches many rows in one go, and this stays correct
    // regardless of how many rows a single change event represents.
    const channel = supabase
      .channel(`notifications-bell-${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
        refreshCount
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  return (
    <Link href={href} className="notification-bell" aria-label={count > 0 ? `Notifications (${count} unread)` : "Notifications"}>
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M6 10a6 6 0 1 1 12 0c0 4 1.5 5.5 2 6H4c.5-.5 2-2 2-6Z" />
        <path d="M10 19a2 2 0 0 0 4 0" />
      </svg>
      {count > 0 && <span className="notification-badge">{count > 9 ? "9+" : count}</span>}
    </Link>
  );
}
