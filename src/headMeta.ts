/**
 * The `<head>` of both pages, as one function.
 *
 * This file exists so the social card metadata is written once. `index.html` had
 * its own hand-written block and `privacy.html` had a partial one that was
 * missing the description, the image and the card type — which is why a shared
 * privacy link rendered as a bare title with no picture and no summary.
 *
 * The tags are injected by `scripts/build-metadata.mjs`, not written into the
 * source HTML by hand, so:
 *
 *   - the canonical and the Open Graph URLs are absolute and consistent,
 *   - `og:image:width` and `og:image:height` are read from the file that exists
 *     rather than from a number someone typed, which is how a 1200x628 image came
 *     to be declared as 1200x630,
 *   - and both pages get the same set, so they cannot drift apart again.
 *
 * The descriptions are per-page and are passed in rather than derived, because
 * what a page is for is not derivable from what it contains.
 */

import { absolute, site, siteOrigin } from './content'

/** The share image. One file, for the home page and for the privacy page. */
const image = {
  url: absolute('media/og.webp'),
  /**
   * The real pixel dimensions of `media/og.webp`, which are 1200x628.
   *
   * Declared as 630 because 630 is what a 1.91:1 crop would be, and the number
   * was written down without checking the file. Social scrapers use these two
   * values to decide how to crop, so a figure 2px taller than the image asks the
   * renderer to crop a border that does not exist.
   *
   * If `og.webp` is ever re-exported, this has to change with it — which is why
   * `scripts/build-metadata.mjs` verifies the numbers against the file rather
   * than trusting them.
   */
  width: 1200,
  height: 628,
  /**
   * The image is a generated illustration, so the alt describes the picture and
   * names no region. An earlier version said "campagna toscana" while the maneggio
   * is in Umbria, which was both the wrong place and an implicit claim that the
   * file photographs somewhere real.
   */
  alt: 'Illustrazione di un cavallo baio al pascolo in un campo.',
}

const escape = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const meta = (property: string, content: string) =>
  `    <meta property="${property}" content="${escape(content)}" />`

const name = (key: string, content: string) =>
  `    <meta name="${key}" content="${escape(content)}" />`

export interface PageMeta {
  /** Path from the site root, e.g. `/` or `/privacy.html`. */
  path: string
  /** `<title>`, written in full rather than derived from the site name. */
  title: string
  description: string
  /** `website` for the home page, `article` for a page of prose. */
  ogType: 'website' | 'article'
}

/** The absolute URL of a page, from its path. */
const url = (path: string) => (path === '/' ? `${siteOrigin}/` : absolute(path))

/**
 * The tags for one page.
 *
 * Every one of these is inside `<head>`, which is the only place any of them do
 * anything: a crawler reads them from the document rather than from a rendered
 * tree, so putting them in React would mean they exist only for a browser.
 */
export function headTags(page: PageMeta): string {
  const canonical = url(page.path)

  return [
    `    <link rel="canonical" href="${canonical}" />`,
    '',
    /* Open Graph. The four required properties, then the image with its real
       dimensions. */
    meta('og:type', page.ogType),
    meta('og:site_name', site.name),
    meta('og:title', page.title),
    meta('og:description', page.description),
    meta('og:url', canonical),
    meta('og:locale', 'it_IT'),
    meta('og:image', image.url),
    meta('og:image:type', 'image/webp'),
    meta('og:image:width', String(image.width)),
    meta('og:image:height', String(image.height)),
    meta('og:image:alt', image.alt),
    '',
    /* Twitter/X. It falls back to the Open Graph tags for anything not named
       here, so the card type is the only genuinely required line — but naming
       the title and description explicitly is what makes a card render correctly
       when a platform reads Twitter tags before Open Graph ones, which several
       do. */
    name('twitter:card', 'summary_large_image'),
    name('twitter:title', page.title),
    name('twitter:description', page.description),
    name('twitter:image', image.url),
    name('twitter:image:alt', image.alt),
  ].join('\n')
}

/**
 * The icons and the theme colour.
 *
 * `theme-color` twice, because the site has two themes and a browser picks one:
 * a single value fixes the address bar to the light ground for a visitor who has
 * asked for dark, which is the one place the theme choice becomes visible outside
 * the page. Browsers that understand `prefers-color-scheme` take the second
 * `media`-scoped value; the rest take the first.
 *
 * The two values are the page grounds from `src/index.css` — `oklch(0.977 …85)`
 * and `oklch(0.192 …45)` — converted to hex, because `theme-color` accepts no
 * other notation on the browsers that ship it. If the tokens in the stylesheet
 * change, these have to change with them; they are written out rather than
 * computed because there is no build step that reads the stylesheet.
 *
 * `apple-touch-icon` is the PNG that iOS uses for a home-screen shortcut. Without
 * it iOS screenshots the page, which on this site means the opening video rather
 * than the mark. An SVG is not accepted there — that is the one format iOS does
 * not read — so the file has to be a real raster image, and `favicon.png` in
 * `public/` is that file.
 *
 * The `<link rel="icon">` for the SVG stays in the source HTML rather than here,
 * because it is the same one line on both pages and needs no generating.
 */
export function iconTags(): string {
  return [
    `    <meta name="theme-color" content="#faf7f2" />`,
    `    <meta name="theme-color" content="#1a120e" media="(prefers-color-scheme: dark)" />`,
    `    <link rel="apple-touch-icon" href="./favicon.png" />`,
    `    <link rel="icon" href="./favicon.svg" type="image/svg+xml" />`,
  ].join('\n')
}

/** The two pages, so the generator and the assertion agree on what exists. */
export const pages: PageMeta[] = [
  {
    path: '/',
    title: `${site.name} | Equitazione e doma a Terni`,
    description: site.description,
    ogType: 'website',
  },
  {
    path: '/privacy.html',
    title: `Privacy | ${site.name}`,
    description:
      'Come Vittoria’s Horses gestisce i dati personali nel sito web: nessun cookie di profilazione, nessun servizio di analytics, nessun modulo di raccolta dati.',
    ogType: 'article',
  },
]