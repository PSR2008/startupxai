import { forwardRef, type InputHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

// ============================================
// INPUT
// ============================================
interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  leftIcon?: React.ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, leftIcon, className, id, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, "-");

    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={inputId} className="font-bricolage text-xs font-bold text-gray-700 tracking-wide uppercase">
            {label}
            {props.required && <span className="text-rose-500 ml-1">*</span>}
          </label>
        )}

        <div className="relative">
          {leftIcon && (
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
              {leftIcon}
            </div>
          )}
          <input
            ref={ref}
            id={inputId}
            className={cn(
              "w-full h-10 px-3.5 rounded-xl text-sm font-jakarta",
              "bg-white border text-gray-900 placeholder:text-gray-400",
              "transition-all duration-150",
              "focus:outline-none focus:ring-2 focus:ring-emerald-500/15",
              error
                ? "border-rose-400 focus:ring-rose-500/15"
                : "border-black/10 hover:border-black/18 focus:border-emerald-500",
              leftIcon && "pl-9",
              className
            )}
            {...props}
          />
        </div>

        {error && <p className="font-jakarta text-xs text-rose-500">{error}</p>}
        {hint && !error && <p className="font-jakarta text-xs text-gray-400">{hint}</p>}
      </div>
    );
  }
);
Input.displayName = "Input";

// ============================================
// TEXTAREA
// ============================================
interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  hint?: string;
  charCount?: boolean;
  maxChars?: number;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, hint, charCount, maxChars, className, id, value, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, "-");
    const currentLength = typeof value === "string" ? value.length : 0;

    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <div className="flex items-center justify-between">
            <label htmlFor={inputId} className="font-bricolage text-xs font-bold text-gray-700 tracking-wide uppercase">
              {label}
              {props.required && <span className="text-rose-500 ml-1">*</span>}
            </label>
            {charCount && maxChars && (
              <span className={cn("font-mono text-[10px]", currentLength > maxChars * 0.9 ? "text-rose-500" : "text-gray-400")}>
                {currentLength}/{maxChars}
              </span>
            )}
          </div>
        )}

        <textarea
          ref={ref}
          id={inputId}
          value={value}
          className={cn(
            "w-full px-3.5 py-3 rounded-xl text-sm font-jakarta resize-none",
            "bg-white border text-gray-900 placeholder:text-gray-400",
            "transition-all duration-150",
            "focus:outline-none focus:ring-2 focus:ring-emerald-500/15",
            error
              ? "border-rose-400 focus:ring-rose-500/15"
              : "border-black/10 hover:border-black/18 focus:border-emerald-500",
            className
          )}
          {...props}
        />

        {error && <p className="font-jakarta text-xs text-rose-500">{error}</p>}
        {hint && !error && <p className="font-jakarta text-xs text-gray-400">{hint}</p>}
      </div>
    );
  }
);
Textarea.displayName = "Textarea";

// ============================================
// SELECT
// ============================================
interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  hint?: string;
  options: { value: string; label: string }[];
  placeholder?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, hint, options, placeholder, className, id, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, "-");

    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={inputId} className="font-bricolage text-xs font-bold text-gray-700 tracking-wide uppercase">
            {label}
            {props.required && <span className="text-rose-500 ml-1">*</span>}
          </label>
        )}

        <select
          ref={ref}
          id={inputId}
          className={cn(
            "w-full h-10 px-3.5 rounded-xl text-sm font-jakarta appearance-none cursor-pointer",
            "bg-white border text-gray-900",
            "transition-all duration-150",
            "focus:outline-none focus:ring-2 focus:ring-emerald-500/15",
            error
              ? "border-rose-400"
              : "border-black/10 hover:border-black/18 focus:border-emerald-500",
            className
          )}
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%239ca3af' d='M6 8L1 3h10z'/%3E%3C/svg%3E")`,
            backgroundRepeat: "no-repeat",
            backgroundPosition: "right 12px center",
          }}
          {...props}
        >
          {placeholder && <option value="" disabled>{placeholder}</option>}
          {options.map((opt) => (
            <option key={opt.value} value={opt.value} className="bg-white text-gray-900">
              {opt.label}
            </option>
          ))}
        </select>

        {error && <p className="font-jakarta text-xs text-rose-500">{error}</p>}
        {hint && !error && <p className="font-jakarta text-xs text-gray-400">{hint}</p>}
      </div>
    );
  }
);
Select.displayName = "Select";
