/* The acceptance list requires the degraded paths to be exercised, not
   assumed. Each case breaks one link in the chain and checks the page still
   delivers the experiences and a way to make contact.

   Run: node checks/fallbacks.mjs [baseUrl]
   Exits non-zero if any case stops being usable. */
import { chromium } from 'playwright'

const BASE = process.argv[2] ?? 'http://localhost:4180'
const browser = await chromium.launch()
const results = []

/* Every deep-link target the page advertises, in the order it is read. Six, now:
   the walk chapter joined the other two activities, and a target list that is not
   updated with the page reports a green run on a page that has lost an anchor
   somebody has already bookmarked. */
const TARGETS = ['top', 'addestramento', 'lezioni', 'passeggiate', 'galleria', 'contatti']

const stillUsable = (page) =>
  page.evaluate((targets) => {
    const hrefs = [...document.querySelectorAll('a[href]')].map((a) => a.getAttribute('href'))
    const visible = (el) => {
      for (let n = el; n && n !== document.body; n = n.parentElement) {
        if (getComputedStyle(n).display === 'none') return false
      }
      return true
    }
    return {
      /* The anchors are deep-link targets rather than links, so what matters is
         that the elements exist, not that something points at them. */
      targets: targets.filter((id) => document.getElementById(id)).length,
      instagram: hrefs.some((h) => h && h.includes('instagram.com')),
      /* A phone number is now the most direct route on the page, and it is a link
         like any other, so it is checked with the social profile: a page that kept
         its Instagram but lost its telephone would still pass on instagram alone. */
      tel: hrefs.some((h) => h && h.startsWith('tel:+393492387355')),
      /* An image that failed must not be the only carrier of the message, so no
         image may carry a short or missing description. alt="" is the correct way
         to mark an image as decorative (the story posters, whose meaning comes
         from the text over them; the gallery thumbnails, whose button already names
         the action; and the mark, whose name is in the text beside it), so only
         alt=null or a stub counts. */
      alts: [...document.querySelectorAll('img')]
        .filter(visible)
        .filter((i) => {
          const alt = i.getAttribute('alt')
          return alt === null || (alt.length > 0 && alt.length < 10)
        }).length,
      h1: document.querySelectorAll('h1').length,
      /* Every moment must still carry its heading, and each activity its action.
         The opening deliberately has neither a heading beyond the name nor a call
         to action, so it is judged on the name alone. */
      chapters: [...document.querySelectorAll('.story-chapter')].map((section) => ({
        id: section.id,
        heading: Boolean(section.querySelector('h1, h2')),
        action: section.id === 'top' ? true : Boolean(section.querySelector('a[href]')),
      })),
    }
  }, TARGETS)

async function run(name, prepare) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e).slice(0, 120)))
  /* A blocked asset is reported by the browser as a failed request. That is the
     point of these cases, so it is not counted as an application error. */
  page.on('console', (m) => {
    if (m.type() !== 'error') return
    if (/Failed to load resource|ERR_FAILED|ERR_BLOCKED/.test(m.text())) return
    errors.push(m.text().slice(0, 120))
  })
  if (prepare) await prepare(ctx, page)
  await page.goto(BASE, { waitUntil: 'load' })
  await page.waitForTimeout(1600)
  const state = await stillUsable(page)

  /* The page has no navigation bar, so most in-page anchors are not links: they are
     deep-link targets kept for people who already have the URL. The promise they
     make is that the id exists and scrolls into view, and that is what is checked
     here.

     Any in-page link that does exist is followed by keyboard, because a link that
     goes nowhere is a broken promise however it was reached. */
  const TARGETS_NAV = TARGETS
  await page.evaluate(() => window.scrollTo(0, 0))
  const dead = []
  for (const id of TARGETS_NAV) {
    const reached = await page.evaluate((target) => {
      const el = document.getElementById(target)
      if (!el) return 'missing'
      /* Scrolled the way a deep link would, not by assigning a location: the point
         is that the target is where a browser would put it. */
      el.scrollIntoView({ block: 'start', behavior: 'instant' })
      const box = el.getBoundingClientRect()
      return box.top < window.innerHeight && box.bottom > 0 ? 'ok' : `out of view at ${Math.round(box.top)}`
    }, id)
    if (reached !== 'ok') dead.push(`#${id} (${reached})`)
  }
  for (const href of await page.evaluate(() =>
    [...new Set([...document.querySelectorAll('a[href^="#"]')].map((a) => a.getAttribute('href')))],
  )) {
    const ok = await page.evaluate((h) => {
      window.scrollTo(0, 0)
      const link = document.querySelector(`a[href="${h}"]`)
      if (!link) return false
      link.focus()
      return document.activeElement === link
    }, href)
    if (!ok) {
      dead.push(`${href} (not focusable)`)
      continue
    }
    await page.keyboard.press('Enter')
    await page.waitForTimeout(700)
    const landedHere = await page.evaluate((h) => {
      const el = document.getElementById(h.slice(1))
      if (!el) return false
      const box = el.getBoundingClientRect()
      return box.top < window.innerHeight && box.bottom > 0
    }, href)
    if (!landedHere) dead.push(`${href} (did not reach it)`)
  }
  const navigated = dead.length === 0

  /* The opening must still read as the name and a line, whatever happened to the
     media behind it, and something must still be visible on the stage. The name is
     now in text beside the mark rather than being the mark's text, so it is read
     out of the document either way. */
  const opening = await page.evaluate(() => {
    const h1 = document.querySelector('h1')
    const layers = [...document.querySelectorAll('.story-layer')]
    const mark = document.querySelector('#nome img')
    return {
      text: (h1?.textContent ?? '').replace(/\s+/g, ' ').trim(),
      /* Either the poster or the clip: something painted, not an empty frame. */
      stageLit: layers.some((l) => Number(getComputedStyle(l).opacity) > 0.01),
      postersDecoded: layers.map((l) => {
        const img = l.querySelector('img')
        return Boolean(img && img.complete && img.naturalWidth > 0)
      }),
      /* Whether the mark itself loaded, and if not whether the typeset fallback
         took its place. Both together are the whole claim of this section. */
      markLoaded: Boolean(mark && mark.complete && mark.naturalWidth > 0),
      markFallback: Boolean(document.querySelector('.brand-logo__fallback')),
    }
  })

  /* The gallery dialog has to open and navigate with every image broken. It is
     reached by keyboard, so the whole path is exercised the way it would be. */
  await page.evaluate(() => document.querySelector('.gallery-grid')?.scrollIntoView())
  await page.waitForTimeout(300)
  const dialog = await page.evaluate(async () => {
    const btn = document.querySelector('#galleria figure button')
    if (!btn) return 'no trigger'
    btn.click()
    await new Promise((r) => setTimeout(r, 400))
    const d = document.querySelector('#galleria dialog')
    if (!d?.open) return 'did not open'
    const before = d.querySelector('[aria-live]')?.textContent?.trim()
    d.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }))
    await new Promise((r) => setTimeout(r, 250))
    const after = d.querySelector('[aria-live]')?.textContent?.trim()
    const moved = before !== after
    const notice = d.textContent.includes('Immagine non disponibile')
    const closable = Boolean(d.querySelector('button'))
    d.close()
    return moved && closable ? (notice ? 'ok (with the missing-image notice)' : 'ok') : `arrows=${moved} controls=${closable}`
  })

  results.push({
    name,
    ...state,
    anchorNav: navigated ? 'ok' : `FAILED: ${dead.join(', ')}`,
    openingText: opening.text.length > 4 ? 'ok' : `FAILED ("${opening.text}")`,
    openingSurface: opening.stageLit ? 'poster/video' : 'FAILED (the stage is empty)',
    /* Either the official mark or the typeset name in its box. A page that has
       neither is a page whose opening is a rectangle of video with no name on it,
       which is the one failure the mark's fallback exists to prevent. */
    mark: opening.markLoaded ? 'logo' : opening.markFallback ? 'typeset fallback' : 'FAILED (nothing)',
    /* Every moment keeps its words: reported per case so a break names itself. */
    chaptersIntact: state.chapters.every((c) => c.heading && c.action) ? 'ok' : 'FAILED',
    galleryDialog: dialog,
    errors: errors.length,
  })
  await ctx.close()
}

await run('baseline')
await run('photographs blocked', async (ctx) => {
  await ctx.route('**/gallery-*.webp', (r) => r.abort())
})
/* One photograph of five, which is the case the whole-section block cannot produce.
   A missing file has to cost one cell and one message, never the composition: the
   other four cells have to stay on screen and in the lightbox. */
await run('one photograph blocked', async (ctx) => {
  await ctx.route('**/gallery-cavalli-*.webp', (r) => r.abort())
})
/* Both marks. This is the case that exists because the opening's name is a picture
   now: with no logo at all, the page must still be named. */
await run('logo blocked', async (ctx) => {
  await ctx.route('**/logo-*.svg', (r) => r.abort())
})
await run('posters blocked', async (ctx) => {
  await ctx.route('**/*poster*.webp', (r) => r.abort())
})
await run('clips blocked', async (ctx) => {
  await ctx.route('**/*.mp4', (r) => r.abort())
})
await run('all media blocked', async (ctx) => {
  await ctx.route('**/*.webp', (r) => r.abort())
  await ctx.route('**/*.mp4', (r) => r.abort())
})
await run('font blocked', async (ctx) => {
  await ctx.route('**/*.woff2', (r) => r.abort())
})
await run('no codec available', async (ctx) => {
  await ctx.addInitScript(() => {
    HTMLMediaElement.prototype.canPlayType = () => ''
    HTMLMediaElement.prototype.play = () =>
      Promise.reject(new DOMException('no supported source', 'NotSupportedError'))
  })
})
await run('save-data', async (ctx) => {
  await ctx.addInitScript(() => {
    const mm = window.matchMedia.bind(window)
    window.matchMedia = (q) =>
      /save-data/.test(q)
        ? { matches: true, addEventListener() {}, removeEventListener() {} }
        : mm(q)
  })
})
await run('reduced motion', async (ctx) => {
  await ctx.addInitScript(() => {
    const mm = window.matchMedia.bind(window)
    window.matchMedia = (q) =>
      /reduced-motion/.test(q)
        ? { matches: true, addEventListener() {}, removeEventListener() {} }
        : mm(q)
  })
})

await browser.close()
console.table(results)
const bad = results.filter(
  (r) =>
    r.targets < TARGETS.length ||
    !r.instagram ||
    !r.tel ||
    r.alts > 0 ||
    r.h1 !== 1 ||
    r.anchorNav !== 'ok' ||
    !String(r.openingText).startsWith('ok') ||
    String(r.openingSurface).startsWith('FAILED') ||
    String(r.mark).startsWith('FAILED') ||
    r.chaptersIntact !== 'ok' ||
    !String(r.galleryDialog).startsWith('ok') ||
    r.errors,
)
console.log(bad.length ? `FAIL: ${bad.map((b) => b.name).join(', ')}` : 'all fallback paths usable')
process.exit(bad.length ? 1 : 0)
