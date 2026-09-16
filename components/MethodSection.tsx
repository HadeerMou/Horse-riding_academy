"use client";

import { useReveal } from "@/lib/useReveal";

const STEPS = [
  {
    index: "01",
    title: "Assess",
    body: "A trial session with a coach places you honestly at the level that fits — no guessing, no ego.",
  },
  {
    index: "02",
    title: "Personalize",
    body: "Your coach builds a riding plan around your goals, your horse, and your pace of progress.",
  },
  {
    index: "03",
    title: "Ride",
    body: "Weekly sessions, logged and reviewed, so every stride builds on the last.",
  },
];

export default function MethodSection() {
  const { ref, revealClassName } = useReveal<HTMLElement>();

  return (
    <section ref={ref} className={`method ${revealClassName}`} id="method" aria-labelledby="method-title">
      <p className="eyebrow eyebrow--light">
        <span></span> How it works
      </p>
      <h2 id="method-title">
        From first lesson to
        <br />
        <em>lifelong rider.</em>
      </h2>

      <div className="method-grid">
        {STEPS.map((step) => (
          <div className="method-step" key={step.index}>
            <span className="method-index">{step.index}</span>
            <h3>{step.title}</h3>
            <p>{step.body}</p>
          </div>
        ))}

        <div className="method-step">
          <span className="method-index">04</span>
          <h3>Track</h3>
          <p>
            Sign in anytime to <strong>My Sessions</strong> — see your plan, sessions completed,
            and what&apos;s remaining before your next level.
          </p>
        </div>
      </div>
    </section>
  );
}
