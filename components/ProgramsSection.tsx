"use client";

import Link from "next/link";
import { useReveal } from "@/lib/useReveal";

export type RidingLevelKey = "foundation" | "progression" | "performance" | "elite";

export type PlanSummary = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  sessionCount: number;
};

function formatPrice(price: number): string {
  return `$${price.toFixed(2)}`;
}

const LEVELS: {
  index: string;
  name: string;
  level: RidingLevelKey;
  tag: string;
  desc: string;
  elite: boolean;
}[] = [
  {
    index: "01",
    name: "Foundation",
    level: "foundation",
    tag: "For new and returning riders",
    desc: "Balance, trust, and quiet hands. You'll learn to walk, halt, and steer with an instructor beside you at every stride.",
    elite: false,
  },
  {
    index: "02",
    name: "Progression",
    level: "progression",
    tag: "For riders finding their seat",
    desc: "Independent control at walk, trot, and canter. Poles and simple patterns build the instincts you'll rely on later.",
    elite: false,
  },
  {
    index: "03",
    name: "Performance",
    level: "performance",
    tag: "For riders sharpening technique",
    desc: "Technical jumping and dressage fundamentals, with course walks and flatwork that prepare you for your first shows.",
    elite: false,
  },
  {
    index: "04",
    name: "Elite",
    level: "elite",
    tag: "For competition-bound riders",
    desc: "A fully personalised circuit plan built with your coach — intensive private sessions, competition prep, and horse partnership guidance.",
    elite: true,
  },
];

export default function ProgramsSection({ plans }: { plans: Record<RidingLevelKey, PlanSummary[]> }) {
  const { ref, revealClassName } = useReveal<HTMLElement>();

  return (
    <section
      ref={ref}
      className={`program-preview ${revealClassName}`}
      id="programs"
      aria-labelledby="program-title"
    >
      <p className="eyebrow">
        <span></span> Your next stride
      </p>
      <h2 id="program-title">
        A plan shaped around
        <br />
        the rider you are becoming.
      </h2>
      <p>Beginner foundations through advanced performance, with every session tracked.</p>

      <div className="level-grid">
        {LEVELS.map((level) => {
          const levelPlans = plans[level.level] ?? [];
          return (
            <article key={level.name} className={`level-card${level.elite ? " level-card--elite" : ""}`}>
              <span className="level-index">{level.index}</span>
              <h3>{level.name}</h3>
              <p className="level-tag">{level.tag}</p>
              <p className="level-desc">{level.desc}</p>

              {levelPlans.length === 0 ? (
                <p className="level-desc">Plans coming soon.</p>
              ) : (
                levelPlans.map((plan) => {
                  const bullets = (plan.description ?? "")
                    .split(";")
                    .map((item) => item.trim())
                    .filter(Boolean);
                  return (
                    <div key={plan.id} className="level-plan-block">
                      {levelPlans.length > 1 && <p className="level-plan-name">{plan.name}</p>}
                      <p className="level-sessions">{plan.sessionCount} sessions</p>
                      {bullets.length > 0 && (
                        <ul className="level-includes">
                          {bullets.map((item) => (
                            <li key={item}>{item}</li>
                          ))}
                        </ul>
                      )}
                      <p className="level-price">{formatPrice(plan.price)} / month</p>
                    </div>
                  );
                })
              )}

              <Link className="text-button level-cta" href="/register">
                Enrol in {level.name}
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M5 12h13M13 7l5 5-5 5" />
                </svg>
              </Link>
            </article>
          );
        })}
      </div>
    </section>
  );
}
