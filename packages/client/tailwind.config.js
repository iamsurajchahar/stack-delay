/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./src/**/*.{ts,tsx}', './index.html'],
  theme: {
    extend: {
      colors: {
        'grade-a': '#22c55e',
        'grade-b': '#3b82f6',
        'grade-c': '#eab308',
        'grade-d': '#f97316',
        'grade-f': '#ef4444',
        sidebar: {
          DEFAULT: '#0f172a',
          hover: '#1e293b',
          active: '#334155',
        },
      },
    },
  },
  plugins: [],
};
