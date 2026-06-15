/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,jsx,ts,tsx}'
  ],
  theme: {
    extend: {
      colors: {
        primary: '#00BFD8',
        primaryHover: '#009EB2',
        navy: '#06243D',
        background: '#F8FAF7',
        surface: '#FFFFFF',
        surfaceLight: '#F3E9D2',
        sand: '#F3E9D2',
        sky: '#DDF7FF',
        turquoise: '#00BFD8',
        ocean: '#007C89',
        text: '#111827',
        muted: '#5F6B76',
        borderDark: '#E5E7EB',
        bg: '#F8FAF7',
        'surface-light': '#F3E9D2',
        'primary-hover': '#009EB2',
        border: '#E5E7EB',
        deep: '#111827',
        lagoon: '#00BFD8',
        coral: '#00BFD8',
        foam: '#F8FAF7'
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif']
      },
      boxShadow: {
        lift: '0 18px 45px rgba(17, 24, 39, 0.10)',
        glow: '0 18px 45px rgba(0, 124, 137, 0.14)'
      }
    }
  },
  plugins: []
};
