import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Backgrounds
        'bg-0': '#0A0A0A',
        'bg-1': '#1C1C1E',
        'bg-2': '#2C2C2E',
        'stroke': '#3A3A3C',
        // Text
        'text-0': '#FAFAF9',
        'text-1': '#D4D4D4',
        'text-2': '#A1A1AA',
        // Accents
        'accent': '#F59E0B',
        'good': '#10B981',
        'bad': '#EF4444',
        'gold': '#F59E0B',
      },
      fontFamily: {
        'display': ['var(--font-space-grotesk)', 'sans-serif'],
        'body': ['var(--font-inter)', 'sans-serif'],
      },
      fontSize: {
        'body': ['15px', '1.5'],
        'score': ['2rem', '1'],
        'score-lg': ['3rem', '1'],
      },
      borderRadius: {
        'card': '16px',
        'card-sm': '12px',
        'button': '14px',
      },
      spacing: {
        '18': '4.5rem',
      },
      minHeight: {
        'button': '48px',  // 48px minimum for mobile touch targets
        'row': '48px',
        'action': '56px',
      },
      transitionDuration: {
        'tap': '150ms',
        'state': '250ms',
      },
      maxWidth: {
        'content': '1100px',
      },
    },
  },
  plugins: [],
}

export default config
