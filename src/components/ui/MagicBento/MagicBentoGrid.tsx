"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import MagicBentoSpotlight from "./MagicBentoSpotlight";
import "./MagicBento.css";

type MagicBentoGridProps = {
  children: ReactNode;
  className?: string;
  preset?: "marketing" | "app" | "plain";
  glowColor?: string;
  enableSpotlight?: boolean;
  disableAnimations?: boolean;
  spotlightRadius?: number;
  spotlightOpacity?: number;
};

export default function MagicBentoGrid({
  children,
  className,
  preset = "marketing",
  glowColor = "16, 185, 129",
  enableSpotlight = true,
  disableAnimations = false,
  spotlightRadius = 300,
  spotlightOpacity = 0.13,
}: MagicBentoGridProps) {
  const gridRef = useRef<HTMLDivElement | null>(null);
  const [motionDisabled, setMotionDisabled] = useState(true);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const mobile = window.matchMedia("(max-width: 767px)");

    const update = () => {
      setMotionDisabled(disableAnimations || reducedMotion.matches || mobile.matches);
    };

    update();
    reducedMotion.addEventListener("change", update);
    mobile.addEventListener("change", update);

    return () => {
      reducedMotion.removeEventListener("change", update);
      mobile.removeEventListener("change", update);
    };
  }, [disableAnimations]);

  useEffect(() => {
    const grid = gridRef.current;
    if (!grid) {
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => setIsVisible(Boolean(entry?.isIntersecting)),
      { rootMargin: "160px" },
    );

    observer.observe(grid);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={gridRef}
      className={cn("magic-bento-grid", className)}
      data-preset={preset}
      style={{ "--magic-bento-glow-color": glowColor } as CSSProperties}
    >
      <MagicBentoSpotlight
        gridRef={gridRef}
        disabled={motionDisabled}
        enabled={enableSpotlight && isVisible}
        glowColor={glowColor}
        spotlightRadius={spotlightRadius}
        spotlightOpacity={spotlightOpacity}
      />
      {children}
    </div>
  );
}
