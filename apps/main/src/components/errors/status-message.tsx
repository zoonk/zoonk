import { cn } from "@zoonk/ui/lib/utils";
import { type ReactNode } from "react";

/**
 * What a page that couldn't show says, as one centered unit: an icon tile to land on, what
 * happened in plain words, a line on why, and the way on. The 404 and the error pages share it, so
 * they read the same.
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
      <span className="bg-muted text-foreground flex size-16 items-center justify-center rounded-2xl [&_svg]:size-7">
        {icon}
      </span>

      <h1 className="mt-6 text-3xl font-bold tracking-tight text-balance sm:text-4xl">{title}</h1>

      <p className="text-muted-foreground mt-3 text-base leading-relaxed text-pretty sm:text-lg">
        {description}
      </p>

      <div className="mt-8 flex flex-col items-center gap-2">{children}</div>
    </div>
  );
}
