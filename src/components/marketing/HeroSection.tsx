import Link from "next/link";

export default function HeroSection() {
  return (
    <section className="resadex-hero relative isolate flex min-h-[100svh] items-center justify-center overflow-hidden">
      <div className="resadex-liquid-field" aria-hidden="true">
        <div className="resadex-ring resadex-ring-one" />
        <div className="resadex-ring resadex-ring-two" />
        <div className="resadex-ring resadex-ring-three" />
        <div className="resadex-ring resadex-ring-four" />
      </div>
      <div className="resadex-center-bead" aria-hidden="true" />

      <div className="resadex-copy relative z-10 mx-auto flex w-full max-w-6xl flex-col items-center px-6 text-center">
        <p className="resadex-kicker">
          Evidence-backed founder workspace
        </p>

        <h1 className="resadex-title">
          <span>STARTUPX</span>
          <span>AI</span>
        </h1>

        <p className="resadex-subtitle">
          Collect market signals, assess assumptions, track experiments, and decide what to build next.
        </p>

        <div className="resadex-actions">
          <Link href="/signup?next=/evidence-engine">Start assessment</Link>
          <Link href="/#workflow">See workflow</Link>
        </div>
      </div>

      <div className="resadex-scroll-cue" aria-hidden="true">
        Scroll down
      </div>
    </section>
  );
}
