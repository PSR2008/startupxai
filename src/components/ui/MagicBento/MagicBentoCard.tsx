"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from "react";
import { gsap } from "gsap";
import { cn } from "@/lib/utils";

const DEFAULT_GLOW_COLOR = "16, 185, 129";
const DEFAULT_PARTICLE_COUNT = 10;

type MagicBentoCardProps = {
  children: ReactNode;
  className?: string;
  contentClassName?: string;
  href?: string;
  interactive?: boolean;
  disabled?: boolean;
  enableStars?: boolean;
  enableBorderGlow?: boolean;
  enableTilt?: boolean;
  enableMagnetism?: boolean;
  clickEffect?: boolean;
  particleCount?: number;
  glowColor?: string;
  style?: CSSProperties;
  as?: "article" | "section" | "div";
};

function createParticleElement(x: number, y: number, color: string): HTMLDivElement {
  const particle = document.createElement("div");
  particle.className = "magic-bento-particle";
  particle.style.left = `${x}px`;
  particle.style.top = `${y}px`;
  particle.style.background = `rgba(${color}, 0.78)`;
  particle.style.boxShadow = `0 0 9px rgba(${color}, 0.55)`;
  return particle;
}

function useMotionDisabled(disabled?: boolean) {
  const [motionDisabled, setMotionDisabled] = useState(true);

  useEffect(() => {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const mobile = window.matchMedia("(max-width: 767px)");

    const update = () => {
      setMotionDisabled(Boolean(disabled) || reducedMotion.matches || mobile.matches);
    };

    update();
    reducedMotion.addEventListener("change", update);
    mobile.addEventListener("change", update);

    return () => {
      reducedMotion.removeEventListener("change", update);
      mobile.removeEventListener("change", update);
    };
  }, [disabled]);

  return motionDisabled;
}

export default function MagicBentoCard({
  children,
  className,
  contentClassName,
  href,
  interactive,
  disabled = false,
  enableStars = false,
  enableBorderGlow = true,
  enableTilt = false,
  enableMagnetism = false,
  clickEffect = false,
  particleCount = DEFAULT_PARTICLE_COUNT,
  glowColor = DEFAULT_GLOW_COLOR,
  style,
  as = "article",
}: MagicBentoCardProps) {
  const cardRef = useRef<HTMLElement | null>(null);
  const particleRefs = useRef<HTMLDivElement[]>([]);
  const cleanupRefs = useRef<number[]>([]);
  const motionDisabled = useMotionDisabled(disabled);
  const isInteractive = Boolean(interactive || href);

  const setCardNode = useCallback((node: HTMLElement | null) => {
    cardRef.current = node;
  }, []);

  const clearParticles = useCallback(() => {
    cleanupRefs.current.forEach((timeout) => window.clearTimeout(timeout));
    cleanupRefs.current = [];
    particleRefs.current.forEach((particle) => {
      gsap.killTweensOf(particle);
      particle.remove();
    });
    particleRefs.current = [];
  }, []);

  useEffect(() => {
    const card = cardRef.current;
    if (!card || motionDisabled) {
      return;
    }

    const handleMouseMove = (event: MouseEvent) => {
      const rect = card.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;

      if (enableTilt) {
        const rotateX = ((y / rect.height) - 0.5) * -6;
        const rotateY = ((x / rect.width) - 0.5) * 6;
        gsap.to(card, {
          rotateX,
          rotateY,
          transformPerspective: 900,
          duration: 0.35,
          ease: "power2.out",
          overwrite: true,
        });
      }

      if (enableMagnetism && isInteractive) {
        gsap.to(card, {
          x: (x - rect.width / 2) * 0.035,
          y: (y - rect.height / 2) * 0.035,
          duration: 0.45,
          ease: "power2.out",
          overwrite: "auto",
        });
      }
    };

    const handleMouseLeave = () => {
      gsap.to(card, {
        x: 0,
        y: 0,
        rotateX: 0,
        rotateY: 0,
        duration: 0.45,
        ease: "elastic.out(1, 0.55)",
        overwrite: true,
      });
      clearParticles();
    };

    const handleMouseEnter = () => {
      if (!enableStars) {
        return;
      }

      clearParticles();
      const rect = card.getBoundingClientRect();
      const spawnCount = Math.max(0, particleCount);

      for (let index = 0; index < spawnCount; index += 1) {
        const particle = createParticleElement(Math.random() * rect.width, Math.random() * rect.height, glowColor);
        card.appendChild(particle);
        particleRefs.current.push(particle);

        gsap.fromTo(
          particle,
          { opacity: 0, scale: 0 },
          {
            opacity: 1,
            scale: Math.random() * 0.7 + 0.55,
            duration: 0.24,
            delay: index * 0.018,
            ease: "power2.out",
          },
        );

        gsap.to(particle, {
          x: (Math.random() - 0.5) * 46,
          y: (Math.random() - 0.5) * 46,
          opacity: 0,
          duration: 1.25,
          delay: 0.28 + Math.random() * 0.42,
          ease: "power2.out",
        });

        cleanupRefs.current.push(window.setTimeout(() => particle.remove(), 1800));
      }
    };

    card.addEventListener("mousemove", handleMouseMove);
    card.addEventListener("mouseenter", handleMouseEnter);
    card.addEventListener("mouseleave", handleMouseLeave);

    return () => {
      card.removeEventListener("mousemove", handleMouseMove);
      card.removeEventListener("mouseenter", handleMouseEnter);
      card.removeEventListener("mouseleave", handleMouseLeave);
      gsap.killTweensOf(card);
      clearParticles();
    };
  }, [
    clearParticles,
    clickEffect,
    enableMagnetism,
    enableStars,
    enableTilt,
    glowColor,
    isInteractive,
    motionDisabled,
    particleCount,
  ]);

  const handleClick = (event: ReactMouseEvent<HTMLElement>) => {
    if (!clickEffect || motionDisabled || disabled || !cardRef.current) {
      return;
    }

    const card = cardRef.current;
    const rect = card.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height) * 1.25;
    const ripple = document.createElement("span");

    ripple.className = "magic-bento-ripple";
    ripple.style.width = `${size}px`;
    ripple.style.height = `${size}px`;
    ripple.style.left = `${event.clientX - rect.left - size / 2}px`;
    ripple.style.top = `${event.clientY - rect.top - size / 2}px`;
    ripple.style.background = `radial-gradient(circle, rgba(${glowColor}, 0.2) 0%, transparent 70%)`;

    card.appendChild(ripple);
    gsap.fromTo(ripple, { scale: 0, opacity: 1 }, { scale: 1, opacity: 0, duration: 0.55, ease: "power2.out" });
    window.setTimeout(() => ripple.remove(), 650);
  };

  const mergedStyle = { ...style, "--magic-bento-glow-color": glowColor } as CSSProperties;
  const classes = cn(
    "magic-bento-card rounded-[var(--radius-lg)]",
    enableBorderGlow && "magic-bento-card--border-glow",
    className,
  );
  const content = <div className={cn("magic-bento-card__content", contentClassName)}>{children}</div>;

  if (href) {
    return (
      <Link
        ref={setCardNode}
        href={href}
        className={classes}
        style={mergedStyle}
        data-interactive={isInteractive}
        data-disabled={motionDisabled}
        onClick={handleClick}
      >
        {content}
      </Link>
    );
  }

  const Element = as;
  return (
    <Element
      ref={setCardNode}
      className={classes}
      style={mergedStyle}
      data-interactive={isInteractive}
      data-disabled={motionDisabled}
      onClick={handleClick}
    >
      {content}
    </Element>
  );
}
