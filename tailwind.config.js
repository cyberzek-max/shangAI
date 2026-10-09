/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        base: {
          950: '#060913',
          900: '#0a0f1d',
          850: '#0f1629',
          800: '#141d34',
          700: '#1d2a4a',
          600: '#273861',
        },
        cyan: {
          400: '#38d9e6',
          500: '#0ea5e9',
        },
        violet: {
          400: '#a78bfa',
          500: '#8b5cf6',
        },
        apple: {
          blue: '#0071e3',
          teal: '#2997ff',
          indigo: '#5856d6',
          purple: '#af52de',
          pink: '#ff2d55',
          red: '#ff3b30',
          orange: '#ff9500',
          yellow: '#ffcc00',
          green: '#34c759',
          gray: '#8e8e93',
        },
      },
      fontFamily: {
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          '"SF Pro Display"',
          '"SF Pro Text"',
          '"Segoe UI"',
          'Roboto',
          'system-ui',
          'sans-serif',
        ],
        display: [
          '-apple-system',
          'BlinkMacSystemFont',
          '"SF Pro Display"',
          '"Rajdhani"',
          'system-ui',
          'sans-serif',
        ],
        mono: ['"SF Mono"', '"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        glow: '0 0 24px -4px rgba(56,217,230,0.35)',
        'glow-violet': '0 0 28px -4px rgba(139,92,246,0.35)',
        'glass-sm': '0 4px 16px 0 rgba(0,0,0,0.25), inset 0 1px 0 0 rgba(255,255,255,0.1)',
        glass: '0 8px 32px 0 rgba(0,0,0,0.36), inset 0 1px 0 0 rgba(255,255,255,0.14)',
        'glass-elevated': '0 20px 48px -8px rgba(0,0,0,0.6), inset 0 1px 0 0 rgba(255,255,255,0.2)',
      },
      transitionTimingFunction: {
        'apple-spring': 'cubic-bezier(0.16, 1, 0.3, 1)',
        'apple-bounce': 'cubic-bezier(0.34, 1.4, 0.64, 1)',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0', transform: 'scale(0.98)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        sheetSlideUp: {
          '0%': { opacity: '0', transform: 'translateY(16px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        pulseSubtle: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.75' },
        },
      },
      animation: {
        fadeIn: 'fadeIn 240ms cubic-bezier(0.16, 1, 0.3, 1) forwards',
        sheetSlideUp: 'sheetSlideUp 280ms cubic-bezier(0.16, 1, 0.3, 1) forwards',
        pulseSubtle: 'pulseSubtle 2.5s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}
