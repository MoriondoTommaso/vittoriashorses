import { createContext, useCallback, useContext, type ReactNode } from 'react'
import { StoryStage } from './StoryStage'
import { useStageGeometry, type StageGeometry } from '../hooks/useStoryStage'

/**
 * How a chapter hands itself to the measurement.
 *
 * The chapters and the stage have to agree on one set of numbers: the stage fades
 * between the clips, and the chapters are what the fades are measured against. So
 * the geometry is created once, here, and passed down. Two measurements of the same
 * scroll would produce two sets of bands and the crossfades would sit in the wrong
 * place relative to the text.
 */
const GeometryContext = createContext<StageGeometry | null>(null)

/**
 * Registers a chapter and returns the ref callback to put on its element.
 *
 * The index is the position of the boundary the chapter ends: the opening is 0 and
 * contributes no band of its own, the first experience is 1 and ends the first
 * crossfade, and so on. Passing the index at the call site rather than deriving it
 * from a ref count keeps the mapping between a chapter and its boundary explicit.
 *
 * Every chapter has to be registered, including the opening. The opening is not a
 * band, but it is the reference the first band is measured against, so leaving it
 * out does not merely lose one boundary: it makes the first crossfade symmetric
 * about the new chapter's panel instead of stretched to clear the wordmark, which
 * is the one panel in the story that is a full screen tall.
 */
export function useChapterRef(index: number) {
  const geometry = useContext(GeometryContext)
  return useCallback(
    (element: HTMLElement | null) => {
      if (geometry) geometry.chapterRefs.current[index] = element
    },
    [geometry, index],
  )
}

/**
 * The story: one stage, then the content that scrolls over it, then a measured gap
 * so the journey can finish before the page begins.
 *
 * The stage comes first in the document and sits behind, the content comes after
 * and pulls itself up over it with a negative margin equal to the stage's height.
 * That is what makes the video stay put while the words move, with no second
 * stacking context and nothing that could go wrong at a particular width.
 *
 * The negative margin belongs to the stage, which is why it stops at the end of
 * this component: the gallery and the closing are outside, and the stage is gone by
 * the time either of them is on screen. Nothing about the page after the story can
 * be painted over the video, because nothing after the story is inside it.
 */
export function Story({ children }: { children: ReactNode }) {
  const geometry = useStageGeometry()

  return (
    <GeometryContext.Provider value={geometry}>
      <div id="racconto" ref={geometry.containerRef as React.RefObject<HTMLDivElement>}>
        <StoryStage geometry={geometry}>
          <div className="story-content" ref={geometry.contentRef}>
            {children}
            {/* Empty on purpose, and sized by the measurement rather than declared
                here: this is the scroll the last panel needs to leave, plus the
                dissolve, plus a short settle. See .story-exit. */}
            <div className="story-exit" ref={geometry.exitRef} aria-hidden="true" />
          </div>
        </StoryStage>
      </div>
    </GeometryContext.Provider>
  )
}