import { cn } from "@zoonk/ui/lib/utils";
import { type ReactNode } from "react";

/**
 * What a page that couldn't show says, as one centered unit: a quiet glyph (bare, as every empty
 * state draws it, never on a tile), what happened in plain words as the page's title, a line on
 * why, and the way on. The 404 and the error pages share it, so they read the same.
 */
export function StatusMessage({
  children,
  className,
  description,
  icon,
  title,
}: {
  /** The way on: the one main action first. */
  children: ReactNode;
  className?: string;
  description: string;
  icon: ReactNode;
  title: string;
}) {
  return (
    <div
      className={cn(
        "mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center px-5 py-16 text-center",
        className,
      )}
    >
      <span className="text-muted-foreground flex [&_svg]:size-8">{icon}</span>

      <h1 className="text-title mt-5">{title}</h1>

      <p className="text-lead mt-3">{description}</p>

      <div className="mt-8 flex flex-col items-center gap-2">{children}</div>
    </div>
  );
}
