"use client";

import { type PlanPhaseCheckpointView } from "@zoonk/core/plans/view-contract";
import { Trickster } from "@zoonk/ui/components/trickster";
import { cn } from "@zoonk/ui/lib/utils";
import { ChevronRightIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { KindTile } from "../_components/kind-tile";
import { PlusMark } from "../_components/plus-lock";
import { useFormatIsoDate } from "../_utils/iso-date";
import { LearnLink } from "../learn-link";
import { type JourneyPathLinks } from "./journey-links";

/**
 * A row inside a phase of the path (a chapter, its challenge or its next mock): its box starts where
 * the phase's title starts and keeps its content as far in as the phase's dates, so the rows'
 * marks line up with each other and their dates and chevrons with the phases'.
 */
export const PATH_ROW_CLASS =
  "flex min-h-11 w-full items-center gap-3 rounded-xl px-3 py-1.5 text-left text-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50";

/** A path row's mark, tile or face, in one width so the rows' text starts in one place. */
export const PATH_ROW_LEADING_CLASS = "flex size-7 shrink-0 items-center justify-center";

/** A phase's event (its mock, its challenge): a soft row of its own, opening its page. */
const EVENT_ROW_CLASS = cn(
  PATH_ROW_CLASS,
  "bg-foreground/4 hover:bg-foreground/8 transition-colors dark:bg-white/4 dark:hover:bg-white/8",
);

function EventChevron() {
  return (
    <ChevronRightIcon aria-hidden="true" className="text-muted-foreground/60 size-4 shrink-0" />
  );
}

/** The phase's checkpoint, the Trickster's challenge, at the end of its phase. */
export function CheckpointRow({
  checkpoint,
  links,
}: {
  checkpoint: PlanPhaseCheckpointView;
  links: JourneyPathLinks;
}) {
  const t = useExtracted();
  const formatDate = useFormatIsoDate();
  const isDone = checkpoint.state === "done";

  return (
    <LearnLink className={EVENT_ROW_CLASS} href={links.challenge(checkpoint.planItemId)}>
      <Trickster className="size-7" />
      <span className={cn("min-w-0 flex-1 font-medium", isDone && "text-muted-foreground")}>
        {t("Phase challenge")}
      </span>
      <span className="text-muted-foreground shrink-0 text-sm">
        {isDone && t("Won")}
        {!isDone && checkpoint.date && formatDate(checkpoint.date, "day")}
      </span>
      <EventChevron />
    </LearnLink>
  );
}

/**
 * The phase's next mock exam and its day; an exam's opens "About the exam", where its mocks are.
 * The mock itself opens from Today on its day. Without Plus it's marked Plus (`locked`).
 */
export function MockRow({
  date,
  examHref,
  locked = false,
}: {
  date: string;
  examHref: string | null;
  locked?: boolean;
}) {
  const t = useExtracted();
  const formatDate = useFormatIsoDate();

  const content = (
    <>
      <KindTile className="size-7" kind="mock" size="sm" />
      <span className="flex min-w-0 flex-1 items-center gap-2 font-medium">
        {t("Mock exam")}
        {locked && <PlusMark />}
      </span>
      <span className="text-muted-foreground shrink-0 text-sm">{formatDate(date, "day")}</span>
    </>
  );

  if (!examHref) {
    return <div className={EVENT_ROW_CLASS}>{content}</div>;
  }

  return (
    <LearnLink className={EVENT_ROW_CLASS} href={examHref}>
      {content}
      <EventChevron />
    </LearnLink>
  );
}
