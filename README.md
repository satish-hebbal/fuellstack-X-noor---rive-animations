# Rive Showcase

A Pinterest-style masonry gallery for your `.riv` animations. Drop files in a
folder, they appear as tiles sized to their own artboards, click one to see it
big. That's the whole app.

```bash
npm install
npm run dev          # http://localhost:5173
npm run drive:check  # verify the Google Drive setup
```

## Where the files come from

Two sources, picked automatically:

| | When it's used | Adding a file |
| --- | --- | --- |
| **Google Drive** | `VITE_DRIVE_FOLDER_ID` + `VITE_DRIVE_API_KEY` are set | Drop it in the folder, hit **Refresh** |
| **Local folder** | Neither is set | Put it in `src/rive/`, restart the dev server |

Either way the filename becomes the title (`loading-spinner.riv` → "Loading
Spinner") and tiles sort alphabetically with natural number ordering (`scene-2`
before `scene-10`).

The local folder is the fallback, so `npm run dev` works with no credentials.

## Serving from Google Drive

The deployed site reads your Drive folder in the browser on every load. Add or
delete a `.riv` there and the gallery matches it — no rebuild, no redeploy.

**1. Share the folder.** In Drive, right-click your folder → Share → General
access → **Anyone with the link** → Viewer. Copy the folder ID from its URL:

```
https://drive.google.com/drive/folders/1AbCdEf...   ← everything after /folders/
```

**2. Make an API key.** In the [Google Cloud console](https://console.cloud.google.com):
create (or pick) a project → **APIs & Services → Library** → enable **Google
Drive API** → **Credentials → Create credentials → API key**.

**3. Restrict the key — don't skip this.** The key ends up in the JavaScript
bundle and is publicly readable. Restricting it is what stops that mattering.
On the key's settings page:

- **Application restrictions → Websites**, and add your domains:
  `https://your-project.vercel.app/*` and `http://localhost:5173/*`
- **API restrictions → Restrict key →** Google Drive API only

**4. Point the app at it.** Locally, `cp .env.example .env` and fill both
values. On Vercel, add them under **Settings → Environment Variables** — Vite
inlines them at build time, so changing either one needs a redeploy.

**5. Check it before running the app.**

```bash
npm run drive:check
```

This verifies the whole chain in one command — key valid, Drive API enabled,
folder actually public — then lists every `.riv` it finds, downloads each one,
and flags any exported from a Rive version too old for the runtime. Each failure
names the exact setting to change.

One gotcha it handles for you: an API key restricted to HTTP referrers rejects
callers that send none, and Node sends none. The script presents itself as
`http://localhost:5173/` so the restriction can stay in place. If that isn't one
of your allowed referrers, pass a different one:

```bash
DRIVE_CHECK_REFERER=https://your-project.vercel.app/ npm run drive:check
```

### What this means in practice

- **Anyone with the folder ID can download your `.riv` files.** That's inherent
  to a public folder. Fine for a showcase; not fine for client work under NDA.
- **Only the listing is on the critical path.** One request resolves the whole
  folder, then tiles load lazily as you scroll — same as before.
- **Files are cached locally after the first visit.** Drive serves downloads
  with `Cache-Control: private, max-age=0`, so the browser refuses to keep them
  and every visit would re-download everything. `lib/fileCache.ts` stores the
  bytes in Cache Storage instead, keyed by file id + Drive's `modifiedTime`.
  Edit a file in Drive and the key changes, so you can't get a stale one.
- **Deleting a file in Drive reclaims its storage.** Both caches are pruned
  down to the current folder contents on every load.
- **Non-`.riv` files in the folder are ignored**, so a stray `notes.txt` is
  harmless.

## Deploying

```bash
npm run build    # → dist/
npm run preview  # serve dist/ locally to check it
```

`dist/` is plain static files and the build uses a relative base path, so it
runs on any host unchanged.

**Because the animations come from Drive, deploying is close to a one-time
job.** Adding or removing a `.riv` never needs a redeploy — only code changes do.

### Vercel

[vercel.json](vercel.json) already sets the build command, output directory, and
immutable caching for hashed assets. From this folder:

```bash
npx vercel          # sign in, create the project
npx vercel --prod   # publish
```

Add the two `VITE_DRIVE_*` values under **Settings → Environment Variables**
before the first build. Vite inlines them at build time, so changing either one
needs a redeploy.

> **Then do this, or the live site will show a Drive error.** Add your new URL
> to the API key's allowed referrers in Google Cloud — Credentials → your key →
> Application restrictions → Websites → `https://<your-project>.vercel.app/*`.
> Verify it before opening a browser:
> ```bash
> DRIVE_CHECK_REFERER=https://<your-project>.vercel.app/ npm run drive:check
> ```

Note Vercel's Hobby plan is for non-commercial use, and their definition covers
anything used for the financial gain of anyone who worked on it. Cloudflare's
free tier has no such restriction if that ever becomes an issue — the build
output is host-agnostic, so moving is a config file, not a rewrite.

### Housekeeping

Once Drive is live, delete the samples in `src/rive/` — otherwise they're
uploaded with every deploy and just sit there unused.

---

## Why this stack

**Vite + React, no framework.** Rive is a WebAssembly runtime that paints into a
`<canvas>` — it is 100% client-side and cannot render on a server. Next.js would
add SSR, hydration, and `dynamic(..., { ssr: false })` wrappers around every
animation to buy exactly nothing here. A static SPA ships less JavaScript, boots
faster, and deploys anywhere.

**`@rive-app/react-webgl2`.** Rive's recommended default renderer: GPU-accelerated,
and the only one that supports newer features like vector feathering. The
`canvas` variants are smaller but push vector rasterisation onto the CPU, which
is exactly the wrong trade when many animations share a page.

## How it stays smooth

The failure mode for a Rive gallery is obvious once you see it: twenty canvases
each running their own `requestAnimationFrame` loop, all painting at once,
including the ones scrolled off screen. Six things prevent that here.

**1. Off-screen animations don't render at all.** Every tile is tracked by an
`IntersectionObserver`. Scroll a tile out of view and its render loop is stopped
via `rive.stopRendering()` — not paused-but-still-drawing, *stopped*. It resumes
exactly where it left off. Whatever the gallery's size, the cost is bounded by
what fits on your screen.

**2. Distant tiles are never even created.** A second observer with an 800px
margin decides when a tile downloads its `.riv` and instantiates a Rive object.
A 100-file gallery loads the first screenful, not 100 files. Once built, a tile
stays built, so scrolling back is instant.

**3. One WebGL context for the whole page.** Browsers hard-cap concurrent WebGL
contexts at around 16, and silently kill the oldest when you exceed it. Rive's
`useOffscreenRenderer` shares a single context across every canvas, which is why
tile count 40 behaves like tile count 4.

**4. Two shared observers, not two per tile.** `useInView` pools observers by
`rootMargin`, so a 200-tile gallery costs two `IntersectionObserver`s total.

**5. Capped pixel ratio.** On a 3× phone screen an uncapped 300px tile allocates
a 900px backing store — roughly 2.2× the fill rate of a 2× one, for no visible
gain at thumbnail size. Capped at 2.

**6. The grid freezes while the lightbox is open.** Opening a big view stops
every tile behind it, so the full-size animation gets the whole frame budget.

Two smaller things: the ~2.5 MB Rive WASM runtime is served from your own origin
rather than a public CDN (no extra DNS + TLS handshake) and starts compiling on
page load rather than when the first tile mounts; and `.riv` files are emitted as
content-hashed assets, so browsers cache them permanently and re-download only
what you change.

### Reading the frame rate

The **FPS** button in the header turns on two readouts: the page's overall frame
rate next to the button, and **each animation's own frame rate beside its name**.
Both go red below 50. Off by default, and genuinely off — with the toggle down,
nothing is subscribed and no timer runs.

Per-tile numbers come from counting Rive's `advance` event, which fires once per
frame per instance. (Rive's built-in `enableFPSCounter` is no use for this: it
delegates to the shared WASM runtime, so it reports one page-wide number and a
second caller overwrites the first.) The value is written straight to its DOM
node rather than through React state — a measurement tool shouldn't re-render
the thing it's measuring twice a second.

**Every visible tile shows the same number.** That is not a bug: Rive advances
all live instances on one shared scheduler tick, so they share a frame budget.
What the per-tile number tells you is whether a tile is *live* — parked tiles
read `0 fps`.

That makes the badges a live trace of the whole strategy. From a 17-tile run of
the heavy samples:

| | |
| --- | --- |
| All 17 tiles on screen | every tile `26 fps` |
| Half scrolled off | off-screen `0 fps`, visible `56 fps` |
| Lightbox open | all 17 tiles `0 fps`, big view `80 fps` |

**To find your expensive files, open them one at a time.** The lightbox freezes
the grid, so the number it shows is that file rendering alone with nothing
competing — directly comparable between files.

### Measured

A 40-tile build of this app, driven headlessly in Chrome on a 1440×950 viewport,
using four *heavy* sample files (full illustrated scenes, not icons):

| | |
| --- | --- |
| Tiles instantiated on first paint | 24 of 40 |
| WebGL contexts for all 40 canvases | 1 |
| Frame rate, 24 tiles built, ~10 visible | 49 fps |
| Frame rate, **all 40** built, ~10 visible | 50 fps |
| Frame rate, lightbox open (grid frozen) | 103 fps |
| JS heap, all 40 built | 7 MB |

The row that matters is the middle pair: going from 24 live Rive instances to 40
moved the frame rate by ~2%. Off-screen animations cost essentially nothing, so
the gallery's size stops mattering — only how many tiles fit on screen at once
does. Widen the `minmax()` in `.grid` if you want fewer, larger, cheaper tiles.

Numbers are from one mid-range machine and are meant as ratios, not absolutes.

## The masonry layout

Tiles are packed Pinterest-style with CSS multi-column — `columns: 260px` on
`.grid`, `break-inside: avoid` on each tile. The browser fits as many columns as
the width allows and drops each tile into the shortest one, so there are no
ragged gaps and no JavaScript layout loop.

What makes it read as masonry is that **every tile takes its animation's own
artboard shape** rather than a uniform crop. A square character sits in a square
tile, a 16:9 scene in a wide one, a phone-shaped artboard in a tall one — and
because the tile matches the art, nothing is letterboxed or cut off.

Two consequences worth knowing:

**Tile heights are only known once a file loads.** A cold first visit therefore
settles slightly as `.riv` files arrive. Measured ratios are cached in
`localStorage` keyed by the file's content-hashed URL, so every later visit lays
out correctly on the first paint — and editing a file changes its hash, which
retires the old entry automatically. See
[src/lib/aspectCache.ts](src/lib/aspectCache.ts).

**Multi-column fills top-to-bottom, then across.** Tiles read down column one,
then down column two — not left-to-right along a row. For an alphabetical
gallery that's rarely noticeable, but it is why "B" sits under "A" rather than
beside it.

## Playback details

Files exported from Rive usually contain a state machine *plus* the raw
timelines it drives. The runtime's default is to play timeline #0, which for
those files can look wrong — a one-shot intro that plays once and freezes.
This app prefers the state machine, matching what you see in the Rive editor.
Flip `PREFER_STATE_MACHINE` in [src/config.ts](src/config.ts) if one of your
files is authored around a plain timeline.

Tiles ignore pointer events so a click always opens the lightbox. **The lightbox
is interactive** — files with Rive Listeners (hover, click, drag) respond there.
One-shot animations that end on their last frame can be restarted with **Replay**.

If a tile shows "Couldn't load this file", the `.riv` was almost certainly
exported from an older Rive version than the current runtime accepts. Re-export
it from the editor.

## Knobs

Everything tunable lives in [src/config.ts](src/config.ts):

| Constant | Default | What it does |
| --- | --- | --- |
| `PREFER_STATE_MACHINE` | `true` | Drive the state machine instead of timeline #0 |
| `AUTO_BIND_VIEW_MODELS` | `true` | Bind data-binding view models; set `false` for a silent console |
| `DEFAULT_TILE_ASPECT_RATIO` | `4/3` | Tile shape before an animation reports its own |
| `TILE_ASPECT_CLAMP` | `[0.45, 2.4]` | Tallest / widest a tile may get |
| `MAX_DEVICE_PIXEL_RATIO` | `2` | Canvas resolution cap |
| `PRELOAD_MARGIN` | `'800px'` | How far ahead of the viewport tiles load |

Column width is `--column` in [src/styles.css](src/styles.css) (raise it for
fewer, larger tiles); spacing is `--gap` next to it.

## Layout

```
src/
  rive/              local .riv files — the fallback source
  config.ts          performance knobs
  lib/
    animations.ts    the shared shape of an animation, whatever its source
    sources/
      drive.ts       lists a public Google Drive folder at runtime
      local.ts       globs src/rive/*.riv at build time
    useAnimations.ts picks a source; loading / error / ready states
    fileCache.ts     Cache Storage for .riv bytes (Drive won't cache them)
    useRiveBytes.ts  per-tile download, cache-first
    riveRuntime.ts   self-hosts + preloads the Rive WASM runtime
    useInView.ts     pooled IntersectionObserver hook
    useFpsReadout.ts per-tile frame rate, written straight to the DOM
    aspectCache.ts   remembers artboard shapes so masonry doesn't re-settle
  components/
    GalleryCard.tsx  a tile: decides when to build and when to render
    RiveStage.tsx    the canvas — all Rive runtime handling lives here
    Lightbox.tsx     the big view
    FpsMeter.tsx     page-wide frame-rate readout in the header
```

Both sources produce the same `RiveAnimation` shape, so adding a third (an S3
bucket, a JSON manifest) means writing one function in `lib/sources/`.

## Things deliberately left out

Search, tags, categories, download buttons, prev/next in the lightbox. The
gallery is one flat sorted list on purpose. `animations` in
[src/lib/animations.ts](src/lib/animations.ts) is a plain array if you ever want
to filter it.
