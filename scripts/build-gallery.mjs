/* Build the web copies of the gallery photographs.
 *
 *   node scripts/build-gallery.mjs
 *
 * The originals in maneggio_pictures/ are never touched. Each one is re-encoded
 * into public/media/ as a set of responsive WebP files, and the dimensions that
 * came out are printed so src/content.ts can declare them.
 *
 * Why a script rather than a one-off conversion:
 *
 *   1. Repeatability. Replacing a photograph is a drop into maneggio_pictures/
 *      and a re-run, not a hand-measured edit to five entries in content.ts.
 *      The intrinsic width and height have to match the file exactly or the
 *      browser reserves the wrong box and the page jumps when it decodes.
 *
 *   2. No upscaling. Every width in WIDTHS is skipped when the original is
 *      narrower, because a 480px-wide version of a 958px original is a real
 *      file and a 1280px one is an invented one that costs bytes and adds
 *      nothing. The largest declared width is therefore the original's own.
 *
 *   3. One command, one answer. The script prints a TypeScript literal per
 *      photograph so the values in content.ts are copied from a measurement
 *      rather than typed from a guess.
 *
 * Quality: WebP q78 with a sharpening pass. These are the largest raster files
 * on the page and they carry faces, so they are held closer to the source than
 * the video posters are: a poster is scenery behind text that is read against
 * it, a gallery photograph is the thing the visitor came to look at.
 *
 * Re-run after replacing anything in maneggio_pictures/. */
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { copyFileSync, mkdirSync, statSync } from 'node:fs'
import { unlink } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join, resolve } from 'node:path'

const run = promisify(execFile)
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const IN = join(root, 'maneggio_pictures')
const OUT = join(root, 'public', 'media')

/* Responsive widths. The set is the one the layouts need: a single-column phone
   is at most 92vw of a 480px screen, a four-column desktop cell is well under a
   quarter of 1440, and the lightbox is at most 64rem. 1280 is the ceiling: it
   covers the lightbox on a wide screen and nothing on the page goes past it. */
const WIDTHS = [480, 720, 960, 1280]

/* The reading order of the section, and the slug each file is published under.
   The names describe the role in the composition rather than the content, so
   replacing a photograph does not mean re-reading every filename.

   Nine items, and the grid is sized for that number rather than for a count that
   happens to work: at 1024 and up it is four columns with the first photograph
   spanning the first two across the first two rows, which is four of twelve cells
   and leaves exactly three full rows for the other eight. A tenth item starts a
   fourth row on its own and a ninth-then-tenth pair would break the rows' symmetry,
   so if the maneggio sends more this list and the grid want looking at together. */
const SHOTS = [
  { id: 'cavalli', source: 'im3.jpeg' },
  { id: 'in-campo', source: 'im1.jpeg' },
  { id: 'insieme', source: 'im5.jpeg' },
  { id: 'rapporto', source: 'im2.jpeg' },
  { id: 'giornata', source: 'im4.jpeg' },
  { id: 'volo', source: 'im9.mp4' },
  { id: 'in-lembo', source: 'im8.jpeg' },
  { id: 'carezza', source: 'im6.jpeg' },
  { id: 'serata', source: 'im7.jpeg' },
]

/* The one clip, which is a photograph of the maneggio like the rest but happens to
   move. It is built here rather than by build-media.mjs because it is not a story
   moment and never will be: it is 576x1024 portrait, and the story stage is 16:9
   on every desktop, so a fifth moment built from it would be a vertical video
   pillarboxed or cropped into a landscape frame on most of the screens the page is
   read on. It belongs beside the photographs, opened on request, where the frame
   is the clip's own shape.

   It keeps its audio, which is the opposite decision to the story clips and for
   the opposite reason: those autoplay muted as atmosphere, so an audio track is
   bytes nobody can hear, while this one is opened deliberately and can be unmuted.
   Measured, the track costs 162 kB on 3.2 MB. Five per cent for a real memory
   with its sound is not a trade worth making. */
const VIDEO = { id: 'volo', source: 'im9.mp4' }

const QUALITY = '78'

/* Intrinsic size and runtime of one file, read through ffprobe rather than through
   a JavaScript image decoder: the same binary already reads the video pipeline, so
   this adds no dependency and no decode of its own.

   Both in one call, because `stream` and `format` are separate sections of
   ffprobe's output and asking for them separately means spawning the binary twice
   per file. `duration` is a container field rather than a stream one, so a
   photograph reports the length of its single frame — 0.04s — which is why it is
   only read for the clip. */
async function probe(file) {
  const { stdout } = await run('ffprobe', [
    '-v',
    'error',
    '-select_streams',
    'v:0',
    '-show_entries',
    'stream=width,height:format=duration',
    '-of',
    'json',
    file,
  ])
  const json = JSON.parse(stdout)
  const stream = json.streams?.[0]
  if (!stream?.width || !stream?.height) throw new Error(`${file}: unreadable dimensions`)
  return {
    width: stream.width,
    height: stream.height,
    duration: Number(json.format?.duration ?? 0),
  }
}

/* Even numbers only.

   yuv420p is what every browser decodes without a surprise, and a chroma
   subsampled by an odd amount produces artefacts along the edges that are worst
   exactly where these photographs need to be clean: a bridle strap, a hand on a
   mane, a face. Height is floored rather than rounded so the ratio never goes
   above the original's and the browser never upscales to fill a cell. */
const even = (n) => Math.max(2, Math.floor(n / 2) * 2)

mkdirSync(OUT, { recursive: true })
console.log('id           source      original     files  largest')

/* Whether a listed file is the clip, so the loop below handles both shapes from
   one ordered list rather than splitting the composition order across two
   statements that can disagree about it. */
const isVideo = (shot) => shot.source.endsWith('.mp4')

const report = []

for (const shot of SHOTS) {
  const src = join(IN, shot.source)
  const original = await probe(src)
  const files = []
  const entries = []

  for (const width of WIDTHS) {
    if (width > original.width) continue
    const height = even((width * original.height) / original.width)
    const name = `gallery-${shot.id}-${width}.webp`
    /* ffmpeg does the scaling and cwebp does the encoding, for one reason: cwebp
       accepts a single -resize value and picks the other axis itself, so the
       output height would be whatever libwebp rounded to and content.ts would
       declare a size that does not match the file. Scaling here means the two
       numbers below are the two numbers on disk. */
    const frame = join(OUT, `.${shot.id}-${width}.png`)
    /* Half a second in, not frame zero. A phone clip starts with the camera still
       finding the subject, and the first frame of this one is a fraction of a
       second before the child's arms are level. The poster is what a visitor sees
       before choosing to play, so it has to be the frame that represents the clip
       rather than the frame that precedes it.

       `-ss` before the input is an input option and `-frames:v` after it is an
       output one, which is why these are two spreads rather than one: ffmpeg
       rejects the pair in either other order. A still has exactly one frame to
       give, so it needs neither. */
    await run('ffmpeg', [
      '-v',
      'error',
      '-y',
      ...(isVideo(shot) ? ['-ss', '0.5'] : []),
      '-i',
      src,
      ...(isVideo(shot) ? ['-frames:v', '1'] : []),
      '-vf',
      `scale=${width}:${height}:flags=lanczos`,
      frame,
    ])
    await run('cwebp', [
      '-quiet',
      '-q',
      QUALITY,
      '-m',
      '6',
      /* A WebP this size is decoded and scaled on the compositor thread, and the
         photograph is being resized from 1536px down to 480px, so the detail
         that survives is already aliased. One pass of unsharp is what keeps the
         horse's eye and the lettering on a saddle pad legible at cell size. */
      '-sharp_yuv',
      frame,
      '-o',
      join(OUT, name),
    ])
    await unlink(frame)
    files.push({ name, width, height })
    entries.push({ name, width, height })
  }

  /* The clip is re-encoded rather than published as it arrived. Three things are
     not optional on a file that goes on the web: it is H.264 in yuv420p, because
     that is what every browser decodes without a surprise; it has fast start, so
     playback begins from the first range request instead of waiting for the whole
     3 MB; and it is re-encoded at all rather than passed through, which is what
     removes whatever the phone encoder chose.

     No loop crossfade here, unlike build-media.mjs, and deliberately: that
     crossfade exists because the story clips loop forever under the reader's
     scroll and a visible seam would be seen ten times a minute. This one is played
     once, deliberately, to the end. Trimming 0.625 s off thirteen to hide a seam
     nobody will watch for would be solving a problem this file does not have. */
  let clip = null
  if (isVideo(shot)) {
    const dest = join(OUT, `gallery-${shot.id}.mp4`)
    await run('ffmpeg', [
      '-v',
      'error',
      '-y',
      '-i',
      src,
      '-c:v',
      'libx264',
      '-crf',
      '23',
      '-preset',
      'slow',
      '-profile:v',
      'high',
      '-level',
      '4.0',
      '-pix_fmt',
      'yuv420p',
      /* Kept, and see the note on VIDEO above. */
      '-c:a',
      'aac',
      '-b:a',
      '96k',
      '-movflags',
      '+faststart',
      dest,
    ])
    const { duration } = await probe(dest)
    clip = { name: `gallery-${shot.id}.mp4`, src: dest, width: original.width, height: original.height, duration }
  }

  /* The widest generated file is the one the lightbox loads, and it is the only
     one that must exist at the original's own proportions: object-contain in
     the dialog means a cropped master would show the crop, not the photograph. */
  const largest = files[files.length - 1]
  const kb = (n) => `${(n / 1024).toFixed(0)}kB`.padStart(7)
  console.log(
    [
      shot.id.padEnd(12),
      shot.source.padEnd(12),
      `${original.width}x${original.height}`.padStart(10),
      String(files.length).padStart(6),
      clip ? kb(statSync(clip.src).size) : kb(statSync(join(OUT, largest.name)).size),
    ].join(' '),
  )

  report.push({ ...shot, original, files: entries, largest, clip })
}

/* ── The values content.ts needs ────────────────────────────────────────────
   Printed rather than written: content.ts is the single source of truth for
   every string and every path on the page, and a generator that edited it would
   have to own its formatting. Copying from here keeps that file hand-written
   and reviewable while still being derived from a measurement. */
console.log('\n--- copy into src/content.ts ---\n')
for (const shot of report) {
  const srcSet = shot.files.map((f) => `media('${f.name}') ${f.width}w`).join(', ')
  const thumb = shot.files[Math.min(1, shot.files.length - 1)]
  console.log(`${shot.id} (${shot.source}, ${shot.original.width}x${shot.original.height})`)
  if (shot.clip) {
    console.log(
      `  VIDEO: media('${shot.clip.name}')  ${shot.clip.width}x${shot.clip.height}  ${shot.clip.duration.toFixed(2)}s`,
    )
  }
  console.log(`  full:  media('${shot.largest.name}')  ${shot.largest.width}x${shot.largest.height}`)
  console.log(`  thumb: media('${thumb.name}')  ${thumb.width}x${thumb.height}`)
  console.log(`  srcSet: ${srcSet}`)
}

/* The logo is not a photograph but it is an asset the page needs in two
   variants, and both live in logo/ with an intrinsic size declared inside the
   file. Copied byte for byte, because this is a mark somebody drew and the
   originals in logo/ stay the only place it is ever edited.

   Not optimised, and here is the measurement so the question stays closed. The
   file is 120 kB with 28,710 coordinates written as `337.00`, which looks like an
   easy 50% saving by stripping the trailing zeros — and is worth 2.2 kB over the
   wire, because gzip has already collapsed that redundancy into a handful of
   bytes. 28.7 kB becomes 26.5 kB. Taking that would mean a regex rewriting path
   data, which is the one change in this file that could silently distort somebody's
   drawing, in exchange for a saving no visitor would ever notice.

   The real reduction would be rewriting the paths as relative commands with svgo,
   which is a tool this project does not have and a change to the artwork's
   description rather than to its delivery. If that is ever wanted it is a decision
   to make on purpose, with the designer, and not a side effect of an asset script. */
const LOGOS = [
  { source: 'victorias_horses_black.svg', dest: 'logo-black.svg' },
  { source: 'victorias_horses_vector_white.svg', dest: 'logo-white.svg' },
]
for (const { source, dest } of LOGOS) {
  copyFileSync(join(root, 'logo', source), join(OUT, dest))
  console.log(`logo ${dest} copied (${(statSync(join(OUT, dest)).size / 1024).toFixed(1)} kB, 700x848)`)
}

console.log('\nre-run the build if any width above changed: content.ts reserves the box from these numbers')