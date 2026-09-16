"use client";

import { useEffect, useRef, useState } from "react";

const GALLOP_START = 0.05;
const GALLOP_END = 5.8;

export default function Hero() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    function startAtGallop() {
      if (!video) return;
      video.currentTime = GALLOP_START;
      if (reducedMotion) {
        video.pause();
        setPaused(true);
      } else {
        video
          .play()
          .then(() => setPaused(false))
          .catch(() => setPaused(true));
      }
    }

    if (video.readyState >= 1) startAtGallop();
    else video.addEventListener("loadedmetadata", startAtGallop, { once: true });

    function onTimeUpdate() {
      if (!video) return;
      if (video.currentTime >= GALLOP_END || video.currentTime < GALLOP_START - 0.3) {
        video.currentTime = GALLOP_START;
      }
    }
    video.addEventListener("timeupdate", onTimeUpdate);

    return () => {
      video.removeEventListener("loadedmetadata", startAtGallop);
      video.removeEventListener("timeupdate", onTimeUpdate);
    };
  }, []);

  function toggleMotion() {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      video.play().then(() => setPaused(false));
    } else {
      video.pause();
      setPaused(true);
    }
  }

  return (
    <section className="hero" aria-labelledby="hero-title">
      <div className="hero-copy">
        <p className="eyebrow">
          <span></span> Move as one
        </p>
        <h1 id="hero-title">
          RIDE
          <br />
          <em>BEYOND</em>
          <br />
          LIMITS.
        </h1>
        <p className="hero-intro">
          Thoughtful coaching, remarkable horses, and a clear path forward—from your first
          confident stride to the competition arena.
        </p>
        <div className="hero-cta-row">
          <a className="primary-button" href="#programs">
            Explore riding plans
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M5 12h13M13 7l5 5-5 5" />
            </svg>
          </a>
          <button
            className="sound-button"
            type="button"
            aria-label={paused ? "Play horse film" : "Pause horse film"}
            aria-pressed={paused}
            onClick={toggleMotion}
          >
            <span className="sound-bars" aria-hidden="true">
              <i></i>
              <i></i>
              <i></i>
              <i></i>
            </span>
            <span className="sound-label">{paused ? "Film paused" : "Running now"}</span>
          </button>
        </div>
      </div>

      <div className="stage" aria-label="Film of a real horse galloping across a field">
        <div className="stage-word" aria-hidden="true">
          EQUESTRIAN
        </div>
        <video ref={videoRef} id="horse-video" autoPlay muted loop playsInline preload="auto">
          <source src="/assets/horse-forest.mp4" type="video/mp4" />
        </video>
        <div className="dust" aria-hidden="true"></div>
        <div className="film-note" aria-hidden="true">
          <span></span> The gallop · Film 01
        </div>
      </div>

      <div className="hero-meta" aria-label="Academy highlights">
        <div>
          <strong>04</strong>
          <span>
            Progressive
            <br />
            riding levels
          </span>
        </div>
        <div>
          <strong>1:1</strong>
          <span>
            Personal
            <br />
            coach guidance
          </span>
        </div>
        <div>
          <strong>∞</strong>
          <span>
            A lifelong
            <br />
            partnership
          </span>
        </div>
      </div>

      <div className="scroll-note" aria-hidden="true">
        <span></span> Discover the academy
      </div>
    </section>
  );
}
