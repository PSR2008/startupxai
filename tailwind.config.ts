import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        bricolage: ["var(--font-bricolage)", "system-ui", "sans-serif"],
        jakarta: ["var(--font-jakarta)", "system-ui", "sans-serif"],
        mono: ["var(--font-jetbrains)", "Consolas", "monospace"],
        // Legacy aliases — keep so old usage still compiles
        display: ["var(--font-bricolage)", "system-ui", "sans-serif"],
        heading: ["var(--font-bricolage)", "system-ui", "sans-serif"],
        body: ["var(--font-jakarta)", "system-ui", "sans-serif"],
      },
      colors: {
        // New primary palette
        emerald: {
          50: "#ecfdf5", 100: "#d1fae5", 200: "#a7f3d0", 300: "#6ee7b7",
          400: "#34d399", 500: "#10b981", 600: "#059669", 700: "#047857",
          800: "#065f46", 900: "#064e3b", 950: "#022c22",
        },
        // Legacy palette kept for engine page compat
        sage: {
          50: "#f6f7f4", 100: "#e9ece3", 200: "#d3d9c8", 300: "#b4bfa3",
          400: "#91a07a", 500: "#72845e", 600: "#5a6a4a", 700: "#47543b",
          800: "#3a4431", 900: "#313a2a", 950: "#181e14",
        },
        cocoa: {
          50: "#faf6f2", 100: "#f0e8dc", 200: "#dfd0bb", 300: "#c9af92",
          400: "#b28b69", 500: "#9e724e", 600: "#8a5e3f", 700: "#714d35",
          800: "#5d3f2e", 900: "#4d3527", 950: "#2a1b13",
        },
        forest: {
          50: "#f2f7f3", 100: "#e0ece3", 200: "#c2d9c8", 300: "#97bda3",
          400: "#659b77", 500: "#447e58", 600: "#326445", 700: "#285139",
          800: "#22412f", 900: "#1d3628", 950: "#0f1f16",
        },
        ivory: {
          50: "#fdfcf8", 100: "#faf7ee", 200: "#f3ecda", 300: "#e9ddc0",
          400: "#d9c99d", 500: "#c9b47a", 600: "#b49b5c", 700: "#957f4a",
          800: "#7a673f", 900: "#645537", 950: "#352d1c",
        },
        midnight: {
          50: "#f0f2fa", 100: "#dde2f3", 200: "#c2cae9", 300: "#99a9d9",
          400: "#6a82c5", 500: "#4a63b5", 600: "#384d9a", 700: "#2f3f7e",
          800: "#2a3568", 900: "#1a2040", 950: "#0d1020",
        },
        peach: {
          50: "#fef6f2", 100: "#fdeade", 200: "#fbd4be", 300: "#f7b593",
          400: "#f28e61", 500: "#ec6e38", 600: "#d8532a", 700: "#b54123",
          800: "#913620", 900: "#762f1e", 950: "#40150c",
        },
        charcoal: {
          50: "#f6f6f6", 100: "#e7e7e7", 200: "#d1d1d1", 300: "#b0b0b0",
          400: "#888888", 500: "#6d6d6d", 600: "#5d5d5d", 700: "#4f4f4f",
          800: "#454545", 900: "#3d3d3d", 950: "#141414",
        },
        beige: "#f5f0e8",
        cream: "#fefdf9",
      },
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
        "gradient-conic": "conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))",
      },
      boxShadow: {
        "glow-sm": "0 0 20px rgba(16,185,129,0.12)",
        "glow-md": "0 0 40px rgba(16,185,129,0.16)",
        "glow-lg": "0 0 80px rgba(16,185,129,0.20)",
        "card": "0 1px 3px rgba(0,0,0,0.05),0 4px 16px rgba(0,0,0,0.05)",
        "card-hover": "0 2px 8px rgba(0,0,0,0.08),0 16px 40px rgba(0,0,0,0.08)",
        "premium": "0 0 0 1px rgba(0,0,0,0.04),0 4px 16px rgba(0,0,0,0.06),0 24px 64px rgba(0,0,0,0.08)",
      },
      animation: {
        "fade-up": "fadeUp 0.6s ease forwards",
        "fade-in": "fadeIn 0.4s ease forwards",
        "scale-in": "scaleIn 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards",
        "float": "float 6s ease-in-out infinite",
        "pulse-slow": "pulse 4s ease-in-out infinite",
        "shimmer": "shimmer 2s linear infinite",
        "marquee": "marquee 30s linear infinite",
        "marquee-reverse": "marquee 30s linear infinite reverse",
      },
      keyframes: {
        fadeUp: { "0%": { opacity: "0", transform: "translateY(24px)" }, "100%": { opacity: "1", transform: "translateY(0)" } },
        fadeIn: { "0%": { opacity: "0" }, "100%": { opacity: "1" } },
        scaleIn: { "0%": { opacity: "0", transform: "scale(0.94)" }, "100%": { opacity: "1", transform: "scale(1)" } },
        float: { "0%, 100%": { transform: "translateY(0px)" }, "50%": { transform: "translateY(-20px)" } },
        shimmer: { "0%": { backgroundPosition: "-200% center" }, "100%": { backgroundPosition: "200% center" } },
        marquee: { "0%": { transform: "translateX(0%)" }, "100%": { transform: "translateX(-50%)" } },
      },
      transitionTimingFunction: {
        "spring": "cubic-bezier(0.16, 1, 0.3, 1)",
      },
    },
  },
  plugins: [],
};

export default config;
