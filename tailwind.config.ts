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
        'bg-0': '#0B1020',
        'bg-1': '#111A2E',
        'bg-2': '#182342',
        'stroke': '#243255',
        // Text
        'text-0': '#F4F7FF',
        'text-1': '#B7C3E3',
        'text-2': '#7E8BB0',
        // Accents
        'accent': '#4DA3FF',
        'good': '#3CE6B0',
        'bad': '#FF5C7A',
        'gold': '#FFC857',
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
        'button': '44px',
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
