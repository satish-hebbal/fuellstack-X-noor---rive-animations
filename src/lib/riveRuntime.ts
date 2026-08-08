import { RuntimeLoader } from '@rive-app/react-webgl2'
import riveWasmUrl from '@rive-app/webgl2/rive.wasm?url'

/**
 * Rive's runtime is a ~2.5 MB WebAssembly module. By default it is fetched from
 * a public CDN at the moment the first animation mounts, which costs a fresh DNS
 * lookup + TLS handshake + download before anything can render.
 *
 * Two fixes, both applied here:
 *
 *  1. Serve the .wasm from our own origin. Vite emits it as a hashed asset next
 *     to the JS bundle, so it reuses the already-open connection and is cached
 *     immutably.
 *  2. Start compiling it immediately on page load rather than lazily, so the
 *     WASM is warm by the time the first tile scrolls into view.
 *
 * This module must be imported before any Rive instance is created — see main.tsx.
 */
RuntimeLoader.setWasmUrl(riveWasmUrl)

// Kick off download + compile now. Every Rive instance on the page shares this
// single runtime, so this happens exactly once.
void RuntimeLoader.awaitInstance().catch(() => {
  // Non-fatal: the loader falls back to its CDN copy, and each animation
  // surfaces its own load failure.
})
