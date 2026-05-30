/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/renderer/index.html', './src/renderer/src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Driven by CSS variables in index.css so themes can be swapped at runtime.
        paper: 'rgb(var(--paper) / <alpha-value>)',
        ink: 'rgb(var(--ink) / <alpha-value>)',
        muted: 'rgb(var(--muted) / <alpha-value>)',
        faint: 'rgb(var(--faint) / <alpha-value>)',
        line: 'rgb(var(--line) / <alpha-value>)',
        accent: 'rgb(var(--accent) / <alpha-value>)',
        chrome: 'rgb(var(--chrome) / <alpha-value>)'
      },
      fontFamily: {
        // Warm editorial serif for content; subtle system sans for chrome.
        content: [
          'ui-serif',
          'Iowan Old Style',
          'Charter',
          'Palatino',
          'Georgia',
          'serif'
        ],
        ui: ['ui-sans-serif', '-apple-system', 'Segoe UI', 'Helvetica Neue', 'sans-serif'],
        mono: ['ui-monospace', 'SF Mono', 'JetBrains Mono', 'Menlo', 'Consolas', 'monospace']
      }
    }
  },
  plugins: []
}
