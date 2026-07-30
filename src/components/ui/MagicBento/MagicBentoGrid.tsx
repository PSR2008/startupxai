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
};

export default function MagicBentoGrid({
  children,
  className,
  preset = "marketing",
  glowColor = "16, 185, 129",
  enableSpotlight = true,
  disableAnimations = false,
  spotlightRadius = 300,
}: MagicBentoGridProps) {
  const gridRef = useRef<HTMLDivElement | null>(null);
  const [motionDisabled, setMotionDisabled] = useState(true);

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

  return (
    <div
      ref={gridRef}
      className={cn("magic-bento-grid", className)}
      data-preset={preset}
      style={{ "--magic-bento-glow-color": glowColor } as CSSProperties}
    >
      <MagicBentoSpotlight
        gridRef={gridRef}
        enabled={enableSpotlight}
        disabled={motionDisabled}
        glowColor={glowColor}
        spotlightRadius={spotlightRadius}
      />
      {children}
    </div>
  );
}
