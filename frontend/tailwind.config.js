/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        space: '#050505',
        ink: '#111111',
        bone: '#e8e4dc',
        mist: '#8b9094',
        dim: '#4a4d50',
        tide: '#3b1c5a',
        foam: '#c89b3c',
        gold: '#c89b3c',
        line: 'rgba(255, 255, 255, 0.06)',
        studio: {
          bg: '#050507',
          panel: '#0C0C10',
          card: '#14141B',
          hover: '#1E1E28',
          border: '#242430',
          yellow: '#D97706', // Dark Yellow / Gold Amber
          yellowHover: '#B45309',
          yellowGlow: 'rgba(217, 119, 6, 0.18)'
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['Bricolage Grotesque', 'sans-serif'],
        mono: ['Space Mono', 'JetBrains Mono', 'Menlo', 'monospace']
      }
    }
  },
  plugins: []
}
