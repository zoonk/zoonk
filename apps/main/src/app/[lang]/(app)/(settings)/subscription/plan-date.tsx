/** The `<mono>` chunk of a plan's date line, so its digits line up. */
export function renderPlanDate(chunks: React.ReactNode) {
  return <span className="tabular-nums">{chunks}</span>;
}
