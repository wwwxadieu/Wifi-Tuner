import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        display: ["-apple-system", "BlinkMacSystemFont", '"Segoe UI"', "Inter", "sans-serif"],
      },
      colors: {
        ink: "#0a0d12",
        surface: "#12161d",
        panel: "rgba(255,255,255,0.05)",
        hair: "rgba(255,255,255,0.08)",
        accent: "#2fd0ff",
        accent2: "#5a7dff",
        good: "#34d399",
        warn: "#fbbf24",
        bad: "#f87171",
      },
      keyframes: {
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(16px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        pulse2: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.5" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.5s cubic-bezier(0.16,1,0.3,1) both",
        pulse2: "pulse2 1.6s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
