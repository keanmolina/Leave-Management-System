/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        maroon: {
          50: '#fdf2f2',
          100: '#fde8e8',
          200: '#fbd5d5',
          600: '#9b1c1c',
          700: '#800000', // Classic university maroon
          800: '#6b0000',
          900: '#4c0000',
        }
      }
    },
  },
  plugins: [],
}