/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#2f3136",
        "bg-block": "#202225",
        "bg-hover": "#40444b",
        "text-main": "#ffffff",
        "text-muted": "#b9bbbe",
        accent: "#5865f2",
        "accent-hover": "#4752c4",
        danger: "#e74c3c",
        "danger-hover": "#c0392b",
        success: "#43b581",
        warn: "#f1c40f",
      },
      fontFamily: {
        logo: ["MyFont", "sans-serif"],
        sans: ['"Segoe UI"', "Roboto", "Arial", "sans-serif"],
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0", transform: "translateY(-20px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        pulseCall: {
          "0%": { boxShadow: "0 0 0 0 rgba(59, 165, 93, 0.7)" },
          "70%": { boxShadow: "0 0 0 15px rgba(59, 165, 93, 0)" },
          "100%": { boxShadow: "0 0 0 0 rgba(59, 165, 93, 0)" },
        },
      },
      animation: {
        fadeIn: "fadeIn 0.4s ease-in-out forwards",
        pulseCall: "pulseCall 1.5s infinite",
      },
    },
  },
  plugins: [],
};
