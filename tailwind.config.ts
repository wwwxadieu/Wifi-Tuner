import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        display: ["-apple-system", "BlinkMacSystemFont", '"SF Pro Display"', '"Segoe UI"', "Inter", "sans-serif"],
      },
      colors: {
        // Bảng màu theo hệ màu tối (Dark Mode) của Apple — dùng đúng giá trị hex
        // hệ thống của iOS/macOS thay vì các màu Tailwind mặc định (indigo/cyan/
        // emerald/rose) từng bị dùng lẫn lộn giữa các panel trước đây.
        ink: "#050507",
        surface: "#0d0d10",
        panel: "rgba(255,255,255,0.055)",
        panel2: "rgba(255,255,255,0.09)",
        hair: "rgba(255,255,255,0.10)",
        accent: "#0a84ff", // SF Blue (dark) — hành động chính, tab active, upload
        accent2: "#64d2ff", // SF Teal (dark) — gradient phụ, điểm nhấn
        good: "#30d158", // SF Green (dark) — thành công, đã tối ưu, download
        warn: "#ff9f0a", // SF Orange (dark) — cảnh báo, chưa tối ưu
        bad: "#ff453a", // SF Red (dark) — chỉ dùng cho lỗi
        download: "#30d158",
        upload: "#0a84ff",
      },
      backdropBlur: {
        xs: "2px",
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
