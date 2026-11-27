/**
 * A button's label that changes with the screen's state and never changes the button's width: every
 * label it can show takes the same cell, so the button is as wide as the widest in any language and
 * what sits beside it never moves. `shown` is the index of the label to show.
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
