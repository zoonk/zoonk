/**
 * Every label takes the same grid cell and only `shown` is visible, so the button stays as wide as
 * its widest label in any language and what sits beside it never moves.
 */
export function SteadyLabel({ labels, shown }: { labels: readonly string[]; shown: number }) {
  return (
    <span className="grid" data-slot="steady-label">
      {labels.map((label, index) => (
        <span
          aria-hidden={index === shown ? undefined : true}
          className={
            index === shown ? "col-start-1 row-start-1" : "invisible col-start-1 row-start-1"
          }
          // oxlint-disable-next-line react/no-array-index-key -- The labels are a fixed list of states.
          key={index}
        >
          {label}
        </span>
      ))}
    </span>
  );
}
