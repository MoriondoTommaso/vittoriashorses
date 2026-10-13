import { useEffect, useRef, useState } from 'react'
import { logo, site } from '../content'

/**
 * The official mark, in the two contexts it is used.
 *
 * Two variants exist as two separate files drawn as one shape, and this component
 * is the only place that knows which one to reach for. That matters because the
 * choice is not the same question as the device's theme:
 *
 *   `media` — over the video. The video is darkened by the opening's scrim in
 *   both themes, so the frame behind the mark is near black whichever theme the
 *   device is in, and only the white mark reads on it. This is why the opening
 *   does not follow the theme: a black logo over the darkened opening in light
 *   mode is a black mark on a black frame, and the site name simply vanishes.
 *
 *   `page` — on the page surface. Here the theme is the honest answer, and it is
 *   a `<picture>` with a `prefers-color-scheme` source so the right file is
 *   fetched rather than both and hidden: two marks in the document means the
 *   browser picks before a single byte of JavaScript has run.
 *
 * Neither file is recoloured with a filter. Inverting a mark with CSS is how an
 * official logo ends up subtly wrong on a screen nobody tested, and there is no
 * layout problem on this page that a second file does not already solve.
 *
 * If a file fails, the name is set in the site's own type in the same box. That is
 * not decoration: the mark is 700x848, so a broken file that collapsed its box
 * would drag the opening line with it, and the alternative — a hole where the name
 * should be — is the one failure this page can least afford.
 */
export type LogoContext = 'media' | 'page'

export function BrandLogo({
  context,
  className = '',
}: {
  context: LogoContext
  /** The caller's own class, which carries the size. Kept separate from the
      variant so a size is never half-decided between here and the stylesheet. */
  className?: string
}) {
  const [failed, setFailed] = useState(false)
  const ref = useRef<HTMLImageElement>(null)

  /* Adopt a mark that already failed.
     The document is prerendered, so the browser starts fetching the mark while the
     bundle is still downloading, and a file that is blocked or 404s has raised its
     `error` event before React attaches the handler below. Nothing then ever sets
     `failed`, the mark's box collapses, and the page loses the one thing this
     fallback exists to preserve: its name.

     `complete` is true for an image that finished loading *and* for one that
     failed, which is exactly why `naturalWidth` has to be consulted as well — it
     is 0 when there are no pixels, so it is what distinguishes a drawn mark from
     a hole. The same check the stage uses on its posters, for the same reason.

     `useEffect` rather than a check during render, because reading the DOM during
     render is not something React allows a component to do and doing it in a
     layout pass would make the first paint depend on an image load. */
  useEffect(() => {
    const image = ref.current
    if (image?.complete && image.naturalWidth === 0) setFailed(true)
  }, [])

  if (failed) {
    return (
      <span className={`brand-logo brand-logo--type ${className}`}>
        <span className="brand-logo__fallback">{site.wordmark}</span>
      </span>
    )
  }

  /* White in both cases, and deliberately: it is the mark for the dark stage and
     it is the img fallback on the page, where it covers every browser and every
     visitor whose theme is dark. The black file only ever arrives through the
     `<source>` below, so no path here can reach it by accident. */
  const source = logo.white
  const mark = (
    <img
      ref={ref}
      src={source.src}
      width={source.width}
      height={source.height}
      /* Empty on purpose. The name is carried by the text below and, on the
         opening, by the h1 that wraps this, so an alt here would announce the
         name twice to anybody using a screen reader. The image adds the drawing;
         it does not add a name. */
      alt=""
      decoding="async"
      onError={() => setFailed(true)}
      className="brand-logo__mark"
    />
  )

  return (
    <span className={`brand-logo ${className}`}>
      {context === 'page' ? (
        /* The dark mark is the light theme's mark. `media` on the source is the
           same query the CSS uses to pick the theme token, so the file and the
           colour of the page behind it can never disagree. */
        <picture>
          <source srcSet={logo.black.src} media="(prefers-color-scheme: light)" />
          {mark}
        </picture>
      ) : (
        mark
      )}
      <span className="sr-only">{site.wordmark}</span>
    </span>
  )
}