/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        apple: {
          bg: '#F5F5F7',
          card: '#FFFFFF',
          blue: '#0071E3',
          hoverBlue: '#0077ED',
          dark: '#1D1D1F',
          secondary: '#86868B',
          border: '#D2D2D7',
          grayBg: '#E8E8ED',
        }
      }
    },
  },
  plugins: [],
}
