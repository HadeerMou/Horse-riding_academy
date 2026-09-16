import Link from "next/link";

const TABS = [
  { href: "/coach", label: "Riders" },
  { href: "/coach/schedule", label: "Weekly schedule" },
  { href: "/coach/plans", label: "Plans" },
  { href: "/coach/payments", label: "Payments" },
] as const;

export default function CoachNav({ active }: { active: (typeof TABS)[number]["href"] }) {
  return (
    <nav className="coach-nav">
      {TABS.map((tab) =>
        tab.href === active ? (
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
