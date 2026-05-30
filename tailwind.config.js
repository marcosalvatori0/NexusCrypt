/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // NexusCrypt Design Tokens
        'nx-bg':        '#080c10',
        'nx-surface':   '#0e1218',
        'nx-surface2':  '#141a22',
        'nx-border':    '#1e2a38',
        'nx-cyan':      '#00f5d4',
        'nx-cyan-dim':  '#009e88',
        'nx-green':     '#22c55e',
        'nx-red':       '#ef4444',
        'nx-amber':     '#f59e0b',
        'nx-text':      '#e2e8f0',
        'nx-muted':     '#64748b',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      boxShadow: {
        'glow-cyan':   '0 0 20px rgba(0,245,212,0.25)',
        'glow-green':  '0 0 20px rgba(34,197,94,0.25)',
        'glow-red':    '0 0 20px rgba(239,68,68,0.25)',
      },
      animation: {
        'pulse-slow':    'pulse 3s ease-in-out infinite',
        'spin-slow':     'spin 4s linear infinite',
        'fade-in':       'fadeIn 0.3s ease',
        'slide-up':      'slideUp 0.3s ease',
        'shimmer':       'shimmer 2s linear infinite',
      },
      keyframes: {
        fadeIn:  { from: { opacity: '0' }, to: { opacity: '1' } },
        slideUp: { from: { opacity: '0', transform: 'translateY(12px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        shimmer: {
          '0%':   { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
    },
  },
  plugins: [],
}
