/* Measures the contrast the browser actually resolves, including the alpha
   compositing that makes a "muted grey" pass on paper and fail on screen.

   Three passes, because the page now has three kinds of background:
     1. text on the page surface, resolved by walking the DOM;
     2. text over the video stage, where the background is a frame under a scrim
        and cannot be read from the DOM at all;
     3. the same text once the veil has replaced the video with the page, which is
        the state the gallery and the closing are actually read in.

   Pass 2 works by hiding the text with a transparent colour rather than with
   visibility, screenshotting the result, and decoding the pixels back into the
   page: what matters is the pixel the eye receives, and that pixel changes with the
   frame. Every clip is sampled through its whole runtime, because a slow push-in
   changes the exposure most between the first and the last frame.

   Run: node checks/contrast.mjs [baseUrl]
   Exits non-zero when anything falls below its threshold. */
import { chromium } from 'playwright'

const BASE = process.argv[2] ?? 'http://localhost:4180'
const browser = await chromium.launch()
const findings = []

/* Colour maths, evaluated inside the page. getComputedStyle returns oklch() for
   these tokens, so the numbers are not RGB; painting into a canvas is the only
   exact way to resolve them to the channels contrast is computed from. */
const HELPERS = `
  const probe = document.createElement('canvas').getContext('2d')
  const toRGB = (str) => {
    probe.clearRect(0, 0, 1, 1)
    probe.fillStyle = '#000'
    probe.fillStyle = str
    probe.fillRect(0, 0, 1, 1)
    return [...probe.getImageData(0, 0, 1, 1).data]
  }
  const lum = (c) => {
    const [r, g, b] = c.slice(0, 3).map((v) => {
      v /= 255
      return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
    })
    return 0.2126 * r + 0.7152 * g + 0.0722 * b
  }
  /* Source-over compositing. Alpha arrives as 0-255 from getImageData but the
     formula needs 0-1, which is why an untreated version of this reports
     negative ratios. */
  const over = (fg, bg) => {
    const a = (fg[3] === undefined ? 255 : fg[3]) / 255
    return [0, 1, 2].map((i) => fg[i] * a + bg[i] * (1 - a))
  }
  /* Walk up for the first opaque background, which is what the eye sees. */
  const bgOf = (el) => {
    const stack = []
    for (let n = el; n; n = n.parentElement) {
      const c = toRGB(getComputedStyle(n).backgroundColor)
      if (c.length >= 3 && (c[3] === undefined ? 255 : c[3]) > 0) {
        stack.push(c)
        if ((c[3] === undefined ? 255 : c[3]) === 255) break
      }
    }
    let acc = [255, 255, 255]
    for (const c of stack.reverse()) acc = over(c, acc)
    return acc
  }
  const ratio = (a, b) => {
    const pair = [lum(a), lum(b)].sort((x, y) => y - x)
    return (pair[0] + 0.05) / (pair[1] + 0.05)
  }
  const needOf = (cs) => {
    const px = parseFloat(cs.fontSize)
    const bold = parseInt(cs.fontWeight, 10) >= 700
    return px >= 24 || (bold && px >= 18.66) ? 3 : 4.5
  }
  /* The text an element actually paints, as opposed to the text it contains.

     The opening's h1 is now a picture: the name lives in a screen-reader-only span
     inside it and the mark is a 700x848 image. Walking textContent would count the
     hidden name as painted words sitting on top of a white mark, measure white on
     white, and fail a page whose opening is perfectly legible — and worse, hide
     the real result behind a failure nobody can act on.

     So a text node only counts if nothing between it and the element is .sr-only
     or a <picture>. The opening's h1 therefore has no painted text and is skipped,
     which is correct: there is nothing painted there to read. The line under the
     mark is a real element and is still measured, and the mark's own legibility is
     a question about the scrim rather than about text contrast. */
  const readsText = (el) => {
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT)
    let out = ''
    while (walker.nextNode()) {
      let hidden = false
      for (let n = walker.currentNode.parentElement; n && n !== el; n = n.parentElement) {
        if (n.classList?.contains('sr-only') || n.tagName === 'PICTURE') { hidden = true; break }
      }
      if (!hidden) out += walker.currentNode.textContent
    }
    return out.trim()
  }
`

/* ── 1. Text on the page surface ─────────────────────────────────────────── */
const domPass = `
  ${HELPERS}
  return [...document.querySelectorAll('p, a, h1, h2, h3, h4, summary, span, li, button, figcaption, dt, dd')]
    /* Anything inside the story sits on the video and belongs to the media pass.
       Resolving its background by walking the DOM would report the page colour and
       quietly judge the wrong thing. */
    .filter((el) => !el.closest('.story-stage') && !el.closest('.story-content') && !el.closest('dialog'))
    .filter((el) => el.getBoundingClientRect().width >= 2 && el.getBoundingClientRect().height >= 2)
    .filter((el) => readsText(el).length > 1)
    .map((el) => {
      const cs = getComputedStyle(el)
      const bg = bgOf(el)
      const fg = over(toRGB(cs.color), bg)
      return {
        text: el.textContent.trim().slice(0, 34),
        ratio: +ratio(fg, bg).toFixed(2),
        need: needOf(cs),
        px: Math.round(parseFloat(cs.fontSize)),
      }
    })
    .filter((x) => x.ratio < x.need)
`

for (const [label, path] of [
  ['home', ''],
  ['privacy', '/privacy.html'],
]) {
  for (const scheme of ['light', 'dark']) {
    for (const width of [390, 1280]) {
      const ctx = await browser.newContext({
        viewport: { width, height: 900 },
        colorScheme: scheme,
      })
      const page = await ctx.newPage()
      await page.goto(BASE + path, { waitUntil: 'load' })
      await page.waitForTimeout(900)
      /* The whole page, not just the first screen: the closing block and the
         disclosure are the text most likely to sit on the wrong surface. */
      await page.evaluate(async () => {
        const step = window.innerHeight * 0.8
        for (let y = 0; y < document.documentElement.scrollHeight; y += step) {
          window.scrollTo(0, y)
          await new Promise((r) => setTimeout(r, 90))
        }
        window.scrollTo(0, 0)
      })
      await page.waitForTimeout(400)
      /* new Function, not the bare string: Playwright evaluates a string argument
         as an expression, and a top-level return is not one. */
      const bad = await page.evaluate(new Function(domPass))
      const where = `${label}/${scheme}@${width}`
      if (bad.length) {
        for (const b of bad) findings.push(`[${where}] ${b.ratio} < ${b.need}  ${b.px}px  "${b.text}"`)
      } else {
        console.log(`${where}: clean`)
      }
      await ctx.close()
    }
  }
}

/* ── 2. Text over the video ──────────────────────────────────────────────────

   For each of the three chapters: park the scroll where that chapter's text is at
   rest, wait for its clip to be playing, then screenshot the stage with the text
   made transparent and measure the worst pixel under every line.

   The worst pixel is whichever the text reads worst against, and which one that
   is depends on the direction: light text fears the lightest pixel, dark text the
   darkest. So the minimum over every pixel is taken rather than guessing. */
async function chapterPass(label, width, height, chapterId) {
  const ctx = await browser.newContext({ viewport: { width, height } })
  const page = await ctx.newPage()
  await page.goto(BASE, { waitUntil: 'load' })
  await page.waitForTimeout(1800)

  /* Park the scroll where this chapter's text comes to rest, which is the point
     its crossfade is centred on. That is deliberately the hardest moment for this
     text: the stage is halfway between two clips and two scrims, which is exactly
     the frame a reader's eye passes through. */
  const landed = await page.evaluate(async (id) => {
    const section = document.getElementById(id)
    if (!section) return 'no such section'
    const box = section.getBoundingClientRect()
    window.scrollTo(0, Math.round(box.top + scrollY + box.height / 2 - window.innerHeight / 2))
    await new Promise((r) => setTimeout(r, 1400))
    return 'ok'
  }, chapterId)

  if (landed !== 'ok') {
    findings.push(`[${label}] ${landed}, so the scrim was never verified there`)
    await ctx.close()
    return
  }

  /* The clip to sample is this chapter's own moment, by index. The story has four
     layers in a fixed order and a chapter maps to one of them. Asking instead for
     "whichever clip is playing" would pick the outgoing one during a crossfade and
     report the exposure of a moment the reader has already left.

     The map is written out rather than derived from the position of the chapter in
     the list, so that inserting a chapter upstream fails this check loudly instead
     of silently measuring one chapter's text against another chapter's clip. */
  const momentOf = { top: 0, addestramento: 1, lezioni: 2, passeggiate: 3 }[chapterId] ?? 0

  /* Wait for it to be on the wire and decoded. A clip only gets a source once its
     poster has decoded, and it only gets asked for shortly before its band opens,
     so this is polled rather than slept on: a fixed wait is a race that passes on a
     fast machine and fails on a slow one. */
  let ready = false
  for (let attempt = 0; attempt < 25; attempt += 1) {
    ready = await page.evaluate((i) => {
      const video = document.querySelectorAll('.story-layer video')[i]
      return Boolean(video?.getAttribute('src') && Number.isFinite(video.duration) && video.duration > 0)
    }, momentOf)
    if (ready) break
    await page.waitForTimeout(300)
  }
  if (!ready) {
    findings.push(`[${label}] the clip for #${chapterId} never became playable, so its scrim was not verified`)
    await ctx.close()
    return
  }

  const duration = await page.evaluate((i) => document.querySelectorAll('.story-layer video')[i].duration, momentOf)

  /* Read the colours before touching anything: the measuring style makes the text
     transparent, and a transparent colour cannot be compared to anything. The
     content box is recorded too, so the same geometry can be used against the
     screenshot. */
  const targets = await page.evaluate(new Function(`
    ${HELPERS}
    const stage = document.querySelector('.story-stage')
    const sb = stage.getBoundingClientRect()
    const host = document.querySelector('#${chapterId} .story-panel')
    const hb = host.getBoundingClientRect()
    const px = (v) => parseFloat(v) || 0
    return [...host.querySelectorAll('h1, h2, p, a')].map((el) => {
      const cs = getComputedStyle(el)
      const r = el.getBoundingClientRect()
      if (r.width < 2 || r.height < 2) return null
      if (readsText(el).length < 2) return null
      /* Relative to the stage, because that is what the screenshot captures. The
         content box, not the border box: on an outlined control the border is a
         line that never sits behind a glyph, and counting it would invent a
         failure no reader has. */
      return {
        text: el.textContent.trim().slice(0, 30),
        color: cs.color,
        need: needOf(cs),
        size: Math.round(parseFloat(cs.fontSize)),
        box: [
          Math.round(r.left - sb.left + px(cs.borderLeftWidth) + px(cs.paddingLeft)),
          Math.round(r.top - sb.top + px(cs.borderTopWidth) + px(cs.paddingTop)),
          Math.round(r.width - px(cs.borderLeftWidth) - px(cs.paddingLeft) - px(cs.borderRightWidth) - px(cs.paddingRight)),
          Math.round(r.height - px(cs.borderTopWidth) - px(cs.paddingTop) - px(cs.borderBottomWidth) - px(cs.paddingBottom)),
        ],
      }
    }).filter(Boolean)
  `))

  if (!targets.length) {
    findings.push(`[${label}] no text found in #${chapterId}, so nothing was measured`)
    await ctx.close()
    return
  }

  /* Opening, three points through, and the last frame. */
  const stamps = [0, 0.25, 0.5, 0.75, 0.99].map((f) => +(duration * f).toFixed(2))
  let worst = { ratio: Infinity }

  for (const t of stamps) {
    await page.evaluate(
      ({ time, index }) => {
        const video = document.querySelectorAll('.story-layer video')[index]
        if (!video) return
        return new Promise((resolve) => {
          video.currentTime = time
          video.onseeked = () => resolve()
          setTimeout(resolve, 2500)
        })
      },
      { time: t, index: momentOf },
    )
    await page.waitForTimeout(120)

    /* Transparent colour, not visibility:hidden. Hiding the element would take its
       own background with it, and a filled button would be measured against the
       video instead of against the white it actually has. Anything painted with
       currentColor, the arrow included, goes at the same time. */
    const handle = await page.addStyleTag({
      /* transition:none matters. The controls transition their own colour over
         180ms, so without this the screenshot catches the text halfway through
         fading out and measures a ghost no visitor ever sees. */
      content:
        '.story-content h1, .story-content h2, .story-content p, .story-content a, .story-content button { color: transparent !important; text-shadow: none !important; transition: none !important; }',
    })
    await page.waitForTimeout(80)
    const shot = await page.locator('.story-stage').screenshot()
    await handle.evaluate((el) => el.remove())

    const rows = await page.evaluate(
      async ({ b64, targets, helpers, stamp }) => {
        /* The body runs through new Function so it can share the colour maths,
           which is written once. Built that way it has no closure, so the inputs
           arrive as declared parameters. */
        const run = new Function('b64', 'targets', 'stamp', helpers + '\nreturn (async () => {' + `
          const img = new Image()
          await new Promise((res, rej) => {
            img.onload = res
            img.onerror = rej
            img.src = 'data:image/png;base64,' + b64
          })
          const canvas = document.createElement('canvas')
          canvas.width = img.width
          canvas.height = img.height
          const g = canvas.getContext('2d')
          g.drawImage(img, 0, 0)

          return targets.map((t) => {
            const [x, y, w, h] = t.box
            if (w < 2 || h < 2 || x + w > canvas.width || y + h > canvas.height) {
              return { ...t, stamp, ratio: -1, bg: null }
            }
            const data = g.getImageData(x, y, w, h).data
            const colour = toRGB(t.color)

            let worstRatio = Infinity
            let worstPx = [0, 0, 0]
            for (let i = 0; i < data.length; i += 4) {
              const px = [data[i], data[i + 1], data[i + 2]]
              const r = ratio(over(colour, px), px)
              if (r < worstRatio) { worstRatio = r; worstPx = px }
            }
            return {
              stamp,
              text: t.text,
              need: t.need,
              px: t.size,
              ratio: +worstRatio.toFixed(2),
              bg: worstPx,
            }
          })
        ` + '})()')
        return run(b64, targets, stamp)
      },
      { b64: shot.toString('base64'), targets, helpers: HELPERS, stamp: t },
    )

    for (const r of rows) {
      if (r.ratio === -1) {
        findings.push(`[${label}] could not sample "${r.text}" at ${r.stamp}s: the box fell outside the frame`)
        continue
      }
      if (r.ratio < worst.ratio) worst = r
      if (r.ratio < r.need) {
        findings.push(
          `[${label}] on video at ${r.stamp}s: ${r.ratio} < ${r.need}  ${r.px}px  "${r.text}" (worst pixel rgb(${r.bg}))`,
        )
      }
    }
  }

  console.log(
    `${label}: worst text-on-video ratio ${worst.ratio} (needs ${worst.need}) on "${worst.text}" at ${worst.stamp}s`,
  )
  await ctx.close()
}

/* Every moment, at the narrowest supported width, a typical phone, a desktop, and a
   phone in landscape.

   320 is the one that matters most for wrapping: the text needs more lines there,
   so it covers more of the frame. Landscape matters for a different reason — it is
   wide and very short, so the bottom-up scrim has a few hundred pixels to work with
   instead of a few thousand, and the text is held lower in the frame to compensate.

   The portrait clips are a different frame under a different scrim, and each
   chapter's text sits somewhere else in it, so all four are measured separately
   rather than sampled once for the whole stage.

   All four are measured rather than the two that existed when this file was
   written. Dropping the new chapter because it is "the same shape as an existing
   one" is how a chapter ships with a title nobody checked: this title is three
   words longer than any other and wraps where the others do not. */
for (const [label, width, height] of [
  ['narrow', 320, 568],
  ['mobile', 390, 780],
  ['landscape', 844, 390],
  ['desktop', 1280, 900],
]) {
  for (const chapter of ['top', 'addestramento', 'lezioni', 'passeggiate']) {
    await chapterPass(`${label}/${chapter}`, width, height, chapter)
  }
}

/* ── 3. The gallery and the closing, once the veil is up ────────────────────
   These are read against the page, and the check has to prove that: if the veil
   were late, the DOM walk in pass 1 would have resolved them against --page and
   reported a clean result for text that is actually on top of a moving frame. */
for (const [width, height] of [
  [320, 568],
  [390, 780],
  [844, 390],
  [1280, 900],
]) {
  const ctx = await browser.newContext({ viewport: { width, height } })
  const page = await ctx.newPage()
  await page.goto(BASE, { waitUntil: 'load' })
  await page.waitForTimeout(1800)

  const veilAtTitle = await page.evaluate(async () => {
    const title = document.querySelector('#galleria-title')
    title.scrollIntoView({ block: 'center', behavior: 'instant' })
    await new Promise((r) => setTimeout(r, 700))
    return Number(getComputedStyle(document.querySelector('.story-veil')).opacity)
  })

  if (veilAtTitle < 0.99) {
    findings.push(
      `[page/${width}] the veil is only ${veilAtTitle.toFixed(2)} when the gallery title is centred: that text is on the video, not on the page`,
    )
  }

  /* Now the honest check: the same text, with the video behind it still running,
     measured against what is actually painted. */
  const bad = await page.evaluate(new Function(`
    ${HELPERS}
    return [...document.querySelectorAll('#galleria *, #contatti *')]
      .filter((el) => {
        const r = el.getBoundingClientRect()
        if (r.width < 2 || r.height < 2) return false
        const txt = [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent.trim()).join('')
        return txt.length > 1
      })
      .map((el) => {
        const cs = getComputedStyle(el)
        const bg = bgOf(el)
        const fg = over(toRGB(cs.color), bg)
        return {
          text: el.textContent.trim().slice(0, 34),
          ratio: +ratio(fg, bg).toFixed(2),
          need: needOf(cs),
          px: Math.round(parseFloat(cs.fontSize)),
        }
      })
      .filter((x) => x.ratio < x.need)
  `))
  for (const b of bad) findings.push(`[page/${width}] ${b.ratio} < ${b.need}  ${b.px}px  "${b.text}"`)
  if (!bad.length) console.log(`page/${width}: gallery and closing clean`)
  await ctx.close()
}

await browser.close()
console.log(findings.length ? `\n${findings.join('\n')}` : '\nno findings')
process.exit(findings.length ? 1 : 0)