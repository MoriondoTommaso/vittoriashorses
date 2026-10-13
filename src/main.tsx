import { StrictMode } from 'react'
import { createRoot, hydrateRoot } from 'react-dom/client'
import App from './App'
import './index.css'

/**
 * Hydration, with a fallback.
 *
 * `scripts/prerender.mjs` writes the rendered tree into the document at build
 * time, so this has markup to attach to and uses `hydrateRoot`. Hydrating rather
 * than rendering is not an optimisation here, it is the mechanism: React adopts
 * the existing nodes instead of discarding them and building replacements, which
 * is what keeps the server-rendered document in place and what stops the page
 * from blanking while the bundle arrives.
 *
 * The fallback covers the two cases where there is nothing to attach to. `vite
 * dev` serves `index.html` straight from source, with no prerender step, so the
 * root really is empty and `hydrateRoot` would throw on the first node it tried
 * to adopt. Checking for children is therefore not defensive programming for an
 * imagined case; it is what keeps `npm run dev` working at all.
 *
 * Both paths render the same tree, so nothing about the page depends on which
 * one ran.
 */
const root = document.getElementById('root')!

const tree = (
  <StrictMode>
    <App />
  </StrictMode>
)

if (root.hasChildNodes()) {
  hydrateRoot(root, tree)
} else {
  createRoot(root).render(tree)
}