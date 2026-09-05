import { MakhrajPlayer } from '../components/MakhrajPlayer'
import '../styles-makhraj.css'

/**
 * The letter diagram on its own page. The player itself is shared with the
 * gallery's letter collection — this only adds the page shell around it.
 */
export default function MakhrajPage() {
  return (
    <main className="mk">
      <h1 className="mk-title">Makhraj</h1>
      <MakhrajPlayer />
    </main>
  )
}
