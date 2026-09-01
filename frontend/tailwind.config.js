/** @type {import('tailwindcss').Config} */
import typography from '@tailwindcss/typography'

export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#111524',
        surface: '#FFFFFF',
        canvas: '#F4F6FB',
        border: '#E3E7F1',
        primary: {
          DEFAULT: '#1E2A5E',
          light: '#2E3E82',
          dark: '#141C42',
        },
        accent: {
          DEFAULT: '#2FA88A',
          light: '#E4F5F0',
          dark: '#1F7C63',
        },
        warn: '#C9762E',
        danger: '#C0432F',
      },
      fontFamily: {
        display: ['Lexend', 'system-ui', 'sans-serif'],
        body: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'monospace'],
      },
      borderRadius: {
        card: '14px',
      },
    },
  },
  plugins: [typography],
}