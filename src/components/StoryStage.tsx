import { useCallback, useEffect, useRef, useState } from 'react'
import { useTransform, type MotionValue } from 'motion/react'
import { Pause, Play } from 'lucide-react'
import {
  clipFor,
  MOMENTS,
  useActiveState,
  useLayerOpacities,
  usePlayback,
  useReadyPosters,
  type StageGeometry,
  type Variant,
} from '../hooks/useStoryStage'

/**
 * How far through a band a value sits, 0 to 1.
 *
 * Under reduced motion the band is a step rather than a ramp: the picture changes
 * when the chapter changes, with nothing in between to animate. Exported from the
 * hook module so the veil and the layers agree on what a band means.
 */
function bandStep(progress: number, band: readonly [number, number], ramped: boolean) {
  const [from, to] = band
  if (!ramped) return progress >= to ? 1 : 0
  if (progress <= from) return 0
  if (progress >= to) return 1
  return (progress - from) / (to - from)
}

/**
 * The single shared backdrop.
 *
 * One sticky stage holds every clip for the whole story. The chapters scroll over
 * it and the clips crossfade inside it. That is the whole difference between one
 * continuous ride and four decorated sections: no video element is created,
 * destroyed or re-created anywhere in the journey, so there is no point at which
 * the background is briefly missing.
 *
 * All four layers live in the document from the start, stacked. Only the current
 * moment and the one it is crossing to are allowed to run, so at most two clips
 * ever decode at once, and the layer underneath stays fully opaque for the whole
 * transition, so the dark base never shows through the middle of a dissolve.
 */
export function StoryStage({
  geometry,
  children,
}: {
  geometry: StageGeometry
  children: React.ReactNode
}) {
  const playback = usePlayback()
  const { ready, markReady } = useReadyPosters(playback.variant)

  /* Under reduced motion the bands become steps and the stage shows one poster at
     a time. The layout, the order and every word are unchanged. */
  const wanted = playback.allowed || playback.manual
  const opacities = useLayerOpacities(geometry.scrollYProgress, geometry.bands, wanted)
  const active = useActiveState(geometry.scrollYProgress, geometry.bands, geometry.lead)
  /* The veil rises on its own band rather than on the last layer's opacity, so
     scrolling back up uncovers a video that never stopped instead of fading one
     back in. Two things moving in opposite directions would also mean two things
     to get right when the reader reverses. */
  const exit = geometry.exit
  const veil = useTransform(
    geometry.scrollYProgress,
    exit ? (progress: number) => bandStep(progress, exit, wanted) : () => 0,
  )
  /* The opening's centred vignette hands over to the chapter scrim on the first
     crossfade, which is the same stretch of scroll over which the text moves from
     the middle of the frame to the left column. The two gradients are therefore
     never both at full strength, and the change of scrim is part of the change of
     moment rather than an event of its own.

     Read once per render, and the component only re-renders when the geometry is
     remeasured, so this is not a per-frame subscription. */
  const firstBand = geometry.bands[0]
  const openingScrim = useTransform(
    geometry.scrollYProgress,
    firstBand ? (progress: number) => bandStep(progress, firstBand, wanted) : () => 1,
  )
  /* The complement, as its own MotionValue rather than as arithmetic on one: motion
     does not subtract two values in a style object, and a plain `1 - value` there
     would be a TypeError rather than a subtraction. */
  const chapterScrim = useTransform(openingScrim, (value) => 1 - Number(value))
  /* The control fades out as the veil comes up. Derived as a value rather than as a
     boolean so the change is a compositor transform and not a re-render, and snapped
     to a decision rather than ramped: it should be plainly there or plainly gone,
     not a ghost that follows the scroll.

     Annotated as number because the literal 0 and 1 would otherwise infer
     `MotionValue<0 | 1>`, which is not assignable where a number is expected. */
  const controlVisible = useTransform(veil, (value: number): number =>
    Number(value) > 0.98 ? 0 : 1,
  )

  const videoRefs = useRef<(HTMLVideoElement | null)[]>([])
  /* One pending requestVideoFrameCallback per layer, so a callback can be handed
     back when its source changes. See the effect below. */
  const frameHandles = useRef<(number | null)[]>(MOMENTS.map(() => null))

  /* The elements the scroll values are written to. Held here rather than looked up
     with querySelector, because a selector would bind to whatever happens to match
     at the time the effect runs and would silently stop updating if the markup
     changed underneath it. */
  const stageRefs = useRef<{
    layers: (HTMLDivElement | null)[]
    /** The element carrying `.story-scrim--opening`. */
    openingScrimEl: HTMLDivElement | null
    /** The element carrying the chapter scrim. */
    chapterScrimEl: HTMLDivElement | null
    veilEl: HTMLDivElement | null
    controlEl: HTMLButtonElement | null
  }>({ layers: [], openingScrimEl: null, chapterScrimEl: null, veilEl: null, controlEl: null })
  /* Whether each clip has produced a frame. A paused clip keeps showing the frame
     it stopped on: falling back to the poster would snap the horse back to the
     opening pose, which is more visible than the pause itself.

     Keyed by the variant rather than held as a flat array of booleans, because a
     boolean that has gone true stays true and turning the phone swaps every source.
     The next thing the element had to paint was then a frame of the file it is no
     longer pointing at, at full opacity: a flash of the wrong orientation. Read
     through the same guard useReadyPosters uses, a new source starts at "not yet
     shown", so the poster underneath is what is visible and the first frame of the
     new file fades in over it exactly as the first one did. */
  const [shownState, setShownState] = useState<{ variant: Variant; shown: boolean[] }>(() => ({
    variant: playback.variant,
    shown: MOMENTS.map(() => false),
  }))
  const shown =
    shownState.variant === playback.variant ? shownState.shown : MOMENTS.map(() => false)
  const [anyPlaying, setAnyPlaying] = useState(false)

  const markShown = useCallback(
    (index: number) => {
      setShownState((current) => {
        const base = current.variant === playback.variant ? current.shown : MOMENTS.map(() => false)
        if (base[index]) return current
        return { variant: playback.variant, shown: base.map((was, i) => (i === index ? true : was)) }
      })
    },
    [playback.variant],
  )

  /* The first clip is not requested until the browser is idle. It is 1.8 MB and
     its poster is 47 KB, and asking for the clip while the poster is still on the
     wire spends the connection on the decorative half of the opening and delays
     the half carrying the name. The timeout is the escape hatch for a busy page:
     it still happens. */
  const [idle, setIdle] = useState(false)
  useEffect(() => {
    if (!wanted || idle) return
    if (typeof window.requestIdleCallback === 'function') {
      const handle = window.requestIdleCallback(() => setIdle(true), { timeout: 2000 })
      return () => window.cancelIdleCallback(handle)
    }
    const handle = window.setTimeout(() => setIdle(true), 800)
    return () => window.clearTimeout(handle)
  }, [wanted, idle])

  /* Asking by hand answers the question the deferral is asking, so it does not
     wait for idle. */
  useEffect(() => {
    if (playback.manual) setIdle(true)
  }, [playback.manual])

  /* Whether any clip is actually running, rather than how many.

     A tally of playing events is the wrong shape for this. It drifts: a video that
     is paused by the browser firing pause on its own, or a source removed while
     playing, leaves the count one too high and the control then offers "pause" for
     a stage where nothing is moving. The ref is the running count because events
     arrive per clip, and the state is the single yes/no the label needs, written
     only when the answer differs from what is already stored. */
  const running = useRef(0)
  const syncRunning = useCallback(() => {
    const shouldRun = running.current > 0
    setAnyPlaying((was) => (was === shouldRun ? was : shouldRun))
  }, [])

  /* Source, preparation and play in one effect, so there is never a moment where a
     source has been swapped and play() has not been called again.

     A clip is given a source only once its poster is decoded, which is what makes
     "poster first, clip second" true rather than aspirational: the frame the
     visitor sees is already on screen before a single byte of video is requested.
     A poster that errors counts as decoded, so a missing image falls through to
     the frame below instead of stalling the story. */
  useEffect(() => {
    const videos = videoRefs.current
    for (let index = 0; index < MOMENTS.length; index += 1) {
      const video = videos[index]
      if (!video) continue

      const armed = wanted && idle && ready[index] && index <= active.requested

      if (armed) {
        const source = clipFor(index, playback.variant).src
        if (video.getAttribute('src') !== source) {
          video.src = source
          video.load()
        }
        const shouldRun =
          !playback.paused &&
          playback.stageVisible &&
          playback.tabVisible &&
          (index === active.index || (active.crossing && index === active.index + 1))
        if (shouldRun) {
          /* A refused autoplay is not an error to report: the poster stays and the
             control offers an explicit start. */
          void video.play().catch(() => undefined)
          /* Waiting for a presented frame rather than for the playing event.

             `playing` says playback has begun, which is a promise about the next
             frame rather than a statement about this one, so the layer can be
             brought to full opacity a tick before there is anything at full opacity
             to show: a flash of the stage's own background on the first play of
             every clip. requestVideoFrameCallback fires when a frame has been handed
             to the compositor. Browsers without it keep the playing event, which is
             wrong by at most one frame.

             And the callback is not sufficient on its own, which is why the frame is
             checked before it is believed. A frame callback means something was
             presented, and a video element presents *something* as soon as it has a
             source: on a device with no codec for it, play() is refused and the
             element still gets composited as an empty rectangle. Believing the
             callback there swaps a good poster for a blank rectangle at full
             opacity, which is worse than the flash it was introduced to remove.
             videoWidth is the honest question: it is zero until a frame has actually
             been decoded, so the poster keeps the stage in every one of those cases. */
          if (!shown[index] && typeof video.requestVideoFrameCallback === 'function') {
            frameHandles.current[index] = video.requestVideoFrameCallback(() => {
              frameHandles.current[index] = null
              if (video.videoWidth > 0) markShown(index)
            })
          }
        } else {
          video.pause()
        }
      } else if (video.hasAttribute('src')) {
        /* Taking the source away stops the decoder. A paused clip left in the
           document would hold its decoded frames for the rest of the session. */
        video.removeAttribute('src')
        video.load()
      }
    }

    /* A pending frame callback belongs to the source it was armed for. Left
       pending it would fire against a video that has since been pointed somewhere
       else and would mark a frame as shown that never belonged to this file. */
    return () => {
      for (let index = 0; index < MOMENTS.length; index += 1) {
        const handle = frameHandles.current[index]
        const video = videos[index]
        if (handle === null || !video) continue
        if (typeof video.cancelVideoFrameCallback === 'function') {
          video.cancelVideoFrameCallback(handle)
        }
        frameHandles.current[index] = null
      }
    }
  }, [
    wanted,
    idle,
    ready,
    shown,
    markShown,
    active.requested,
    active.index,
    active.crossing,
    playback.variant,
    playback.paused,
    playback.stageVisible,
    playback.tabVisible,
  ])

  /* Bind the scroll values straight to inline styles.

     This is what a motion component does internally, and it is done here by hand
     for one reason: the values only ever drive `opacity`, and reaching for the
     component to get that costs about 36 KB of animation runtime in a bundle whose
     whole job is to follow a scroll position. The page measures LCP on the wordmark,
     and the wordmark cannot paint until this bundle has downloaded, parsed and run,
     so its size is not an abstract concern.

     One subscriber per value, created once, writing one property each: no React
     state, no re-render, and nothing measured from the DOM during a frame. The
     listeners are torn down with the effect, which is also what makes the Strict
     Mode double mount harmless. */
  useEffect(() => {
    const { layers, openingScrimEl, chapterScrimEl, veilEl, controlEl } = stageRefs.current
    const pairs: [MotionValue<number>, HTMLElement | null][] = [
      [opacities[0], layers[0]],
      [opacities[1], layers[1]],
      [opacities[2], layers[2]],
      /* The fourth moment. This line is the one that is easiest to forget when a
         moment is added: useLayerOpacities would return a fourth value, the fourth
         layer would still be in the document, and nothing would ever write to it,
         so it would sit at whatever the last frame of the third moment left on it
         and the walk would simply never appear. Written next to the other three so
         the count is visible. */
      [opacities[3], layers[3]],
      /* The opening's vignette is the element that fades as the chapter scrim
         arrives, and the two are the same pair of gradients read in opposite
         directions. */
      [chapterScrim, openingScrimEl],
      [openingScrim, chapterScrimEl],
      [veil, veilEl],
      /* The control is handled separately below, because it also has to stop being
         clickable once it has gone. */
    ]
    const stop = pairs
      .filter((pair): pair is [MotionValue<number>, HTMLElement] => Boolean(pair[1]))
      .map(([value, element]) => {
        /* Applied once up front as well as on change: a value that never fires
           still has to be on the element, and the opening's initial state is a
           value rather than an absence. */
        const write = () => {
          element.style.opacity = String(Number(value.get()))
        }
        write()
        return value.on('change', write)
      })

    /* The control goes away with the veil, and stops accepting clicks when it does:
       pointer events are not something a value can carry, so they are set here
       rather than instead of the opacity.

       The test reads "is it still visible", which is 1 while there is a video and 0
       once the veil has covered it, so the comparison is against the bottom of the
       range and not the top. */
    if (controlEl) {
      const syncControl = () => {
        const gone = Number(controlVisible.get()) < 0.02
        controlEl.style.opacity = gone ? '0' : '1'
        controlEl.style.pointerEvents = gone ? 'none' : ''
        /* Pointer events were the whole of the previous treatment, and that left a
           control that could not be clicked and could still be reached by Tab: a
           keyboard user scrolling to the end of the story tabbed into an invisible
           button and was offered "pause the video" over a page of sand.
           `visibility` takes it out of the tab order and out of the accessibility
           tree in one property, and it is set in the same tick as the opacity, which
           is already a step rather than a ramp. */
        controlEl.style.visibility = gone ? 'hidden' : 'visible'
        /* If focus was sitting on it when it went, focus has to go somewhere
           deliberate. Dropping it to the body would restart the Tab order from the
           top of the document, several screens above where the reader is. */
        if (gone && document.activeElement === controlEl) controlEl.blur()
      }
      syncControl()
      stop.push(controlVisible.on('change', syncControl))
    }
    return () => stop.forEach((off) => off())
  }, [opacities, openingScrim, chapterScrim, veil, controlVisible])

  return (
    <>
      <div className="story-stage" aria-hidden="true">
        {MOMENTS.map((moment, index) => {
          const clip = clipFor(index, playback.variant)
          return (
            /* Its opacity is written from the scroll value in the effect above, never from
               state: the stage follows the reader on the compositor and does not
               re-render while they scroll. */
            <div
              key={moment}
              className="story-layer"
              ref={(element) => {
                stageRefs.current.layers[index] = element
              }}
            >
              <img
                src={clip.poster}
                width={clip.width}
                height={clip.height}
                alt=""
                decoding="async"
                /* Only the opening poster competes for bandwidth; the other three are
                   fetched while the reader is still on the first moment. */
                fetchPriority={index === 0 ? 'high' : 'auto'}
                loading={index === 0 ? 'eager' : 'lazy'}
                onLoad={() => markReady(index)}
                /* A clip that cannot be decoded does not count as ready. The poster
                   stays underneath and carries the layer, which is the same state as
                   before the clip was ever requested. */
                onError={() => undefined}
                className="absolute inset-0 h-full w-full bg-[oklch(0.16_0.022_235)] object-cover"
              />
              <video
                ref={(element) => {
                  videoRefs.current[index] = element
                }}
                muted
                playsInline
                loop
                preload="none"
                tabIndex={-1}
                /* Fades in over its own poster on the first presented frame, so the
                   two are never visible as separate images. */
                className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-240 ease-[var(--ease-out)] motion-reduce:transition-none ${
                  shown[index] ? 'opacity-100' : 'opacity-0'
                }`}
                onPlaying={() => {
                  running.current += 1
                  syncRunning()
                  /* The fallback for browsers without requestVideoFrameCallback,
                     and only there: where the callback exists it is the one that
                     decides, and it decides later, on a frame rather than on an
                     intention. */
                  const video = videoRefs.current[index]
                  if (
                    video &&
                    typeof video.requestVideoFrameCallback !== 'function' &&
                    video.videoWidth > 0
                  ) {
                    markShown(index)
                  }
                }}
                onPause={() => {
                  running.current = Math.max(0, running.current - 1)
                  syncRunning()
                }}
                onError={() => markReady(index)}
              />
            </div>
          )
        })}

        {/* The two scrims, crossfaded on the first band's progress. Both are static
            gradients; only their opacity moves, which is a compositor-only property
            and reverses cleanly. Why two is written in index.css: the opening centres
            its text and the experience chapters put it in a left column, and one
            gradient cannot protect both. */}
        <div
          className="story-scrim story-scrim--opening"
          ref={(element) => {
            stageRefs.current.openingScrimEl = element
          }}
        />
        <div
          className="story-scrim"
          ref={(element) => {
            stageRefs.current.chapterScrimEl = element
          }}
        />

        {/* The veil: the page's own colour, rising over the video as the last moment
            finishes. It exists so the gallery and the closing are read against a
            surface rather than against a moving frame of grass, which is the one
            thing a gradient cannot promise — it can soften the lower edge of the
            video, but it cannot make the whole frame a known colour. */}
        <div
          className="story-veil"
          ref={(element) => {
            stageRefs.current.veilEl = element
          }}
        />
      </div>

      {/* The one element of the stage that is not decorative, so it cannot live
          inside the aria-hidden subtree: a control hidden from assistive technology
          is not a control.

          The fade is applied to the button itself rather than to a wrapper, and that
          is not a detail. An ancestor with opacity below 1 creates a stacking context,
          so the button, which is position: fixed with a z-index of its own, would be
          stacked inside that context and painted *under* the chapter text scrolling
          past above it — the control would be visible and unclickable at the same
          time. It stays in the document while it is faded, so nothing shifts. */}
      <PlaybackControl
        controlRef={(element: HTMLButtonElement | null) => {
          stageRefs.current.controlEl = element
        }}
        onToggle={playback.toggle}
        playing={anyPlaying}
        offered={wanted}
      />

      {children}
    </>
  )
}

/**
 * One control for the whole story: pause and resume.
 *
 * It is not a bar and it does not become one. It sits in the top corner, which is
 * the one region no chapter puts its text in, and keeps a 44 by 44 target at
 * every size. The accessible name carries the action rather than the state, so a
 * screen reader announces what pressing it will do.
 *
 * It says "di sfondo", and that word is doing real work now that the page contains
 * a second video. The gallery holds a clip somebody opens on purpose, and its own
 * control is announced as "Riproduci il video: <what it shows>". Two controls on
 * one page both called "Riproduci il video" is not a distinction a screen reader
 * user can act on: one of them starts the whole backdrop, the other plays one
 * thirteen-second clip. Naming the backdrop for what it is the difference.
 */
function PlaybackControl({
  onToggle,
  playing,
  offered,
  controlRef,
}: {
  onToggle: () => void
  playing: boolean
  offered: boolean
  controlRef: (element: HTMLButtonElement | null) => void
}) {
  const label = offered && playing ? 'Metti in pausa il video di sfondo' : 'Riproduci il video di sfondo'
  return (
    <button type="button" onClick={onToggle} ref={controlRef} className="story-control">
      {offered && playing ? (
        <Pause size={18} aria-hidden />
      ) : (
        <Play size={18} aria-hidden />
      )}
      <span className="sr-only">{label}</span>
    </button>
  )
}