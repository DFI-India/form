/** @type {import('tailwindcss').Config} */

/**
 * Every colour below is a CSS variable holding space-separated RGB channels,
 * defined twice in `app/globals.css` — once on `:root` and once under `.dark`.
 * The `<alpha-value>` placeholder is what keeps slash-opacity utilities such as
 * `bg-ink/20` working; drop it and those silently render opaque.
 */
const token = (name) => `rgb(var(--${name}) / <alpha-value>)`

module.exports = {
  darkMode: 'class',
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'monospace'],
      },
      colors: {
        // Warm neutral scale — text and chrome.
        ink: {
          DEFAULT: token('ink'),
          muted: token('ink-muted'),
          faint: token('ink-faint'),
        },
        // Page and panel backgrounds.
        surface: {
          DEFAULT: token('surface'),
          sunken: token('surface-sunken'),
          sidebar: token('surface-sidebar'),
          hover: token('surface-hover'),
        },
        // Hairline borders.
        rule: {
          DEFAULT: token('rule'),
          strong: token('rule-strong'),
          faint: token('rule-faint'),
        },
        // Record status. Each pairs a tint with readable text.
        status: {
          'pending-bg': token('status-pending-bg'),
          'pending-fg': token('status-pending-fg'),
          'verified-bg': token('status-verified-bg'),
          'verified-fg': token('status-verified-fg'),
          'approved-bg': token('status-approved-bg'),
          'approved-fg': token('status-approved-fg'),
          'returned-bg': token('status-returned-bg'),
          'returned-fg': token('status-returned-fg'),
          'inactive-bg': token('status-inactive-bg'),
          'inactive-fg': token('status-inactive-fg'),
        },
        // Completeness meter.
        meter: {
          filled: token('meter-filled'),
          empty: token('meter-empty'),
          inactive: token('meter-inactive'),
        },
        // Accent used for avatars and the "current" highlight.
        accent: {
          bg: token('accent-bg'),
          fg: token('accent-fg'),
        },
      },
    },
  },
  plugins: [],
}
