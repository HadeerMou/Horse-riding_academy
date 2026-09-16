"use client";

import { useReveal } from "@/lib/useReveal";

const STATS = [
  { value: "12", label: "Years\nteaching" },
  { value: "18", label: "Academy\nhorses" },
  { value: "6", label: "Resident\ncoaches" },
  { value: "40", label: "Forest acres\nof trails" },
];

export default function StorySection() {
  const { ref, revealClassName } = useReveal<HTMLElement>();

  return (
    <section ref={ref} className={`story ${revealClassName}`} id="story" aria-labelledby="story-title">
      <div className="story-copy">
        <p className="eyebrow">
          <span></span> The academy
        </p>
        <h2 id="story-title">
          Stables in the
          <br />
          <em>heart of the forest.</em>
        </h2>
        <p>
          Nocturne began as a single stable and a belief: that riding is taught best away from
          noise, at the pace of the horse. Today our instructors and horses share forest trails,
          a covered arena, and a community built one lesson at a time.
        </p>
        <p>
          Every coach here rides daily. Every horse is chosen for temperament as much as
          training. It&apos;s a small academy, deliberately — so your progress is never a number
          on a roster.
        </p>
      </div>
      <div className="story-stats" aria-label="Academy in numbers">
        {STATS.map((stat) => (
          <div key={stat.value + stat.label}>
            <strong>{stat.value}</strong>
            <span>
              {stat.label.split("\n").map((line, i) => (
                <span key={i}>
                  {i > 0 && <br />}
                  {line}
                </span>
              ))}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
