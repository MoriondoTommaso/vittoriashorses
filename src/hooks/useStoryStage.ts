import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'
import { useMotionValueEvent, useScroll, useTransform, type MotionValue } from 'motion/react'
import { clips, type StoryMoment } from '../content'

export type Variant = 'desktop' | 'mobile'

/** The story is four moments long, in this order. */
export const MOMENTS: StoryMoment[] = ['fermo', 'passo', 'trotto', 'galoppo']

/**
 * Width of a crossfade, as a fraction of the viewport height.
 *
 * 25 to 35 per cent is the range the brief gives: wide enough that a swap reads
 * as the scene changing rather than as a cut, narrow enough that the two moments
 * do not blur into each other.
 */
const FADE_RATIO = 0.3

/**
 * How far before a band the incoming clip is requested, in viewport heights.
 *
 * A little over one screen of scroll is roughly where the next chapter's text
 * starts to appear, so the clip is decodable by the time anyone can see it. This
 * is what keeps the six files from being requested at once: layer 1 is asked for
 * while layer 0 is on screen, layer 2 while layer 1 is, and never before.
 */
const PREVIEW_VH = 1.2

/**
 * The handover from the last moment to the page, measured forwards from where the
 * last panel's bottom edge leaves the viewport.
 *
 * The veil does not start rising while that panel is still on screen. The veil is
 * *behind* the text, inside the stage, so a veil at 60% under a panel of near
 * white type is near white type on a sand page: 1.7:1. The sequence has to be
 * panel readable, panel gone, dissolve finished, gallery arriving, and only the
 * middle two are ours to time. So the rise begins at the scroll position where the
 * panel's bottom edge reaches the top of the viewport and takes EXIT_LENGTH_VH of
 * viewport height to complete.
 *
 * EXIT_SETTLE_VH is the short stretch of page between a finished veil and the first
 * photograph arriving. It exists so the gallery does not appear on the same frame
 * the dissolve finishes, which reads as one movement rather than two.
 *
 * All three are fractions of the viewport height, and the runway is solved from them
 * in `read` rather than iterated, because the runway's own length is one of the
 * terms. Every one of them is converted to pixels before it meets `total`, which is
 * a distance in pixels: a viewport fraction divided by a pixel count is not a
 * fraction of anything, and the band it produced was clamped to nothing.
 */
const EXIT_LENGTH_VH = 0.35
const EXIT_SETTLE_VH = 0.2
const EXIT_MIN_VH = 0.15

/** A transition band in scroll-progress space: opacity ramps 0 to 1 across it. */
export type Band = readonly [number, number]

const clamp01 = (n: number) => (n < 0 ? 0 : n > 1 ? 1 : n)

/* A band with from < to always. Callers pass raw fractions that can come out
   inverted or zero-length when a chapter is taller than the viewport; widening a
   degenerate band to a minimum keeps the ramp a ramp. */
const MIN_BAND = 0.01

function band(from: number, to: number): Band {
  const a = clamp01(from)
  const b = clamp01(Math.max(to, from + MIN_BAND))
  return [a, b]
}

/* ── Geometry ─────────────────────────────────────────────────────────────── */

export interface StageGeometry {
  containerRef: React.RefObject<HTMLElement>
  /** The scrolling content: the chapters plus the exit runway. */
  contentRef: React.RefObject<HTMLDivElement>
  /** The measured, empty stretch after the last chapter. See .story-exit. */
  exitRef: React.RefObject<HTMLDivElement>
  chapterRefs: React.MutableRefObject<(HTMLElement | null)[]>
  scrollYProgress: MotionValue<number>
  /** One band per crossfade: bands[0] is the change from the first moment to the
   *  second. There is no band for the last moment; the exit has its own. */
  bands: Band[]
  /** The handover from the last moment to the page. Drives the veil rather than a
   *  layer, so scrolling back up uncovers a video that never stopped, instead of
   *  one that has to be faded back in. */
  exit: Band | null
  /** How far ahead of a band the next clip should be requested. */
  lead: number
}

/** Everything one measurement produced. Compared field by field before committing. */
interface Measurement {
  bands: Band[]
  exit: Band | null
  lead: number
}

const sameBands = (a: Band[], b: Band[]) =>
  a.length === b.length && a.every((one, i) => one[0] === b[i][0] && one[1] === b[i][1])

const sameBand = (a: Band | null, b: Band | null) =>
  a === null || b === null ? a === b : a[0] === b[0] && a[1] === b[1]

/**
 * Measures the stage and turns the chapter boundaries into scroll-progress bands.
 *
 * The bands are measured rather than assumed, because every moment is allowed to
 * grow: a small phone in landscape, or a long Italian word in a narrow column,
 * makes a chapter taller than a viewport, and a hardcoded boundary would then put
 * the crossfade in the wrong place relative to the text the visitor is reading.
 *
 * The runway covers the chapters and nothing else. The gallery and the closing sit
 * outside the story now, so opening the FAQ, resizing a photograph or a longer
 * caption cannot move a crossfade that happened three screens earlier.
 */
export function useStageGeometry(): StageGeometry {
  const containerRef = useRef<HTMLElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const exitRef = useRef<HTMLDivElement>(null)
  const chapterRefs = useRef<(HTMLElement | null)[]>([])
  const [bands, setBands] = useState<Band[]>([])
  const [exit, setExit] = useState<Band | null>(null)
  const [lead, setLead] = useState(0)

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start start', 'end end'],
  })

  /**
   * One reading of the DOM, expressed in scroll-progress fractions.
   *
   * `total` is the distance the reader scrolls between the container's top meeting
   * the top of the viewport and its bottom meeting the bottom of it, which is
   * exactly what useScroll measures, so the two agree by construction rather than
   * by luck.
   */
  const read = useCallback((): Measurement | null => {
    const container = containerRef.current
    const content = contentRef.current
    const exitEl = exitRef.current
    if (!container || !content || !exitEl) return null

    const viewport = window.innerHeight
    /* The chapters on their own. The exit is subtracted out because its height is
       the thing being solved for below, and a reading that included it would be a
       function of its own answer. */
    const chaptersH = content.offsetHeight - (exitEl.offsetHeight || 0)
    const top = container.getBoundingClientRect().top

    /* Where the last panel's bottom edge sits, as a scroll position: the scroll
       after which that text is clear of the viewport.

       Read first, and in absolute terms, because the exit is timed from it and the
       runway has to be long enough to reach it. A chapter is a screen tall, so a
       panel's offset *within* its chapter is most of a screen; measuring from the
       chapter and comparing against a total that counts every chapter puts the
       dissolve about two screens early, which is the version where the veil is
       fully up while the visitor is still reading the last paragraph. */
    const last = chapterRefs.current[MOMENTS.length - 1]
    const lastPanel = last?.querySelector('.story-panel') ?? last
    const panelCleared = lastPanel
      ? Math.max(0, lastPanel.getBoundingClientRect().bottom - top)
      : 0

    /* The runway the handover needs: the panel's exit, plus the dissolve, plus a
       short settle before the gallery starts arriving. */
    const dissolve = viewport * EXIT_LENGTH_VH
    const settle = viewport * EXIT_SETTLE_VH
    /* Solved rather than iterated. The runway is the chapters plus the exit minus
       the viewport, and the exit is what is short, so:
         chapters + exit - viewport = panelCleared + dissolve + settle
       which has the exit on both sides once total is substituted. Writing it as
       "whatever the runway is currently short of" instead is what produced a veil
       pinned at zero: the shortfall came out negative, the exit was floored, and
       the band it fed was measured against a runway that did not include the exit
       at all, so both its ends landed past 1 and clamped to [1, 1]. */
    const tail = Math.max(0.25 * viewport, panelCleared + dissolve + settle - chaptersH + viewport)
    const total = chaptersH + tail - viewport

    /* Nothing to fade across: the stage is not taller than the screen, so there is
       no scroll distance to map onto it. Empty bands leave the backdrop on its
       first moment, which is the right answer for a viewport that cannot show the
       journey at all. */
    if (total <= 0) {
      exitEl.style.height = '0px'
      return { bands: [], exit: null, lead: 0 }
    }
    exitEl.style.height = `${tail}px`

    const next: Band[] = []

    /* Where a chapter's text comes to rest. The text is centred in the chapter, so
       its middle is the chapter's middle, and it is centred in the viewport half a
       screen before that point is reached. Anchoring the crossfade here is what
       makes a moment's words and its own clip arrive together, instead of the words
       settling and the picture changing afterwards. */
    const settlePoint = (box: DOMRect) => box.top - top + box.height / 2 - viewport / 2

    /* One crossfade per video chapter after the first, and no more.

       The band is centred on the point where the arriving chapter's text comes to
       rest, which is where its own clip should be arriving too. The width is then
       stretched until the outgoing chapter's text is still fully on screen at the
       moment the new one starts to appear.

       That second part is what stops the picture changing under a sentence that is
       still being read. With a fixed width it works out for a chapter whose text is
       centred and about half a screen tall, and it fails for the opening, whose
       wordmark sits in the middle of a full screen: the fade would be half over
       before the last word of the previous moment had left. Measured, it holds for
       any text length and any viewport. */
    const opening = chapterRefs.current[0]
    for (let index = 1; index < MOMENTS.length; index += 1) {
      const element = chapterRefs.current[index]
      if (!element) continue
      const centre = settlePoint(element.getBoundingClientRect())
      const half = (viewport * FADE_RATIO) / 2

      /* Where the outgoing chapter's text finishes leaving the top of the screen. */
      let earliest = centre - half
      if (opening) {
        const panel = opening.querySelector('.story-panel')
        if (panel) {
          const panelBox = panel.getBoundingClientRect()
          const settle = settlePoint(opening.getBoundingClientRect())
          earliest = Math.min(earliest, settle - panelBox.height / 2)
        }
      }
      next[index - 1] = band(earliest / total, (centre + half) / total)
    }

    /* A chapter that never registered leaves a hole. Repeating the last band that
       did resolve keeps the layer opacities monotonic, so a missing measurement
       degrades to "the picture holds" rather than to "the picture flickers". */
    const crossfades: Band[] = []
    let previous: Band = [0, 0]
    for (let index = 0; index < MOMENTS.length - 1; index += 1) {
      previous = next[index] ?? previous
      crossfades.push(previous)
    }

    /* Ordered, and non-degenerate, checked rather than assumed. Two bands sharing
       a stretch would put two layers ramping over the same scroll, which is the
       compositing fault this file used to have; a band that ended before it started
       would divide by a negative range. Either way the fix is to hold the previous
       boundary, which stalls the picture rather than tearing it. */
    const ordered: Band[] = []
    let lastEnd = 0
    for (const [from, to] of crossfades) {
      const start = Math.max(from, lastEnd)
      const end = Math.max(to, start + MIN_BAND)
      ordered.push([start, end])
      lastEnd = end
    }

    const lead = clamp01((viewport * PREVIEW_VH) / total)


    /* The handover, measured off the last panel rather than off the end of the
       story.

       `drop` is how far the last panel's bottom edge sits below the top of its own
       chapter: the scroll still to be done before that text is clear of the
       viewport. It is read from the panel, because a chapter that grew to two
       screens, or a title that wrapped to a third line, moves it, and a number
       taken from the chapter's height would be wrong in exactly those cases.

       The runway is then extended by whatever scroll it is short of: the drop, plus
       the length of the dissolve, plus a short settle. Everything below is expressed
       against `total`, which is the divisor useScroll uses, so the veil completes
       exactly where it was asked to and not a fraction of a pixel away from it. */
    let exitBand: Band | null = null
    if (last) {
      const lastEndAt = ordered.length ? ordered[ordered.length - 1][1] : 0
      const floor = lastEndAt + (viewport * EXIT_MIN_VH) / total
      exitBand = band(
        Math.max(panelCleared / total, floor),
        Math.max((panelCleared + dissolve) / total, lastEndAt + MIN_BAND),
      )
    }

    return { bands: ordered, exit: exitBand, lead }
  }, [])

  const measure = useCallback(() => {
    const next = read()
    if (!next) return
    setBands((was) => (sameBands(was, next.bands) ? was : next.bands))
    setExit((was) => (sameBand(was, next.exit) ? was : next.exit))
    setLead((was) => (was === next.lead ? was : next.lead))
  }, [read])

  /* Notifications are coalesced into one measurement per frame.

     A ResizeObserver fires once per element that changed, so a resize that reflows
     three chapters delivers three callbacks and each one reads layout. Without the
     frame guard that is three forced layouts for one resize, and with a
     keyboard-driven font size change it is one per step held down. */
  const pending = useRef(0)
  const schedule = useCallback(() => {
    if (pending.current) return
    pending.current = window.requestAnimationFrame(() => {
      pending.current = 0
      measure()
    })
  }, [measure])

  useEffect(() => {
    measure()

    const observer =
      typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(() => schedule())
    if (containerRef.current) observer?.observe(containerRef.current)
    if (contentRef.current) observer?.observe(contentRef.current)
    for (const element of chapterRefs.current) if (element) observer?.observe(element)

    /* Every boundary is derived from where a chapter's type lands, so measuring
       before the webfont has arrived measures the fallback. Alfa Slab One is a
       different width from Plus Jakarta Sans at the same size, which is exactly the
       kind of difference that lands a crossfade under the wrong line. */
    const fonts = (document as Document & { fonts?: FontFaceSet }).fonts
    fonts?.ready?.then(() => measure()).catch(() => undefined)

    window.addEventListener('resize', schedule)
    window.addEventListener('orientationchange', schedule)
    return () => {
      if (pending.current) window.cancelAnimationFrame(pending.current)
      pending.current = 0
      observer?.disconnect()
      window.removeEventListener('resize', schedule)
      window.removeEventListener('orientationchange', schedule)
    }
  }, [measure, schedule])

  return { containerRef, contentRef, exitRef, chapterRefs, scrollYProgress, bands, exit, lead }
}

/* ── Layer opacities ──────────────────────────────────────────────────────── */

/**
 * The middle of a band, where the outgoing layer stops being lowered and the
 * incoming one finishes arriving.
 *
 * This one function is the whole crossfade. The outgoing layer holds at fully
 * opaque until halfway, then falls; the incoming layer rises from nothing to fully
 * opaque by that same halfway point. So at every scroll position inside a band the
 * layer *underneath* the one that is moving is fully opaque, and the composite is
 * always complete coverage.
 *
 * The version this replaces had both layers moving at once: at the midpoint of a
 * band the outgoing sat at 0.5 and the incoming at 0.5, which composites to 0.75 of
 * real footage over the 0.25 that was left showing the stage's dark base. That is
 * the dark pulse in the middle of every dissolve, and no amount of tuning the
 * gradient or the duration hides it. It is arithmetic, and this is the fix.
 */
const midpoint = (band: Band) => (band[0] + band[1]) / 2

/**
 * Opacity of one layer at a given scroll progress.
 *
 * Layer 0 is opaque until the first band opens. Every later layer is transparent
 * until the band before it opens, rises across the first half of it, and is then
 * taken back down across the second half of the band after it.
 */
function layerOpacity(index: number, bands: Band[], ramped: boolean) {
  return (progress: number) => {
    const incoming = index > 0 ? bands[index - 1] : undefined
    const outgoing = index < bands.length ? bands[index] : undefined
    let value = 1
    if (incoming) value *= step(progress, incoming[0], midpoint(incoming), ramped)
    if (outgoing) value *= 1 - step(progress, midpoint(outgoing), outgoing[1], ramped)
    return value
  }
}

/* Under reduced motion the band is a step rather than a ramp: the poster changes
   when the chapter changes, with nothing in between to animate. It switches at the
   same halfway point, so the outgoing frame leaves exactly as the incoming one
   arrives and the stage is never two-thirds of both and a third of nothing. */
function step(progress: number, from: number, to: number, ramped: boolean) {
  if (!ramped) return progress >= to ? 1 : 0
  if (progress <= from) return 0
  if (progress >= to) return 1
  return (progress - from) / (to - from)
}

/**
 * One MotionValue per layer, bound straight to scroll progress.
 *
 * Written out one per moment rather than mapped over an array, because the hooks
 * have to be called unconditionally and in the same order every render. Four
 * moments is a fixed number, which is what makes this safe, and the number is
 * written here by hand on purpose: adding a moment to MOMENTS and forgetting a line
 * here produces a fourth layer that never moves, which reads as a page where one
 * crossfade does not happen, rather than as a bug in a hook.
 *
 * Four lines for four moments. A fifth moment means a fifth line here and a fifth
 * pair in StoryStage's binding effect.
 */
export function useLayerOpacities(
  progress: MotionValue<number>,
  bands: Band[],
  ramped: boolean,
): MotionValue<number>[] {
  const first = useTransform(progress, layerOpacity(0, bands, ramped))
  const second = useTransform(progress, layerOpacity(1, bands, ramped))
  const third = useTransform(progress, layerOpacity(2, bands, ramped))
  const fourth = useTransform(progress, layerOpacity(3, bands, ramped))
  return [first, second, third, fourth]
}

/* ── Discrete state ───────────────────────────────────────────────────────── */

export interface ActiveState {
  /** The moment whose clip owns the stage. */
  index: number
  /** True while a band is partly open, which is the only time two clips run. */
  crossing: boolean
  /** The last moment whose poster should be in the document. */
  requested: number
}

/**
 * Turns continuous scroll progress into the three discrete facts the media layer
 * needs, without re-rendering on every frame.
 *
 * The listener does run on every scroll frame, so each value is compared with
 * what is already stored and React is only called when an answer actually
 * changes. That comparison is the whole difference between a page that re-renders
 * while scrolling and one that does not.
 */
export function useActiveState(
  progress: MotionValue<number>,
  bands: Band[],
  lead: number,
): ActiveState {
  const [state, setState] = useState<ActiveState>({ index: 0, crossing: false, requested: 0 })

  const resolve = useCallback(
    (value: number) => {
      if (!bands.length) return
      let index = 0
      let crossing = false
      for (let i = 0; i < bands.length; i += 1) {
        const [from, to] = bands[i]
        if (value >= to) {
          index = i + 1
          continue
        }
        crossing = value > from
        break
      }
      index = Math.min(index, MOMENTS.length - 1)

      /* The next moment's poster is asked for once the visitor is within the preview
         distance of the band that brings it in. */
      const upcoming = bands[Math.min(index, bands.length - 1)]
      const requested =
        value >= upcoming[0] - lead ? Math.min(index + 1, MOMENTS.length - 1) : index

      setState((current) =>
        current.index === index && current.crossing === crossing && current.requested === requested
          ? current
          : { index, crossing, requested },
      )
    },
    [bands, lead],
  )

  useMotionValueEvent(progress, 'change', resolve)

  /* Re-resolved whenever the geometry changes, from wherever the reader already
     is. A resize, a rotation or the webfont arriving moves every band, and without
     this the media layer would keep answering for the old ones until the reader
     happened to scroll again: a reader who rotated the phone and stayed still
     would be left with the wrong clip playing under the right text. */
  useEffect(() => {
    resolve(Number(progress.get()))
  }, [progress, resolve])

  return state
}

/**
 * Which posters have decoded.
 *
 * A poster that is requested but has not arrived must not fade in over the layer
 * beneath it, or a slow image opens a hole in the stage. Only a decoded poster
 * counts as ready, and an image that errors is treated as ready too: it has
 * settled, it simply has nothing to show, and the frame below carries on.
 */
export function useReadyPosters(
  variant: Variant,
  posters: RefObject<(HTMLImageElement | null)[]>,
): {
  ready: boolean[]
  markReady: (index: number) => void
} {
  /* Keyed by orientation, so turning the phone resets the set as a side effect of
     the state identity changing rather than through a separate effect. An effect
     that cleared this on mount would run *after* the images had already fired
     their load events, and the stage would then wait forever for a load that had
     already happened. That is the whole reason this is not an effect. */
  const [state, setState] = useState<{ variant: Variant; ready: boolean[] }>(() => ({
    variant,
    ready: MOMENTS.map(() => false),
  }))

  /* Turning the phone swaps every poster, so all four go back to waiting. They
     are in the HTTP cache by then, so this costs a decode and not a download, and
     it stops a frame from the previous orientation being shown against the new
     one. */
  const ready = state.variant === variant ? state.ready : MOMENTS.map(() => false)

  const markReady = useCallback(
    (index: number) => {
      setState((current) => {
        const base = current.variant === variant ? current.ready : MOMENTS.map(() => false)
        if (base[index]) return current
        return {
          variant,
          ready: base.map((was, i) => (i === index ? true : was)),
        }
      })
    },
    [variant],
  )

  /* Adopt posters that are already decoded.

     Without this the stage waits for a `load` event that will never arrive, and
     no clip is ever given a source. The page still looks right — the poster is
     what carries the layer — so the failure is a stage that never moves.

     Why the event has already gone: the document is prerendered, so the poster
     is in the HTML and the browser starts decoding it while the bundle is still
     downloading. On a warm cache it is decoded before React hydrates, so the
     `onLoad` this hook is driven by fires before the handler is attached. A
     listener attached after the event has fired hears nothing.

     `complete` is the answer to that, and it is the right question to ask rather
     than a proxy for it: true when the image is fully available for rendering,
     which includes the cached-and-decoded case and the not-yet-started one, and
     the two are distinguished by `naturalWidth`, which is 0 until there are real
     pixels to report. An image that failed also has `complete` true, so the
     width test is what keeps a broken poster from counting as a ready frame.

     This runs once on mount and on no other trigger, because it adopts state
     that already exists rather than observing anything that can change. */
  useEffect(() => {
    const images = posters.current
    if (!images) return
    for (let index = 0; index < images.length; index += 1) {
      const image = images[index]
      if (image?.complete && image.naturalWidth > 0) markReady(index)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [posters, variant])

  return { ready, markReady }
}

/* ── Playback preferences ─────────────────────────────────────────────────── */

export interface PlaybackState {
  /** Whether the visitor's motion preference permits a clip to be requested. */
  motionAllows: boolean
  /** Whether the visitor's data preference permits the bytes to be requested.
   *  Kept apart from the motion preference because the two ask different
   *  questions and are answered by different people: one is about comfort, one is
   *  about a connection someone is paying for. Merged into one flag they become
   *  indistinguishable, and so does the control's label. */
  dataAllows: boolean
  /** Both of the above. A preference, not a decision about this visit. */
  allowed: boolean
  /** The visitor overriding those preferences with the control. */
  manual: boolean
  /** The visitor's own pause. Survives every chapter change. */
  paused: boolean
  variant: Variant
  stageVisible: boolean
  tabVisible: boolean
  toggle: () => void
}

/**
 * Everything about whether a clip may play, kept out of the scroll code.
 *
 * Four conditions decide this and they are deliberately kept apart: the two
 * preferences, `manual` as the visitor overriding them, and `paused` as the visitor
 * asking for silence. Merging them is exactly how a manual pause ends up being
 * undone by the next observer callback.
 */
export function usePlayback(): PlaybackState {
  const [variant, setVariant] = useState<Variant>(() =>
    typeof window !== 'undefined' && window.matchMedia('(min-width: 768px)').matches
      ? 'desktop'
      : 'mobile',
  )
  const [motionAllows, setMotionAllows] = useState(true)
  const [dataAllows, setDataAllows] = useState(true)
  const [manual, setManual] = useState(false)
  const [paused, setPaused] = useState(false)
  const [stageVisible, setStageVisible] = useState(true)
  const [tabVisible, setTabVisible] = useState(true)

  useEffect(() => {
    const wide = window.matchMedia('(min-width: 768px)')
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)')
    /* Not implemented everywhere. An unsupported query never matches, which is
       the answer we want here. */
    const data = window.matchMedia('(save-data: reduce)')
    const sync = () => {
      setVariant(wide.matches ? 'desktop' : 'mobile')
      setMotionAllows(!motion.matches)
      setDataAllows(!data.matches)
    }
    sync()
    for (const query of [wide, motion, data]) query.addEventListener('change', sync)
    return () => {
      for (const query of [wide, motion, data]) query.removeEventListener('change', sync)
    }
  }, [])

  useEffect(() => {
    const onVisibility = () => setTabVisible(!document.hidden)
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [])

  /* The stage is sticky and full height, so it is on screen for the whole story.
     What matters is whether the reader has left the story behind. */
  useEffect(() => {
    const element = document.getElementById('racconto')
    if (!element || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver(([entry]) => setStageVisible(entry.isIntersecting))
    io.observe(element)
    return () => io.disconnect()
  }, [])

  const allowed = motionAllows && dataAllows

  return {
    motionAllows,
    dataAllows,
    allowed,
    manual,
    paused,
    variant,
    stageVisible,
    tabVisible,
    toggle: () => {
      if (!allowed && !manual) {
        setManual(true)
        return
      }
      setPaused((current) => !current)
    },
  }
}

export const clipFor = (index: number, variant: Variant) => clips[MOMENTS[index]][variant]