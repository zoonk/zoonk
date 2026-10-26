import { type ReactNode } from "react";

/**
 * A block beside a public page's main column (a shared plan's phases): its title, a quiet line of
 * mono facts and its rows, flat, as Today's aside draws its blocks.
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
        <h2 className="text-[0.9375rem] leading-snug font-semibold" id={id}>
          {title}
        </h2>

        {facts && <p className="text-muted-foreground font-mono text-xs tabular-nums">{facts}</p>}
      </div>

      {children}
    </section>
  );
}
