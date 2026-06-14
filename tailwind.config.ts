import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        paper: "#F4F1E8",
        "paper-raised": "#FBF9F2",
        ink: "#1d2014",
        "ink-soft": "#5f6450",
        "ink-faint": "#8c9072",
        olive: "#5c6b2e",
        "olive-deep": "#445223",
        line: "#d9d6c8",
        gem: "#cfe08a",
      },
      fontFamily: {
        display: ["var(--font-display)", "Georgia", "serif"],
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
      },
      keyframes: {
        floatUp: {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        pop: {
          "0%": { transform: "scale(0.6)", opacity: "0" },
          "60%": { transform: "scale(1.15)", opacity: "1" },
          "100%": { transform: "scale(1)" },
        },
      },
      animation: {
        floatUp: "floatUp 0.5s ease-out both",
        pop: "pop 0.35s ease-out both",
      },
    },
  },
  plugins: [],
};

export default config;
