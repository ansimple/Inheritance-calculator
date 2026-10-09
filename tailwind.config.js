/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brown: {
          50: '#fdfbf7',
          100: '#f7f2eb',
          200: '#ede2d5',
          300: '#dfcbba',
          400: '#c5a892',
          500: '#ab886d',
          600: '#8e6c54',
          700: '#6f523f',
          800: '#4e3a2d',
          850: '#382a20',
          900: '#241a14',
          950: '#130e0b',
        },
      },
    },
  },
  plugins: [],
};
