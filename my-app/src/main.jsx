import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// Reveal Material Symbols glyphs once the icon font has painted (prevents the raw
// ligature word flashing). Falls back after a short timeout so icons never stay
// blank if the font can't be fetched (offline / blocked CDN).
const markFontsLoaded = () => document.documentElement.classList.add('fonts-loaded')
if (document.fonts?.ready) document.fonts.ready.then(markFontsLoaded).catch(markFontsLoaded)
else markFontsLoaded()
setTimeout(markFontsLoaded, 3000)

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
