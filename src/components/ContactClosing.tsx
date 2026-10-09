import { ArrowRight, MapPin } from 'lucide-react'
import { closing, contact, mediaNotice, site, social } from '../content'
import { BrandLogo } from './BrandLogo'

/**
 * The end of the journey: everything a visitor needs in order to write.
 *
 * The old page spent two sections on it, a first-contact block and a separate set
 * of questions, both sitting between the gallery and the contact details. Here
 * they are folded into the same block, in the order somebody actually needs them:
 * what this is, who they are, how to reach them, where it is, and then the small
 * print. One destination, one action, one place to look.
 *
 * Alberto's name is stated rather than implied. A telephone number with no name on
 * it is a number, and somebody deciding whether to ring has no way of knowing
 * whether it is a person, an answerphone or a farm; the name costs two words and
 * removes the question.
 */
export function ContactClosing() {
  const cta = closing.cta
  const ctaExternal = cta.kind === 'social'

  return (
    <section id={closing.id} className="section anchor" aria-labelledby="contatti-title">
      <div className="shell">
        <div className="closing-grid">
          <div>
            {/* Both of these carry data-reveal, and that is the whole contract: the
                hidden state is written by useReveal and keyed on this attribute.
                This heading used to carry the class without the attribute, which
                left it transparent for the length of the session with nothing to show
                for it. */}
            <h2 id="contatti-title" className="section-title" data-reveal>
              {closing.title}
            </h2>
            <p className="mt-5 max-w-measure text-lg leading-relaxed text-muted" data-reveal>
              {closing.text}
            </p>
            <a
              href={cta.href}
              {...(ctaExternal ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
              className="pill pill--solid pill--cta mt-8"
            >
              {cta.label}
              <ArrowRight size={16} aria-hidden className="arrow" />
              <span className="sr-only">
                {ctaExternal
                  ? ` su ${cta.externalName} (si apre in una nuova scheda)`
                  : ' (telefonata)'}
              </span>
            </a>
          </div>

          <div>
            <h3 className="label text-muted">Contatti</h3>
            {/* Who to ask, before how. It is one line and it is the difference
                between a list of links and an invitation. */}
            <p className="mt-4 text-lg leading-snug">
              Chiedi a <span className="font-semibold">{contact.person}</span>
            </p>
            <ul className="mt-4">
              {closing.links.map((link) => (
                <li key={link.label}>
                  {/* Only the links that leave the page say so, and only they open
                      a tab. A telephone number opens the dialler, which is not a
                      tab, so `target` on it is not a small inaccuracy: it asks the
                      browser for a window it will never use. */}
                  <a
                    href={link.href}
                    {...(link.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                    className="flex min-h-14 items-center justify-between gap-6 border-b border-line py-3 text-ink no-underline"
                  >
                    <span className="label text-muted">{link.label}</span>
                    <span className="font-semibold">{link.value}</span>
                    {link.external ? <span className="sr-only">(si apre in una nuova scheda)</span> : null}
                  </a>
                </li>
              ))}
            </ul>

            {/* The position. A readable address and one external link, which is
                everything a visitor needs and nothing more: an embedded map loads a
                third-party script, a frame and usually a consent banner on a page
                that is otherwise entirely first-party, and a pin on somebody else's
                map is a worse answer than their own pin. */}
            <div className="mt-8">
              <h3 className="label text-muted">Dove siamo</h3>
              {closing.location.confirmed && closing.location.address ? (
                <div className="mt-4 flex flex-wrap items-baseline gap-x-4 gap-y-2">
                  <p className="flex items-baseline gap-3 text-lg leading-snug">
                    <MapPin size={18} aria-hidden className="mt-1 shrink-0 text-accent" />
                    {closing.location.address}
                  </p>
                  {closing.location.mapsUrl ? (
                    <a
                      href={closing.location.mapsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="prose-link inline-flex min-h-11 items-center gap-2"
                    >
                      {closing.location.mapsLabel}
                      <span className="sr-only"> (si apre in una nuova scheda)</span>
                    </a>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
        </div>

        {/* The questions the old page gave a section of their own. A visitor who
            wants them opens this; a visitor who came to write does not scroll past
            four answers to reach the contact details. Native disclosure, so the
            keyboard, the screen reader and the no-JavaScript case are the
            platform's. */}
        <details className="closing-info">
          <summary>
            {closing.info.title}
            <span aria-hidden="true" className="marker">
              +
            </span>
          </summary>
          <div className="closing-info-body">
            <p className="max-w-measure leading-relaxed text-muted">{closing.info.lead}</p>
            <dl className="mt-8">
              {closing.info.items.map((item) => (
                <div key={item.question} className="border-t border-line py-5">
                  <dt className="text-lg font-semibold leading-snug">{item.question}</dt>
                  <dd className="mt-2 max-w-measure leading-relaxed text-muted">{item.answer}</dd>
                </div>
              ))}
            </dl>
          </div>
        </details>

        {/* The closing mark, then the small print. The mark is the same official file
            the opening uses, in the variant that matches the page surface rather
            than the one that matches the video: black on the light theme, white on
            the dark one, chosen by the browser before any script runs. The note
            underneath covers the videos, which are the only illustrative media left
            on the page. */}
        <div className="closing-signoff">
          <BrandLogo context="page" className="brand-logo--footer" />
          {mediaNotice ? (
            <p className="max-w-[52ch] text-xs leading-relaxed text-muted">{mediaNotice}</p>
          ) : null}
          <ul className="flex flex-wrap gap-x-8 gap-y-1 text-sm">
            <li>
              <a href={social.facebook} target="_blank" rel="noopener noreferrer" className="closing-link">
                Facebook
                <span className="sr-only"> (si apre in una nuova scheda)</span>
              </a>
            </li>
            <li>
              <a href={site.privacyUrl} className="closing-link">
                Privacy
              </a>
            </li>
          </ul>
        </div>
      </div>
    </section>
  )
}