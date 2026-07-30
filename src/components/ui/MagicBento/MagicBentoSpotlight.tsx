"use client";

import { useEffect, type RefObject } from "react";
import { gsap } from "gsap";

const DEFAULT_GLOW_COLOR = "16, 185, 129";
const DEFAULT_SPOTLIGHT_RADIUS = 300;

export function calculateSpotlightValues(radius: number) {
  return {
    proximity: radius * 0.5,
    fadeDistance: radius * 0.75,
  };
}

export function updateCardGlowProperties(
  card: HTMLElement,
  mouseX: number,
  mouseY: number,
  intensity: number,
  radius: number,
) {
  const rect = card.getBoundingClientRect();
  const relativeX = ((mouseX - rect.left) / rect.width) * 100;
  const relativeY = ((mouseY - rect.top) / rect.height) * 100;

  card.style.setProperty("--glow-x", `${relativeX}%`);
  card.style.setProperty("--glow-y", `${relativeY}%`);
  card.style.setProperty("--glow-intensity", intensity.toString());
  card.style.setProperty("--glow-radius", `${radius}px`);
}

type MagicBentoSpotlightProps = {
  gridRef: RefObject<HTMLElement | null>;
  enabled?: boolean;
  disabled?: boolean;
  glowColor?: string;
  spotlightRadius?: number;
};

export default function MagicBentoSpotlight({
  gridRef,
  enabled = true,
  disabled = false,
  glowColor = DEFAULT_GLOW_COLOR,
  spotlightRadius = DEFAULT_SPOTLIGHT_RADIUS,
}: MagicBentoSpotlightProps) {
  useEffect(() => {
    if (!enabled || disabled || !gridRef.current) {
      return;
    }

    const spotlight = document.createElement("div");
    spotlight.className = "magic-bento-spotlight";
    spotlight.style.background = `radial-gradient(circle, rgba(${glowColor}, 0.13) 0%, rgba(${glowColor}, 0.06) 32%, transparent 68%)`;
    document.body.appendChild(spotlight);

    const resetCards = () => {
      const cards = gridRef.current?.querySelectorAll<HTMLElement>(".magic-bento-card") ?? [];
      cards.forEach((card) => card.style.setProperty("--glow-intensity", "0"));
    };

    const handleMouseMove = (event: MouseEvent) => {
      const grid = gridRef.current;
      if (!grid) {
        return;
      }

      const rect = grid.getBoundingClientRect();
      const inside =
        event.clientX >= rect.left &&
        event.clientX <= rect.right &&
        event.clientY >= rect.top &&
        event.clientY <= rect.bottom;

      if (!inside) {
        gsap.to(spotlight, { opacity: 0, duration: 0.22, overwrite: true });
        resetCards();
        return;
      }

      gsap.to(spotlight, {
        left: event.clientX,
        top: event.clientY,
        opacity: 1,
        duration: 0.18,
        ease: "power2.out",
        overwrite: true,
      });

      const { proximity, fadeDistance } = calculateSpotlightValues(spotlightRadius);
      const cards = grid.querySelectorAll<HTMLElement>(".magic-bento-card");

      cards.forEach((card) => {
        const cardRect = card.getBoundingClientRect();
        const centerX = cardRect.left + cardRect.width / 2;
        const centerY = cardRect.top + cardRect.height / 2;
        const distance = Math.hypot(event.clientX - centerX, event.clientY - centerY);
        const intensity = distance <= proximity ? 1 : Math.max(0, 1 - (distance - proximity) / fadeDistance);

        updateCardGlowProperties(card, event.clientX, event.clientY, intensity, spotlightRadius);
      });
    };

    const handleMouseLeave = () => {
      gsap.to(spotlight, { opacity: 0, duration: 0.22, overwrite: true });
      resetCards();
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseleave", handleMouseLeave);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseleave", handleMouseLeave);
      gsap.killTweensOf(spotlight);
      spotlight.remove();
    };
  }, [disabled, enabled, glowColor, gridRef, spotlightRadius]);

  return null;
}
