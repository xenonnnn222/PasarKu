/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif']
      },
      colors: {
        primary: {
          50: '#F0FDF4',
          100: '#DCFCE7',
          200: '#BBF7D0',
          500: '#22C55E',
          600: '#16A34A',
          700: '#15803D',
          800: '#166534',
          900: '#14532D'
        },
        surface: {
          light: '#F6F8F7',
          card: '#FFFFFF',
          dark: '#0B1410',
          darkCard: '#12201A'
        },
        status: {
          danger: '#DC2626',
          warning: '#D97706',
          info: '#2563EB'
        }
      },
      borderRadius: {
        card: '16px',
        btn: '12px'
      },
      boxShadow: {
        soft: '0 2px 10px rgba(0, 0, 0, 0.04)',
        nav: '0 -2px 12px rgba(0, 0, 0, 0.06)'
      }
    }
  },
  plugins: []
};

