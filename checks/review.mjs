/* Visual and behavioural review harness. Not shipped: it exists so the checks in
   the spec are runnable, not aspirational.

   Run against a served build:
     node checks/review.mjs [baseUrl]

   Exits non-zero when anything is found, so it can gate a deploy. */
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'

const BASE = process.argv[2] ?? 'http://localhost:4180'
const OUT = 'review-shots'
mkdirSync(OUT, { recursive: true })

/* 640 is the layout width a 1280 screen lands on at 200% zoom, and 320 is the
   400% case. Zooming the root element is not a usable way to test this: Chromium
   reports scrollWidth pre-scaled and clientWidth unscaled, so the comparison
   mixes units and fails on a layout that does not overflow. 360 is the narrowest
   width any current phone reports. */
const WIDTHS = [320, 360, 390, 640, 768, 1024, 1440]

/* Every moment, in the order the page is read: the opening, then the three
   activities, then the two sections outside the story. #esperienze is the block of
   chapters; the individual chapters are checked separately below because that is
   where the video crossfades are. */
const SECTIONS = ['addestramento', 'lezioni', 'passeggiate', 'galleria', 'contatti']

/* The clips, in order. Kept as one list rather than repeated in three places
   below, because the file names the page asks for, the moment each chapter is
   paired with, and the regex that watches the wire all have to agree: a check that
   watches for three moments on a page that requests four would report a page
   working correctly as a page requesting a clip it should not have. */
const MOMENTS = ['fermo', 'passo', 'trotto', 'galoppo']
const MOMENT_RE = new RegExp(`^(${MOMENTS.join('|')})(-mobile)?\\.mp4$`)
/* Which chapter owns which moment. The pairing is a fact about the page, so it is
   asserted rather than inferred from the order of the two lists. */
const CHAPTER_MOMENT = {
  top: 'fermo',
  addestramento: 'passo',
  lezioni: 'trotto',
  passeggiate: 'galoppo',
}

const problems = []
const note = (w, msg) => problems.push(`[${w}] ${msg}`)

const browser = await chromium.launch()

/* ── Layout, media and keyboard across widths ───────────────────────────── */
for (const width of WIDTHS) {
  const ctx = await browser.newContext({
    viewport: { width, height: width < 500 ? 780 : 900 },
    deviceScaleFactor: 1,
  })
  const page = await ctx.newPage()
  const errors = []
  const foreign = []
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
  page.on('request', (r) => {
    const u = r.url()
    if (u.startsWith(BASE) || u.startsWith('data:') || u.startsWith('blob:')) return
    foreign.push(u)
  })

  await page.goto(BASE, { waitUntil: 'load' })
  await page.waitForTimeout(1200)

  /* Horizontal overflow is the most common responsive failure, but only when it
     escapes to the document. Content inside a deliberate scroll container is
     meant to extend past the edge. */
  const overflow = await page.evaluate(() => {
    const scrolls = (el) => {
      for (let n = el.parentElement; n; n = n.parentElement) {
        const ox = getComputedStyle(n).overflowX
        if (ox === 'auto' || ox === 'scroll' || ox === 'hidden') return true
      }
      return false
    }
    const w = document.documentElement.clientWidth
    return {
      doc: document.documentElement.scrollWidth > w + 1,
      items: [...document.querySelectorAll('body *')]
        .filter((el) => el.getBoundingClientRect().right > w + 1 && !scrolls(el))
        .slice(0, 5)
        .map((el) => `${el.tagName}.${el.className?.toString().slice(0, 40)}`),
    }
  })
  if (overflow.doc) note(`${width}px`, `document scrolls horizontally (${overflow.items.join(', ')})`)

  /* The opening must be legible without scrolling: the name and the one line
     inside the first screen. */
  const fold = await page.evaluate(() => {
    const h = window.innerHeight
    const seen = (sel) => {
      const el = document.querySelector(sel)
      if (!el) return 'missing'
      const r = el.getBoundingClientRect()
      return r.bottom <= h + 1 && r.top >= -1 ? 'in' : `out(${Math.round(r.top)}..${Math.round(r.bottom)} of ${h})`
    }
    return { name: seen('h1'), line: seen('h1 + p') }
  })
  if (fold.name !== 'in') note(`${width}px`, `the name is not in the first screen: ${fold.name}`)
  if (fold.line !== 'in') note(`${width}px`, `the opening line is not in the first screen: ${fold.line}`)

  await page.screenshot({ path: `${OUT}/${width}-opening.png` })

  for (const id of SECTIONS) {
    const found = await page.evaluate((i) => {
      const el = document.getElementById(i)
      if (!el) return false
      el.scrollIntoView({ block: 'start', behavior: 'instant' })
      return true
    }, id)
    if (!found) note(`${width}px`, `missing section #${id}`)
    await page.waitForTimeout(450)
    await page.screenshot({ path: `${OUT}/${width}-${id}.png` })
  }

  /* Every chapter must keep its title, its sentence and its action on screen
     together. A chapter is allowed to be taller than the viewport, but its own
     content is not: if that has grown, the action is pushed somewhere the reader
     would have to scroll away and come back to reach. */
  const chapterFit = await page.evaluate(() =>
    [...document.querySelectorAll('.story-chapter')].map((section) => {
      const panel = section.querySelector('.story-panel')
      if (!panel) return { id: section.id || 'opening', ok: true }
      const box = panel.getBoundingClientRect()
      return {
        id: section.id || 'opening',
        ok: box.height <= window.innerHeight,
        panelHeight: Math.round(box.height),
        viewport: window.innerHeight,
      }
    }),
  )
  for (const chapter of chapterFit) {
    if (!chapter.ok) {
      note(
        `${width}px`,
        `chapter #${chapter.id} needs ${chapter.panelHeight}px of content but the viewport is ${chapter.viewport}px`,
      )
    }
  }

  /* Every image must actually decode, and none may be left without a text
     alternative or with empty dimensions that would shift the layout.
     Only images that are actually rendered are judged: the three story layers are
     always in the document, and a browser is right not to fetch the ones whose
     moment has not been reached. */
  const images = await page.evaluate(() =>
    [...document.querySelectorAll('img')]
      .filter((el) => {
        for (let n = el; n && n !== document.body; n = n.parentElement) {
          if (getComputedStyle(n).display === 'none') return false
        }
        /* A layer that has not been reached yet legitimately has no source yet. */
        if (el.closest('.story-layer')) {
          const layer = el.closest('.story-layer')
          return Number(getComputedStyle(layer).opacity) > 0.01 || !el.getAttribute('src')
        }
        /* A lazy image below the fold is also let off, and this became necessary
           rather than tidy when the gallery went from five items to nine. Judged at
           the point this runs, its last row is legitimately off-screen and has
           correctly not been fetched: the browser is doing exactly what
           `loading="lazy"` asks of it. Asserting on it reports a page working
           correctly as a broken one, and the way that hides a real failure is that
           the same assertion would then have to be loosened far enough to tolerate
           the breakage too.

           The line is drawn at the viewport, not at "somewhere in the document": an
           eager image, or a lazy one somebody has actually scrolled to, still has
           to have decoded. */
        if (el.getAttribute('loading') === 'lazy') {
          const r = el.getBoundingClientRect()
          if (r.top > window.innerHeight || r.bottom < 0) return false
        }
        return true
      })
      .map((el) => ({
        ok: el.complete && el.naturalWidth > 0,
        alt: el.getAttribute('alt'),
        w: el.getAttribute('width'),
        h: el.getAttribute('height'),
        file: (el.currentSrc || el.src).split('/').pop(),
      }))
      .filter((i) => !i.ok || i.alt === null || !i.w || !i.h),
  )
  if (images.length) {
    note(`${width}px`, `images: ${images.map((i) => `${i.file} ${JSON.stringify(i)}`).join(' | ')}`)
  }

  /* Touch targets on the interactive set. */
  const small = await page.evaluate(() => {
    /* A link inside running text is exempt from the target size minimum, the same
       way WCAG 2.2 exempts it: enlarging it would break the line box it sits in.
       Everything that is a control in its own right is held to 44. */
    const inlineInProse = (el) => {
      if (el.tagName !== 'A') return false
      const parent = el.parentElement
      if (!parent) return false
      return [...parent.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim().length > 0)
    }
    return [...document.querySelectorAll('a[href], button, summary')]
      .filter((el) => !inlineInProse(el))
      .filter((el) => {
        const r = el.getBoundingClientRect()
        /* A control that has been faded out with the backdrop is not on screen and
           does not need to be reachable by touch. */
        if (r.width === 0 && r.height === 0) return false
        for (let n = el; n && n !== document.body; n = n.parentElement) {
          if (Number(getComputedStyle(n).opacity) < 0.05) return false
        }
        return r.width > 0 && (r.height < 44 || r.width < 44)
      })
      .slice(0, 6)
      .map((el) => `${el.tagName}:${(el.textContent ?? '').trim().slice(0, 24)}`)
  })
  if (small.length) note(`${width}px`, `targets under 44px: ${small.join(' | ')}`)

  /* Exactly one h1, and every anchor the page still advertises must exist. */
  const anchors = await page.evaluate(() => ({
    h1: document.querySelectorAll('h1').length,
    missing: [...document.querySelectorAll('a[href^="#"]')]
      .map((a) => a.getAttribute('href'))
      .filter((href) => href !== '#' && !document.querySelector(href)),
  }))
  if (anchors.h1 !== 1) note(`${width}px`, `${anchors.h1} h1 elements`)
  if (anchors.missing.length) note(`${width}px`, `an anchor points nowhere: ${anchors.missing.join(', ')}`)

  /* The six sections, in the order they are read. Order is the whole promise of
     the page: the story is one journey with the gaits in the order a horse moves in
     them, and a section that arrives early or late moves a crossfade that has
     already happened. */
  const order = await page.evaluate(() =>
    [...document.querySelectorAll('.story-chapter, #galleria, #contatti')].map(
      (e) => e.id || e.dataset.chapter,
    ),
  )
  const expectedOrder = ['top', 'addestramento', 'lezioni', 'passeggiate', 'galleria', 'contatti']
  if (order.join(',') !== expectedOrder.join(',')) {
    note(`${width}px`, `the order changed: ${order.join(', ')}`)
  }

  /* The mark, the telephone and the position. Read rather than assumed: each of
     these was a design decision, and a check that only asserts the page loads
     would not notice any of them being undone. */
  const facts = await page.evaluate(() => {
    const mark = document.querySelector('#nome img')
    const tel = document.querySelector('#addestramento a[href^="tel:"]')
    /* Any social link, not one in a named chapter. The walk chapter's action is a
       phone call now, so a check that looked for the social link there would be
       asserting something the page is right not to do. */
    const social = [...document.querySelectorAll('a[href]')].find((a) =>
      /instagram|facebook/.test(a.href),
    )
    const mapLink = [...document.querySelectorAll('#contatti a')].find((a) =>
      /maps\.app\.goo\.gl|google\.[a-z.]+\/maps/.test(a.href),
    )
    return {
      /* alt="" on the mark: the name is carried by the text beside it, so an alt
         here would announce "Vittoria's Horses" twice. */
      markAlt: mark ? mark.getAttribute('alt') : 'no img',
      markWidth: mark ? Math.round(mark.getBoundingClientRect().width) : 0,
      markVisible: mark ? Number(getComputedStyle(mark.closest('.brand-logo')).opacity) > 0 : false,
      telHref: tel ? tel.getAttribute('href') : 'missing',
      telTarget: tel ? tel.getAttribute('target') : 'missing',
      telText: tel ? (tel.textContent ?? '').replace(/\s+/g, ' ').trim() : '',
      socialTarget: social ? social.getAttribute('target') : 'missing',
      socialRel: social ? social.getAttribute('rel') : 'missing',
      address: document.querySelector('#contatti')?.textContent?.includes('Strada di Sabione 129'),
      pendingNote: /non è ancora pubblicato/.test(document.querySelector('#contatti')?.textContent ?? ''),
      mapsHref: mapLink ? mapLink.getAttribute('href') : 'missing',
      /* The photographs are real, so the sentence that denies it must be gone.
         Checked as text rather than as the absence of an element, because the
         notice is derived from the provenance of the set and could come back as a
         different node. */
      galleryNotice: /illustrazioni generate con AI|non fotografano il ranch/.test(
        document.querySelector('#galleria')?.textContent ?? '',
      ),
      items: document.querySelectorAll('#galleria .gallery-cell').length,
      /* Exactly one cell claims to be playable, and it is drawn rather than read. */
      plays: document.querySelectorAll('#galleria .gallery-play').length,
      /* A video element anywhere outside the open dialog means the clip is being
         requested with the page. */
      clipsInGrid: document.querySelectorAll('#galleria video').length,
    }
  })
  if (facts.markAlt !== '') note(`${width}px`, `the opening mark carries alt=${JSON.stringify(facts.markAlt)}`)
  if (!facts.markVisible) note(`${width}px`, 'the opening mark is not visible')
  if (facts.markWidth < 150 || facts.markWidth > 300) {
    note(`${width}px`, `the opening mark is ${facts.markWidth}px wide, outside 150-300`)
  }
  if (facts.telHref !== 'tel:+393493287355') note(`${width}px`, `the telephone link is ${facts.telHref}`)
  if (facts.telTarget !== null) note(`${width}px`, `the telephone link opens a tab (target=${facts.telTarget})`)
  if (!/Chiama Alberto/.test(facts.telText)) note(`${width}px`, `the telephone link reads "${facts.telText}"`)
  if (/instagram/i.test(facts.telText)) note(`${width}px`, 'the telephone link says "su Instagram"')
  if (facts.socialTarget !== '_blank') note(`${width}px`, `the social link target is ${facts.socialTarget}`)
  if (!/noopener/.test(facts.socialRel ?? '')) note(`${width}px`, `the social link rel is ${facts.socialRel}`)
  if (!facts.address) note(`${width}px`, 'the address is not on the page')
  if (facts.pendingNote) note(`${width}px`, 'the "address not published yet" note is still rendered')
  if (facts.mapsHref !== 'https://maps.app.goo.gl/ZrxD5R7oRXE6e89V7?g_st=ic') {
    note(`${width}px`, `the maps link is ${facts.mapsHref}`)
  }
  if (facts.galleryNotice) note(`${width}px`, 'the gallery still calls its photographs illustrations')
  if (facts.items !== 9) note(`${width}px`, `${facts.items} items in the gallery, wanted 9`)
  if (facts.plays !== 1) note(`${width}px`, `${facts.plays} cells marked as playable, wanted 1`)
  /* The clip's file must not be on the wire while the section is merely on screen.
     It is 3 MB against a section of photographs totalling well under that, and it
     is fetched only when somebody chooses it. A `<video>` element sitting in the
     grid with a src would break this on every visitor who scrolled past. */
  if (facts.clipsInGrid > 0) {
    note(`${width}px`, `${facts.clipsInGrid} video elements in the gallery; the clip must not exist until it is opened`)
  }

  /* The story must be one continuous stage: a sticky backdrop that spans the
     chapters, and no bar above them. A header reappearing, or the backdrop
     turning into a per-section block, is the failure this page exists to avoid. */
  const stage = await page.evaluate(() => {
    const stageEl = document.querySelector('.story-stage')
    if (!stageEl) return { ok: false, why: 'no .story-stage' }
    const cs = getComputedStyle(stageEl)
    const content = document.querySelector('.story-content')
    const stageZ = Number(cs.zIndex)
    const contentZ = content ? Number(getComputedStyle(content).zIndex) : -1
    return {
      ok: cs.position === 'sticky' && stageZ < contentZ,
      position: cs.position,
      stageZ,
      contentZ,
      header: document.querySelector('header') !== null,
    }
  })
  if (!stage.ok) note(`${width}px`, `the story stage is not one sticky backdrop behind the content: ${JSON.stringify(stage)}`)
  if (stage.header) note(`${width}px`, 'a header bar is present; the page is meant to open without one')

  /* Gallery dialog, by keyboard only. */
  {
    await page.evaluate(() => document.getElementById('galleria')?.scrollIntoView())
    await page.waitForTimeout(300)
    const opened = await page.evaluate(async () => {
      const btn = document.querySelector('#galleria figure button')
      if (!btn) return 'no trigger'
      btn.focus()
      btn.click()
      await new Promise((r) => setTimeout(r, 350))
      const d = document.querySelector('#galleria dialog')
      return d?.open ? 'ok' : 'did not open'
    })
    if (opened !== 'ok') note(`${width}px`, `gallery dialog ${opened}`)

    const first = await page.evaluate(
      () => document.querySelector('#galleria dialog [aria-live]')?.textContent?.trim(),
    )
    await page.keyboard.press('ArrowRight')
    await page.waitForTimeout(250)
    const second = await page.evaluate(
      () => document.querySelector('#galleria dialog [aria-live]')?.textContent?.trim(),
    )
    if (first === second) note(`${width}px`, 'ArrowRight did not change the gallery image')

    const trapped = await page.evaluate(() => {
      const d = document.querySelector('#galleria dialog')
      return d?.contains(document.activeElement) ?? false
    })
    if (!trapped) note(`${width}px`, 'focus left the gallery dialog')

    await page.screenshot({ path: `${OUT}/${width}-galleria-dialog.png` })
    await page.keyboard.press('Escape')
    await page.waitForTimeout(300)
    const back = await page.evaluate(
      () => document.activeElement?.tagName === 'BUTTON' && !!document.activeElement.closest('#galleria'),
    )
    if (!back) note(`${width}px`, 'closing the gallery did not return focus to a thumbnail')
  }

  if (foreign.length) note(`${width}px`, `third-party requests: ${[...new Set(foreign)].slice(0, 3).join(' | ')}`)
  if (errors.length) note(`${width}px`, `console: ${[...new Set(errors)].slice(0, 3).join(' | ')}`)
  await ctx.close()
}

/* ── The video: which variant, who may start it, and how many run at once ── */
async function withPage(context, fn) {
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
  await page.goto(BASE, { waitUntil: 'load' })
  await page.waitForTimeout(1600)
  const result = await fn(page)
  return { ...result, errors: [...new Set(errors)] }
}

for (const [label, width, want] of [
  ['below 768', 390, 'mobile'],
  ['above 768', 1280, 'desktop'],
]) {
  const ctx = await browser.newContext({ viewport: { width, height: 900 } })
  /* Filenames, not a shortened form: the orientation is encoded in the name and the
     check below has to be able to read it. */
  const asked = []
  ctx.on('request', (r) => {
    const file = r.url().split('/').pop() ?? ''
    if (MOMENT_RE.test(file)) asked.push(file)
  })
  const { errors } = await withPage(ctx, async (page) => {
    const state = await page.evaluate(() => {
      const videos = [...document.querySelectorAll('.story-layer video')]
      const running = videos.filter((v) => !v.paused && !v.ended)
      return {
        sources: videos.map((v) => (v.getAttribute('src') ?? '').split('/').pop()),
        running: running.length,
        label: document.querySelector('.story-control .sr-only')?.textContent?.trim(),
      }
    })
    const wantedSrc = `fermo${want === 'mobile' ? '-mobile' : ''}.mp4`
    if (!state.sources.includes(wantedSrc)) {
      note(`video ${label}`, `the opening moment did not use ${wantedSrc} (${state.sources.join(', ') || 'no source'})`)
    }
    /* Only the orientation that was asked for may be requested. On a narrow screen
       every clip must be the portrait file, and on a wide one none of them may
       be: mounting both and hiding one with CSS would download both. */
    const portrait = (name) => name.endsWith('-mobile.mp4')
    const wrong = asked.filter((name) => portrait(name) !== (want === 'mobile'))
    if (wrong.length) note(`video ${label}`, `also requested the other orientation: ${wrong.join(', ')}`)
    if (state.running !== 1) note(`video ${label}`, `${state.running} clips running at the opening, wanted 1`)
    if (state.label !== 'Metti in pausa il video di sfondo') {
      note(`video ${label}`, `the control reads "${state.label}"`)
    }

    /* At most one clip may be requested ahead of the reader, so the eight files are
       never all on the wire at once. */
    if (asked.length > 2) note(`video ${label}`, `${asked.length} clips requested at the opening: ${asked.join(', ')}`)

    /* A manual pause has to survive the observer, the timer and a chapter change. */
    await page.getByRole('button', { name: /Metti in pausa il video di sfondo/ }).click()
    await page.waitForTimeout(700)
    const afterPause = await page.evaluate(() => {
      const videos = [...document.querySelectorAll('.story-layer video')]
      return {
        paused: videos.every((v) => v.paused),
        label: document.querySelector('.story-control .sr-only')?.textContent?.trim(),
        /* The clip that had a frame must keep showing it: falling back to the poster
           would snap the horse back to its opening pose. */
        visible: videos.map((v) => Number(getComputedStyle(v).opacity)),
      }
    })
    if (!afterPause.paused) note('video pause', 'the visitor paused it and it started again')
    if (afterPause.label !== 'Riproduci il video di sfondo') {
      note('video pause', `the control now reads "${afterPause.label}"`)
    }
    if (Math.max(...afterPause.visible) < 0.99) {
      note('video pause', 'a paused clip fell back to its poster instead of keeping its frame')
    }

    /* Crossing into the chapter that owns the second moment must not restart it. */
    await page.evaluate(() => document.getElementById('addestramento')?.scrollIntoView())
    await page.waitForTimeout(1200)
    const afterChapter = await page.evaluate(() => {
      const videos = [...document.querySelectorAll('.story-layer video')]
      return videos.every((v) => v.paused)
    })
    if (!afterChapter) note('video pause', 'changing chapter restarted the video the visitor had paused')

    /* Leaving the story must stop everything. */
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
    await page.waitForTimeout(1000)
    const offscreen = await page.evaluate(() => {
      const videos = [...document.querySelectorAll('.story-layer video')]
      return videos.filter((v) => !v.paused && v.getAttribute('src')).length
    })
    if (offscreen > 0) note('video offscreen', `${offscreen} clips still running after the story`)

    /* And the control must be gone by then: it controls a video nobody can see. It
       is measured on the button itself rather than on an ancestor, because an
       ancestor carrying the opacity would change what the button is stacked
       against, and that is exactly the bug this assertion exists to catch. */
    const controlGone = await page.evaluate(() => {
      const button = document.querySelector('.story-control')
      return {
        opacity: Number(getComputedStyle(button).opacity),
        pointerEvents: getComputedStyle(button).pointerEvents,
      }
    })
    if (controlGone.opacity > 0.05 || controlGone.pointerEvents !== 'none') {
      note(
        'video offscreen',
        `the playback control is still live over the gallery (opacity ${controlGone.opacity}, pointer-events ${controlGone.pointerEvents})`,
      )
    }

    await page.evaluate(() => window.scrollTo(0, 0))
    await page.waitForTimeout(900)
    const resumed = await page.evaluate(() => {
      const videos = [...document.querySelectorAll('.story-layer video')]
      return videos.every((v) => v.paused)
    })
    if (!resumed) note('video offscreen', 'resumed on its own after the visitor paused it')
    return {}
  })
  if (errors.length) note(`video ${label}`, `console: ${errors.slice(0, 3).join(' | ')}`)
  await ctx.close()
}

/* ── The crossfade: real overlap, and it runs both ways ──────────────────── */
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  const { errors } = await withPage(ctx, async (page) => {
    const layers = () =>
      page.evaluate(() =>
        [...document.querySelectorAll('.story-layer')].map((l) => Number(getComputedStyle(l).opacity)),
      )

    /* Sweep the whole story in small steps and record the worst moment: two layers
       partly visible at once is the crossfade working, and no moment where all
       three are dim or where the sum drops well below one is the dark base holding
       through the transition. */
    const doc = await page.evaluate(() => document.documentElement.scrollHeight)
    const samples = []
    for (let i = 0; i <= 60; i += 1) {
      const y = Math.round((doc * i) / 60)
      await page.evaluate((v) => window.scrollTo(0, v), y)
      await page.waitForTimeout(60)
      const o = await layers()
      samples.push({ y, o, sum: o.reduce((a, b) => a + b, 0) })
    }

    /* A genuine dissolve, with the frame underneath never dimming.

       Two layers *both* partly visible is the wrong shape, not the right one: it is
       what compositing two half-opaque layers over a dark base gives you, and it
       composites to three quarters of real footage, so the base shows through the
       middle of every transition. The correct shape is one layer moving while the
       layer beneath it stays at full opacity, which sums to complete coverage at
       every point. So that is what is asserted here: a layer strictly between
       nothing and opaque, over another that is fully opaque. A cut fails it, and
       the old two-dim-layers version fails it too. */
    const dissolving = samples.filter(
      (s) =>
        s.o.some((v) => v > 0.02 && v < 0.98) && s.o.some((v) => v >= 0.98),
    )
    if (!dissolving.length) {
      note('crossfade', 'no layer ever moves over a fully opaque one: the swap is a cut')
    }
    const twoDim = samples.filter((s) => s.o.filter((v) => v > 0.02 && v < 0.98).length >= 2)
    if (twoDim.length) {
      note(
        'crossfade',
        `${twoDim.length} samples had two layers dimmed at once, so the base shows between them`,
      )
    }

    /* The sum of the layers must never collapse: that is what a dark frame looks
       like. The single exception is the exit, where the veil is deliberately
       replacing all of it. */
    /* The sum must hold for as long as the video is meant to be on screen. It is
       allowed to fall at the end, because that is the veil replacing the video on
       purpose, so the window is everything above where the veil starts. */
    const veilStart = await page.evaluate(() => {
      const grid = document.querySelector('.gallery-grid')
      return grid ? Math.round(grid.getBoundingClientRect().top + scrollY - innerHeight * 0.85) : 1e9
    })
    const duringStory = samples.filter((s) => s.y < veilStart)
    const worstSum = duringStory.reduce((a, b) => (b.sum < a.sum ? b : a), duringStory[0] ?? null)
    if (worstSum && worstSum.sum < 0.97) {
      note('crossfade', `the layers drop to ${worstSum.sum.toFixed(2)} at scrollY ${worstSum.y}: a dark frame`)
    }

    /* Scrolling back up must retrace the same opacities. A swap that only works
       downwards is how a backdrop ends up showing the wrong moment.

       Sampled finely, and compared against the layer opacity the same scroll
       position produced on the way down. Comparing consecutive samples instead
       would only prove the fade is gradual, not that it is reversible: a fade that
       is gradual in both directions but anchored to the wrong place passes that
       and fails this. */
    const trace = []
    const stepPx = 60
    for (let y = 0; y <= doc; y += stepPx) {
      await page.evaluate((v) => window.scrollTo(0, v), y)
      await page.waitForTimeout(45)
      trace.push([y, await layers()])
    }
    for (let i = trace.length - 2; i >= 0; i -= 1) {
      await page.evaluate((v) => window.scrollTo(0, v), trace[i][0])
      await page.waitForTimeout(45)
      const o = await layers()
      const drift = Math.max(...o.map((v, k) => Math.abs(v - trace[i][1][k])))
      if (drift > 0.05) {
        note(
          'crossfade up',
          `at scrollY ${trace[i][0]} the layers read ${o.map((n) => n.toFixed(2)).join(',')} on the way back up but ${trace[i][1].map((n) => n.toFixed(2)).join(',')} on the way down`,
        )
        break
      }
    }

    /* And nothing may jump between neighbouring samples, in either direction: a
       band that comes out inverted or zero-length produces exactly that. */
    for (let i = 1; i < trace.length; i += 1) {
      const jump = Math.max(...trace[i][1].map((v, k) => Math.abs(v - trace[i - 1][1][k])))
      if (jump > 0.35) {
        note('crossfade', `a layer jumped ${jump.toFixed(2)} between scrollY ${trace[i - 1][0]} and ${trace[i][0]}`)
        break
      }
    }

    /* Every moment must actually have run at some point, and each chapter must have
       played its own moment rather than its neighbour's. Sampled at four depths
       instead of one: with four layers, a single sample at 45% of the document can
       land in a gap and report that the walk never played while the page is
       working perfectly. */
    const height = await page.evaluate(() => document.documentElement.scrollHeight)
    const seen = new Set()
    for (const f of [0.2, 0.4, 0.6, 0.8]) {
      await page.evaluate((v) => window.scrollTo(0, v), Math.round(height * f))
      await page.waitForTimeout(1500)
      const srcs = await page.evaluate(() =>
        [...document.querySelectorAll('.story-layer video')]
          .map((v) => (v.getAttribute('src') ?? '').split('/').pop())
          .filter(Boolean),
      )
      for (const s of srcs) seen.add(s.replace('-mobile', ''))
    }
    for (const moment of MOMENTS) {
      if (!seen.has(`${moment}.mp4`)) {
        note('crossfade', `${moment} never played (saw ${[...seen].join(', ') || 'no sources'})`)
      }
    }
    return {}
  })
  if (errors.length) note('crossfade', `console: ${errors.slice(0, 3).join(' | ')}`)
  await ctx.close()
}

/* A hidden tab is the same case as leaving the story. */
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  const page = await ctx.newPage()
  await page.goto(BASE, { waitUntil: 'load' })
  await page.waitForTimeout(1600)
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true })
    document.dispatchEvent(new Event('visibilitychange'))
  })
  await page.waitForTimeout(700)
  const running = await page.evaluate(
    () => [...document.querySelectorAll('.story-layer video')].filter((v) => !v.paused).length,
  )
  if (running > 0) note('video hidden tab', `${running} clips kept playing while the tab was hidden`)
  await ctx.close()
}

/* Reduced motion: no automatic request at all, and a control to start it. */
{
  const ctx = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    reducedMotion: 'reduce',
  })
  const asked = []
  ctx.on('request', (r) => {
    if (MOMENT_RE.test(r.url().split('/').pop() ?? '')) asked.push(r.url().split('/').pop())
  })
  const page = await ctx.newPage()
  await page.goto(BASE, { waitUntil: 'load' })
  await page.waitForTimeout(1900)
  const state = await page.evaluate(() => {
    const videos = [...document.querySelectorAll('.story-layer video')]
    return {
      src: videos.map((v) => v.getAttribute('src')).filter(Boolean),
      posters: [...document.querySelectorAll('.story-layer img')].map((i) => ({
        opacity: Number(getComputedStyle(i.closest('.story-layer')).opacity),
        loaded: i.complete && i.naturalWidth > 0,
      })),
      layers: [...document.querySelectorAll('.story-layer')].map((l) => Number(getComputedStyle(l).opacity)),
    }
  })
  if (asked.length) note('reduced motion', `requested a clip anyway: ${asked.join(', ')}`)
  if (state.src.length) note('reduced motion', `assigned a clip without being asked: ${state.src.join(', ')}`)
  /* Exactly one poster on screen at a time, and it must be the one for the moment
     being read. Two posters at once would be a crossfade, which is the thing
     reduced motion rules out. */
  const lit = state.layers.filter((o) => o > 0.5)
  if (lit.length !== 1) note('reduced motion', `${lit.length} layers visible at once, wanted 1`)
  if (!state.posters.some((p) => p.loaded && p.opacity > 0.5)) {
    note('reduced motion', 'no poster is carrying the stage')
  }

  /* Everything must already be readable: no reveal left at opacity 0. */
  const faded = await page.evaluate(() =>
    [...document.querySelectorAll('h1, h2, h3, p, a, button, li, summary')]
      .filter((el) => {
        const r = el.getBoundingClientRect()
        if (r.width < 2 || r.height < 2) return false
        return Number(getComputedStyle(el).opacity) < 0.9
      })
      .map((el) => `${el.tagName}:${(el.textContent ?? '').trim().slice(0, 20)}`),
  )
  if (faded.length) note('reduced motion', `invisible content: ${faded.slice(0, 5).join(' | ')}`)

  /* The whole journey must still be there, in the same order. */
  const order = await page.evaluate(() =>
    [...document.querySelectorAll('.story-chapter, #galleria, #contatti')].map(
      (e) => e.id || e.dataset.chapter,
    ),
  )
  const expected = ['top', 'addestramento', 'lezioni', 'passeggiate', 'galleria', 'contatti']
  if (order.join(',') !== expected.join(',')) {
    note('reduced motion', `the order changed: ${order.join(', ')}`)
  }

  /* Asking for the video by hand must still work: the preference is a default,
     not a lock. */
  await page.getByRole('button', { name: /Riproduci il video di sfondo/ }).click()
  await page.waitForTimeout(1400)
  const afterAsk = await page.evaluate(
    () => [...document.querySelectorAll('.story-layer video')].filter((v) => !v.paused).length,
  )
  if (afterAsk !== 1) note('reduced motion', `the control did not start the clip (${afterAsk} running)`)

  await page.screenshot({ path: `${OUT}/reduced-motion.png` })
  await ctx.close()
}

/* A broken clip must leave the poster standing and the page intact. */
/* One case per clip, plus all of them. A single case cannot fail: with four
   moments, blocking "the middle clips" leaves three moments working, so the stage
   looks fine and the check reports nothing. Each clip is blocked on its own so a
   failure names the moment that broke rather than "a clip". */
for (const [label, pattern] of [
  ['all clips', '**/*.mp4'],
  ['the opening', '**/fermo*.mp4'],
  ['the walk', '**/passo*.mp4'],
  ['the trot', '**/trotto*.mp4'],
  ['the gallop', '**/galoppo*.mp4'],
]) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  const errors = []
  const page = await ctx.newPage()
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('console', (m) => {
    /* The abort below is the browser reporting its own failed fetch. Counting it as
       an unhandled application error would make this test unfailable. */
    if (m.type() !== 'error') return
    if (/Failed to load resource|ERR_FAILED|ERR_ABORTED/.test(m.text())) return
    errors.push(m.text())
  })
  await ctx.route(pattern, (r) => r.abort())
  await page.goto(BASE, { waitUntil: 'load' })
  await page.waitForTimeout(2200)

  /* Walk the whole story: a clip that dies halfway must not leave a hole. */
  for (const fraction of [0, 0.25, 0.5, 0.75, 1]) {
    await page.evaluate((f) => window.scrollTo(0, document.documentElement.scrollHeight * f), fraction)
    await page.waitForTimeout(500)
  }
  const state = await page.evaluate(() => {
    const stage = document.querySelector('.story-stage')
    const layers = [...document.querySelectorAll('.story-layer')]
    return {
      stageVisible: stage.getBoundingClientRect().height > 0,
      /* Summed, not per layer: at the end of the story the first three moments have
         faded out by design and the fourth owns the stage, so "layer 0 is opaque"
         would fail a page that is working exactly as intended. What must never
         happen is all of them being transparent at once, which is the dark frame. */
      sum: layers.reduce((total, l) => total + Number(getComputedStyle(l).opacity), 0),
      /* The accessible name, not the text. The h1 wraps the mark and the name is
         in a screen-reader-only span, so textContent is empty and asserting on it
         would fail a page that announces its name correctly. This is the same
         computation the browser runs, without a browser. */
      name: [...(document.querySelector('h1')?.childNodes ?? [])]
        .map((n) => (n.nodeType === 1 ? (n.textContent ?? '') : n.textContent))
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim(),
      chapters: document.querySelectorAll('.story-chapter').length,
    }
  })
  if (!state.stageVisible) note(`video error (${label})`, 'the stage collapsed')
  if (state.sum < 0.99) {
    note(`video error (${label})`, `nothing is visible on the stage at the end of the story (sum ${state.sum.toFixed(2)})`)
  }
  /* The h1 must keep its accessible name. With the mark as an image inside it and
     the name in a screen-reader-only span, `textContent` is now empty, so it is
     the accessible name that is asserted rather than the text — which is the thing
     that actually has to survive. */
  if (!state.name) note(`video error (${label})`, 'the name went missing')
  if (state.chapters !== 4) {
    note(`video error (${label})`, `the text went missing (${state.chapters} chapters, wanted 4)`)
  }
  if (errors.length) note(`video error (${label})`, `unhandled console errors: ${errors.slice(0, 3).join(' | ')}`)
  await ctx.close()
}

/* A browser that cannot decode H.264 at all. Playwright's Chromium can, so the
   case is staged, and it has to be staged properly: stubbing canPlayType and play()
   alone is not enough, because a real file still gets demuxed and its first frame
   decoded, so the element ends up holding a genuine frame and the poster is
   correctly replaced. That passes without proving anything.

   So the clip is also not delivered. Every request for one returns a body that is
   not a video, which is what a build without the codec effectively receives, and
   the element cannot know a frame's dimensions at all. Some Linux builds and a few
   older devices land in this state for real, and the opening screen still has to
   arrive as a photograph with the name on it. */
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  await ctx.route('**/*.mp4', (route) =>
    route.fulfill({ status: 200, contentType: 'video/mp4', body: 'not a video' }),
  )
  await ctx.addInitScript(() => {
    HTMLMediaElement.prototype.canPlayType = () => ''
    HTMLMediaElement.prototype.play = () =>
      Promise.reject(new DOMException('no supported source', 'NotSupportedError'))
  })
  const errors = []
  const page = await ctx.newPage()
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
  await page.goto(BASE, { waitUntil: 'load' })
  await page.waitForTimeout(2300)
  const state = await page.evaluate(() => {
    const layers = [...document.querySelectorAll('.story-layer')]
    return {
      canPlay: layers[0].querySelector('video')?.canPlayType('video/mp4; codecs="avc1.64001f"') ?? '',
      videoWidth: layers[0].querySelector('video')?.videoWidth ?? -1,
      base: Number(getComputedStyle(layers[0]).opacity),
      posterVisible: Number(getComputedStyle(layers[0].querySelector('img')).opacity),
      videoVisible: Number(getComputedStyle(layers[0].querySelector('video')).opacity),
      /* The name must survive a browser with no codec. It now lives in text beside the
     mark rather than in a typeset h1, so this asserts that the name is in the
     document at all — which is the failure the fallback exists to prevent. */
      name: document.querySelector('#nome')?.textContent?.replace(/\s+/g, ' ').trim(),
    }
  })
  /* state.canPlay is expected to be empty: that is the case being staged. */
  if (state.canPlay !== '') note('no codec', 'the staged codec failure did not take effect, so nothing was tested')
  /* The whole point: a clip that produced no decodable frame must never be treated
     as visually ready, because "ready" is what lifts the layer to full opacity over
     the poster. */
  if (state.videoWidth > 0) {
    note('no codec', 'the staged failure still decoded a frame, so nothing was tested')
  }
  if (state.videoVisible > 0.01) note('no codec', 'an undecodable clip was left visible over the poster')
  if (state.posterVisible < 0.99) note('no codec', 'the poster did not carry the opening screen')
  if (!state.name) note('no codec', 'the name went missing')
  if (errors.length) note('no codec', `unhandled console errors: ${errors.slice(0, 3).join(' | ')}`)
  await page.screenshot({ path: `${OUT}/no-codec.png` })
  await ctx.close()
}

/* Keyboard: the skip link first, then the actions, in a sensible order. */
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  const page = await ctx.newPage()
  await page.goto(BASE, { waitUntil: 'load' })
  await page.waitForTimeout(900)
  const seen = []
  for (let i = 0; i < 10; i += 1) {
    await page.keyboard.press('Tab')
    seen.push(
      await page.evaluate(() => {
        const el = document.activeElement
        if (!el) return 'none'
        return `${el.tagName}:${(el.textContent ?? el.getAttribute('aria-label') ?? el.getAttribute('class') ?? '').trim().slice(0, 28)}`
      }),
    )
  }
  if (!seen.some((s) => s.includes('Vai al contenuto'))) {
    note('keyboard', `the skip link is not in the tab order: ${seen.slice(0, 3).join(' -> ')}`)
  }
  /* The playback control must be reachable without a pointer. */
  if (!seen.some((s) => s.includes('video'))) {
    note('keyboard', `the playback control is not reachable: ${seen.join(' -> ')}`)
  }
  /* The skip target takes focus without becoming a stop of its own. */
  const stops = await page.evaluate(() => {
    const el = document.getElementById('contenuto')
    return { tabIndex: el?.getAttribute('tabindex') }
  })
  if (stops.tabIndex !== '-1') note('keyboard', '#contenuto is not programmatically focusable only')
  await ctx.close()
}

/* ── Nothing is painted over ────────────────────────────────────────────────
   Every other check here reads computed styles, and computed styles do not know
   what is on top of what. A positioned overlay with an opaque background can cover
   an entire section while every measurement of that section still reads correct:
   full height, right width, right opacity, completely invisible.

   That is not hypothetical. Moving the gallery out of the story left the stage
   overhanging the end of its container by exactly one viewport, because sticky
   constrains an element's margin box and the stage carried a -100dvh bottom
   margin. The stage's veil is opaque and exactly the colour of the page, so it
   painted over the photographs and nothing reported it: contrast was clean because
   the photographs were read against the page token, axe was clean because nothing
   was hidden from it, and the layout assertions were clean because the gallery was
   laid out correctly underneath.

   elementFromPoint is the only thing that answers the question, so it is what
   asks it. Sampled across the whole scroll at three shapes, because the overhang
   was a desktop-and-mobile-sized problem and a short-screen one. */
for (const [label, width, height] of [
  ['desktop', 1440, 900],
  ['mobile', 390, 844],
  ['landscape', 844, 390],
]) {
  const ctx = await browser.newContext({ viewport: { width, height } })
  const { errors } = await withPage(ctx, async (page) => {
    await page.evaluate(() => {
      document.documentElement.style.scrollBehavior = 'auto'
    })
    const covered = await page.evaluate(async () => {
      const story = document.querySelector('#racconto')
      if (!story) return ['no #racconto']
      /* Past the end of the story as well as through it: that is where the
         overhang lived. */
      const reach = story.offsetHeight - window.innerHeight + window.innerHeight
      const found = new Set()
      for (const id of ['galleria', 'contatti']) {
        const section = document.getElementById(id)
        if (!section) {
          found.add(`#${id} is missing`)
          continue
        }
        for (let i = 0; i <= 24; i += 1) {
          const y = Math.round((i / 24) * reach)
          window.scrollTo(0, y)
          await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
          for (const el of section.querySelectorAll('h2, h3, p, a, button, figcaption, dt, dd, img')) {
            const r = el.getBoundingClientRect()
            /* Only blocks comfortably inside the viewport: a sliver at the edge is
               legitimately under the fold, not covered. */
            if (r.top < 8 || r.bottom > window.innerHeight - 8) continue
            if (r.width < 4 || r.height < 4) continue
            const hit = document.elementFromPoint(
              Math.min(r.left + r.width / 2, window.innerWidth - 2),
              Math.min(r.top + r.height / 2, window.innerHeight - 2),
            )
            if (!hit) continue
            if (hit.closest('.story-stage')) {
              found.add(
                `#${id} @${y}: ${el.tagName} is covered by the story stage`,
              )
            } else if (!hit.contains(el) && !el.contains(hit)) {
              found.add(
                `#${id} @${y}: ${el.tagName} is covered by ${hit.tagName}.${String(hit.className).slice(0, 24)}`,
              )
            }
          }
        }
      }
      return [...found]
    })
    for (const entry of covered.slice(0, 4)) note(`occlusion (${label})`, entry)
  })
  if (errors.length) note(`occlusion (${label})`, `console: ${errors.slice(0, 2).join(' | ')}`)
  await ctx.close()
}

/* ── The gallery clip: fetched on request, plays, and is the only video on the
      page that a visitor opens deliberately rather than one that plays at them ── */
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  const clipRequests = []
  ctx.on('request', (r) => {
    if (/gallery-volo\.mp4/.test(r.url())) clipRequests.push(r.url().split('/').pop())
  })
  const { errors } = await withPage(ctx, async (page) => {
    await page.evaluate(() => document.getElementById('galleria')?.scrollIntoView())
    await page.waitForTimeout(1200)

    /* Scrolling the whole gallery past must not fetch it. */
    const beforeOpen = clipRequests.length

    /* Opened by keyboard, the way a reader reaches it.

     Found by what it is rather than by where it sits: the clip is the sixth cell
     today and the seventh when the maneggio sends another photograph, and a check
     pinned to `nth-child(6)` would quietly start opening a photograph and pass on
     every assertion that follows, because a photograph is exactly what the
     assertions were written to rule out. */
    const opened = await page.evaluate(async () => {
      const btn = [...document.querySelectorAll('#galleria .gallery-cell button')].find((b) =>
        (b.getAttribute('aria-label') ?? '').startsWith('Riproduci il video'),
      )
      if (!btn) return 'no trigger'
      btn.focus()
      if (document.activeElement !== btn) return 'not focusable'
      btn.click()
      await new Promise((r) => setTimeout(r, 400))
      const d = document.querySelector('#galleria dialog')
      return d?.open ? 'ok' : 'did not open'
    })
    if (opened !== 'ok') note('gallery clip', `the clip ${opened}`)
    if (beforeOpen > 0) note('gallery clip', 'it was requested before anybody asked for it')

    await page.waitForTimeout(1500)
    const state = await page.evaluate(() => {
      const v = document.querySelector('#galleria dialog video')
      return {
        exists: Boolean(v),
        src: v ? (v.getAttribute('src') ?? '').split('/').pop() : null,
        controls: Boolean(v?.controls),
        muted: v?.muted ?? null,
        inline: v?.getAttribute('playsinline') !== null,
        width: v?.videoWidth ?? 0,
        height: v?.videoHeight ?? 0,
        playing: Boolean(v && !v.paused && v.currentTime > 0),
        /* The description is the accessible name, because a <video> has no alt. */
        named: (v?.getAttribute('aria-label') ?? '').length > 20,
        poster: Boolean(v?.getAttribute('poster')),
      }
    })
    if (!state.exists) note('gallery clip', 'no video element in the dialog')
    if (state.src !== 'gallery-volo.mp4') note('gallery clip', `the dialog loaded ${state.src}`)
    if (!state.controls) note('gallery clip', 'the clip has no controls, so its sound cannot be reached')
    if (!state.muted) note('gallery clip', 'the clip is not muted by default')
    if (!state.inline) note('gallery clip', 'the clip is not playsinline')
    if (state.width === 0) note('gallery clip', 'the clip never decoded a frame')
    if (!state.playing) note('gallery clip', 'opening it did not start it')
    if (!state.named) note('gallery clip', 'the clip has no accessible name')
    if (!state.poster) note('gallery clip', 'the clip has no poster frame')

    /* And it must actually be on the wire by now, which is the other half of
       "fetched on request": deferred is only correct if it arrives when asked. */
    if (!clipRequests.length) note('gallery clip', 'the clip was never requested')

    await page.screenshot({ path: `${OUT}/gallery-clip.png` })

    /* Walking away from it must stop it: the dialog unmounts the element, and a
       video that keeps playing after it has left the document is the audio nobody
       asked for, still going. */
    await page.keyboard.press('Escape')
    await page.waitForTimeout(600)
    const after = await page.evaluate(() => ({
      open: Boolean(document.querySelector('#galleria dialog')?.open),
      elements: document.querySelectorAll('#galleria video').length,
    }))
    if (after.open) note('gallery clip', 'Escape did not close the dialog')
    if (after.elements > 0) note('gallery clip', `${after.elements} video elements left in the document after closing`)
    return {}
  })
  if (errors.length) note('gallery clip', `console: ${errors.slice(0, 3).join(' | ')}`)
  await ctx.close()
}

await browser.close()

console.log(problems.length ? problems.join('\n') : 'no findings')
console.log(`\nscreenshots in ${OUT}/`)
process.exit(problems.length ? 1 : 0)