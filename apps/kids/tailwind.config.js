/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './App.{js,jsx,ts,tsx}',
    './src/**/*.{js,jsx,ts,tsx}',
    '../../packages/**/*.{js,jsx,ts,tsx}',
  ],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#5B6CFF',
          50: '#EEF0FF',
          500: '#5B6CFF',
          600: '#4655F0',
        },
      },
    },
  },
  plugins: [],
};
