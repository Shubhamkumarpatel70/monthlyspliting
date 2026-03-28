/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: '#22D3EE',
        darkBg: '#0F172A',
        surface: '#1E293B',
        success: '#10B981',
        danger: '#EF4444',
        warning: '#F59E0B',
        textPrimary: '#F8FAFC',
        textSecondary: '#94A3B8',
      },
      fontFamily: {
        sans: ['DM Sans', 'system-ui', 'sans-serif'],
      },
      keyframes: {
        'ai-shimmer': {
          '0%': { transform: 'translateX(-120%)' },
          '100%': { transform: 'translateX(350%)' },
        },
        'ai-pulse-glow': {
          '0%, 100%': { opacity: '0.85' },
          '50%': { opacity: '1' },
        },
      },
      animation: {
        'ai-shimmer': 'ai-shimmer 1.35s ease-in-out infinite',
        'ai-pulse-glow': 'ai-pulse-glow 1.8s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
