import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
    "./lib/**/*.{js,ts,jsx,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        ink: "var(--ink)",
        line: "var(--line)",
        card: "var(--card)",
        accent: "var(--accent)",
        warm: "var(--warm)"
      },
      boxShadow: {
        glow: "0 24px 80px rgba(244, 101, 36, 0.16)"
      }
    }
  },
  plugins: []
};

export default config;
