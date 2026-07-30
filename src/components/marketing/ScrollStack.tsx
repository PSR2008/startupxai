"use client";

import { useCallback, useLayoutEffect, useRef } from "react";
import type { ReactNode } from "react";
import "./ScrollStack.css";

type TransformState = {
  translateY: number;
  scale: number;
  rotation: number;
};

type GeometryCache = {
  cardTops: number[];
  endTop: number;
  viewportHeight: number;
  stackPositionPx: number;
  scaleEndPositionPx: number;
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

const parsePosition = (value: string | number, viewportHeight: number) => {
  if (typeof value === "string" && value.includes("%")) {
    return (parseFloat(value) / 100) * viewportHeight;
  }
  return typeof value === "number" ? value : parseFloat(value);
};

const calculateProgress = (scrollTop: number, start: number, end: number) => {
  if (scrollTop < start) return 0;
  if (scrollTop > end) return 1;
  return (scrollTop - start) / Math.max(end - start, 1);
};

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
  const cardsRef = useRef<HTMLElement[]>([]);
  const geometryRef = useRef<GeometryCache | null>(null);
  const lastTransformsRef = useRef<Map<number, TransformState>>(new Map());
  const scheduledFrameRef = useRef<number | null>(null);
  const stackCompletedRef = useRef(false);
  const isActiveRef = useRef(false);
  const isStaticLayoutRef = useRef(false);

  const getScrollTop = useCallback(() => {
    if (useWindowScroll) return window.scrollY;
    return scrollerRef.current?.scrollTop ?? 0;
  }, [useWindowScroll]);

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
      card.style.transition = "";
    });
    lastTransformsRef.current.clear();
  }, []);

  const recalculateGeometry = useCallback(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;

    const viewportHeight = useWindowScroll ? window.innerHeight : scroller.clientHeight;
    const endElement = scroller.querySelector<HTMLElement>(".scroll-stack-end");

    geometryRef.current = {
      cardTops: cardsRef.current.map((card) => card.getBoundingClientRect().top + window.scrollY),
      endTop: endElement ? endElement.getBoundingClientRect().top + window.scrollY : 0,
      viewportHeight,
      stackPositionPx: parsePosition(stackPosition, viewportHeight),
      scaleEndPositionPx: parsePosition(scaleEndPosition, viewportHeight),
    };
  }, [scaleEndPosition, stackPosition, useWindowScroll]);

  const updateCardTransforms = useCallback(() => {
    scheduledFrameRef.current = null;
    if (!cardsRef.current.length || isStaticLayoutRef.current || !isActiveRef.current) return;

    const geometry = geometryRef.current;
    if (!geometry) return;

    const scrollTop = getScrollTop();
    const pinEnd = geometry.endTop - geometry.viewportHeight / 2;

    cardsRef.current.forEach((card, index) => {
      const cardTop = geometry.cardTops[index];
      const triggerStart = cardTop - geometry.stackPositionPx - itemStackDistance * index;
      const triggerEnd = cardTop - geometry.scaleEndPositionPx;
      const pinStart = triggerStart;
      const scaleProgress = calculateProgress(scrollTop, triggerStart, triggerEnd);
      const targetScale = baseScale + index * itemScale;
      const scale = 1 - scaleProgress * (1 - targetScale);
      const rotation = rotationAmount ? index * rotationAmount * scaleProgress : 0;
      let translateY = 0;

      if (scrollTop >= pinStart && scrollTop <= pinEnd) {
        translateY = scrollTop - cardTop + geometry.stackPositionPx + itemStackDistance * index;
      } else if (scrollTop > pinEnd) {
        translateY = pinEnd - cardTop + geometry.stackPositionPx + itemStackDistance * index;
      }

      const nextTransform: TransformState = {
        translateY: Math.round(translateY * 100) / 100,
        scale: Math.round(scale * 1000) / 1000,
        rotation: Math.round(rotation * 100) / 100,
      };
      const previous = lastTransformsRef.current.get(index);
      const changed =
        !previous ||
        Math.abs(previous.translateY - nextTransform.translateY) > 0.1 ||
        Math.abs(previous.scale - nextTransform.scale) > 0.001 ||
        Math.abs(previous.rotation - nextTransform.rotation) > 0.1;

      if (changed) {
        card.style.transform = `translate3d(0, ${nextTransform.translateY}px, 0) scale(${nextTransform.scale}) rotate(${nextTransform.rotation}deg)`;
        lastTransformsRef.current.set(index, nextTransform);
      }

      if (index === cardsRef.current.length - 1) {
        const isInView = scrollTop >= pinStart && scrollTop <= pinEnd;
        if (isInView && !stackCompletedRef.current) {
          stackCompletedRef.current = true;
          onStackComplete?.();
        } else if (!isInView && stackCompletedRef.current) {
          stackCompletedRef.current = false;
        }
      }
    });
  }, [baseScale, getScrollTop, itemScale, itemStackDistance, onStackComplete, rotationAmount]);

  const scheduleTransformUpdate = useCallback(() => {
    if (scheduledFrameRef.current !== null || isStaticLayoutRef.current) return;
    scheduledFrameRef.current = requestAnimationFrame(updateCardTransforms);
  }, [updateCardTransforms]);

  const scheduleGeometryUpdate = useCallback(() => {
    recalculateGeometry();
    scheduleTransformUpdate();
  }, [recalculateGeometry, scheduleTransformUpdate]);

  useLayoutEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;

    const reducedMotionMedia = window.matchMedia("(prefers-reduced-motion: reduce)");
    const smallViewportMedia = window.matchMedia("(max-width: 767px)");
    cardsRef.current = Array.from(scroller.querySelectorAll<HTMLElement>(".scroll-stack-card"));

    const configureLayout = () => {
      isStaticLayoutRef.current = reducedMotionMedia.matches || smallViewportMedia.matches;
      scroller.classList.toggle("scroll-stack-no-motion", isStaticLayoutRef.current);

      if (isStaticLayoutRef.current) {
        resetCardsForStaticLayout();
        return;
      }

      cardsRef.current.forEach((card, index) => {
        if (index < cardsRef.current.length - 1) card.style.marginBottom = `${itemDistance}px`;
        card.style.willChange = "transform";
        card.style.transformOrigin = "top center";
        card.style.backfaceVisibility = "hidden";
        card.style.transform = "translateZ(0)";
        card.style.webkitTransform = "translateZ(0)";
        card.style.perspective = "1000px";
        card.style.webkitPerspective = "1000px";
        card.style.transition = `transform ${scaleDuration}s cubic-bezier(0.16, 1, 0.3, 1)`;
      });
      recalculateGeometry();
      scheduleTransformUpdate();
    };

    configureLayout();

    const onScroll = () => {
      scheduleTransformUpdate();
    };

    const onResize = () => {
      scheduleGeometryUpdate();
    };

    const observer = new IntersectionObserver(
      ([entry]) => {
        isActiveRef.current = Boolean(entry?.isIntersecting);
        if (isActiveRef.current) scheduleGeometryUpdate();
      },
      { rootMargin: "700px 0px" },
    );
    observer.observe(scroller);

    const resizeObserver = new ResizeObserver(scheduleGeometryUpdate);
    resizeObserver.observe(scroller);
    cardsRef.current.forEach((card) => resizeObserver.observe(card));

    const scrollTarget = useWindowScroll ? window : scroller;
    scrollTarget.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize, { passive: true });
    reducedMotionMedia.addEventListener("change", configureLayout);
    smallViewportMedia.addEventListener("change", configureLayout);

    return () => {
      if (scheduledFrameRef.current !== null) cancelAnimationFrame(scheduledFrameRef.current);
      scrollTarget.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
      reducedMotionMedia.removeEventListener("change", configureLayout);
      smallViewportMedia.removeEventListener("change", configureLayout);
      observer.disconnect();
      resizeObserver.disconnect();
      resetCardsForStaticLayout();
      cardsRef.current = [];
      geometryRef.current = null;
      scheduledFrameRef.current = null;
      stackCompletedRef.current = false;
    };
  }, [
    itemDistance,
    scaleDuration,
    resetCardsForStaticLayout,
    recalculateGeometry,
    scheduleGeometryUpdate,
    scheduleTransformUpdate,
    useWindowScroll,
  ]);

  void blurAmount;

  return (
    <div className={`scroll-stack-scroller scroll-stack-motion-aware ${className}`.trim()} ref={scrollerRef}>
      <div className="scroll-stack-inner">
        {children}
        <div className="scroll-stack-end" />
      </div>
    </div>
  );
};

export default ScrollStack;
