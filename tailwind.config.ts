import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#111827',
        paper: '#f5f5f0',
        accent: '#7c3aed',
        // Semantic score colors
        ok: '#059669',
        warn: '#ea580c',
        bad: '#e11d48',
      },
      fontFamily: {
        sans: ['var(--font-geist-sans)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      transitionTimingFunction: {
        'out-strong': 'cubic-bezier(0.23, 1, 0.32, 1)',
        'in-out-strong': 'cubic-bezier(0.77, 0, 0.175, 1)',
        'drawer': 'cubic-bezier(0.32, 0.72, 0, 1)',
      },
      boxShadow: {
        'card': '0 1px 2px rgba(11,13,18,0.04), 0 8px 24px -8px rgba(11,13,18,0.08)',
        'card-lift': '0 1px 2px rgba(11,13,18,0.05), 0 24px 48px -12px rgba(11,13,18,0.18)',
      },
    },
  },
  plugins: [],
};
export default config;
