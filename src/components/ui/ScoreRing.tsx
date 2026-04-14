"use client";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface ScoreRingProps {
  score: number;
  size?: number;
  strokeWidth?: number;
  label?: string;
  sublabel?: string;
  colorClass?: string;
  className?: string;
  animate?: boolean;
}

export default function ScoreRing({ score, size = 120, strokeWidth = 8, label, sublabel, colorClass, className, animate = true }: ScoreRingProps) {
  const [displayScore, setDisplayScore] = useState(animate ? 0 : score);
  const [progress, setProgress] = useState(animate ? 0 : score);

  const radius = (size - strokeWidth * 2) / 2;
  const circumference = 2 * Math.PI * radius;
  const center = size / 2;

  const getColor = () => {
    if (colorClass) return colorClass;
    if (score >= 75) return "#10b981";
    if (score >= 50) return "#f59e0b";
    return "#f43f5e";
  };

  const strokeDashoffset = circumference - (progress / 100) * circumference;

  useEffect(() => {
    if (!animate) return;
    const duration = 1400;
    const startTime = performance.now();
    const tick = (now: number) => {
      const elapsed = now - startTime;
      const t = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplayScore(Math.round(eased * score));
      setProgress(eased * score);
      if (t < 1) requestAnimationFrame(tick);
    };
    const frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [score, animate]);

  const color = getColor();

  const getScoreLabel = () => {
    if (score >= 75) return "Strong";
    if (score >= 50) return "Moderate";
    return "Needs Work";
  };

  // Track color depends on score tier
  const trackColor = score >= 75 ? "rgba(16,185,129,0.12)" : score >= 50 ? "rgba(245,158,11,0.12)" : "rgba(244,63,94,0.12)";

  return (
    <div className={cn("flex flex-col items-center gap-2", className)}>
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} fill="none" className="-rotate-90">
          <circle cx={center} cy={center} r={radius} stroke={trackColor} strokeWidth={strokeWidth} fill="none" />
          <circle
            cx={center} cy={center} r={radius} stroke={color} strokeWidth={strokeWidth} fill="none"
            strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={strokeDashoffset}
            style={{ filter: `drop-shadow(0 0 4px ${color}60)` }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-bricolage font-bold leading-none tabular-nums" style={{ fontSize: size * 0.22, color }}>
            {displayScore}
          </span>
          <span className="font-jakarta text-gray-400 leading-none mt-0.5" style={{ fontSize: size * 0.1 }}>
            / 100
          </span>
        </div>
      </div>
      <div className="text-center">
        {label && <p className="font-bricolage text-sm font-semibold text-gray-800">{label}</p>}
        <p className="font-jakarta text-xs text-gray-400 mt-0.5">{sublabel ?? getScoreLabel()}</p>
      </div>
    </div>
  );
}
