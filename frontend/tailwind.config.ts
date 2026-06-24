import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // GYMTEC palette
        canvas: "#FAFAF7",
        ink: {
          900: "#042C53",
          700: "#0C447C",
          500: "#185FA5",
          300: "#378ADD",
        },
        neutral: {
          900: "#2C2C2A",
          700: "#5F5E5A",
          500: "#888780",
          300: "#D3D1C7",
          100: "#F1EFE8",
        },
        gold: {
          700: "#854F0B",
          500: "#BA7517",
        },
        // Occupancy semantic colors
        occ: {
          lowBg: "#EAF3DE",
          lowFg: "#27500A",
          lowSolid: "#639922",
          medBg: "#FAEEDA",
          medFg: "#633806",
          medSolid: "#BA7517",
          highBg: "#FCEBEB",
          highFg: "#791F1F",
          highSolid: "#A32D2D",
        },
      },
      fontFamily: {
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          "Inter",
          "Segoe UI",
          "Roboto",
          "sans-serif",
        ],
      },
      borderRadius: {
        card: "14px",
        pill: "999px",
      },
      boxShadow: {
        card: "0 1px 2px rgba(4, 44, 83, 0.04), 0 1px 1px rgba(4, 44, 83, 0.02)",
        cardHover: "0 4px 12px rgba(4, 44, 83, 0.08)",
      },
    },
  },
  plugins: [],
};

export default config;
