/**
 * The entry `scripts/build-metadata.mjs` compiles.
 *
 * It exists so the build produces one bundle that can be imported from Node,
 * rather than this script having to know about two separate modules and two
 * separate compilations.
 *
 * Everything re-exported here is derived from `content.ts`, which is the only
 * place the site's data is written down. `structuredData` and `headMeta` both
 * read from it, so a change to the phone number or the address reaches the JSON-LD,
 * the social cards, `llms.txt` and the rendered page together — or not at all.
 */

export { structuredData, structuredDataJson, llmsTxt } from './structuredData'
export { headTags, iconTags, pages } from './headMeta'
export { privacyHtml, privacySections, privacyNeedsConsent } from './privacy'
export { absolute, siteOrigin } from './content'