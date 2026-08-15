import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: {
          DEFAULT: "#0b0d12",
          soft: "#12151c",
          card: "#171b24",
        },
        accent: {
          DEFAULT: "#f27a1a",
          soft: "#ffb066",
        },
      },
    },
  },
  plugins: [],
};

export default config;
