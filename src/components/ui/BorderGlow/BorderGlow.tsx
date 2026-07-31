"use client";

import type { CSSProperties, HTMLAttributes, ReactNode } from "react";
import { useCallback, useRef } from "react";
import { cn } from "@/lib/utils";
import "./BorderGlow.css";

type BorderGlowProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
  glowColor?: string;
  intensity?: number;
  recommended?: boolean;
};

export default function BorderGlow({
  children,
  className,
  glowColor = "16, 185, 129",
  intensity = 0.42,
  recommended = false,
  style,
  ...props
}: BorderGlowProps) {
  const ref = useRef<HTMLDivElement>(null);

  const updatePointer = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const node = ref.current;
    if (!node) return;
    const rect = node.getBoundingClientRect();
    node.style.setProperty("--border-glow-x", `${event.clientX - rect.left}px`);
    node.style.setProperty("--border-glow-y", `${event.clientY - rect.top}px`);
  }, []);

  const resetPointer = useCallback(() => {
    const node = ref.current;
    if (!node) return;
    node.style.setProperty("--border-glow-x", "50%");
    node.style.setProperty("--border-glow-y", "0%");
  }, []);

  return (
    <div
      ref={ref}
      className={cn("border-glow", recommended && "border-glow--recommended", className)}
      onPointerMove={updatePointer}
      onPointerLeave={resetPointer}
      style={
        {
          "--border-glow-color": glowColor,
          "--border-glow-strength": String(intensity),
          ...style,
        } as CSSProperties
      }
      {...props}
    >
      <div className="border-glow__content">{children}</div>
    </div>
  );
}
