/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#1456f0',
          light: '#3daeff',
          deep: '#17437d',
          pink: '#ea5ec1',
        },
        primary: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
          950: '#172554',
        },
        ink: {
          DEFAULT: '#222222',
          dark: '#18181b',
          charcoal: '#181e25',
          secondary: '#45515e',
          muted: '#8e8e93',
          helper: '#5f5f5f',
        },
        surface: {
          DEFAULT: '#ffffff',
          soft: '#f7f8fa',
          divider: '#f2f3f5',
          border: '#e5e7eb',
        },
      },
      fontFamily: {
        sans: ['"DM Sans"', 'Helvetica Neue', 'Helvetica', 'Arial', 'sans-serif'],
        display: ['Outfit', 'Helvetica Neue', 'Helvetica', 'Arial', 'sans-serif'],
        mid: ['Poppins', 'Helvetica Neue', 'Helvetica', 'Arial', 'sans-serif'],
        data: ['Roboto', 'Helvetica Neue', 'Helvetica', 'Arial', 'sans-serif'],
      },
      borderRadius: {
        card: '20px',
        panel: '13px',
      },
      boxShadow: {
        card: 'rgba(0, 0, 0, 0.08) 0px 4px 6px',
        glow: 'rgba(0, 0, 0, 0.08) 0px 0px 22.576px',
        brand: 'rgba(44, 30, 116, 0.16) 0px 0px 15px',
        elevated: 'rgba(36, 36, 36, 0.08) 0px 12px 16px -4px',
      },
      keyframes: {
        fadeSlideIn: {
          '0%': { opacity: '0', transform: 'translateY(5px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'fade-slide': 'fadeSlideIn 0.35s ease-out',
      },
    },
  },
  plugins: [],
};
