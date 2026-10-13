/**
 * The render entry for `scripts/prerender.mjs`.
 *
 * It exists because `main.tsx` is a browser module. Its last statement reaches
 * for `document.getElementById('root')` and then calls `hydrateRoot`, which is
 * correct in a browser and impossible on a server — so importing it from the
 * prerenderer throws `ReferenceError: document is not defined` at import time,
 * before a single component has rendered.
 *
 * A separate entry is the fix rather than a `typeof document` guard inside
 * `main.tsx`. The guard would make the browser entry carry a branch that exists
 * only to satisfy a build script, and it would have to be reasoned about every
 * time the mount logic changed: the branch is exactly where a hydration mistake
 * would hide, and the failure mode is a page that quietly falls back to
 * client-rendering instead of hydrating.
 *
 * So this file renders `App` and exports it. `main.tsx` keeps the browser's
 * problem, this keeps the server's, and neither has to know about the other.
 */

import App from './App'
import { structuredDataJson } from './structuredData'

/** Rendered by the prerenderer into `dist/index.html`. */
export { App, structuredDataJson }
export default App