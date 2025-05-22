import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
        "gradient-conic":
          "conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))",
      },
      fontFamily: {
        medieval: ["MedievalSharp", "cursive"],
        pixel: ["PressStart2P", "monospace"],
        quest: ["Cinzel Decorative", "serif"],
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'glow': 'glow 2s infinite',
        'bounce-slow': 'bounce 2s infinite',
        'float': 'float 3s ease-in-out infinite',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        }
      },
      boxShadow: {
        'game': '0 0 10px rgba(255, 180, 0, 0.3)',
        'game-hover': '0 0 15px rgba(255, 180, 0, 0.5)',
        'pixel': '0 4px 0 0 #0a0a12, 4px 0 0 0 #0a0a12, 0 -4px 0 0 #0a0a12, -4px 0 0 0 #0a0a12',
        'celeste': '0 4px 0 0 rgba(0,0,0,0.5)',
        'celeste-inner': 'inset 0 0 0 2px var(--celeste-accent)',
      },
      colors: {
        'pixel': {
          'primary': 'var(--pixel-primary)',
          'secondary': 'var(--pixel-secondary)',
          'accent': 'var(--pixel-accent)',
          'dark': 'var(--pixel-dark)',
          'light': 'var(--pixel-light)',
          'health': 'var(--pixel-health)',
          'mana': 'var(--pixel-mana)',
          'exp': 'var(--pixel-exp)',
        },
        'quest': {
          'primary': 'var(--quest-primary)',
          'secondary': 'var(--quest-secondary)',
          'accent': 'var(--quest-accent)',
          'dark': 'var(--quest-dark)',
          'light': 'var(--quest-light)',
        },
        'celeste': {
          'bg': 'var(--celeste-bg)',
          'dark': 'var(--celeste-dark)',
          'medium': 'var(--celeste-medium)',
          'light': 'var(--celeste-light)',
          'accent': 'var(--celeste-accent)',
          'accent2': 'var(--celeste-accent2)',
          'text': 'var(--celeste-text)',
          'highlight': 'var(--celeste-highlight)',
        },
      },
    },
  },
  plugins: [],
};
export default config;
