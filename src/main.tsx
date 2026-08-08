// Must come first: it points the Rive runtime at our self-hosted .wasm and
// starts compiling it before any animation asks for it.
import './lib/riveRuntime'

import { createRoot } from 'react-dom/client'
import App from './App'
import './styles.css'

// No <StrictMode> on purpose. Its dev-only double-mount would build, tear down
// and rebuild every Rive instance on the page, which makes local performance
// look far worse than production actually is.
createRoot(document.getElementById('root')!).render(<App />)
