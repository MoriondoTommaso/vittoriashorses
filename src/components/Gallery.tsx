import { useCallback, useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Play, X } from 'lucide-react'
import { gallery, galleryNotice, social } from '../content'

/**
 * Eight photographs and one clip of the maneggio, composed.
 *
 * The layout is CSS Grid with every cell filled. Above 1024 px it is four columns:
 * the item that carries the section takes two of them across two rows and the other
 * eight fill what is left, which is twelve cells with nine in them. Between 768 and
 * 1023 the leading one goes the full width and the rest pair up. Below 768 it is
 * one column in the order they are declared, which is the order the lightbox walks.
 *
 * Only the leading cell is positioned by hand. Everything after it is placed by the
 * grid's own cursor, which walks past the two occupied columns of row one, fills
 * row one, fills row two, and then starts row three — so the composition holds for
 * a tenth item too, and no rule has to be written to say where item nine goes.
 * The earlier version named all five positions explicitly and would have needed
 * nine rules, of which the eighth would have been the one a future edit got wrong.
 *
 * Nothing is positioned absolutely and no cell is left empty, because both of those
 * are fragile in ways that show up as a gap at some width nobody tested.
 *
 * The crops are per photograph and declared with it rather than here. Nine portraits
 * cropped as one shape would either cut a head off a horse or leave a rider standing
 * in a field of sky, and the focal point that prevents it is a fact about the
 * picture, not about this component.
 *
 * The photographs carry no border, no shadow and no overlaid label. A frame around
 * an image says "this is a placeholder", and the sharp edge is what makes a
 * photograph and a button read as two different materials. The clip is the one
 * exception and does carry a mark, because a moving thing among nine still ones
 * that looks identical to them is a control the visitor has no reason to press.
 *
 * This section is outside the story. The video has become the page by the time any
 * of it is on screen, so the title can lead the way every other heading on this
 * page does, and a photograph can never arrive over a frame of grass.
 *
 * The lightbox is the platform's: <dialog> and showModal() give the top layer, the
 * focus trap, Escape, the scroll lock and the return of focus to whatever opened
 * it. The only thing left to write is the arrow keys, which no native dialog does.
 */
export function Gallery() {
  /* Which item is in the lightbox, or null when it is closed. */
  const [index, setIndex] = useState<number | null>(null)
  /* Thumbnails that failed, so a missing file costs one cell instead of the
     composition. The lightbox has its own state for the full-size file. */
  const [missing, setMissing] = useState<readonly string[]>([])
  const [fullState, setFullState] = useState<'loading' | 'ready' | 'failed'>('loading')
  /* The last photograph whose full-size file actually decoded, kept mounted while
     the next one loads. Without it, every arrow press unmounts the image and shows
     "Caricamento dell'immagine" over an empty panel, which is a worse answer than
     the one it replaces: the reader is looking at a picture they chose and it
     vanishes to announce the arrival of the one they just asked for.

     Photographs only. A clip has to unmount: keeping the previous one mounted to
     fade the next in would mean two videos decoding, and the one on its way out
     would keep playing its own audio underneath the one being opened. */
  const [decoded, setDecoded] = useState<(typeof gallery.items)[number] | null>(null)
  const dialogRef = useRef<HTMLDialogElement>(null)
  /* Whether the clip may start on its own when it is opened.

     Read on render rather than subscribed to, and consulted before play() rather
     than after: a refused autoplay is not an error to report, it is the preference
     working, and the control is right there for a visitor who wants the sound and
     the movement. A listener would only matter if somebody changed an operating
     system preference while the dialog was open, which is not a case worth a
     subscription that never gets cleaned up. */
  const motionAllows =
    typeof window === 'undefined' || !window.matchMedia('(prefers-reduced-motion: reduce)').matches

  const open = useCallback((i: number) => {
    setFullState('loading')
    setIndex(i)
    dialogRef.current?.showModal()
  }, [])

  const step = useCallback((delta: number) => {
    /* Reset here, not only in open. Resetting on open is not enough: a reader who
       walks to a second photograph after one failed would land on the failed state
       and be told the new picture is unavailable when it is merely still arriving,
       and nothing would ever load again. */
    setFullState('loading')
    setIndex((current) =>
      current === null ? current : (current + delta + gallery.items.length) % gallery.items.length,
    )
  }, [])

  const noteMissing = useCallback((id: string) => {
    setMissing((was) => (was.includes(id) ? was : [...was, id]))
  }, [])

  useEffect(() => {
    const element = dialogRef.current
    if (!element) return
    /* Nothing to reset on close: the browser hands focus back to the thumbnail
       that called showModal(). */
    const onClose = () => setIndex(null)
    /* The one thing a native dialog does not do. */
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        e.preventDefault()
        step(-1)
      } else if (e.key === 'ArrowRight') {
        e.preventDefault()
        step(1)
      }
    }
    element.addEventListener('close', onClose)
    element.addEventListener('keydown', onKey)
    return () => {
      element.removeEventListener('close', onClose)
      element.removeEventListener('keydown', onKey)
    }
  }, [step])

  /* The caption and the position travel together, so the label can never disagree
     with the frame above it. */
  const current =
    index === null
      ? null
      : { item: gallery.items[index], position: `${index + 1} di ${gallery.items.length}` }

  /* One sizes attribute for the whole set, derived from the layout rather than
     repeated per cell. The leading item is half the width of a four-column row
     above 1024 px and the full width below it; each supporting one is a quarter of
     the row or half of the pair. A wrong figure here costs a photograph at the
     wrong resolution, not a layout break, because the width and height attributes
     on the image are what actually reserve the box. */
  const sizes = (i: number) =>
    i === 0
      ? '(min-width: 1024px) 48vw, (min-width: 768px) 92vw, 92vw'
      : '(min-width: 1024px) 24vw, (min-width: 768px) 46vw, 92vw'

  return (
    <section id={gallery.id} className="section anchor" aria-labelledby="galleria-title">
      <div className="shell">
        <h2 id="galleria-title" className="section-title gallery-heading" data-reveal>
          {gallery.title}
        </h2>

        <div className="gallery-grid">
          {gallery.items.map((item, i) => {
            /* One image source for both members of the union, so the cell that
               shows a poster is not a second copy of the photograph cell with two
               fields renamed. The clip's file is not anywhere near here: nothing in
               this markup can reference it, which is what guarantees it is not
               requested until somebody opens the lightbox. */
            const image = item.type === 'photo' ? item.thumb : item.poster
            const isClip = item.type === 'video'
            return (
              <figure key={item.id} className={`gallery-cell gallery-cell--${i + 1}`}>
                <button
                  type="button"
                  onClick={() => open(i)}
                  className="gallery-frame"
                  /* The accessible name says what the control does and what it
                     shows, because a still and a clip are different things to ask
                     for and "Apri immagine" would be the wrong verb for one of
                     them. */
                  aria-label={
                    isClip
                      ? `Riproduci il video: ${item.caption.charAt(0).toLowerCase()}${item.caption.slice(1)}`
                      : undefined
                  }
                >
                  {missing.includes(item.id) ? (
                    /* The cell keeps its proportions and says what is missing. A
                       collapsed cell would pull the plates beside it up a line and
                       the section would read as broken rather than as one absent
                       item. */
                    <span className="gallery-fallback">
                      {isClip ? 'Video non disponibile.' : 'Fotografia non disponibile.'}
                      <span className="sr-only"> {item.type === 'photo' ? item.alt : item.description}</span>
                    </span>
                  ) : (
                    <>
                      <img
                        src={image.src}
                        srcSet={image.srcSet}
                        sizes={sizes(i)}
                        width={image.width}
                        height={image.height}
                        /* The button already names the action and the dialog carries
                           the full description, and the mark below is drawn rather
                           than read, so the image itself adds nothing to say. */
                        alt=""
                        loading="lazy"
                        decoding="async"
                        /* A focal point from the asset configuration, so a replacement
                           photograph can be framed without touching this file. The
                           clip's poster is centred: it is a frame of a moving
                           subject and there is no edge of it worth protecting. */
                        style={
                          item.type === 'photo'
                            ? { objectPosition: item.focalPoint }
                            : { objectPosition: '50% 40%' }
                        }
                        onError={() => noteMissing(item.id)}
                        className="h-full w-full object-cover"
                      />
                      {isClip ? (
                        /* Drawn, not read: the button's aria-label above already
                           says there is a video, and announcing a play glyph as
                           well is the same name twice. */
                        <span className="gallery-play" aria-hidden>
                          <Play size={18} />
                        </span>
                      ) : null}
                    </>
                  )}
                  <span className="sr-only">
                    {isClip
                      ? undefined
                      : `Apri immagine: ${item.caption.charAt(0).toLowerCase()}${item.caption.slice(1)}`}
                  </span>
                </button>
                <figcaption className="gallery-caption">{item.caption}</figcaption>
              </figure>
            )
          })}
        </div>

        {/* Printed only while at least one photograph still needs it.
            galleryNotice is derived from the provenance of the set, so a page whose
            photographs are all real says nothing about them rather than denying what
            is directly above this line. */}
        {galleryNotice ? (
          <p className="gallery-notice">
            {galleryNotice}{' '}
            <a
              href={social.instagram}
              target="_blank"
              rel="noopener noreferrer"
              className="prose-link"
            >
              Visita Instagram
              <span className="sr-only"> (si apre in una nuova scheda)</span>
            </a>
            .
          </p>
        ) : null}
      </div>

      <dialog
        ref={dialogRef}
        aria-label="Immagine della galleria"
        className="m-auto max-h-[100dvh] w-[min(64rem,100vw-2rem)] max-w-none rounded-panel border-0 bg-surface p-0 text-ink"
      >
        {current ? (
          <div className="flex max-h-[100dvh] flex-col">
            <div className="flex items-start justify-between gap-4 border-b border-line px-4 py-3 min-[480px]:px-6">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{current.item.caption}</p>
                <p className="mt-0.5 text-xs text-muted" aria-live="polite">
                  {current.position}
                </p>
              </div>
              <button
                type="button"
                onClick={() => dialogRef.current?.close()}
                className="-mr-2 grid h-11 w-11 shrink-0 place-items-center rounded-control border border-line-strong"
              >
                <X size={18} aria-hidden />
                <span className="sr-only">Chiudi l’immagine</span>
              </button>
            </div>

            {/* One region for the three states, and only one of them ever true. The
                status text is announced rather than drawn as a spinner, so the state
                exists for a screen reader and for anybody on a slow connection, not
                only for the eye. */}
            <div className="relative flex min-h-0 flex-1 items-center justify-center bg-[oklch(0.16_0.022_235)] p-2 min-[480px]:p-4">
              {current.item.type === 'video' ? (
                /* The clip.

                   Muted and with controls, which is the only combination that is
                   honest here: muted because the visitor did not ask for sound by
                   opening a picture of a paddock, and a dialog that starts making
                   noise unasked is the thing people close immediately; controls
                   because the sound is the point of keeping the audio track in the
                   first place, and a visitor who wants it presses one button.

                   The poster is set as the poster attribute rather than shipped as a
                   separate <img>, so the frame is on screen before the 3 MB has
                   arrived and there is no second element flashing in over it.

                   The description is the accessible name, because a <video> has no
                   alt attribute and without one a screen reader announces nothing
                   but "video". */
                <video
                  key={current.item.id}
                  src={current.item.src}
                  poster={current.item.poster.src}
                  width={current.item.width}
                  height={current.item.height}
                  controls
                  muted
                  playsInline
                  /* Started by hand rather than by the autoplay
                     attribute, so there is exactly one mechanism and it is the one
                     that consults the motion preference. Carrying both meant two
                     play() calls racing on every open, which is how a video ends up
                     with an InterruptedError in the console. A refusal is swallowed:
                     the controls are right there and a rejected promise is the
                     preference working, not an error. */
                  /* Stated rather than left to the browser's default, which is
                     "auto" on Safari and iOS and would download all three megabytes
                     before anybody pressed play. "metadata" is the honest amount for
                     an element that exists because a visitor opened it and is about
                     to press play anyway. */
                  preload="metadata"
                  onError={() => setFullState('failed')}
                  ref={(element) => {
                    if (!element || !motionAllows) return
                    void element.play().catch(() => undefined)
                  }}
                  aria-label={current.item.description}
                  className="max-h-[52dvh] w-auto max-w-full bg-transparent object-contain"
                />
              ) : (
                <>
                  {/* The previous photograph stays mounted underneath, dimmed, for
                      as long as the next one is arriving. It is never the wrong
                      picture to be holding: the caption above it has already
                      changed, and the photograph that is on screen is one the reader
                      chose from this same gallery.

                      object-contain, and never a crop: this is the one place on the
                      page where the whole photograph is the point. The cells crop
                      because a grid has to be a grid; here the reader asked for this
                      specific picture and a version of it with a head missing is not
                      the thing they asked for. */}
                  {decoded && decoded.type === 'photo' && fullState !== 'failed' ? (
                    <img
                      key={decoded.id}
                      src={decoded.full.src}
                      width={decoded.full.width}
                      height={decoded.full.height}
                      alt={decoded.alt}
                      aria-hidden={decoded.id !== current.item.id}
                      style={{ opacity: fullState === 'ready' ? 1 : 0.35 }}
                      className="max-h-[52dvh] w-auto max-w-full object-contain transition-opacity duration-200 ease-[var(--ease-out)] motion-reduce:transition-none"
                    />
                  ) : null}

                  {fullState === 'failed' ? (
                    <p className="absolute px-4 py-10 text-center text-media-text">
                      Immagine non disponibile.
                    </p>
                  ) : fullState === 'loading' && !decoded ? (
                    <p className="absolute px-4 py-10 text-center text-media-text" role="status">
                      Caricamento dell’immagine
                    </p>
                  ) : null}

                  {/* Loads off-screen and hands over when it has a frame. Not
                      `display: none`, which some browsers decline to decode at all. */}
                  <img
                    key={`load-${current.item.id}`}
                    src={current.item.full.src}
                    alt=""
                    aria-hidden
                    decoding="async"
                    onLoad={() => {
                      setDecoded(current.item)
                      setFullState('ready')
                    }}
                    onError={() => setFullState('failed')}
                    className="pointer-events-none absolute h-px w-px opacity-0"
                  />
                </>
              )}

              {/* Said for the clip too, and it is not a repeat. A photograph that
                  fails prints a message over a panel that would otherwise be blank,
                  and a clip that fails prints nothing at all: the poster resolves,
                  the play bar sits on it, and the reader is looking at a still
                  frame of a paddock with no way to tell "this will start if you
                  wait" from "this is gone". An empty stage is the one state nobody
                  can interpret. */}
              {current.item.type === 'video' && fullState === 'failed' ? (
                <p className="absolute px-4 py-10 text-center text-media-text" role="status">
                  Video non disponibile.
                </p>
              ) : null}
            </div>

            <div className="flex items-center justify-between gap-3 border-t border-line px-4 py-3 min-[480px]:px-6">
              <button type="button" onClick={() => step(-1)} className="pill pill--line min-h-11 px-4">
                <ChevronLeft size={16} aria-hidden className="shrink-0" />
                Precedente
              </button>
              <button type="button" onClick={() => step(1)} className="pill pill--line min-h-11 px-4">
                Successiva
                <ChevronRight size={16} aria-hidden className="shrink-0" />
              </button>
            </div>
          </div>
        ) : null}
      </dialog>
    </section>
  )
}