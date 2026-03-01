/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        sidebar: '#111827',
        chat: '#1F2937',
        bubble: {
          user: '#2563EB',
          agent: '#374151',
        },
        accent: '#10B981',
        warning: '#F59E0B',
      },
    },
  },
  plugins: [],
};
