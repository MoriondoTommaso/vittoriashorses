# Vittoria's Horses

One page, no router, no store. Vite + React 18 + TypeScript + Tailwind 3, published
as static files on GitHub Pages, served at `vittoriashorses.it`.

The page is one continuous journey rather than a set of sections: a horse moves
from standing to walk to trot to gallop across a single shared video stage, and then
the maneggio and the contacts arrive on the same surface the video has just become.
There is no header, and no visual break anywhere in it.

The conversion is a call to Alberto or a message on Instagram. The site does not
take bookings and does not pretend to.

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # typecheck, then production build into dist/
npm run preview    # serve dist/
```

`vite.config.ts` sets `base: './'`, so the build works from a root domain or
from a project subpath. Both `index.html` and `privacy.html` are entry points
and both end up in `dist/`.

## Publishing

Push to `main`. `.github/workflows/deploy.yml` builds and deploys to GitHub
Pages; there is no `dist/` branch and no committed build output.

The build runs on the runner rather than publishing a committed `dist/`,
because the published media is already in `public/media/` and a second copy of
32 MB of assets would exist only to be uploaded again on every push. For the
same reason the workflow needs no `ffmpeg` and no `cwebp`: it runs `npm ci` and
`npm run build`, nothing else. The typecheck is inside `npm run build` because
that is where it lives locally, and a deploy that skipped the check the
developer runs would not be the same deploy.

The repository tracks only what the build reads: `src/`, `public/`, the two
entry points, the four config files and `package.json`. `videos/`,
`maneggio_pictures/` and `logo/` are the inputs of the two build scripts, and
`figure/` and `assets/` are from the earlier version; excluding them takes the
repository from 165 MB to 30 MB and changes not one byte of `dist/`, which was
verified by building from a clean checkout and diffing. The consequence is
stated rather than hidden: **`npm run media` and `npm run gallery` do not run
from a fresh clone.** That is deliberate, because regenerating the published
media is an act on a working copy, not something a deploy does, but it does
mean the originals in `videos/` and `maneggio_pictures/` have to be kept
somewhere safe. They are not in this repository.

The checks under `npm run review:*` are local and are not part of the deploy.
Playwright and Lighthouse would add minutes and a class of failure to a site
that has not changed. All four take a base URL, so they can be pointed at the
deployed site rather than at `npm run preview`:

```bash
npm run review https://moriondotommaso.github.io/vittoriashorses/
```

## The page

One continuous journey with no header. A single sticky stage carries the video
for the whole story, and the story ends before the page begins.

```
#racconto      the story                   the stage, the four chapters, the exit
#top             Vittoria's Horses        the mark, one line, the clip at rest
#esperienze      the three activities     one title, one sentence, one action each
#addestramento   Addestramento e doma     passo, a telephone call rather than a message
#lezioni         Lezioni di equitazione    trotto, text in the free left third
#passeggiate     Passeggiate a cavallo    galoppo, same treatment, no alternation
#galleria        Il maneggio              the title, then eight photographs and one clip
#contatti        Vieni a conoscerci       Alberto, contacts, position, mark, small print
  #prima-di-venire  Informazioni utili    one <details>, folded into the closing
```

The gaits are in the order a horse moves in them, and that order is the point: a
reader who scrolls the whole page watches the horse change speed rather than watch
four unrelated clips replace one another.

`#racconto` contains the stage and the chapters and nothing else. The gallery and
the closing are **siblings** of it, not children, and that is load-bearing rather
than tidier: the stage measures the scroll position of its own container and turns
each chapter's text into a crossfade band, so anything inside that container is
inside the measurement. With the gallery and the FAQ in there, opening
"Informazioni utili" added the height of four answers to the bottom of the
container and moved every crossfade on the page, including the two that had
already scrolled past.

Inside `#racconto`, after the last chapter, there is one empty measured element:
`.story-exit`, the runway the journey needs to finish. Its height is written by
`useStoryStage` rather than declared in CSS, because it is solved from where the
last panel's bottom edge actually lands. The order it buys is: the panel is
readable, the panel leaves the viewport, the veil finishes rising, and only then
does the first photograph arrive.

There is no navigation bar, and none of these ids are links. They are deep-link
targets, kept so an old URL still lands in the right place.

### The mark

The opening shows the official mark, which is 700×848 and therefore vertical. It
cannot inherit the dimensions of the typeset wordmark it replaced: its width is the
only number worth choosing and its height follows from the ratio.

Two files, drawn as one shape in two inks, and the choice follows the surface behind
the mark rather than the device's theme — because on this page the two are not the
same thing. The opening sits on a video the scrim has darkened, which is dark in
both themes, so it takes the white file in both; a black mark over the opening in
light mode is a black mark on a near-black frame. The footer sits on the page,
where the theme *is* the honest answer, so it is a `<picture>` with a
`prefers-color-scheme` source and the browser fetches one file rather than both.
Neither is recoloured with a filter.

The `h1` is still here and is still the only one on the page, even though what it
shows is a picture. The name lives in text beside the mark rather than in its `alt`,
so a screen reader announces the name once and a crawler can read it, and if the
file ever 404s the component falls back to the name set in the site's own type, in
the same box, so the opening does not lose its height either. That is a check, not
an intention: `fallbacks.mjs` blocks both marks and asserts the page is still named.

The mark is the LCP element, and being an SVG it cannot be discovered until the
bundle has downloaded, parsed and run. It is preloaded from `index.html` for the
same reason the opening poster is: without the preload LCP measured 3.45 s, with it
2.35 s, which equals FCP. See "The bundle" below.

### Why one stage and not four video sections

Four independent video sections each create, play and destroy their own element,
and every boundary between them is a moment where the background is briefly
nothing. One shared stage has no boundary: the four layers are stacked for the
whole journey and the clips crossfade between them, so at no point does the
background not exist.

The cost is that the text and the crossfade have to be measured against each
other rather than laid out independently. `useStageGeometry` measures where each
chapter's text comes to rest and puts the fade there, so a moment's words and its
own clip arrive together. It is measured rather than hardcoded because every
chapter is allowed to grow: a short screen, or a long Italian word in a narrow
column, makes one taller, and a fixed boundary would then put the fade in the wrong
place relative to the text being read.

### The two families

`Alfa Slab One` for the brand voice (`h1`, `h2`, the three primary actions) and
`Plus Jakarta Sans` for everything that is read rather than announced (body, `h3`,
labels, controls, the FAQ). Both are self-hosted latin WOFF2 in `src/fonts`, about
39 KB together, with their OFL licences beside them, and both are preloaded from
`index.html`: the opening line is the first slab text painted, and neither face can
be discovered before the stylesheet has downloaded.

The slab has one weight and nothing applies another to it. It is set in caps with
positive tracking, more of it on the small button labels than on the 56px titles,
and each role has its own scale rather than sharing one ramp: an activity title, a
section title and a button label are three different jobs.

### The scroll values

`useScroll` gives one progress value; `useTransform` derives every opacity from
it. They are written straight to inline styles by one subscriber per value,
rather than through `motion.div`.

That is deliberate and it is the one place this page does not use the library's
component. The values only ever drive `opacity`, and reaching for the component to
get that costs about 36 KB of animation runtime in a bundle whose entire job is to
follow a scroll position — and the mark is the LCP, so it cannot paint until this
bundle has downloaded, parsed and run. Nothing is measured from the DOM during a
frame, no React state is written per frame, and `review.mjs` counts the DOM
mutations across a full scroll sweep to keep it that way.

Adding a moment is a four-place edit, and the count is written out by hand in each
of them on purpose: `MOMENTS` in `useStoryStage.ts`, the fourth `useTransform` in
`useLayerOpacities`, the fourth `[opacities[3], layers[3]]` pair in `StoryStage`'s
binding effect, and the `momentOf` map in `contrast.mjs`. Miss one and the page
still builds and still passes most checks; what surfaces is a moment that never
fades in, or a chapter measured against its neighbour's clip.

## The clips

Eight files: four moments, each in a 16:9 and a 9:16 crop. The source is chosen
with `matchMedia`: mounting two elements and hiding one with CSS would download
both. The breakpoint is read before the first paint, not in an effect, because an
effect would assign the desktop clip first and then immediately replace it.

The poster is in the document before a source is assigned, and the mark is painted
before the clip is even requested. A visitor who never sees a frame still gets the
name. The clip waits for `requestIdleCallback`: it is around 2 MB and the poster is
under 50 KB, and asking for the decorative half first spends the connection on the
wrong thing. The next clip is requested about a screen of scroll before its fade
opens, so at most two are ever decoding.

| state | behaviour |
| --- | --- |
| poster | image visible, name and text live |
| playing | clip visible, control reads "Metti in pausa il video" |
| paused by the visitor | frame held, control reads "Riproduci il video", and it stays paused across chapters |
| autoplay refused | poster stays, the control starts it explicitly |
| reduced motion / save-data | no request at all until the control is used |
| offscreen or hidden tab | paused, and resumed only if the visitor had not paused |
| no H.264, or media error | poster stands, no error in the layout |

### Loops

`scripts/build-media.mjs` builds the published clips and prints a measurement for
each one. Run it after replacing anything in `videos/`.

**None of the originals loops.** Frame 0 and the last frame differ by 3.7 to
11.8 dB PSNR, while ordinary frame-to-frame motion in the same clip sits at 6.9 to
29 dB — so on a ten second loop that is a visible jump cut, repeated forever.

The fix crossfades the last 0.625 s into the first 0.625 s, so the dissolve
straddles the loop point instead of ending on the frame the loop jumps back to.
Afterwards every seam measures at or above its own clip's motion floor, which is
the test that matters: not "the seam is gone" but "the seam is indistinguishable
from the shot". Each clip loses 0.625 s of runtime.

The script also strips the audio track, which is silent and would otherwise cost
about a fifth of the file, and enables fast start.

> The measurement uses the `psnr` filter, not `ssim`. `ssim`'s parenthesised
> figure is derived from its structural similarity term rather than from the mean
> squared error, so it is not on the same scale as any other PSNR and cannot be
> compared against a motion floor measured elsewhere. The `psnr` filter reports
> `inf` for a frame against itself, which is the control that shows the harness is
> measuring what it claims to.

## Colour, type and motion

Semantic tokens live in `src/index.css`, not in the Tailwind config, so the
React page and the static `privacy.html` read the same values and both follow
`prefers-color-scheme`. One accent, forest green, light in the dark theme.

> The tokens are plain `var()` references, and that has a consequence worth
> remembering: **Tailwind silently drops the `/opacity` modifier on a `var()`
> colour.** `bg-ink/10` emits nothing at all. Translucency is baked into the
> token (`--line`) or spelled with `color-mix()` in the stylesheet.

Motion has three jobs and nothing else: atmosphere (the backdrop), narration
(the scroll-driven crossfade), feedback (press, arrow, dialog). Every animation
runs once, or follows scroll, or is a transition that can be retargeted
mid-flight. Nothing animates height, top or width.

`prefers-reduced-motion` takes the movement out and nothing else: the order, the
words, the actions and the layout are identical. The crossfade becomes a step, so
the picture changes with the chapter instead of during it; the autoplay does not
happen and the control offers it explicitly; the reveal does not hide anything.

The reveal is hidden by an attribute JavaScript writes, not by a class the
stylesheet interprets: `[data-shown='false']`. The direction matters. A rule saying
"anything with `.reveal` starts transparent" makes the content depend on a script
running *and* on that script having found the element, and the failure mode is a
heading that is invisible for the rest of the session with nothing in the console.
That is exactly what happened to "Vieni a conoscerci", which carried the class
without the attribute. With the attribute, the worst case for anything going wrong
is a block that arrives without animating.

The scrims are static gradients and only their opacity moves. That is not only a
performance point: animating a gradient's colours or a filter is work the
compositor cannot do on its own, and a scrim that shifted between chapters would
read as a flicker on a stage where all four clips are the same field under the
same light.

There are two scrims, because the opening centres its text and the experience
chapters put it in a left column, and one gradient cannot protect both. They are
crossfaded on the first band's progress, so the change of scrim is part of the
change of moment rather than an event of its own. Their strength is set by
measurement: see the contrast note below.

## Photography and video

Sources are kept, published assets are separate.

- `logo/` holds the official mark, black and white, untouched.
- `maneggio_pictures/` holds the nine items of the gallery — eight photographs and
  one clip — untouched.
- `figure/` holds six generated plates from the earlier version. Nothing on the site
  uses them any more; they are kept because each carries a hard exposure seam where
  two generations were blended, and that seam is the reason a naive replacement
  photograph can look worse than a repaired one.
- `videos/` holds the eight original story clips, untouched.
- `public/media/` holds what the browser actually downloads.

| slot | source | provenance |
| --- | --- | --- |
| opening, and the backdrop of the whole story | `fermo`, animated | illustrative |
| training chapter | `passo`, animated | illustrative |
| lessons chapter | `trotto`, animated | illustrative |
| rides chapter | `galoppo`, animated | illustrative |
| gallery, dominant | `maneggio_pictures/im3.jpeg` | **official** |
| gallery, clip | `im9.mp4` | **official** |
| gallery, seven stills | `im1`, `im5`, `im2`, `im4`, `im8`, `im6`, `im7` | **official** |

The gallery is entirely real, photographs and clip both. The four backdrop clips are
not, and the page says exactly that and nothing more: the gallery has no notice at
all, and the small print at the end carries one clause naming the *background*
videos specifically.

That split is derived rather than written. `provenance` is per item and per clip,
and each notice appears if and only if its own set still needs it — so real
photographs arriving did not make the backdrop clips real, adding a generated
photograph among the nine would produce a sentence about that one rather than a
blanket claim about all of them, and the wording says which videos it means rather
than "the videos", because one of them is a real recording of the maneggio sitting
directly above the sentence.

The four story clips are the same field and the same horse at four gaits, which is
what lets one stage carry all four moments: the light does not change between them,
so a scrim that stays still does not read as a mistake.

The photographs carry a focal point each, declared next to the photograph rather
than in the stylesheet. Nine portraits cropped as one shape would either cut a head
off a horse or leave a rider standing in a field of sky, and the crop that protects
a face is a fact about that picture and not about the grid. In the lightbox the
photographs are shown whole: the cells crop because a grid has to be a grid, but the
reader asked for that specific picture there.

### The one clip in the gallery

`im9.mp4` is 576×1024 and thirteen seconds, and it is not a fifth story moment and is
not going to become one. The stage is 16:9 on every desktop, so a portrait clip there
is pillarboxed or cropped out of shape; in the gallery the frame is the clip's own
shape and it is fetched only when somebody chooses it. It is the only `<video>` in
the grid markup that does not exist — the poster is an image, the file is not
referenced anywhere outside the dialog, and `review.mjs` asserts both that no video
element exists until the dialog opens and that the 3 MB is on the wire once it does.

Two decisions that differ from the story clips, both for the same reason:

- **It keeps its audio.** The story clips autoplay muted as atmosphere, so a track is
  bytes nobody can hear. This one is opened deliberately and can be unmuted, and
  measured, the track costs 162 kB on 3.2 MB.
- **It does not get the seamless-loop crossfade.** That processing exists because the
  story clips loop forever under the reader's scroll and a seam would be seen ten
  times a minute. This is played once, to the end; trimming 0.625 s off thirteen to
  hide a seam nobody will watch for would solve a problem the file does not have.

It opens muted with controls: a dialog that starts making noise unasked is the thing
people close immediately, and the controls are how the kept audio is actually
reachable. It starts itself only where `prefers-reduced-motion` permits, and
`preload="metadata"` is stated rather than left to the browser, whose default is
`auto` on Safari and would take all three megabytes before anybody pressed play.

### Rebuilding the published clips

```bash
node scripts/build-media.mjs     # or: npm run media
```

Re-encodes all eight into `public/media/` with the audio removed, fast start
enabled, and the seamless-loop crossfade applied, then extracts a poster from each
published clip's own first frame and prints the seam measurement for every one. It
exits non-zero if a seam comes out coarser than the motion already in its clip, so
a regression shows up in the log rather than on the page.

Needs `ffmpeg`, `ffprobe` and `cwebp` on the path.

### Rebuilding the published photographs

```bash
node scripts/build-gallery.mjs   # or: npm run gallery
```

Encodes every item in `maneggio_pictures/` into responsive WebP at 480, 720, 960 and
1280 px — skipping any width wider than the original, so nothing is ever upscaled,
which is why the one clip gets a single 480px poster from a 576px source — then
re-encodes the clip, copies both logo files, and prints a TypeScript literal per
item with the dimensions that came out.

Those printed numbers are the point of the script. `src/content.ts` has to declare
each file's intrinsic size so the browser reserves the right box before the file
arrives, and a hand-typed width is a guess that shows up as layout shift. Copying
them from a measurement is not a convenience, it is the only version of this that is
correct.

Needs `ffmpeg` and `cwebp` on the path.

The mark is copied byte for byte and is deliberately not optimised. It is 120 kB with
28,710 coordinates written as `337.00`, and stripping the trailing zeros looks like a
50% saving while being worth 2.2 kB over the wire, because gzip has already collapsed
that redundancy. Taking it would mean a regex rewriting somebody's drawing for a
saving no visitor would notice.

`assets/images/` is the earlier Pexels set. Nothing on the site uses it. It is
left in place because it is the only record of those licences and download
sources; delete it once that is no longer of interest.

## Checks

Each script is a real check and exits non-zero when it finds something. Start
the preview server first, then point the scripts at it.

```bash
npm run preview &
npm run review           # responsive layout from 320 up, overflow, touch targets,
                         # images, deep-link targets, the section order, the mark,
                         # the telephone link and the address, the gallery dialog by
                         # keyboard, tab order, one sticky stage and no header,
                         # and the whole video matrix: variant per breakpoint, one
                         # clip running at a time, every moment reached at some
                         # point, manual pause surviving a chapter change,
                         # offscreen, hidden tab, reduced motion, media errors one
                         # per clip, a browser without H.264, and the crossfade in
                         # both directions
npm run review:a11y      # axe: opening, a chapter over the video, the gallery,
                         # the dialog, the closing, the open disclosure, privacy,
                         # in both themes
npm run review:contrast  # composited contrast in both themes, text over the video
                         # measured against real frames of all four moments at four
                         # viewports, and a proof that the veil is up before the
                         # gallery text is read
npm run review:fallbacks # photographs, one photograph, both marks, posters, clips,
                         # all media, font, missing codec, save-data and reduced
                         # motion each blocked in turn
npm run review:perf      # Lighthouse on the production build, real throttling
npm run review:all
```

> `review.mjs` also drives the gallery clip end to end: it finds the cell by its
> accessible name rather than by position, refuses it if it is reachable before the
> dialog opens, and then checks that it arrives, decodes, plays, is muted with
> controls, has a poster, has an accessible name, and leaves the document when the
> dialog closes. Position would have been the fragile way to find it — the clip is
> the sixth cell today and the seventh when the maneggio sends another photograph,
> and `nth-child(6)` would quietly start opening a photograph and pass every
> assertion written to rule one out.

> The checks are not decorative and they are not generic. They were extended rather
> than widened: `review.mjs` holds one `MOMENTS` list and one `CHAPTER_MOMENT` map,
> and the clip regex, the pairing of each chapter to its moment and the sampling
> depth all derive from them, because a check still watching for three moments on a
> page that requests four reports a page working correctly as a page fetching a clip
> it should not have. `contrast.mjs` names all four chapters rather than the two
> that existed when it was written — dropping the new one as "the same shape as an
> existing one" is how a chapter ships with a title nobody measured.
>
> One consequence worth knowing: the opening's `h1` now wraps a picture, so
> `contrast.mjs` skips it. Walking `textContent` would count the screen-reader-only
> name as painted words over a white mark, measure white on white and fail a page
> whose opening is perfectly legible — a failure nobody can act on, sitting on top
> of the real result. What is painted in the opening is measured; the mark's own
> legibility is a question about the scrim, not about text contrast.

> `lh.mjs` runs Lighthouse with `throttlingMethod: devtools` rather than the
> default `simulate`, and takes the median of three runs. `simulate` records an
> unthrottled trace and replays it through a model of the network, and that model
> is where nearly all the variance on this page came from: the same build returned
> 1.65, 1.80 and 2.71 s under `simulate`, and 2.08 s every time under real
> throttling. The claim being checked is how long until the name is readable on a
> slow phone, which is something the browser does rather than something a model
> predicts, so the browser is asked to do it. Every run is printed beside the
> median so the spread stays visible.

Four of these deserve a note, because each was wrong before and the correction is
the interesting part.

**Contrast over the video.** The page keeps its text on the photographs, so
walking the DOM for a background colour cannot answer the question: the background
is a frame under a scrim. `contrast.mjs` screenshots the stage with the text made
transparent, decodes the result back into the page, and takes the *minimum*
contrast ratio over every pixel behind each line. The minimum, not the lightest
pixel, because which pixel is worst depends on the direction: light text fears
the lightest, dark text the darkest. It samples the content box rather than the
border box, since a button's border never sits behind a glyph, and it sets
`transition: none` while measuring, or the control fades its own colour over
180 ms and the screenshot catches a ghost no visitor ever sees.

It measures all four moments at 320, 390, landscape and desktop, and takes each
chapter's own clip by index rather than "whichever is playing" — during a
crossfade the latter picks the outgoing one and reports the exposure of a moment
the reader has already left.

**The veil.** The gallery and the closing are read against the page, and the check
has to prove it. The DOM walk would resolve their text against `--page` and report
clean even if the video were still behind them, so there is a separate assertion
that the veil is fully up before the first photograph enters the viewport. The veil
rises only after the last panel's bottom edge has cleared the top of the screen: the
veil sits inside the stage, behind the text, so a veil at 60% under a panel of near
white type is near white type on a sand page.

**Touch targets.** WCAG 2.2 exempts a link inside a sentence from the target
size minimum, because enlarging it would break the line box it sits in. Every
control in its own right is held to 44 px; inline prose links are not. Controls
that have faded out with the backdrop are exempt too, since they are not on screen.

**The crossfade.** `review.mjs` sweeps the whole story in 60 px steps and checks
four things a screenshot cannot. That a layer is ever strictly between transparent
and opaque **while another is fully opaque**, which is what distinguishes a
dissolve from a cut. That no two layers are ever partly transparent at once, which
is the shape that fails: two half-opaque layers over a dark base composite to three
quarters of real footage and the base shows through the middle of every transition.
That the sum of the layer opacities never collapses. And that scrolling back up
retraces the same values the way down did, compared against the trace from the
descent rather than against the previous sample, because comparing consecutive
samples would only prove the fade is gradual rather than reversible.

The band is split at its midpoint to get that: the incoming layer rises across the
first half while the outgoing one holds at full opacity, then the outgoing one falls
across the second half while the incoming one stays. One layer moves, the layer
beneath it never dims, and the composite is complete coverage at every point.

**Occlusion.** `review.mjs` also samples every block in the gallery and the closing
across the whole scroll and asks `elementFromPoint` what is actually on top. Every
other assertion in the file reads computed styles, and computed styles do not know
what covers what: when the gallery moved out of the story, the stage overhung the
end of its container by exactly one viewport — sticky constrains an element's
*margin box*, and the stage carried a `-100dvh` bottom margin — and its veil, which
is opaque and exactly the colour of the page, painted over the photographs.
Contrast was clean, axe was clean, the layout assertions were clean, and the
gallery was invisible.

**The bundle.** `lh.mjs` measures the mark, and the mark cannot paint until the
bundle has downloaded, parsed and run — there is no server-rendered markup, so this
page has no content before its JavaScript. That makes bundle size a first-order
concern rather than a detail, and it is the reason `StoryStage` binds its scroll
values to inline styles by hand instead of through `motion.div`: the values only
ever drive `opacity`, and the component would add about 36 KB of animation runtime
to a 62 KB bundle. Removing it took the script from 98 KB to 61 KB over the wire
and the LCP from about 2.9 s to 2.1 s.

The same trap caught the mark. It was typeset text, so it needed nothing but the
stylesheet and it was the LCP for free; switching to the official SVG put a 28 kB
file at the *end* of the critical path, and LCP went from 2.1 s to 3.45 s while the
performance score went 98 to 88. One `<link rel="preload">` for the white file put
it back: 2.35 s and 95. Only the white one, because the opening takes the white file
in both themes and preloading the black as well would spend 28 kB on a footer image
most visitors never scroll to.

## Not confirmed by the ranch

The mark, the photographs, the address and the telephone have all arrived. One
thing is still missing, and it is isolated in `src/content.ts` so that confirming it
is a flag rather than a search:

- **The founding year.** Not confirmed, so it is not rendered. **Est. 2026** sits in
  `content.ts` behind `establishedConfirmed: false`; flip the flag when it is
  confirmed rather than editing a component.

Also absent: WhatsApp, opening days, prices, a legal name, a sports registry,
qualifications, reviews, years of activity, coordinates. None of them is guessed:
an invented opening hour or a founding year is a claim a stranger will rely on.

> **Authorisation to publish is not a data question.** Nobody has confirmed in
> writing that the maneggio may publish these photographs and this clip, or that the
> people in them — several of them children — agree to appear. That has to be settled
> with the maneggio before the site is published, and it is not something any check
> here can verify.

The contacts are Alberto, a telephone number and an address, all confirmed. The
telephone is the first row of the contact card, above the social profiles, because it
is the only route on the page that reaches a person directly. The number is written
once in `content.ts` and read from there by the visible link, the `tel:` href and the
structured data, so the three cannot drift apart.

A `tel:` link gets no `target`, because a dialler is not a tab, and the words "su
Instagram" under it would be a plain false statement. The check asserts both.

The address links to the Google Maps URL the maneggio supplied rather than to a
search for its own address, and it is a link rather than an embed: an embedded map
loads a third-party script, a frame and usually a consent banner onto a page that is
otherwise entirely first-party, to draw something the link already does.

The activities say "Scrivici" or "Chiama Alberto", never "Prenota", because there is
no booking flow and a button that promises one is worse than no button. Addestramento
promises a process rather than an outcome: "un percorso su misura" is what a training
service is, and a guaranteed result in a fixed number of lessons is a claim nobody
has made.

`site.md` is the superseded 1.0 specification. The current one is the redesign
spec this implementation follows.
