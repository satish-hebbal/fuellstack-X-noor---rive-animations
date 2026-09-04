import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],

  server: {
    port: 5173,
    // Fail loudly instead of drifting to 5174. The Google API key is
    // restricted to an exact origin, so a silently different port shows up as
    // a confusing "the API key rejected this site's address" error instead of
    // an obvious "port in use".
    strictPort: true,
  },

  // Served from the domain root; the app routes /noor and /makhraj itself.
  base: '/',

  // Teach Vite that .riv is a static asset. Files in src/rive/ are then emitted
  // with a content hash, so browsers cache them forever and re-download only
  // the ones you actually change.
  assetsInclude: ['**/*.riv'],

  build: {
    outDir: 'dist',

    // Never base64-inline .riv or .wasm into the JS bundle. Keeping them as
    // separate requests means they stream in parallel and stay cacheable.
    assetsInlineLimit: 0,
  },
})
