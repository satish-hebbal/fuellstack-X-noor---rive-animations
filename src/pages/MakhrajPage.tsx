import { LetterPlayer } from '../components/LetterPlayer'
import { MakhrajDiagram } from '../components/MakhrajDiagram'
import '../styles-makhraj.css'

/**
 * The mouth diagram on its own page. The player itself is shared with the
 * gallery's letter collections — this only adds the page shell around it.
 */
export default function MakhrajPage() {
  return (
    <main className="mk">
      <h1 className="mk-title">Makhraj</h1>
      <LetterPlayer stage={MakhrajDiagram} />
    </main>
  )
}
