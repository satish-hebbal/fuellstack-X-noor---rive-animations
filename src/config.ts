/**
 * Every performance knob in one place.
 */

/**
 * Rive files exported from the editor almost always contain a state machine
 * plus the raw linear animations it drives. The runtime's default is to play
 * linear animation #0, which for those files can look wrong (a one-shot intro
 * that plays once and freezes). Preferring the state machine matches what you
 * see in the Rive editor preview.
 *
 * Flip to `false` if one of your files is authored around a plain timeline.
 */
export const PREFER_STATE_MACHINE = true

/**
 * Bind each file's default view model on load, so files built with Rive's data
 * binding show the values their designer set rather than unbound defaults.
 *
 * The runtime logs a red `Could not find a View Model linked to Artboard …`
 * for every file that *doesn't* use data binding. It is harmless — the file
 * renders correctly either way — but if none of your animations use data
 * binding and you want a silent console, set this to `false`.
 */
export const AUTO_BIND_VIEW_MODELS = true

/**
 * Cap the canvas backing-store resolution. On a 3x phone screen an uncapped
 * 300px tile allocates a 900px buffer, which is ~2.2x the fill rate of a 2x
 * one for no visible gain at thumbnail size. 2 looks crisp everywhere.
 */
export const MAX_DEVICE_PIXEL_RATIO = 2

/**
 * Tile shape before its animation has loaded and reported its real artboard
 * size. Pick whatever most of your files look like — the closer this is, the
 * less the masonry columns settle on a cold first visit.
 */
export const DEFAULT_TILE_ASPECT_RATIO = 4 / 3

/**
 * Clamp on measured aspect ratios, as [tallest, widest]. Without it a single
 * extreme banner or ticker artboard would produce one absurdly long tile and
 * wreck the column balance. Artboards outside the range are letterboxed.
 *
 * The low end is deliberately generous: phone-shaped artboards are common in
 * Rive and run to 9:20 (0.45). Anything past that is a genuine outlier.
 */
export const TILE_ASPECT_CLAMP: [min: number, max: number] = [0.45, 2.4]

/**
 * How far outside the viewport a tile starts downloading and instantiating its
 * .riv file. Big enough that scrolling never shows an empty tile, small enough
 * that a 100-file gallery never loads all 100 at once.
 */
export const PRELOAD_MARGIN = '800px'
