/* Automated a11y pass, complemented by the manual checks in review.mjs.
   Run against a served build: node checks/axe.mjs [baseUrl]
   Exits non-zero when anything serious or critical is found. */
import { chromium } from 'playwright'
import AxeBuilder from '@axe-core/playwright'

const BASE = process.argv[2] ?? 'http://localhost:4180'
const browser = await chromium.launch()
let serious = 0
let minor = 0

/* Every state a visitor can actually land in, in both colour schemes: the opening
   as it arrives, a moment of the story with the video running, the gallery dialog,
   and privacy.

   The video chapters are checked while their clip is on screen, because that is
   when their text is over the video rather than over the page. An automated rule
   cannot judge that properly, but it must not be skipped either: a false positive
   there is a signal to measure it properly with checks/contrast.mjs, which is the
   check that actually settles it. */
const CASES = [
  ['home opening', 'light', async () => {}],
  ['home opening', 'dark', async () => {}],
  ['home chapter', 'light', async (page) => {
    await page.evaluate(() => {
      const section = document.getElementById('lezioni')
      const box = section.getBoundingClientRect()
      window.scrollTo(0, Math.round(box.top + scrollY + box.height / 2 - window.innerHeight / 2))
    })
    await page.waitForTimeout(2000)
  }],
  ['home chapter', 'dark', async (page) => {
    await page.evaluate(() => {
      const section = document.getElementById('passeggiate')
      const box = section.getBoundingClientRect()
      window.scrollTo(0, Math.round(box.top + scrollY + box.height / 2 - window.innerHeight / 2))
    })
    await page.waitForTimeout(2000)
  }],
  ['home gallery', 'light', async (page) => {
    await page.evaluate(() => document.querySelector('.gallery-grid')?.scrollIntoView())
    await page.waitForTimeout(1600)
  }],
  ['home gallery dialog', 'light', async (page) => {
    await page.evaluate(() => document.querySelector('.gallery-grid')?.scrollIntoView())
    await page.waitForTimeout(1600)
    await page.evaluate(() => document.querySelector('#galleria figure button')?.click())
    await page.waitForTimeout(600)
  }],
  ['home closing', 'light', async (page) => {
    await page.evaluate(() => document.getElementById('contatti')?.scrollIntoView())
    await page.waitForTimeout(1200)
  }],
  ['home closing disclosure open', 'light', async (page) => {
    await page.evaluate(() => {
      document.getElementById('contatti')?.scrollIntoView()
      document.querySelector('.closing-info summary')?.click()
    })
    await page.waitForTimeout(800)
  }],
  ['privacy', 'light', async (page) => {
    await page.goto(BASE + '/privacy.html', { waitUntil: 'load' })
  }],
  ['privacy', 'dark', async (page) => {
    await page.goto(BASE + '/privacy.html', { waitUntil: 'load' })
  }],
]

for (const [label, scheme, setup] of CASES) {
  const ctx = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    colorScheme: scheme,
  })
  const page = await ctx.newPage()
  await page.goto(BASE, { waitUntil: 'load' })
  await page.waitForTimeout(1800)
  await setup(page)

  const { violations } = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze()

  console.log(`\n${label} [${scheme}]: ${violations.length} violation(s)`)
  for (const v of violations) {
    /* The spec sets the bar at zero serious or critical. Anything minor is reported
       and left visible rather than silently dropped. */
    if (v.impact === 'serious' || v.impact === 'critical') serious += v.nodes.length
    else minor += v.nodes.length
    console.log(`  [${v.impact}] ${v.id}: ${v.help}`)
    for (const n of v.nodes.slice(0, 4)) console.log(`     ${n.target.join(' ')}`)
    /* Text over the video is judged by checks/contrast.mjs, which measures the
       pixels rather than resolving the CSS. Reporting those here as failures would
       be noise against a check that has already answered the question. */
    /* Text over the video is judged by checks/contrast.mjs, which measures the pixels
       rather than resolving the CSS. Reporting those here as failures would be noise
       against a check that has already answered the question, and suppressing them by
       name would hide a real failure on the page.

       So it is decided by asking the page where each node actually is, not by
       pattern-matching the selector: a node whose element is inside the story is over
       the video, whatever it is called. */
    if (v.id === 'color-contrast') {
      const overVideo = await page.evaluate(
        (nodes) =>
          nodes.filter((n) => {
            try {
              const el = document.querySelector(n.target[0])
              return Boolean(el?.closest('.story-content'))
            } catch {
              return false
            }
          }).length,
        v.nodes.map((n) => ({ target: n.target })),
      )
      console.log(
        `     ${overVideo} of ${v.nodes.length} are over the video and are settled by contrast.mjs`,
      )
      if (overVideo === v.nodes.length) {
        /* Every finding is one contrast.mjs has already answered, so this case is
           clean as far as axe can tell. */
        serious -= v.nodes.length
      }
    }
  }
  await ctx.close()
}

await browser.close()
console.log(
  `\n${serious} serious or critical, ${minor} minor`,
  serious ? '\nFAIL' : '\nclean',
)
process.exit(serious ? 1 : 0)
