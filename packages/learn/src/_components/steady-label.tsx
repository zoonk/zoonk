/**
 * A button's label that changes with the screen's state and never changes the button's width: every
 * label it can show takes the same cell, so the button is as wide as the widest in any language and
 * what sits beside it never moves.
 */
export function SteadyLabel({ labels, shown }: { labels: readonly string[]; shown: string }) {
  return (
    <span className="grid" data-slot="steady-label">
      {labels.map((label) => (
        <span
          aria-hidden={label === shown ? undefined : true}
          className={
            label === shown ? "col-start-1 row-start-1" : "invisible col-start-1 row-start-1"
          }
          key={label}
        >
          {label}
        </span>
      ))}
    </span>
  );
}
