import { type ReactNode } from "react";

/**
 * A block of a catalog page's aside (a lesson's chapter): its label, a quiet line of mono facts
 * and its rows, flat on the aside, as Today's aside draws its blocks.
 */
export function CatalogAsideBlock({
  children,
  facts,
  id,
  title,
}: {
  children: ReactNode;
  /** The block's numbers in one line ("37 short lessons · about 2 hr"). */
  facts?: ReactNode;
  /** Names the block for screen readers by its label. */
  id: string;
  title: ReactNode;
}) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <h2 className="text-label" id={id}>
          {title}
        </h2>

        {facts && <p className="text-muted-foreground font-mono text-xs tabular-nums">{facts}</p>}
      </div>

      {children}
    </section>
  );
}
