/** @type {import('tailwindcss').Config} */
export default {
  /* privacy.html is a second entry: without it its classes are never generated.
     So is public/*.html, which is where 404.html lives: it is copied to dist
     verbatim rather than built as an entry, so nothing else would put its classes
     in the stylesheet and a utility used only there would be silently absent. */
  content: [
    './index.html',
    './privacy.html',
    './public/*.html',
    './src/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      /* Semantic tokens only. The values live in src/index.css so home and
         privacy read from one place and can flip with prefers-color-scheme.

         They are plain var() references on purpose, and that has a consequence
         worth remembering: Tailwind silently drops the /opacity modifier on
         var() colours, so `bg-ink/10` emits nothing at all. Translucency is
         baked into the token instead (--line) or spelled with color-mix() in
         index.css. Do not reintroduce /NN on these. */
      colors: {
        page: 'var(--page)',
        surface: 'var(--surface)',
        ink: 'var(--text)',
        muted: 'var(--muted)',
        accent: 'var(--accent)',
        'on-accent': 'var(--on-accent)',
        line: 'var(--line)',
        'line-strong': 'var(--line-strong)',
        'media-text': 'var(--media-text)',
        'media-scrim': 'var(--media-scrim)',
      },
      /* Two families, with one job each.
         `display` is the brand voice: Alfa Slab One carries the name and the
         experience titles, and only at weight 400. The face is already visually
         massive, so a medium or semibold on it is a request the file cannot
         answer and the browser would fake by smearing. `sans` is Plus Jakarta
         Sans, which carries everything that has to be read rather than
         announced: body copy, labels, controls, the FAQ.

         Both are self-hosted WOFF2 in src/fonts, so a visit makes no request to
         any font service and the two pages read from the same files. */
      fontFamily: {
        sans: ['Plus Jakarta Sans', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['Alfa Slab One', 'Georgia', 'serif'],
      },
      maxWidth: { shell: '1280px', measure: '58ch' },
      /* Photography stays square-edged; only controls and functional surfaces
         are rounded, so the two materials never read as the same thing. */
      borderRadius: { control: '8px', panel: '12px' },
      spacing: { gutter: '1.5rem', 'gutter-md': '2rem', 'gutter-lg': '3rem' },
      /* Named so a panel can never be ordered against a header by accident. */
      zIndex: { panel: '30', header: '40', skip: '60', dialog: '50' },
      transitionTimingFunction: { out: 'cubic-bezier(0.16, 1, 0.3, 1)' },
      transitionDuration: { 120: '120ms', 180: '180ms', 240: '240ms' },
    },
  },
  plugins: [],
}
