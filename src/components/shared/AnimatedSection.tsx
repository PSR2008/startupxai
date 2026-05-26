"use client";
import { motion } from "framer-motion";
import { useInView } from "react-intersection-observer";
import { cn } from "@/lib/utils";

interface AnimatedSectionProps {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  direction?: "up" | "down" | "left" | "right" | "none";
  once?: boolean;
  threshold?: number;
  as?: "div" | "section" | "article" | "aside";
  id?: string;
}

export default function AnimatedSection({
  children,
  className,
  delay = 0,
  direction = "up",
  once = true,
  threshold = 0.1,
  as: Tag = "div",
  id,
}: AnimatedSectionProps) {
  const { ref, inView } = useInView({ threshold, triggerOnce: once });

  const directionMap = {
    up: { hidden: { y: 32, opacity: 0 }, visible: { y: 0, opacity: 1 } },
    down: { hidden: { y: -32, opacity: 0 }, visible: { y: 0, opacity: 1 } },
    left: { hidden: { x: 32, opacity: 0 }, visible: { x: 0, opacity: 1 } },
    right: { hidden: { x: -32, opacity: 0 }, visible: { x: 0, opacity: 1 } },
    none: { hidden: { opacity: 0 }, visible: { opacity: 1 } },
  };

  const variants = directionMap[direction];

  return (
    <motion.div
      ref={ref}
      initial="hidden"
      animate={inView ? "visible" : "hidden"}
      variants={variants}
      transition={{
        duration: 0.65,
        delay,
        ease: [0.16, 1, 0.3, 1],
      }}
      className={cn(className)}
      id={id}
      // @ts-expect-error - motion.div doesn't support as prop directly
      as={Tag}
    >
      {children}
    </motion.div>
  );
}

// Stagger children container
interface StaggerContainerProps {
  children: React.ReactNode;
  className?: string;
  staggerDelay?: number;
  threshold?: number;
}

export function StaggerContainer({
  children,
  className,
  staggerDelay = 0.08,
  threshold = 0.05,
}: StaggerContainerProps) {
  const { ref, inView } = useInView({ threshold, triggerOnce: true });

  return (
    <motion.div
      ref={ref}
      initial="hidden"
      animate={inView ? "visible" : "hidden"}
      variants={{
        visible: { transition: { staggerChildren: staggerDelay } },
      }}
      className={cn(className)}
    >
      {children}
    </motion.div>
  );
}

export function StaggerItem({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, y: 20 },
        visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] } },
      }}
      className={cn(className)}
    >
      {children}
    </motion.div>
  );
}
