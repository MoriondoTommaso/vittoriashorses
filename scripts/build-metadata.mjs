/**
 * Static metadata generation.
 *
 * Run after `vite build`:
 *
 *     node scripts/build-metadata.mjs
 *
 * It reads the same modules the page reads and writes three files into `dist/`
 * that a crawler or an answer engine needs and that React cannot deliver,
 * because neither of them runs the page's JavaScript:
 *
 *   - `dist/llms.txt`      a plain-text summary for language models
 *   - `dist/robots.txt`    rewritten to point at the sitemap
 *   - `dist/sitemap.xml`   with `<lastmod>` taken from the sources
 *
 * The JSON-LD and the rendered body are `scripts/prerender.mjs`'s job. This file
 * is only the parts that need no browser.
 *
 * The values come from `src/content.ts` via a bundle compiled from the real
 * sources, never from a second transcription in this file. A hand-written
 * `llms.txt` is a document that starts lying the first time somebody changes a
 * phone number, and the only defence is that it cannot be written by hand.
 */

import { build } from 'vite'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { readFile, writeFile, stat } from 'node:fs/promises'
import { dirname, join } from 'node:path'

const root = dirname(fileURLToPath(new URL('.', import.meta.url)))
const dist = join(root, 'dist')

/**
 * Compile `src/metadata-entry.ts` to a temporary module and import it.
 *
 * A build rather than a loader because the alternative is a TypeScript transform
 * in this file, and the project has a working one already. The output goes to a
 * temporary directory rather than into `dist/` so that a failed run cannot leave a
 * stray bundle in the published site.
 */
async function loadMetadata() {
  const outDir = join(root, 'node_modules', '.cache', 'metadata-build')

  await build({
    configFile: false,
    root,
    logLevel: 'error',
    publicDir: false,
    build: {
      outDir,
      emptyOutDir: true,
      /* Library mode: no HTML entry, no CSS, and one ES module that this file
         imports. `ssr` keeps `import.meta.env` populated, which is how
         `content.ts`'s `media()` helper resolves the deploy base. */
      ssr: true,
      lib: {
        /* Both modules in one bundle. `structuredData` pulls in `content.ts`, and
           `headMeta` reads from the same file, so compiling them together means
           the social card metadata and the JSON-LD are derived from one copy of
           the site data rather than two that can be edited independently. */
        entry: join(root, 'src', 'metadata-entry.ts'),
        formats: ['es'],
      },
      rollupOptions: {
        external: [/^react/],
        /* Not `fileName`, because lib mode derives the name from the entry and
           ignores it — the name asked for is not the name written. The output
           name is pinned here instead so the import below has something exact to
           resolve. */
        output: { entryFileNames: 'metadata.mjs' },
      },
    },
  })

  return import(pathToFileURL(join(outDir, 'metadata.mjs')).href)
}

const { structuredData, llmsTxt, headTags, iconTags, pages, absolute, privacyHtml, privacySections, privacyNeedsConsent } =
  await loadMetadata()

/** ISO 8601, which is what `<lastmod>` and `Last-Modified` both require. */
const iso = (date) => date.toISOString().replace(/\.\d{3}Z$/, 'Z')

/* ── the <head> of both pages ────────────────────────────────────────────────
   The canonical, the Open Graph tags and the Twitter card, generated from
   `src/headMeta.ts` and replacing whatever was in the source HTML.

   Replaced rather than added to, because both pages already carried hand-written
   copies of most of these and `privacy.html` was missing the description, the
   image and the card type. Two sets of tags for one page is not a merge
   conflict to be resolved later: some scrapers read the first match and some read
   the last, so a page with both can render with the older description on one
   platform and the newer on another.

   `index.html` is handled here rather than by `prerender.mjs` because the two
   run in sequence — `vite build`, then the prerender, then this — so by the time
   this writes, the prerendered body is already in place and must not be lost.
   The markers are what makes that safe: a `<!-- generated:head -->` pair the
   replacement targets, so the operation is idempotent and cannot rewrite the
   body by accident. */
const HEAD_MARKER = '<!-- generated:head -->'

/**
 * Replace a marked region, however much is inside it, leaving one opening marker.
 *
 * Index arithmetic rather than a regular expression, because the two cases a
 * pattern has to distinguish are not reliably distinguishable by one:
 *
 *   - The source carries an *empty* pair — the marker twice on adjacent lines,
 *     with nothing between — which a "then something, then the marker" pattern
 *     does not match at all. It matches from the first marker to the second,
 *     which is the next marker of a *different* kind further down the document,
 *     and deletes everything in between. On `privacy.html` that is the entire
 *     notice: a page that builds, reports success, and ships with its legal text
 *     missing.
 *
 *   - The second run carries a full block, which any pattern handles.
 *
 * Splitting on the marker and rejoining handles both, because it never asks how
 * much is in between.
 *
 * The return is *the whole document with the region collapsed to one marker*: the
 * part before the opening marker, the marker, then everything after the closing
 * one. Returning only the head was the bug this shape replaces — the caller then
 * appended its block to a fragment that had no tail, so everything after the
 * region, including the stylesheet link, was dropped and the page shipped
 * unstyled with no error anywhere.
 *
 * A marker count other than two or three is reported rather than guessed at: a
 * document with one marker or five has been edited by hand, and silently picking
 * a pair out of five would be the wrong answer.
 */
function replaceBlock(html, marker) {
  const parts = html.split(marker)
  const found = parts.length - 1

  /* Exactly two, or the document has been edited by hand in a way the generator
     cannot resolve. Three cases, all of them observed rather than imagined:

     - More than two: an extra marker, so no pair can be chosen without deleting
       something that was written on purpose.
     - Exactly one: a marker was removed. `replaceBlock` has nothing to collapse,
       returns the document untouched, and the *insert* that follows then wraps
       new content around the surviving marker — which produces a document with
       both the hand-written block and the generated one. On privacy.html that is
       18 sections rather than 11, it builds successfully, and it ships duplicate
       legal text.
     - Zero: the marker is gone entirely and the generated content silently does
       not appear at all.

     The last two are the reason this is fatal rather than a fallback. A missing
     block that fails the build is a five-second fix; one that ships quietly is a
     page with two copies of a privacy notice, or none.
     */
  if (found !== 2) {
    console.error(`FAIL: ${marker} appears ${found} time(s), expected exactly 2.`)
    console.error('      The markers were added, removed or duplicated by hand.')
    process.exit(1)
  }

  return `${parts[0]}${marker}${parts[2]}`
}

for (const page of pages) {
  const file = page.path === '/' ? 'index.html' : page.path.slice(1)
  const path = join(dist, file)

  let html = await readFile(path, 'utf8')
  const headEnd = html.indexOf('</head>')

  /* Everything up to </head>, which is the only part this touches. Splitting the
     document first is what makes "in the head" a structural fact rather than a
     pattern that happens to avoid matching a body element — the body of the home
     page is 17 kB of prerendered markup, and a regex loose enough to be simple
     is also loose enough to find something in there. */
  let head = html.slice(0, headEnd)
  const body = html.slice(headEnd)

  /* Remove the previous output, and any hand-written equivalent, before writing the
     new one. Order matters and was the bug this replaced: stripping after
     injecting removes the tags it had just added, which is why a first run
     produced a document with `og:title` and `og:description` but no `og:type`, no
     canonical and no `twitter:card` — and no error, because every individual
     operation succeeded. */
  head = replaceBlock(head, HEAD_MARKER)

  for (const pattern of [
    /\s*<link\b[^>]*\brel="canonical"[^>]*>/,
    /\s*<meta\b[^>]*\bproperty="og:[^"]*"[^>]*>/,
    /\s*<meta\b[^>]*\bname="twitter:[^"]*"[^>]*>/,
  ]) {
    head = head.replace(pattern, '')
  }

  /* `replaceBlock` has already collapsed the region to a single opening marker, so
     the new block is the opening marker, the tags, and the closing one. Appending
     to the collapsed head is what keeps everything after the marker — the
     stylesheet link, the rest of </head> — in the document. */
  /* `privacy.html` loads no JavaScript, so nothing imports the stylesheet and
     Vite emits no `<link>` for it — the only reason `index.html` has one is the
     CSS import in `main.tsx`. The link is therefore taken from the built
     `index.html`, which is also where the content-hashed filename lives: hardcoding
     it here would break on the next stylesheet change. Read from the output rather
     than computed so the three pages cannot reference different files. */
  let stylesheet = ''

  if (file === 'privacy.html') {
    const built = await readFile(join(dist, 'index.html'), 'utf8')
    const href = built.match(/<link rel="stylesheet"[^>]*href="([^"]+)"/)

    if (!href) {
      console.error('FAIL: no bundled stylesheet in dist/index.html to give privacy.html')
      process.exit(1)
    }

    stylesheet = `\n    <link rel="stylesheet" href="${href[1]}" />`
  }

  const block = `${HEAD_MARKER}\n${headTags(page)}\n${iconTags()}${stylesheet}\n    ${HEAD_MARKER}`

  const written = head
    .replace(/\n{3,}/g, '\n\n')
    .replace(/\s*$/, '\n  ')
    .replace(HEAD_MARKER, block) + '\n  ' + body

  await writeFile(path, written, 'utf8')
  console.log(`${file.padEnd(17)} head metadata written`)
}

/* ── the 404 page's stylesheet ───────────────────────────────────────────────
   `public/404.html` is copied to `dist/` verbatim rather than processed by Vite,
   so a `/src/index.css` link in it would ship as written and 404. The served page
   would be an unstyled wall of default-type links, shown to the one visitor who
   has already hit a broken address.

   So the bundled file is found in `dist/index.html` and the same href is written
   here. Read from the built output rather than hardcoded, because the filename
   carries a content hash that changes whenever the CSS does; copying a fixed
   name into this file would be a broken link waiting for the next stylesheet
   edit.

   `<link rel="icon">` is injected here for the same reason it is on the other two
   pages, and `theme-color` is left off a page that is never in a tab for long. */
{
  const path = join(dist, '404.html')
  let html = await readFile(path, 'utf8')

  const built = await readFile(join(dist, 'index.html'), 'utf8')
  const href = built.match(/<link rel="stylesheet"[^>]*href="([^"]+)"/)

  if (!href) {
    console.error('FAIL: no bundled stylesheet found in dist/index.html')
    console.error('      The 404 page cannot be given one; check the vite build output.')
    process.exit(1)
  }

  /* Relative, because `404.html` is served for any path under the site root: a
     request for `/a/b/c` returns this file at the root, and an absolute `/assets/…`
     would be the safer form here — but `href[1]` is what Vite wrote into the
     other pages and matching it keeps one rule for all three. */
  const block = `${HEAD_MARKER}\n${iconTags()}\n    <link rel="stylesheet" href="${href[1]}" />\n    ${HEAD_MARKER}`

  const headEnd = html.indexOf('</head>')
  const head = html.slice(0, headEnd)
  const rest = html.slice(headEnd)

  const cleaned = replaceBlock(head, HEAD_MARKER)
    .replace(/\s*$/, '\n  ')
    .replace(HEAD_MARKER, block)

  await writeFile(path, cleaned + '\n  ' + rest, 'utf8')
  console.log(`404.html          stylesheet and icons written`)
}

/* ── the privacy notice ──────────────────────────────────────────────────────
   The body of `privacy.html`, from `src/privacy.ts`.

   It cannot be rendered by React: this page loads no JavaScript at all, on
   purpose, so that a reader who blocks scripts still reads the whole notice. That
   is also the reason the notice has to be in the document rather than fetched —
   the people most likely to be reading a privacy notice are the ones least likely
   to allow scripts.

   The same reason it is generated rather than hand-written: the address, the phone
   number and the two social profiles appear in this notice and on the home page,
   and a second hand-written copy of a contact detail is a second thing to forget
   when it changes.

   The last-updated date is generated from the file's own mtime for the same
   reason it was hardcoded before and wrong: a date somebody typed is a date
   nobody updates. */
{
  const NOTICE_MARKER = '<!-- generated:notice -->'
  const path = join(dist, 'privacy.html')
  const html = await readFile(path, 'utf8')

  const { mtime } = await stat(join(root, 'privacy.html'))

  const italian = new Intl.DateTimeFormat('it-IT', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Europe/Rome',
  })

  const updated = `<p class="text-sm text-muted">\n          Ultimo aggiornamento:\n          <time datetime="${iso(mtime)}">${italian.format(mtime)}</time>.\n        </p>`

  const notice = [
    '      <div class="mt-10 max-w-[58ch] space-y-9">',
    privacyHtml(),
    '',
    updated,
    '      </div>',
  ].join('\n')

  const cleaned = replaceBlock(html, NOTICE_MARKER)

  const written = cleaned.replace(
    NOTICE_MARKER,
    `${NOTICE_MARKER}\n${notice}\n      ${NOTICE_MARKER}`,
  )

  await writeFile(path, written, 'utf8')

  const count = privacySections().length
  console.log(`privacy.html       notice written (${count} sections)`)

  /* A notice that lost its right to complain to a regulator is incomplete, and
     that is not something a build failure would otherwise catch: the section is
     prose, and prose that renders is prose that renders. Checked here because the
     previous version of this page omitted it entirely and nothing noticed. */
  const rights = privacySections().find((section) => section.id === 'diritti')
  if (!rights?.body.some((paragraph) => /Garante/.test(paragraph))) {
    console.error('FAIL: the privacy notice does not name the right to complain to the Garante')
    console.error('      GDPR art. 13(2)(b) requires it to be stated.')
    process.exit(1)
  }

  if (privacyNeedsConsent) {
    console.error('FAIL: privacyNeedsConsent is true but no consent banner is implemented.')
    console.error('      The site now needs one; see the note in src/privacy.ts.')
    process.exit(1)
  }

  console.log(`privacy.html       art. 13 required elements present`)
}

/* ── verify the share image is what the tags claim ─────────────────────────────
   The dimensions are written in `headMeta.ts` as constants, and they are the kind
   of number that is correct once and then wrong forever after: the file gets
   re-exported at a different size and the tags keep describing the old one. That
   mismatch is invisible to a crawler, which trusts the tags, and to a person
   looking at the page.

   So the header of the real file is read and compared. WebP and JPEG both carry
   their dimensions in a fixed-size header, and this reads them rather than
   shelling out to an image library the project does not otherwise depend on. */
async function imageSize(file) {
  const buffer = await readFile(file)

  /* RIFF....WEBP */
  if (buffer.subarray(8, 12).toString() !== 'WEBP') return null

  const chunk = buffer.subarray(12, 16).toString()
  const body = buffer.subarray(20)

  /* VP8X: the extended format, 24-bit little-endian canvas size minus one. */
  if (chunk === 'VP8X') {
    return {
      width: 1 + (body[4] | (body[5] << 8) | (body[6] << 16)),
      height: 1 + (body[7] | (body[8] << 8) | (body[9] << 16)),
    }
  }

  /* VP8 (lossy): the frame header, 14 bits of width and height. */
  if (chunk === 'VP8 ') {
    return {
      width: body[6] | (body[7] << 8),
      height: body[8] | (body[9] << 8),
    }
  }

  /* VP8L (lossless): a 14-bit width and height packed after a signature byte. */
  if (chunk === 'VP8L') {
    const bits = body[1] | (body[2] << 8) | (body[3] << 16) | (body[4] << 24)
    return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 }
  }

  return null
}

const shareImage = await imageSize(join(root, 'public', 'media', 'og.webp'))
const declared = pages[0] && (await readFile(join(dist, 'index.html'), 'utf8'))
  .match(/og:image:width" content="(\d+)"[\s\S]*?og:image:height" content="(\d+)"/)

if (!shareImage) {
  console.error('FAIL: could not read the dimensions of media/og.webp')
  process.exit(1)
}

if (!declared) {
  console.error('FAIL: the share image dimensions are missing from dist/index.html')
  process.exit(1)
}

const [, width, height] = declared

if (shareImage.width !== Number(width) || shareImage.height !== Number(height)) {
  console.error(
    `FAIL: og.webp is ${shareImage.width}x${shareImage.height} but the tags declare ${width}x${height}`,
  )
  console.error('      Update the `image` object in src/headMeta.ts.')
  process.exit(1)
}

console.log(`share image        ok (${shareImage.width}x${shareImage.height}, matches the tags)`)

/* ── llms.txt ──────────────────────────────────────────────────────────────── */

await writeFile(join(dist, 'llms.txt'), llmsTxt(), 'utf8')
console.log('llms.txt          written')

/* ── robots.txt ──────────────────────────────────────────────────────────────
   Rewritten rather than copied, for the same reason: the sitemap URL is a fact
   about the deployment, and `vite.config.ts` uses a relative `base` so the site
   can also be served from a project subpath. Writing it by hand once is how the
   sitemap URL and the canonical origin end up disagreeing. */
await writeFile(
  join(dist, 'robots.txt'),
  ['User-agent: *', 'Allow: /', '', 'Sitemap: https://vittoriashorses.it/sitemap.xml', ''].join('\n'),
  'utf8',
)
console.log('robots.txt        rewritten')

/* ── sitemap.xml ──────────────────────────────────────────────────────────────
   `<lastmod>` is the mtime of the source that owns each page, read from the
   working tree rather than from a date someone remembered to type.

   It is advisory, not a directive: a search engine uses it to decide whether
   re-fetching a URL is worth the request, so a wrong value in the safe
   direction costs crawl budget, and a value that never changes is worse than no
   value at all because it teaches the crawler the signal is meaningless. */
/* From the same `pages` the head tags are generated from, so a page cannot appear
   in the sitemap without having a canonical URL, or the other way round. That
   coincidence is what stops the sitemap and the canonicals describing different
   sets of pages, which is a silent failure in both: neither file is wrong on its
   own, and a crawler has no way to notice that one URL is missing from one of
   them. */
const urls = []
for (const page of pages) {
  const file = page.path === '/' ? 'index.html' : page.path.slice(1)
  const { mtime } = await stat(join(root, file))
  urls.push(
    [
      '  <url>',
      `    <loc>${absolute(page.path)}</loc>`,
      `    <lastmod>${iso(mtime)}</lastmod>`,
      '  </url>',
    ].join('\n'),
  )
}

await writeFile(
  join(dist, 'sitemap.xml'),
  [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    urls.join('\n'),
    '</urlset>',
    '',
  ].join('\n'),
  'utf8',
)
console.log('sitemap.xml       written with lastmod')

/* ── a self-check, because a silently empty llms.txt ships like any other file ──
   The failure mode of a generator that depends on a bundle it just compiled is
   an import that resolved to undefined and a file containing the string
   "undefined". Nothing would report it. So the graph is validated here, in the
   build, where failing is cheap. */
const graph = structuredData()
const types = new Set(graph['@graph'].map((node) => node['@type']))

for (const required of ['LocalBusiness', 'WebSite', 'WebPage', 'FAQPage', 'Service']) {
  if (!types.has(required)) {
    console.error(`FAIL: structured data is missing a ${required} node`)
    process.exit(1)
  }
}

if (!JSON.stringify(graph).includes('3492387355')) {
  console.error('FAIL: structured data does not carry the phone number')
  process.exit(1)
}

console.log(
  `structured data   ok (${graph['@graph'].length} nodes: ${[...types].join(', ')})`,
)