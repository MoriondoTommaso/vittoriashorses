import { useEffect } from 'react'

/**
 * One observer for the whole page: elements marked `data-reveal` are hidden when
 * this runs and shown the first time they are reached.
 *
 * The direction of the dependency is the whole point. The stylesheet's hidden state
 * hangs off `[data-shown='false']`, an attribute only this hook ever writes, and
 * only after it has found the element. So the worst case for anything going wrong
 * here is a block that arrives without animating. The worst case with the usual
 * arrangement, where the stylesheet decides on its own that a class starts
 * transparent, is a heading that is invisible for the rest of the session because
 * of one wrong attribute name, with nothing in the console to explain it. That is
 * what a `.reveal` class with no matching `data-reveal` did here.
 *
 * Three escape hatches, in order of how early they fire:
 *
 *   - no IntersectionObserver: everything is shown at once, immediately.
 *   - reduced motion: nothing is hidden in the first place.
 *   - a 1.5s deadline: anything still waiting is shown anyway, which covers an
 *     element that is inside a subtree the observer cannot measure yet.
 */
export function useReveal() {
  useEffect(() => {
    const targets = Array.from(document.querySelectorAll<HTMLElement>('[data-reveal]'))
    if (!targets.length) return

    const show = (element: HTMLElement) => {
      if (element.dataset.shown === 'true') return
      element.dataset.shown = 'true'
    }

    /* No script-driven hiding without a way to un-hide it. */
    const settle = () => {
      for (const element of targets) show(element)
    }

    if (typeof IntersectionObserver === 'undefined') {
      settle()
      return
    }
    const motion = window.matchMedia?.('(prefers-reduced-motion: reduce)')
    if (motion?.matches) {
      settle()
      return
    }

    /* Hidden only now, with the observer already standing by. */
    for (const element of targets) element.dataset.shown = 'false'

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue
          show(entry.target as HTMLElement)
          io.unobserve(entry.target)
        }
      },
      /* Slightly early, so the block has finished arriving by the time it is
         comfortably on screen. */
      { rootMargin: '0px 0px -8% 0px' },
    )
    for (const element of targets) io.observe(element)

    /* A deadline for the observer having missed something, and only for that.

       It re-shows a target that is on screen and still hidden, which is the one
       failure an observer can have: an element inside a subtree that was not
       measurable when it was observed. It deliberately does not show everything,
       because showing everything is what a blanket timeout does, and the effect of
       that is that every entrance on the page has already happened before the
       reader has scrolled anywhere. A visitor who lingers on the opening for two
       seconds would arrive at the gallery to find it standing in full view, which is
       not a reveal at all.

       The observer's own first callback covers the ordinary case, since it reports
       every target it is watching, intersecting or not. */
    const deadline = window.setTimeout(() => {
      for (const element of targets) {
        if (element.dataset.shown === 'true') continue
        const box = element.getBoundingClientRect()
        if (box.top < window.innerHeight && box.bottom > 0) show(element)
      }
    }, 1500)

    return () => {
      window.clearTimeout(deadline)
      io.disconnect()
      settle()
    }
  }, [])
}