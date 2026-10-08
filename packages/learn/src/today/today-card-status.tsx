"use client";

import { cn } from "@zoonk/ui/lib/utils";

/**
 * The session card when there's no block to start: the day is done, it's a rest day, the study
 * time ran out, or the lessons are still being prepared. An image to anchor it, one bold line, a
 * quieter one, and the actions right under them. The lines are a status, so a day that changes
 * while the learner is here (lessons that arrive) is announced.
 */
export function TodayCardStatus({
  art,
  children,
  detail,
  title,
}: {
  art: React.ReactNode;
  children?: React.ReactNode;
  detail?: string | null;
  title: string;
}) {
  return (
    <div
      className="flex flex-col items-center gap-5 py-2 text-center"
      data-slot="today-card-status"
    >
      {art}

      <div className="flex flex-col gap-1" role="status">
        <h2 className="text-2xl font-bold tracking-tight text-balance">{title}</h2>
        {detail && <p className="text-muted-foreground text-balance">{detail}</p>}
      </div>

      {children && <div className="flex w-full flex-col gap-2">{children}</div>}
    </div>
  );
}

/** The status's image when there's no buddy to show: an icon on a tinted tile. */
export function TodayStatusTile({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex size-16 shrink-0 items-center justify-center rounded-2xl [&>svg]:size-8",
        className,
      )}
    >
      {children}
    </span>
  );
}
