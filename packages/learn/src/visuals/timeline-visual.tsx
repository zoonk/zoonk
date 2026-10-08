import { type TimelineVisual } from "@zoonk/core/library/steps/contract";
import { cn } from "@zoonk/ui/lib/utils";

/**
 * Dated events in order down a rail, each date set apart from what happened, so the order and
 * the gaps read at a glance on a phone. It's a list, so screen readers count the events too.
 */
export function TimelineVisualView({
  className,
  visual,
}: {
  className?: string;
  visual: TimelineVisual;
}) {
  return (
    <figure
      className={cn("bg-card flex w-full flex-col gap-4 rounded-2xl border p-4", className)}
      data-slot="timeline-visual"
    >
      <figcaption className="text-foreground text-sm font-semibold text-balance">
        {visual.title}
      </figcaption>

      <ol className="flex flex-col">
        {visual.events.map((event, index) => {
          const key = `${event.date}-${index}`;
          const isLast = index === visual.events.length - 1;

          return (
            <li className="relative flex gap-3 pb-4 last:pb-0" key={key}>
              <span aria-hidden="true" className="relative flex w-3 shrink-0 justify-center">
                <span className="bg-viz-accent ring-card relative z-10 mt-1.5 size-3 rounded-full ring-4" />
                {!isLast && <span className="bg-border absolute top-3 -bottom-4 w-0.5" />}
              </span>

              <div className="flex min-w-0 flex-col gap-0.5">
                <p className="text-viz-accent text-sm font-semibold tabular-nums">{event.date}</p>
                <p className="text-foreground text-base leading-snug">{event.label}</p>
                {event.detail && (
                  <p className="text-muted-foreground text-sm leading-snug">{event.detail}</p>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </figure>
  );
}
