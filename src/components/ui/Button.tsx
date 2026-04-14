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
      "relative inline-flex items-center justify-center gap-2 font-bricolage font-semibold transition-all duration-200 cursor-pointer select-none overflow-hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white disabled:cursor-not-allowed disabled:opacity-50";

    const variants = {
      primary: [
        "bg-gradient-to-br from-emerald-500 to-emerald-600",
        "text-white",
        "shadow-md shadow-emerald-500/25",
        "hover:shadow-lg hover:shadow-emerald-500/35 hover:-translate-y-0.5",
        "active:translate-y-0 active:shadow-sm",
        "border border-emerald-600/20",
      ].join(" "),

      secondary: [
        "bg-gray-100 border border-gray-200",
        "text-gray-800",
        "hover:bg-gray-200 hover:border-gray-300 hover:-translate-y-0.5",
        "active:translate-y-0",
      ].join(" "),

      ghost: [
        "bg-transparent border border-transparent",
        "text-gray-600",
        "hover:bg-black/5 hover:border-black/8 hover:text-gray-900",
        "active:bg-black/8",
      ].join(" "),

      outline: [
        "bg-transparent border border-black/12",
        "text-gray-800",
        "hover:bg-black/4 hover:border-black/20 hover:-translate-y-0.5",
        "active:translate-y-0",
      ].join(" "),

      danger: [
        "bg-gradient-to-br from-rose-500 to-rose-600",
        "text-white border border-rose-600/20",
        "shadow-md shadow-rose-500/20",
        "hover:shadow-lg hover:shadow-rose-500/30 hover:-translate-y-0.5",
        "active:translate-y-0",
      ].join(" "),
    };

    const sizes = {
      sm: "h-8 px-3 text-xs rounded-lg gap-1.5",
      md: "h-10 px-4 text-sm rounded-xl gap-2",
      lg: "h-12 px-6 text-sm rounded-xl gap-2",
      xl: "h-14 px-8 text-base rounded-2xl gap-3",
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
        {variant === "primary" && (
          <span
            className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent opacity-0 hover:opacity-100 transition-opacity pointer-events-none"
            aria-hidden
          />
        )}

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
