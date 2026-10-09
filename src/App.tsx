import { useEffect } from 'react'
import { Story } from './components/Story'
import { Opening, StoryChapters } from './components/StoryChapters'
import { Gallery } from './components/Gallery'
import { ContactClosing } from './components/ContactClosing'
import { useReveal } from './hooks/useReveal'
import { closing, contact, site, social } from './content'

export default function App() {
  useReveal()
  useDeepLink()

  return (
    <>
      <a className="skip-link" href="#contenuto">
        Vai al contenuto
      </a>

      <main id="contenuto" tabIndex={-1}>
        {/* The story is its own container and ends after the last chapter. The
            gallery and the closing are siblings of it, not children.

            That is not a tidiness decision. The stage measures the scroll position
            of its own container and turns each chapter's text into a band, so
            anything inside that container is inside the measurement: with the
            gallery and the FAQ in here, opening "Informazioni utili" added the
            height of four answers to the bottom of the container, which moved every
            crossfade on the page, including the two that had already scrolled past.
            Now a disclosure three screens down cannot reach up and change what
            happened three screens ago. */}
        <Story>
          <Opening />
          <StoryChapters />
        </Story>

        <Gallery />
        <ContactClosing />
      </main>

      {/* Only confirmed data. The maneggio has confirmed a person, a telephone
          number, a street address and two profiles, and nothing else: no opening
          days, no prices, no coordinates, no reviews, no qualifications. Those are
          absent rather than approximated, because a LocalBusiness carrying an
          invented field is worse than an Organization carrying fewer.

          `LocalBusiness` and not `Organization`, because an address and a
          telephone number are what make this a place rather than a brand, and the
          street is carried as a PostalAddress because a place without one cannot
          be routed to. hasMap holds the link the maneggio supplied: a map URL is a
          fact about the place, where an embedded map would be a third-party frame
          on an otherwise first-party page. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@graph': [
              {
                '@type': 'LocalBusiness',
                name: site.name,
                description: site.description,
                url: 'https://vittoriashorses.it',
                /* E.164 without the scheme, which is the form schema.org defines.
                    Read from the one place the number is written, so the metadata
                    and the visible link cannot drift apart. */
                telephone: contact.phoneHref.replace('tel:', ''),
                address: {
                  '@type': 'PostalAddress',
                  streetAddress: 'Strada di Sabione 129',
                  addressLocality: 'Terni',
                  addressCountry: 'IT',
                },
                hasMap: closing.location.mapsUrl,
                sameAs: [social.instagram, social.facebook],
              },
              {
                '@type': 'WebSite',
                name: site.name,
                url: 'https://vittoriashorses.it',
                inLanguage: 'it',
              },
            ],
          }),
        }}
      />
    </>
  )
}

/**
 * Honours a fragment link that arrived before the page existed.
 *
 * The browser looks for the target once, when the document finishes parsing. On a
 * page whose content is rendered by React, the element named in the URL is not in
 * the document yet, so the lookup fails, the browser moves on, and the visitor who
 * asked for "#passeggiate" is left at the top of the opening with the address bar
 * promising something the page is not showing.
 *
 * So it is done again here, after the tree exists. `scrollIntoView` rather than
 * assigning scrollTop, because the sections carry scroll-margin-top for the sticky
 * header and only the former respects it; a hand-computed offset would land the
 * heading underneath the control.
 *
 * `requestAnimationFrame` twice, not once: the first frame is before the stage has
 * been measured and the exit runway has its height, and scrolling to a position
 * computed against the wrong document height is how the gallery ends up half a
 * screen off. The second frame is after.
 *
 * Only when there is a fragment, only once, and never for the skip link: that link
 * is handled natively because its target is in the first frame of the document.
 */
function useDeepLink() {
  useEffect(() => {
    const hash = window.location.hash
    if (!hash || hash === '#contenuto') return

    let cancelled = false
    const go = () => {
      if (cancelled) return
      const target = document.getElementById(decodeURIComponent(hash.slice(1)))
      if (!target) return
      target.scrollIntoView({ block: 'start' })
    }

    const frames = requestAnimationFrame(() => requestAnimationFrame(go))
    /* And once more after the fonts have settled, because the headings are set in
       a slab face that arrives after first paint and moves every section below it. */
    const fonts = (document as Document & { fonts?: FontFaceSet }).fonts
    fonts?.ready?.then(go).catch(() => undefined)

    return () => {
      cancelled = true
      cancelAnimationFrame(frames)
    }
  }, [])
}