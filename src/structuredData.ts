/**
 * The structured data, in one place.
 *
 * This module is the reason the site is legible to an AI answer engine.
 *
 * The page renders its entire body with React, which means a crawler that does
 * not execute JavaScript receives a document containing `<div id="root"></div>`
 * and nothing else: no headings, no telephone number, no address, no questions.
 * Google Search renders JavaScript and recovers the page. Most answer engines do
 * not — they fetch, parse and index what arrived. For those, this file is the
 * entire visible site.
 *
 * So it is built in two independent ways from one source:
 *
 *   - `scripts/prerender.mjs` renders this module's output into the static HTML
 *     at build time, so the shipped document carries the JSON-LD regardless of
 *     scripting.
 *   - `App.tsx` still emits it at runtime for the client-rendered path.
 *
 * Both read the same exported object, so they cannot disagree. The values come
 * from `content.ts`, which is the same place the visible page reads them, so the
 * metadata and the page cannot drift apart either.
 *
 * What is deliberately absent: aggregateRating, openingHours, priceRange, and
 * every other field the maneggio has not confirmed. A LocalBusiness carrying an
 * invented field is worse than one carrying fewer, and `contact.ts` is the only
 * place such a value may enter the site.
 */

import {
  absolute,
  closing,
  contact,
  experiences,
  location,
  media,
  pendingFacts,
  site,
  siteOrigin,
  social,
} from './content'

/** The one image a card, a search result and an answer engine can all use. */
const shareImage = absolute(media('og.webp'))

const telephone = contact.phoneHref.replace('tel:', '')

/**
 * The local business.
 *
 * Only confirmed facts, plus the two that are true by construction:
 *
 *   - `areaServed`, because the address is in Terni and the page is about a
 *     place in Terni. This is not new information, it is the address restated
 *     in the vocabulary a search engine queries against.
 *   - `image`, because `og.webp` is a file that exists on this origin.
 *
 * `geo` and `openingHoursSpecification` are gated on `pendingFacts`. They are
 * the two fields a local ranking leans on hardest, which is exactly why they
 * are not invented to fill them. */
const localBusiness = () => {
  const node: Record<string, unknown> = {
    '@type': 'LocalBusiness',
    '@id': `${siteOrigin}/#business`,
    name: site.name,
    description: site.description,
    url: `${siteOrigin}/`,
    /* E.164 without the scheme, which is the form schema.org defines. Read from
       the one place the number is written, so the metadata and the visible link
       cannot drift apart. */
    telephone,
    address: {
      '@type': 'PostalAddress',
      streetAddress: location.streetAddress,
      addressLocality: location.addressLocality,
      addressRegion: location.addressRegion,
      addressCountry: location.addressCountry,
    },
    areaServed: {
      '@type': 'City',
      name: location.addressLocality,
    },
    image: shareImage,
    hasMap: closing.location.mapsUrl,
    sameAs: [social.instagram, social.facebook],
  }

  /* Absent rather than empty. An `openingHoursSpecification` of `[]` tells a
     consumer the business is closed all year, which is a claim; omitting the
     property tells it the information is not published, which is true. */
  if (pendingFacts.geo.confirmed && pendingFacts.geo.latitude != null) {
    node.geo = {
      '@type': 'GeoCoordinates',
      latitude: pendingFacts.geo.latitude,
      longitude: pendingFacts.geo.longitude,
    }
  }

  if (pendingFacts.openingHours.confirmed && pendingFacts.openingHours.days.length) {
    node.openingHoursSpecification = pendingFacts.openingHours.days.map((day) => ({
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: `https://schema.org/${day}`,
      opens: pendingFacts.openingHours.opens,
      closes: pendingFacts.openingHours.closes,
    }))
  }

  return node
}

/**
 * The three activities, as services.
 *
 * `Service` rather than three more `LocalBusiness` nodes: these are things the
 * maneggio does, not places it is. The description is the sentence the page
 * already shows, which is the whole point — an answer engine quoting a service
 * description is quoting the ranch's own words rather than a paraphrase of them.
 *
 * `areaServed` repeats on each one because the question an engine is usually
 * answering is "lecciones de equitazione near me", and the service node is where
 * that pairing is legible. */
const services = (): unknown[] =>
  experiences.map((experience) => ({
    '@type': 'Service',
    '@id': `${siteOrigin}/#${experience.id}`,
    name: experience.title,
    description: experience.text,
    serviceType: experience.title,
    url: absolute(`/#${experience.id}`),
    provider: { '@id': `${siteOrigin}/#business` },
    areaServed: { '@type': 'City', name: location.addressLocality },
  }))

/**
 * The four questions, as a FAQ.
 *
 * These are already written, already factual, and already on the page in a
 * `<details>` disclosure. They are the highest-value structured data on this
 * site for the cost of copying them into a second shape, because a question and
 * an answer written in the plain words a person would use is close to the exact
 * string a retrieval system matches a query against.
 *
 * `@id` on each question is not decoration. It lets an engine attribute the
 * answer to the specific page rather than to the site, which is the difference
 * between being quoted and being paraphrased.
 *
 * Note what is absent: no price, no duration, no age requirement, no claim about
 * what is included. The maneggio has not confirmed those, and a FAQ answer that
 * invents them is the most likely way for an answer engine to state something
 * false in the ranch's voice. */
const faq = () => ({
  '@type': 'FAQPage',
  '@id': `${siteOrigin}/#faq`,
  mainEntity: closing.info.items.map((item) => ({
    '@type': 'Question',
    name: item.question,
    acceptedAnswer: {
      '@type': 'Answer',
      text: item.answer,
    },
  })),
})

const website = {
  '@type': 'WebSite',
  '@id': `${siteOrigin}/#website`,
  name: site.name,
  description: site.description,
  url: `${siteOrigin}/`,
  inLanguage: 'it-IT',
  publisher: { '@id': `${siteOrigin}/#business` },
}

const webPage = {
  '@type': 'WebPage',
  '@id': `${siteOrigin}/#webpage`,
  url: `${siteOrigin}/`,
  name: site.name,
  description: site.description,
  inLanguage: 'it-IT',
  isPartOf: { '@id': `${siteOrigin}/#website` },
  about: { '@id': `${siteOrigin}/#business` },
  primaryImageOfPage: { '@id': `${siteOrigin}/#primaryimage` },
  primaryImage: {
    '@id': `${siteOrigin}/#primaryimage`,
    url: shareImage,
    width: 1200,
    /* The file's real height, which is 628 and not the 630 that a 1.91:1 crop
       would give. Declaring 630 described a file that does not exist. */
    height: 628,
  },
}

/**
 * The whole graph.
 *
 * `@graph` rather than a bare node because the references between these are
 * genuine: the services point at the business, the FAQ points at the page, the
 * page points at the image. Written as separate top-level objects those
 * references become repeated literals that can fall out of step; as a graph
 * each is written once.
 */
export function structuredData() {
  return {
    '@context': 'https://schema.org',
    '@graph': [localBusiness(), website, webPage, faq(), ...services()],
  }
}

/** The graph serialised for a `<script type="application/ld+json">` element. */
export function structuredDataJson(): string {
  return JSON.stringify(structuredData())
}

/**
 * The same graph as a Markdown summary for `llms.txt`.
 *
 * Separate from the JSON-LD on purpose. `llms.txt` is read by a language model
 * that wants prose, and handing it a JSON document is handing it a document it
 * has to parse before it can answer with it. The facts are identical; only the
 * shape differs. Every value here is read from the same fields, so the two
 * cannot claim different things.
 */
export function llmsTxt(): string {
  const lines: string[] = [
    `# ${site.name}`,
    '',
    `> ${site.tagline}.`,
    '',
    'A horse riding stable in Terni, Umbria. Addestramento e doma, lezioni di',
    'equitazione and passeggiate a cavallo. Contact:',
    `${contact.person}, ${contact.phone}.`,
    '',
    '## Contact',
    '',
    `- Address: ${location.address} (${location.addressRegion}, Italia)`,
    `- Phone: ${contact.phone}`,
    `- Email: none published. Requests are taken by phone or Instagram message.`,
    `- Instagram: ${social.instagram}`,
    `- Facebook: ${social.facebook}`,
    `- Map: ${closing.location.mapsUrl}`,
    '',
    '## Services',
    '',
  ]

  for (const experience of experiences) {
    lines.push(`### ${experience.title}`, '', experience.text, '')
  }

  lines.push(
    '## How to enquire',
    '',
    closing.text,
    '',
    'There is no booking form and no booking flow on this site. Enquiries and',
    'arrangements are made directly with the stable, by phone or by message on',
    'Instagram. A message does not confirm a booking.',
    '',
    '## Common questions',
    '',
  )

  for (const item of closing.info.items) {
    lines.push(`### ${item.question}`, '', item.answer, '')
  }

  lines.push(
    '## Notes on this information',
    '',
    '- No prices, opening days, opening hours, qualifications or reviews are',
    '  published, because the stable has not stated them.',
    '- The gallery photographs and the gallery video are of the real maneggio.',
    '  The four background videos illustrate the activities and are not footage',
    '  of the stable.',
    '',
    `- Privacy: ${siteOrigin}/privacy.html`,
    '',
  )

  return lines.join('\n')
}