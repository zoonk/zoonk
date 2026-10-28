import { type ReactNode } from "react";

export function CatalogAsideBlock({
  children,
  facts,
  id,
  title,
}: {
  children: ReactNode;
  facts?: ReactNode;
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
