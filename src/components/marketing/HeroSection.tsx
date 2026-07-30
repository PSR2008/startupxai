import Link from "next/link";
import Lightfall from "./Lightfall";

const LIGHTFALL_COLORS = ["#A6C8FF", "#5227FF", "#FF9FFC"] as const;

export default function HeroSection() {
  return (
    <section className="resadex-hero relative isolate flex min-h-[100svh] items-center justify-center overflow-hidden">
      <div className="lightfall-hero-bg" aria-hidden="true">
        <Lightfall
          className="absolute inset-0"
          colors={LIGHTFALL_COLORS}
          backgroundColor="#0A29FF"
          speed={1}
          streakCount={8}
          streakWidth={1}
          streakLength={1}
          glow={1}
          density={1}
          twinkle={1}
          zoom={2}
          backgroundGlow={1}
          opacity={1}
          mouseInteraction={true}
          mouseStrength={1}
          mouseRadius={0.6}
        />
      </div>
      <div className="lightfall-hero-scrim" aria-hidden="true" />

      <div className="resadex-copy relative z-10 mx-auto flex w-full max-w-6xl flex-col items-center px-6 text-center">
        <p className="resadex-kicker">
          Evidence-backed founder workspace
        </p>
        <p className="resadex-example-label">
          Example assessment
        </p>

        <h1 className="resadex-title">
          <span>STARTUPX</span>
          <span>AI</span>
        </h1>

        <p className="resadex-subtitle">
          Add evidence from customer interviews, research and experiments. Connect it to your assumptions and decide what to test next.
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
