"use client";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { type ButtonHTMLAttributes, forwardRef } from "react";
import { Loader2 } from "lucide-react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger" | "outline";
  size?: "sm" | "md" | "lg" | "xl";
  loading?: boolean;
  icon?: React.ReactNode;
  iconPosition?: "left" | "right";
  fullWidth?: boolean;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = "primary",
      size = "md",
      loading = false,
      icon,
      iconPosition = "left",
      fullWidth = false,
      className,
      children,
      disabled,
      ...props
    },
    ref
  ) => {
    const isDisabled = disabled || loading;

    const baseStyles =
      "relative inline-flex items-center justify-center gap-2 font-jakarta font-semibold transition-all duration-200 cursor-pointer select-none overflow-hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white disabled:cursor-not-allowed disabled:opacity-50";

    const variants = {
      primary: [
        "bg-emerald-700",
        "text-white",
        "shadow-sm",
        "hover:bg-emerald-800 hover:-translate-y-px hover:shadow-md hover:shadow-emerald-900/10",
        "active:translate-y-0 active:shadow-sm",
        "border border-emerald-900/10",
      ].join(" "),

      secondary: [
        "bg-[#f8f6f0] border border-black/10",
        "text-gray-800 shadow-xs",
        "hover:bg-white hover:border-black/15 hover:-translate-y-px",
        "active:translate-y-0",
      ].join(" "),

      ghost: [
        "bg-transparent border border-transparent",
        "text-gray-600",
        "hover:bg-black/5 hover:border-black/8 hover:text-gray-900",
        "active:bg-black/8",
      ].join(" "),

      outline: [
        "bg-white/50 border border-black/12",
        "text-gray-800",
        "hover:bg-white hover:border-black/20 hover:-translate-y-px",
        "active:translate-y-0",
      ].join(" "),

      danger: [
        "bg-rose-600",
        "text-white border border-rose-600/20",
        "shadow-sm",
        "hover:bg-rose-700 hover:-translate-y-px",
        "active:translate-y-0",
      ].join(" "),
    };

    const sizes = {
      sm: "h-8 px-3 text-xs rounded-md gap-1.5",
      md: "h-10 px-4 text-sm rounded-lg gap-2",
      lg: "h-11 px-5 text-sm rounded-lg gap-2",
      xl: "h-[52px] px-7 text-base rounded-xl gap-3",
    };

    return (
      <motion.button
        ref={ref}
        whileTap={{ scale: isDisabled ? 1 : 0.98 }}
        className={cn(
          baseStyles,
          variants[variant],
          sizes[size],
          fullWidth && "w-full",
          className
        )}
        disabled={isDisabled}
        {...(props as React.ComponentProps<typeof motion.button>)}
      >
        {loading ? (
          <Loader2 className="animate-spin" size={size === "sm" ? 14 : 16} />
        ) : (
          icon && iconPosition === "left" && (
            <span className="flex-shrink-0">{icon}</span>
          )
        )}

        {children && <span>{children}</span>}

        {!loading && icon && iconPosition === "right" && (
          <span className="flex-shrink-0">{icon}</span>
        )}
      </motion.button>
    );
  }
);

Button.displayName = "Button";
export default Button;
