"use client";

import { useCallback, useLayoutEffect, useRef } from "react";
import type { ReactNode } from "react";
import Lenis from "lenis";
import "./ScrollStack.css";

type TransformState = {
  translateY: number;
  scale: number;
  rotation: number;
  blur: number;
};

type ScrollData = {
  scrollTop: number;
  containerHeight: number;
};

export type ScrollStackItemProps = {
  children: ReactNode;
  itemClassName?: string;
  id?: string;
};

export type ScrollStackProps = {
  children: ReactNode;
  className?: string;
  itemDistance?: number;
  itemScale?: number;
  itemStackDistance?: number;
  stackPosition?: string;
  scaleEndPosition?: string;
  baseScale?: number;
  scaleDuration?: number;
  rotationAmount?: number;
  blurAmount?: number;
  useWindowScroll?: boolean;
  onStackComplete?: () => void;
};

export const ScrollStackItem = ({ children, itemClassName = "", id }: ScrollStackItemProps) => (
  <article id={id} className={`scroll-stack-card ${itemClassName}`.trim()}>
    {children}
  </article>
);

const ScrollStack = ({
  children,
  className = "",
  itemDistance = 100,
  itemScale = 0.03,
  itemStackDistance = 30,
  stackPosition = "20%",
  scaleEndPosition = "10%",
  baseScale = 0.85,
  scaleDuration = 0.5,
  rotationAmount = 0,
  blurAmount = 0,
  useWindowScroll = false,
  onStackComplete,
}: ScrollStackProps) => {
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const stackCompletedRef = useRef(false);
  const animationFrameRef = useRef<number | null>(null);
  const lenisRef = useRef<Lenis | null>(null);
  const cardsRef = useRef<HTMLElement[]>([]);
  const lastTransformsRef = useRef<Map<number, TransformState>>(new Map());
  const isUpdatingRef = useRef(false);
  const isActiveRef = useRef(true);
  const isStaticLayoutRef = useRef(false);

  const calculateProgress = useCallback((scrollTop: number, start: number, end: number) => {
    if (scrollTop < start) return 0;
    if (scrollTop > end) return 1;
    return (scrollTop - start) / (end - start);
  }, []);

  const parsePercentage = useCallback((value: string | number, containerHeight: number) => {
    if (typeof value === "string" && value.includes("%")) {
      return (parseFloat(value) / 100) * containerHeight;
    }
    return typeof value === "number" ? value : parseFloat(value);
  }, []);

  const getScrollData = useCallback((): ScrollData => {
    if (useWindowScroll) {
      return {
        scrollTop: window.scrollY,
        containerHeight: window.innerHeight,
      };
    }

    const scroller = scrollerRef.current;
    return {
      scrollTop: scroller?.scrollTop ?? 0,
      containerHeight: scroller?.clientHeight ?? window.innerHeight,
    };
  }, [useWindowScroll]);

  const getElementOffset = useCallback(
    (element: HTMLElement) => {
      if (useWindowScroll) {
        const rect = element.getBoundingClientRect();
        return rect.top + window.scrollY;
      }
      return element.offsetTop;
    },
    [useWindowScroll],
  );

  const resetCardsForStaticLayout = useCallback(() => {
    cardsRef.current.forEach((card) => {
      card.style.marginBottom = "";
      card.style.willChange = "auto";
      card.style.transformOrigin = "";
      card.style.backfaceVisibility = "";
      card.style.transform = "";
      card.style.webkitTransform = "";
      card.style.perspective = "";
      card.style.webkitPerspective = "";
      card.style.filter = "";
    });
    lastTransformsRef.current.clear();
  }, []);

  const updateCardTransforms = useCallback(() => {
    if (!cardsRef.current.length || isUpdatingRef.current || isStaticLayoutRef.current || !isActiveRef.current) return;

    isUpdatingRef.current = true;

    const { scrollTop, containerHeight } = getScrollData();
    const stackPositionPx = parsePercentage(stackPosition, containerHeight);
    const scaleEndPositionPx = parsePercentage(scaleEndPosition, containerHeight);

    const root = scrollerRef.current;
    const endElement = root?.querySelector<HTMLElement>(".scroll-stack-end");
    const endElementTop = endElement ? getElementOffset(endElement) : 0;

    cardsRef.current.forEach((card, i) => {
      const cardTop = getElementOffset(card);
      const triggerStart = cardTop - stackPositionPx - itemStackDistance * i;
      const triggerEnd = cardTop - scaleEndPositionPx;
      const pinStart = cardTop - stackPositionPx - itemStackDistance * i;
      const pinEnd = endElementTop - containerHeight / 2;

      const scaleProgress = calculateProgress(scrollTop, triggerStart, triggerEnd);
      const targetScale = baseScale + i * itemScale;
      const scale = 1 - scaleProgress * (1 - targetScale);
      const rotation = rotationAmount ? i * rotationAmount * scaleProgress : 0;

      let blur = 0;
      if (blurAmount) {
        let topCardIndex = 0;
        for (let j = 0; j < cardsRef.current.length; j++) {
          const jCardTop = getElementOffset(cardsRef.current[j]);
          const jTriggerStart = jCardTop - stackPositionPx - itemStackDistance * j;
          if (scrollTop >= jTriggerStart) topCardIndex = j;
        }

        if (i < topCardIndex) {
          const depthInStack = topCardIndex - i;
          blur = Math.max(0, depthInStack * blurAmount);
        }
      }

      let translateY = 0;
      const isPinned = scrollTop >= pinStart && scrollTop <= pinEnd;

      if (isPinned) {
        translateY = scrollTop - cardTop + stackPositionPx + itemStackDistance * i;
      } else if (scrollTop > pinEnd) {
        translateY = pinEnd - cardTop + stackPositionPx + itemStackDistance * i;
      }

      const newTransform: TransformState = {
        translateY: Math.round(translateY * 100) / 100,
        scale: Math.round(scale * 1000) / 1000,
        rotation: Math.round(rotation * 100) / 100,
        blur: Math.round(blur * 100) / 100,
      };

      const lastTransform = lastTransformsRef.current.get(i);
      const hasChanged =
        !lastTransform ||
        Math.abs(lastTransform.translateY - newTransform.translateY) > 0.1 ||
        Math.abs(lastTransform.scale - newTransform.scale) > 0.001 ||
        Math.abs(lastTransform.rotation - newTransform.rotation) > 0.1 ||
        Math.abs(lastTransform.blur - newTransform.blur) > 0.1;

      if (hasChanged) {
        const transform = `translate3d(0, ${newTransform.translateY}px, 0) scale(${newTransform.scale}) rotate(${newTransform.rotation}deg)`;
        const filter = newTransform.blur > 0 ? `blur(${newTransform.blur}px)` : "";

        card.style.transform = transform;
        card.style.filter = filter;
        lastTransformsRef.current.set(i, newTransform);
      }

      if (i === cardsRef.current.length - 1) {
        const isInView = scrollTop >= pinStart && scrollTop <= pinEnd;
        if (isInView && !stackCompletedRef.current) {
          stackCompletedRef.current = true;
          onStackComplete?.();
        } else if (!isInView && stackCompletedRef.current) {
          stackCompletedRef.current = false;
        }
      }
    });

    isUpdatingRef.current = false;
  }, [
    itemScale,
    itemStackDistance,
    stackPosition,
    scaleEndPosition,
    baseScale,
    rotationAmount,
    blurAmount,
    onStackComplete,
    calculateProgress,
    parsePercentage,
    getScrollData,
    getElementOffset,
  ]);

  const handleScroll = useCallback(() => {
    updateCardTransforms();
  }, [updateCardTransforms]);

  const setupLenis = useCallback(() => {
    if (isStaticLayoutRef.current) return;

    if (useWindowScroll) {
      const lenis = new Lenis({
        duration: 1.2,
        easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
        smoothWheel: true,
        touchMultiplier: 2,
        infinite: false,
        wheelMultiplier: 1,
        lerp: 0.1,
        syncTouch: true,
        syncTouchLerp: 0.075,
      });

      lenis.on("scroll", handleScroll);

      const raf = (time: number) => {
        lenis.raf(time);
        animationFrameRef.current = requestAnimationFrame(raf);
      };
      animationFrameRef.current = requestAnimationFrame(raf);

      lenisRef.current = lenis;
      return;
    }

    const scroller = scrollerRef.current;
    if (!scroller) return;

    const lenis = new Lenis({
      wrapper: scroller,
      content: scroller.querySelector<HTMLElement>(".scroll-stack-inner") ?? undefined,
      duration: 1.2,
      easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
      touchMultiplier: 2,
      infinite: false,
      wheelMultiplier: 1,
      lerp: 0.1,
      syncTouch: true,
      syncTouchLerp: 0.075,
    });

    lenis.on("scroll", handleScroll);

    const raf = (time: number) => {
      lenis.raf(time);
      animationFrameRef.current = requestAnimationFrame(raf);
    };
    animationFrameRef.current = requestAnimationFrame(raf);

    lenisRef.current = lenis;
  }, [handleScroll, useWindowScroll]);

  useLayoutEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;

    const cards = Array.from(scroller.querySelectorAll<HTMLElement>(".scroll-stack-card"));
    cardsRef.current = cards;
    const transformsCache = lastTransformsRef.current;
    const reducedMotionMedia = window.matchMedia("(prefers-reduced-motion: reduce)");
    const smallViewportMedia = window.matchMedia("(max-width: 767px)");

    const configureLayoutMode = () => {
      isStaticLayoutRef.current = reducedMotionMedia.matches || smallViewportMedia.matches;
      scroller.classList.toggle("scroll-stack-no-motion", isStaticLayoutRef.current);
    };

    configureLayoutMode();

    if (isStaticLayoutRef.current) {
      resetCardsForStaticLayout();
    } else {
      cards.forEach((card, i) => {
        if (i < cards.length - 1) card.style.marginBottom = `${itemDistance}px`;
        card.style.willChange = "transform, filter";
        card.style.transformOrigin = "top center";
        card.style.backfaceVisibility = "hidden";
        card.style.transform = "translateZ(0)";
        card.style.webkitTransform = "translateZ(0)";
        card.style.perspective = "1000px";
        card.style.webkitPerspective = "1000px";
        card.style.transition = `transform ${scaleDuration}s cubic-bezier(0.16, 1, 0.3, 1), filter ${scaleDuration}s cubic-bezier(0.16, 1, 0.3, 1)`;
      });
      setupLenis();
      updateCardTransforms();
    }

    const onMediaChange = () => {
      const wasStatic = isStaticLayoutRef.current;
      configureLayoutMode();
      if (isStaticLayoutRef.current) {
        if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
        lenisRef.current?.destroy();
        lenisRef.current = null;
        resetCardsForStaticLayout();
      } else if (wasStatic) {
        cards.forEach((card, i) => {
          if (i < cards.length - 1) card.style.marginBottom = `${itemDistance}px`;
          card.style.willChange = "transform, filter";
          card.style.transformOrigin = "top center";
          card.style.backfaceVisibility = "hidden";
          card.style.transform = "translateZ(0)";
          card.style.webkitTransform = "translateZ(0)";
          card.style.perspective = "1000px";
          card.style.webkitPerspective = "1000px";
        });
        setupLenis();
        updateCardTransforms();
      }
    };

    const observer = new IntersectionObserver(
      ([entry]) => {
        isActiveRef.current = entry.isIntersecting;
        if (entry.isIntersecting) updateCardTransforms();
      },
      { rootMargin: "700px 0px" },
    );
    observer.observe(scroller);

    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("resize", handleScroll, { passive: true });
    reducedMotionMedia.addEventListener("change", onMediaChange);
    smallViewportMedia.addEventListener("change", onMediaChange);

    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
      lenisRef.current?.destroy();
      lenisRef.current = null;
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", handleScroll);
      reducedMotionMedia.removeEventListener("change", onMediaChange);
      smallViewportMedia.removeEventListener("change", onMediaChange);
      observer.disconnect();
      stackCompletedRef.current = false;
      resetCardsForStaticLayout();
      cardsRef.current = [];
      transformsCache.clear();
      isUpdatingRef.current = false;
    };
  }, [
    itemDistance,
    scaleDuration,
    resetCardsForStaticLayout,
    setupLenis,
    updateCardTransforms,
    handleScroll,
  ]);

  const noMotionClass = "scroll-stack-motion-aware";

  return (
    <div className={`scroll-stack-scroller ${noMotionClass} ${className}`.trim()} ref={scrollerRef}>
      <div className="scroll-stack-inner">
        {children}
        <div className="scroll-stack-end" />
      </div>
    </div>
  );
};

export default ScrollStack;
