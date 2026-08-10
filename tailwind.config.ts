import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eef7ff",
          100: "#d9edff",
          200: "#bce0ff",
          300: "#8ecdff",
          400: "#59b0ff",
          500: "#3390fc",
          600: "#1b70f1",
          700: "#1459dd",
          800: "#1749b3",
          900: "#19418d",
          950: "#142a56",
        },
        sand: {
          50: "#faf7f2",
          100: "#f2ece0",
          200: "#e4d7c1",
          300: "#d2bd9b",
          400: "#bd9d73",
          500: "#ac8557",
          600: "#9a714b",
          700: "#805a40",
          800: "#694b39",
          900: "#573e31",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "Georgia", "serif"],
      },
      container: {
        center: true,
        padding: { DEFAULT: "1rem", lg: "2rem" },
        screens: { "2xl": "1280px" },
      },
      keyframes: {
        "fade-in": {
          from: { opacity: "0", transform: "translateY(8px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "fade-in": "fade-in 0.3s ease-out",
      },
    },
  },
  plugins: [],
};

export default config;
