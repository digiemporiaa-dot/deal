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
        /* Admin tokens. Defined as CSS variables in globals.css and read
           through <alpha-value> so `bg-admin-card/60` works, and so a dark
           theme only has to redefine the variables. */
        admin: {
          navy: "rgb(var(--admin-navy) / <alpha-value>)",
          "navy-soft": "rgb(var(--admin-navy-soft) / <alpha-value>)",
          "navy-line": "rgb(var(--admin-navy-line) / <alpha-value>)",
          bg: "rgb(var(--admin-bg) / <alpha-value>)",
          card: "rgb(var(--admin-card) / <alpha-value>)",
          muted: "rgb(var(--admin-muted-bg) / <alpha-value>)",
          border: "rgb(var(--admin-border) / <alpha-value>)",
          "border-strong": "rgb(var(--admin-border-strong) / <alpha-value>)",
          text: "rgb(var(--admin-text) / <alpha-value>)",
          "text-muted": "rgb(var(--admin-text-muted) / <alpha-value>)",
          "text-subtle": "rgb(var(--admin-text-subtle) / <alpha-value>)",
          success: "rgb(var(--admin-success) / <alpha-value>)",
          warning: "rgb(var(--admin-warning) / <alpha-value>)",
          danger: "rgb(var(--admin-danger) / <alpha-value>)",
          info: "rgb(var(--admin-info) / <alpha-value>)",
        },
        /* The public site's brand ramp. Read through CSS variables so the
           appearance module can repaint the site from the admin panel without
           a rebuild; globals.css holds the defaults, so an unthemed install
           and the admin panel look exactly as they did before. */
        brand: {
          50: "rgb(var(--brand-50) / <alpha-value>)",
          100: "rgb(var(--brand-100) / <alpha-value>)",
          200: "rgb(var(--brand-200) / <alpha-value>)",
          300: "rgb(var(--brand-300) / <alpha-value>)",
          400: "rgb(var(--brand-400) / <alpha-value>)",
          500: "rgb(var(--brand-500) / <alpha-value>)",
          600: "rgb(var(--brand-600) / <alpha-value>)",
          700: "rgb(var(--brand-700) / <alpha-value>)",
          800: "rgb(var(--brand-800) / <alpha-value>)",
          900: "rgb(var(--brand-900) / <alpha-value>)",
          950: "rgb(var(--brand-950) / <alpha-value>)",
        },
        site: {
          heading: "rgb(var(--site-heading) / <alpha-value>)",
          body: "rgb(var(--site-body) / <alpha-value>)",
          bg: "rgb(var(--site-bg) / <alpha-value>)",
          "header-bg": "rgb(var(--site-header-bg) / <alpha-value>)",
          "footer-bg": "rgb(var(--site-footer-bg) / <alpha-value>)",
          "footer-text": "rgb(var(--site-footer-text) / <alpha-value>)",
          "button-text": "rgb(var(--site-button-text) / <alpha-value>)",
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
      borderColor: {
        /* `border-admin` reads the token; plain `border` still works. */
        admin: "rgb(var(--admin-border) / <alpha-value>)",
      },
      borderRadius: {
        card: "var(--admin-radius-lg)",
        control: "var(--admin-radius)",
        chip: "var(--admin-radius-sm)",
      },
      spacing: {
        sidebar: "var(--admin-sidebar-w)",
        "sidebar-collapsed": "var(--admin-sidebar-collapsed-w)",
        topbar: "var(--admin-topbar-h)",
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
