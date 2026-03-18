import starlightPlugin from "@astrojs/starlight-tailwind";
import colors from "tailwindcss/colors";
import animate from "tailwindcss-animate";

/** @type {import('tailwindcss').Config} */
export default {
  content: ["./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}"],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        accent: colors.indigo,
        gray: colors.zinc,
        primary: "#f97316",
        background: "black",
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        foreground: "hsl(var(--foreground))",
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: 0 },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: 0 },
        },
        wiggle: {
          "0%, 100%": { transform: "rotate(-4deg)" },
          "50%": { transform: "rotate(4deg)" },
        },
        "wiggle-backwards": {
          "0%, 100%": { transform: "rotate(4deg)" },
          "50%": { transform: "rotate(-4deg)" },
        },
        blicking: {
          "0%, 100%": { opacity: 0 },
          "50%": { opacity: 1 },
        },
        "levitate-top": {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-10px)" },
        },
        "levitate-bottom": {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(10px)" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "wiggle-left": "wiggle-backwards 5s ease-in-out infinite",
        "wiggle-right": "wiggle 6s ease-in-out infinite",
        blicking: "blicking 1s infinite",
        "levitate-top-1": "levitate-top 6s ease-in-out infinite",
        "levitate-top-2": "levitate-top 6s ease-in-out 1s infinite",
        "levitate-top-3": "levitate-top 6s ease-in-out 2s infinite",
        "levitate-bottom-1": "levitate-bottom 6s ease-in-out 3s infinite",
        "levitate-bottom-2": "levitate-bottom 6s ease-in-out 4s infinite",
        "levitate-bottom-3": "levitate-bottom 6s ease-in-out 5s infinite",
      },
    },
  },
  plugins: [starlightPlugin(), animate],
};
