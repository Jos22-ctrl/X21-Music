/** Fondo de tres capas: portada difuminada, radiales teñidos y oscurecimiento adaptativo. */
export function AmbientBackdrop() {
  return (
    <div className="ambient" aria-hidden="true">
      <div className="ambient__cover" />
      <div className="ambient__gradient" />
      <div className="ambient__dim" />
    </div>
  )
}
