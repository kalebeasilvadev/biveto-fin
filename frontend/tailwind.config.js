/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Biveto Brand Colors
        primary: {
          50: '#f0f4f8',
          100: '#d9e2ec',
          200: '#bcccdc',
          300: '#9fb3c8',
          400: '#829ab1',
          500: '#627d98',
          600: '#486581',
          700: '#334e68',
          800: '#243b53',
          900: '#1E3A5F',  // Main brand navy
          950: '#102a43',
        },
        accent: {
          50: '#f0fdf4',
          100: '#dcfce7',
          200: '#bbf7d0',
          300: '#86efac',
          400: '#4ade80',  // Main brand green
          500: '#22c55e',
          600: '#16a34a',
          700: '#15803d',
        },
        biveto: {
          navy: '#1E3A5F',
          'navy-dark': '#102a43',
          'navy-light': '#334e68',
          green: '#4ade80',
          'green-dark': '#22c55e',
        },
        expense: '#ef4444',
        income: '#22c55e',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
