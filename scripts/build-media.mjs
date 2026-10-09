/* Build the web copies of the story clips.
 *
 *   node scripts/build-media.mjs
 *
 * The originals in videos/ are never touched. Each one is re-encoded into
 * public/media/ with three changes, all of which are load-bearing rather than
 * housekeeping:
 *
 *   1. Seamless loop. None of the originals loops: frame 0 and the last frame
 *      differ by 3.7 to 11.8 dB PSNR, while ordinary frame-to-frame motion in
 *      the same clip sits at 6.9 to 29 dB. On a ten second loop that is a jump
 *      cut the visitor sees over and over.
 *      The fix crossfades the last 0.625 s into the first 0.625 s, so the
 *      dissolve straddles the loop point instead of ending on the frame the
 *      loop jumps back to. Measured afterwards, the seam sits at the same PSNR
 *      as ordinary motion in the clip, which is the test that matters: not
 *      "the seam is gone" but "the seam is indistinguishable from the shot".
 *      Cost: each clip loses 0.625 s of runtime.
 *
 *   2. No audio. The AAC track is silent decorative sound. Carrying it would
 *      spend roughly a fifth of the file size on something muted players never
 *      decode, and an autoplaying element with a sound track is a thing some
 *      browsers will refuse outright.
 *
 *   3. Fast start. The moov atom moves to the front so playback can begin from
 *      the first range request instead of waiting for the whole file.
 *
 * A poster is extracted from the first frame of each processed clip, at the
 * clip's own resolution, because the poster is what the visitor sees while the
 * clip is still arriving and it must match the clip exactly.
 *
 * Re-run after replacing anything in videos/. The script prints the seam
 * measurement for every clip so a regression is visible in the log rather than
 * discovered on the page. */
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { mkdirSync, statSync } from 'node:fs'
import { unlink } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join, resolve } from 'node:path'

const run = promisify(execFile)
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const IN = join(root, 'videos')
const OUT = join(root, 'public', 'media')

/* clip id -> source basename. The mobile clips are the 9:16 crops of the same
   three moments, and they are named differently in videos/ on purpose so the
   two orientations never get swapped by accident. */
const CLIPS = [
  { id: 'fermo', source: 'fermo', format: 'desktop' },
  { id: 'fermo', source: 'fermo_mobile', format: 'mobile' },
  { id: 'passo', source: 'passo', format: 'desktop' },
  { id: 'passo', source: 'passo_mobile', format: 'mobile' },
  { id: 'trotto', source: 'trotto', format: 'desktop' },
  { id: 'trotto', source: 'trotto_mobile', format: 'mobile' },
  { id: 'galoppo', source: 'galoppo', format: 'desktop' },
  { id: 'galoppo', source: 'galoppo_mobile', format: 'mobile' },
]

const XFADE = 0.625
const FPS = 24
/* blend's expression is evaluated one frame early, because T is the timestamp of
   the frame being produced and the last frame of a 15 frame window sits at
   14/24. Dividing by 14/24 rather than by 0.625 is what makes the dissolve land
   exactly on 0 and exactly on 1. */
const XFADE_LAST_T = (XFADE * FPS - 1) / FPS

const clipName = ({ id, format }) => (format === 'mobile' ? `${id}-mobile.mp4` : `${id}.mp4`)
const posterName = ({ id, format }) =>
  format === 'mobile' ? `${id}-poster-mobile.webp` : `${id}-poster.webp`

/* ffprobe is asked for stream and container fields in one call, so the caller
   gets both shapes from the same read instead of spawning twice. */
async function probe(file, streamEntries = []) {
  const { stdout } = await run('ffprobe', [
    '-v',
    'error',
    '-select_streams',
    'v:0',
    '-show_entries',
    `stream=${streamEntries.join(',')}:format=duration`,
    '-of',
    'json',
    file,
  ])
  const json = JSON.parse(stdout)
  return { ...(json.streams?.[0] ?? {}), duration: Number(json.format?.duration ?? 0) }
}

async function build(clip) {
  const src = join(IN, `${clip.source}.mp4`)
  const dest = join(OUT, clipName(clip))
  const { duration: sourceDuration } = await probe(src)
  if (!sourceDuration) throw new Error(`${clip.source}: no readable duration`)

  const tailStart = (sourceDuration - XFADE).toFixed(3)
  const bodyEnd = tailStart

  /* split into three reads of one decode: the tail, the head, and the body
     between them. blend then dissolves tail into head, and concat puts the
     dissolve first so the loop point falls in its middle. */
  const filter = [
    '[0:v]split=3[tail][head][rest]',
    `[tail]trim=start=${tailStart}:duration=${XFADE},setpts=PTS-STARTPTS[t]`,
    `[head]trim=start=0:duration=${XFADE},setpts=PTS-STARTPTS[h]`,
    `[t][h]blend=all_expr='A*(1-(T/${XFADE_LAST_T}))+B*(T/${XFADE_LAST_T})'[xf]`,
    `[rest]trim=start=${XFADE}:end=${bodyEnd},setpts=PTS-STARTPTS[mid]`,
    '[xf][mid]concat=n=2:v=1:a=0[v]',
  ].join(';')

  await run('ffmpeg', [
    '-v',
    'error',
    '-y',
    '-i',
    src,
    '-filter_complex',
    filter,
    '-map',
    '[v]',
    '-an',
    '-c:v',
    'libx264',
    /* The originals are already H.264 at a modest bitrate. CRF 23 lands close
       to the source quality while taking the audio track out of the budget,
       which is most of where the saving comes from. */
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
    /* keyframe every second: a 10s loop needs to be seekable enough to start
       promptly, and range requests during the crossfade want a nearby
       keyframe. */
    '-g',
    String(FPS),
    '-movflags',
    '+faststart',
    dest,
  ])

  /* Poster from the processed clip's own first frame, not from the original:
     after the crossfade the first frame is a blend, and the poster must be the
     pixel the visitor actually sees first. */
  /* ffmpeg writes WebP only through a limited encoder, so the frame goes out as
     PNG and is converted with cwebp, which has the quality and effort knobs
     worth having for a file that is the largest paint on the page. */
  const poster = join(OUT, posterName(clip))
  const frame = join(OUT, `.${clipName(clip)}.png`)
  await run('ffmpeg', ['-v', 'error', '-y', '-i', dest, '-frames:v', '1', frame])
  await run('cwebp', ['-quiet', '-q', '72', '-m', '5', frame, '-o', poster])
  await unlink(frame)

  /* Report what came out, not what went in: the crossfade shortens the clip by
     XFADE, and that difference is the whole point of the operation. */
  const { duration } = await probe(dest)
  return { dest, poster, duration, frames: await frameCount(dest), sourceDuration }
}

/* PSNR between two frames of one file, in dB. Higher means the two frames are
   more alike.
   This uses the psnr filter rather than the ssim filter: ssim's parenthesised
   figure is derived from its structural similarity term, not from the mean
   squared error, so it is not on the same scale as any other PSNR in the log
   and cannot be compared against a motion floor measured elsewhere. The psnr
   filter reports inf when handed a frame against itself, which is the control
   that shows the harness is measuring what it claims to. */
async function psnr(file, a, b) {
  const { stderr } = await run(
    'ffmpeg',
    [
      '-hide_banner',
      '-v',
      'info',
      '-i',
      file,
      '-i',
      file,
      '-filter_complex',
      `[0:v]select='eq(n\\,${a})',setpts=N/${FPS}/TB[x];[1:v]select='eq(n\\,${b})',setpts=N/${FPS}/TB[y];[x][y]psnr`,
      '-f',
      'null',
      '-',
    ],
    { maxBuffer: 1 << 24 },
  )
  const m = stderr.match(/average:([\d.]+|inf)/)
  return m ? (m[1] === 'inf' ? Infinity : Number(m[1])) : NaN
}

/* The lowest PSNR between any two consecutive frames of the clip, in one pass:
   one stream offset by a frame against the other. That minimum is the shot's own
   motion floor, and it is the only honest baseline for judging a seam. A horse
   walking across a field changes more between frames than a horse standing still
   does, so a fixed threshold would pass one clip and fail another for the same
   seam. */
async function motionFloor(file, last) {
  const { stderr } = await run(
    'ffmpeg',
    [
      '-hide_banner',
      '-v',
      'info',
      '-i',
      file,
      '-i',
      file,
      '-filter_complex',
      `[0:v]trim=start=1,setpts=PTS-STARTPTS[cur];[1:v]trim=end=${last},setpts=PTS-STARTPTS[prev];[prev][cur]psnr`,
      '-f',
      'null',
      '-',
    ],
    { maxBuffer: 1 << 24 },
  )
  const m = stderr.match(/min:([\d.]+|inf)/)
  return m ? (m[1] === 'inf' ? Infinity : Number(m[1])) : NaN
}

async function frameCount(file) {
  const { stdout } = await run('ffprobe', [
    '-v',
    'error',
    '-select_streams',
    'v:0',
    '-count_frames',
    '-show_entries',
    'stream=nb_read_frames',
    '-of',
    'csv=p=0',
    file,
  ])
  return Number(stdout.trim())
}

/* The loop seam is the pair the visitor actually sees: last frame to first
   frame. It is seamless when it is no coarser than the motion the clip already
   contains. */
async function measureSeam(file) {
  const last = (await frameCount(file)) - 1
  const floor = await motionFloor(file, last)
  return { seam: await psnr(file, last, 0), floor }
}

mkdirSync(OUT, { recursive: true })
console.log('clip                    size    poster     frames    seam dB   floor dB')

/* TOLERANCE absorbs the re-encode. Every built clip is decoded twice, once for
   the seam and once for the floor, so the two numbers are directly comparable;
   half a decibel is slack for a frame pair that sits right on the boundary. */
const TOLERANCE = 0.5
const failures = []

for (const clip of CLIPS) {
  const { dest, poster, duration, frames } = await build(clip)
  const { seam, floor } = await measureSeam(dest)
  const ok = seam >= floor - TOLERANCE
  if (!ok) failures.push(`${clipName(clip)}: seam ${seam.toFixed(2)} dB, floor ${floor.toFixed(2)} dB`)

  const kb = (n) => `${(n / 1024).toFixed(0)}kB`.padStart(9)
  console.log(
    [
      clipName(clip).padEnd(22),
      kb(statSync(dest).size),
      kb(statSync(poster).size),
      `${frames} / ${(duration * FPS).toFixed(0)}`.padStart(11),
      seam.toFixed(2).padStart(10),
      floor.toFixed(2).padStart(10),
      ok ? '  ok' : '  <- seam coarser than the motion in this clip',
    ].join(' '),
  )
}

if (failures.length) {
  console.log(`\nFAIL:\n  ${failures.join('\n  ')}`)
  process.exit(1)
}
console.log('\nevery loop seam is no coarser than the motion already in its clip')