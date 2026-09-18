"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/coach", label: "Dashboard" },
  { href: "/coach/riders", label: "Riders" },
  { href: "/coach/groups", label: "Groups" },
  { href: "/coach/sessions", label: "Sessions" },
  { href: "/coach/schedule", label: "Weekly schedule" },
  { href: "/coach/plans", label: "Plans" },
  { href: "/coach/payments", label: "Payments" },
  { href: "/coach/notifications", label: "Notifications" },
] as const;

export default function CoachNav() {
  const pathname = usePathname();

  return (
    <nav className="coach-sidebar" aria-label="Coach dashboard">
      {TABS.map((tab) =>
        tab.href === pathname ? (
          <span key={tab.href} className="coach-nav-active">
            {tab.label}
          </span>
        ) : (
          <Link key={tab.href} href={tab.href}>
            {tab.label}
          </Link>
        )
      )}
    </nav>
  );
}
