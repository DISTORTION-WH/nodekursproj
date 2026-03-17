/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        discord: {
          bg: 'var(--color-bg)',
          secondary: 'var(--color-secondary)',
          tertiary: 'var(--color-tertiary)',
          accent: 'var(--color-accent)',
          'accent-hover': 'var(--color-accent-hover)',
          success: 'var(--color-success)',
          'success-hover': 'var(--color-success-hover)',
          danger: 'var(--color-danger)',
          'danger-hover': 'var(--color-danger-hover)',
          warn: 'var(--color-warn)',
          'text-primary': 'var(--color-text-primary)',
          'text-secondary': 'var(--color-text-secondary)',
          'text-muted': 'var(--color-text-muted)',
          input: 'var(--color-input)',
          'input-hover': 'var(--color-input-hover)',
        },
      },
      fontFamily: {
        sans: ['Segoe UI', 'Roboto', 'Arial', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
