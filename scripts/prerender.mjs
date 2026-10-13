/**
 * Static rendering.
 *
 * Run after `vite build`:
 *
 *     node scripts/prerender.mjs
 *
 * It renders the React tree to a string at build time and writes it into
 * `dist/index.html`, and it moves the JSON-LD into `<head>`.
 *
 * ── Why ──────────────────────────────────────────────────────────────────────
 *
 * The page renders its whole body with React, which is a real decision with real
 * costs and it is being kept. But it has one consequence that is not a matter of
 * taste:
 *
 *     curl https://vittoriashorses.it/ | grep -c "<h1>"
 *     0
 *
 * The shipped document is `<div id="root"></div>` and nothing else. Google Search
 * executes JavaScript, so it recovers the page from the same bytes. Most answer
 * engines do not: they fetch, parse and index what arrived, and what arrived is
 * an empty div. For a site whose entire value is "we are a riding stable in
 * Terni, here is our number and here is our address", that is the largest
 * single defect the audit found, and it is invisible to Lighthouse — which is
 * why the SEO category scores 100 while the page has no text in it.
 *
 * This closes it. The server-rendered markup is in the document for a crawler
 * that never runs a line of the bundle, and `hydrateRoot` takes over from there
 * for a visitor who does, so the page stays exactly as it was.
 *
 * ── What is deliberately not done here ───────────────────────────────────────
 *
 * `renderToString`, not `renderToPipeableStream` or a streaming pass. There is
 * one route and one tree, and the whole point is a complete string to write into
 * a file. Streaming buys nothing here and adds an async boundary that would have
 * to be awaited correctly to avoid a truncated document — which is a
 * malformed-HTML failure mode that is genuinely hard to spot, because the page
 * still renders.
 *
 * ── What this must not break ─────────────────────────────────────────────────
 *
 * Two things were verified before writing this, because both would have produced
 * a subtly broken page rather than an error:
 *
 *   1. Every `window`, `document`, `matchMedia` and `IntersectionObserver` read
 *      in the tree is inside a `useEffect` or an event handler. None is in
 *      render. That is what makes the render deterministic, and it was checked
 *      rather than assumed — a single `useState(() => window.innerHeight)` would
 *      have produced a hydration mismatch on every load.
 *
 *   2. `useReveal` writes its hidden state in an effect, not in render
 *      (useReveal.ts:49). So the prerendered HTML ships with every block visible,
 *      and a visitor never sees a page where the text is hidden waiting for an
 *      observer that hydration has not started yet. If that ever moves into
 *      render, the prerendered document becomes a page of invisible text, and
 *      the crawler reads that same invisible text.
 *
 * The verification run at the end of this file checks the second one, by
 * asserting that the output contains no `data-shown="false"`.
 */

import { build } from 'vite'
import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, join } from 'node:path'

import { createElement } from 'react'
import { renderToString } from 'react-dom/server'

const root = dirname(fileURLToPath(new URL('.', import.meta.url)))
const dist = join(root, 'dist')
const outDir = join(root, 'node_modules', '.cache', 'prerender-build')

/**
 * Compile `src/main.tsx` to a runnable server module.
 *
 * A real build rather than a loader, because the alternative is a TypeScript and
 * JSX transform in this file, and the project already has both configured. The
 * output goes under `node_modules/.cache/` so a failed run cannot leave a stray
 * bundle in the published site, and `publicDir` is off so the 30 MB of media is
 * not copied on every run.
 *
 * `ssr: true` is what keeps `import.meta.env` populated inside `content.ts`,
 * which is how `media()` resolves the deploy base.
 *
 * `base` has to be restated here, and it is the second of the two settings that
 * have to agree. `vite.config.ts` sets `base: './'` so the site works from a
 * project subpath, and this programmatic build sets `configFile: false`, which
 * throws that file away. Without the restatement `import.meta.env.BASE_URL` is
 * `/`, every asset in the output becomes `/media/…`, and the prerendered
 * document disagrees with the client build on fifteen paths — a hydration
 * mismatch that React resolves by discarding the whole prerender, plus a page
 * that 404s every image if it were ever served from a subpath.
 *
 * It is the same class of bug as a hardcoded origin: a value that has to agree
 * across two places, and fails silently when it does not.
 *
 * `motion` is external, and not because it cannot render on a server: it can.
 * But `useScroll` measures its target against a document that does not exist
 * here, and the values it produces during a server render are placeholders that
 * hydration immediately discards. Bundling it would mean shipping a second copy
 * of a library the client already loads. `renderToString` never waits for
 * effects, so the placeholders cannot reach the output.
 */
async function buildApp() {
  await build({
    configFile: false,
    root,
    logLevel: 'error',
    publicDir: false,
    /* Must match vite.config.ts. See the note above. */
    base: './',
    define: {
      /* `base` alone is not enough. In an SSR build Vite does not populate
         `import.meta.env.BASE_URL`, so `media()` in content.ts reads `undefined`
         and every path comes out as `/media/…`. Defining it explicitly is what
         actually reaches the module, and it has to stay in step with the `base`
         above — the assertion in step 3 fails the build if they diverge. */
      'import.meta.env.BASE_URL': JSON.stringify('./'),
      'process.env.NODE_ENV': JSON.stringify('production'),
    },
    build: {
      outDir,
      emptyOutDir: true,
      ssr: true,
      lib: { entry: join(root, 'src', 'entry-server.tsx'), formats: ['es'] },
      rollupOptions: {
        external: [/^react/, /^motion/],
        output: { entryFileNames: 'app.mjs' },
      },
    },
  })

  return import(pathToFileURL(join(outDir, 'app.mjs')).href)
}

const { default: App, structuredDataJson } = await buildApp()

/**
 * Lowercase the one attribute React 18 writes in camelCase.
 *
 * `renderToString` emits `srcSet="…"` on the gallery images. An HTML parser
 * lowercases attribute names, so by the time React hydrates and looks for the
 * `srcSet` prop it finds `srcset` instead and reports a mismatch — error #418,
 * then #423, after which the root silently falls back to client rendering. That
 * is the whole prerender undone, from one letter case, and it is invisible in
 * the page: everything still works, which is why it has to be checked rather
 * than looked for.
 *
 * It is a React 18 bug, not a mistake in the components — React 19 emits
 * `srcset`. The rewrite is scoped to whole attribute names on `<img>` and
 * `<source>` tags, so it cannot touch attribute *values*: a `srcSet` inside an
 * `alt` or a caption is left alone, and `viewBox`, which is genuinely
 * case-sensitive in SVG, is excluded by tag rather than by blanket lowercasing.
 *
 * Delete this on the React 19 upgrade, where the emitted markup is already
 * correct. The assertion in step 3 is what will notice if it is left behind.
 */
const lowerSrcSet = (input) =>
  input.replace(/(<(?:img|source)\b[^>]*?)\ssrcSet=/g, '$1 srcset=')

const html = await readFile(join(dist, 'index.html'), 'utf8')

/* ── 1. the body ────────────────────────────────────────────────────────────
   Replace the empty mount point with the rendered tree. The existing
   `<div id="root"></div>` is located rather than the whole file rewritten, so
   the head — every preload, the font faces, the canonical, the OG tags — is
   carried through untouched and cannot be dropped by a regeneration bug. */
const marker = '<div id="root"></div>'

if (!html.includes(marker)) {
  console.error(`FAIL: ${marker} not found in dist/index.html`)
  console.error('      The build output shape changed; this script has to follow it.')
  process.exit(1)
}

const markup = renderToString(createElement(App))

const rendered = html.replace(marker, `<div id="root">${lowerSrcSet(markup)}</div>`)

/* ── 2. the JSON-LD ─────────────────────────────────────────────────────────
   Written into `<head>`, from the same module the page would have used.

   Not stripped from the body, because there is nothing there to strip: `App` no
   longer renders it. It used to, and this script used to delete that copy before
   adding this one. That arrangement broke hydration in a way worth recording,
   because both halves looked correct on their own.

   An element present in the prerendered document but absent from what the client
   renders is a hydration mismatch, and React answers a mismatch by discarding
   the prerender and rendering everything from scratch. So a node that the server
   emitted and the client did not — the script, having been moved to `<head>` —
   was enough to throw away the entire prerender on every page load. The page
   still looked perfect, which is what made it invisible: React recovered by
   client-rendering, so the result was correct and the fix was silently off.

   The lesson generalises past this file: with hydration, "the server output and
   the client render must describe the same tree" is a harder requirement than
   "the server output must be correct", and a step that makes one of them differ
   breaks the other. The JSON-LD therefore has exactly one owner — this file —
   and `App` renders no script at all. */
const head = `<script type="application/ld+json">${structuredDataJson()}</script>`

if (!rendered.includes('</head>')) {
  console.error('FAIL: dist/index.html has no </head> to write the JSON-LD into')
  process.exit(1)
}

const withData = rendered.replace('</head>', `  ${head}\n  </head>`)

await writeFile(join(dist, 'index.html'), withData, 'utf8')

/* ── 3. assert the result ────────────────────────────────────────────────────
   A prerenderer that quietly produces an empty or invisible document is the one
   bug in this file that no type check would catch, so the output is read back
   and checked for the specific ways it can be wrong. */
const final = await readFile(join(dist, 'index.html'), 'utf8')

const problems = []

if (!final.includes('<h1')) problems.push('no h1 in the output')
if (!final.includes('Addestramento')) problems.push('no activity text in the output')
if (!final.includes('349 238 7355')) problems.push('no telephone in the output')
if (!final.includes('Strada di Sabione')) problems.push('no street address in the output')

/* The failure mode this whole file exists to prevent. */
if (!final.includes('<h1')) {
  console.error('FAIL: the prerendered document has no h1 — this is the defect being fixed')
  process.exit(1)
}

/* Hidden-by-default text would be read as text by a crawler and seen as nothing
   by a visitor, which is the one asymmetry prerendering can introduce. */
if (final.includes('data-shown="false"')) {
  problems.push('output contains data-shown="false" — text would ship hidden')
}

/* Asset paths must be relative, matching what the client bundle emits. An
   absolute `/media/…` here means `BASE_URL` did not survive into the SSR build,
   which both mismatches hydration and 404s on a subpath deploy. */
if (/<(?:img|source|video)\b[^>]*\s(?:src|poster)="\/media\//.test(final)) {
  problems.push('output has absolute /media/ paths — BASE_URL did not reach the SSR build')
}

/* A camelCase `srcSet` in the output means hydration will mismatch and React
   will quietly throw away the prerender. See `lowerSrcSet` above. */
if (/<(?:img|source)\b[^>]*\ssrcSet=/.test(final)) {
  problems.push('output contains camelCase srcSet — hydration will fail')
}

const scripts = final.match(/application\/ld\+json/g) ?? []

if (scripts.length !== 1) {
  problems.push(`expected 1 JSON-LD block, found ${scripts.length}`)
}

/* `hydrateRoot` throws on a mismatch, so this is not cosmetic. */
if (!final.includes('id="root"')) problems.push('the mount point is gone')

if (problems.length) {
  for (const problem of problems) console.error(`FAIL: ${problem}`)
  process.exit(1)
}

const text = markup.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()

console.log(`index.html        prerendered (${markup.length} bytes of markup)`)
console.log(`                  ${text.length} characters of text, ${final.length} bytes total`)
console.log(`                  1 JSON-LD block, in <head>`)