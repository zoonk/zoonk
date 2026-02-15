"use client";

import {
  type SupportedVisualKind,
  type VisualContentByKind,
  timelineVisualContentSchema,
} from "@zoonk/core/steps/visual-content-contract";
import { useExtracted } from "next-intl";

function TimelineEvent({
  date,
  description,
  hasLine,
  title,
}: {
  date: string;
  description: string;
  hasLine: boolean;
  title: string;
}) {
  return (
    <li className="relative pb-8 last:pb-0">
      <div className="flex items-center gap-3">
        <span aria-hidden="true" className="bg-foreground size-2 shrink-0 rounded-full" />
        <time className="text-muted-foreground text-xs font-medium tracking-wide">{date}</time>
      </div>

      {hasLine ? (
        <span aria-hidden="true" className="bg-border absolute top-4.5 bottom-0 left-0.75 w-px" />
      ) : null}

      <div className="pl-5">
        <p className="text-sm font-semibold">{title}</p>
        <p className="text-muted-foreground text-sm leading-relaxed">{description}</p>
      </div>
    </li>
  );
}

export function TimelineVisual({ content }: { content: VisualContentByKind[SupportedVisualKind] }) {
  const t = useExtracted();
  const parsed = timelineVisualContentSchema.parse(content);
  const hasMultipleEvents = parsed.events.length > 1;

  return (
    <figure aria-label={t("Timeline")} className="w-full max-w-xl">
      <ol className="ml-3" role="list">
        {parsed.events.map((event, index) => (
          <TimelineEvent
            date={event.date}
            description={event.description}
            hasLine={hasMultipleEvents && index < parsed.events.length - 1}
            key={event.date}
            title={event.title}
          />
        ))}
      </ol>
    </figure>
  );
}
