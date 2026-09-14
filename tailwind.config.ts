import type { Config } from "tailwindcss";

const token = (name: string) => `rgb(var(--c-${name}) / <alpha-value>)`;

export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: token("bg"),
        surface: token("surface"),
        "surface-2": token("surface-2"),
        line: token("line"),
        ink: token("text"),
        muted: token("muted"),
        primary: token("primary"),
        "primary-fg": token("primary-fg"),
        secondary: token("secondary"),
        success: token("success"),
        warning: token("warning"),
        danger: token("danger"),
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "Georgia", "serif"],
      },
      borderRadius: {
        card: "calc(var(--radius) * 1px)",
        field: "calc(var(--radius) * 0.6px)",
      },
      spacing: {
        gap: "calc(var(--density) * 1rem)",
      },
      keyframes: {
        shimmer: { "100%": { transform: "translateX(100%)" } },
        "fade-up": {
          from: { opacity: "0", transform: "translateY(6px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "toast-in": {
          from: { opacity: "0", transform: "translateY(12px) scale(.98)" },
          to: { opacity: "1", transform: "translateY(0) scale(1)" },
        },
      },
      animation: {
        shimmer: "shimmer 1.6s infinite",
        "fade-up": "fade-up .35s cubic-bezier(.2,.7,.2,1) both",
        "toast-in": "toast-in .25s cubic-bezier(.2,.7,.2,1) both",
      },
    },
  },
  plugins: [],
} satisfies Config;
