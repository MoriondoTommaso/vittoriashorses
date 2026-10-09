import { ArrowRight } from 'lucide-react'
import { experiences, opening, site } from '../content'
import { BrandLogo } from './BrandLogo'
import { useChapterRef } from './Story'

/**
 * The opening.
 *
 * A brand opening, not a marketing hero: the mark, one line, and nothing else. No
 * list of services, no pair of calls to action, no scroll cue, no badge. The
 * composition is centred because the mark is the subject, which is the one place
 * a centred composition is honest.
 *
 * The h1 is still here and it is still the only one on the page, even though what
 * it now shows is a picture. It wraps the mark, and the mark's own accessible text
 * supplies the name, so the page still has a heading a screen reader can announce
 * and a crawler can read. If the h1 were dropped along with the typeset wordmark,
 * the day the logo file failed there would be no name on the page at all, which is
 * the reason the name is never carried by the image alone.
 */
export function Opening() {
  /* Registered as chapter 0. It contributes no band of its own, but the first
     crossfade is measured against its panel, so it has to be in the list. */
  const register = useChapterRef(0)

  return (
    <section
      id="top"
      className="story-chapter story-opening on-media"
      data-chapter="opening"
      aria-labelledby="nome"
      ref={register}
    >
      <div className="story-panel story-panel--opening">
        {/* White on the stage, in both themes. The video is darkened by the
            opening's vignette, so it is a dark frame either way and a black mark
            here would be a black mark on black. */}
        <h1 id="nome" className="brand-logo-heading">
          <BrandLogo context="media" className="brand-logo--opening" />
        </h1>
        <p className="story-opening-line">{opening.line}</p>
        {/* The founding year is not published until the maneggio confirms it, so it
            is not rendered. The field stays in content.ts, gated by its own flag, so
            that confirming it is flipping one boolean rather than writing a
            component and hoping the string matches. `.story-opening-est` is the
            style it takes once it is. */}
        {site.establishedConfirmed ? (
          <p className="story-opening-est">{site.established}</p>
        ) : null}
      </div>
    </section>
  )
}

/**
 * The three activities.
 *
 * Same shape for each: a title that fits two lines, one sentence, one action. The
 * text sits in the free part of the frame rather than in a panel: the horse is on
 * the right of every desktop clip and the grass is at the bottom of every mobile
 * clip, so the column is on the left above 768 px and along the bottom below it.
 * The position follows the space in the video, which is why it does not alternate.
 */
export function StoryChapters() {
  return (
    <div id="esperienze">
      {experiences.map((experience, index) => (
        <Chapter key={experience.id} experience={experience} boundary={index + 1} />
      ))}
    </div>
  )
}

/* One chapter, registered with the measurement. Split out so the hook it calls is
   inside a component of its own rather than inside a map. */
function Chapter({
  experience,
  boundary,
}: {
  experience: (typeof experiences)[number]
  boundary: number
}) {
  const register = useChapterRef(boundary)
  const { cta } = experience
  /* A telephone link and a social link are different things and the markup says so.
     A `tel:` handed to `target="_blank"` does not open a dialler, it asks a browser
     to open a blank tab and hand it to nothing; and the words "su Instagram" under
     a phone number would be a plain false statement. So the suffix, the target and
     the rel all come from what the action actually is. */
  const external = cta.kind === 'social'

  return (
    <section
      id={experience.id}
      className="story-chapter on-media"
      data-chapter={experience.id}
      aria-labelledby={`${experience.id}-title`}
      ref={register}
    >
      <div className="story-panel">
        <h2
          id={`${experience.id}-title`}
          /* One title is three words longer than the others and wraps to three
             lines in a column sized for two. It gets its own size rather than
             shrinking every title to suit the longest one: the other two are
             already right, and a page where every heading is smaller because one of
             them is longer is a page where nothing is emphasised. */
          className={experience.tight ? 'story-title story-title--tight' : 'story-title'}
        >
          {experience.title}
        </h2>
        <p className="story-text">{experience.text}</p>
        <a
          href={cta.href}
          {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
          className="pill pill--media pill--cta story-cta"
        >
          {cta.label}
          <ArrowRight size={16} aria-hidden className="arrow" />
          <span className="sr-only">
            {external ? ` su ${cta.externalName} (si apre in una nuova scheda)` : ' (telefonata)'}
          </span>
        </a>
      </div>
    </section>
  )
}