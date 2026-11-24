/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        charcoal: {
          DEFAULT: '#1F2937',
          50: '#F9FAFB',
          100: '#F3F4F6',
          200: '#E5E7EB',
          700: '#374151',
          800: '#1F2937',
          900: '#111827',
          950: '#0B0F17',
        },
        gold: {
          DEFAULT: '#D4A017',
          light: '#F59E0B',
          dark: '#B45309',
          50: '#FFFBEB',
          100: '#FEF3C7',
          500: '#D4A017',
          600: '#B8860B',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
