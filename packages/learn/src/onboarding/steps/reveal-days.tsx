"use client";

import { type PlanRevealDays } from "@zoonk/core/view-models/today/plan-reveal";
import { useCelebration } from "@zoonk/ui/hooks/celebration";
import { BEAT_MS } from "@zoonk/ui/lib/motion";
import { cn } from "@zoonk/ui/lib/utils";
import { safeAsync } from "@zoonk/utils/error";
import { useExtracted, useFormatter } from "next-intl";
import { useState, useTransition } from "react";
import {
  ListGroup,
  ListRow,
  ListRowButton,
  ListRowContent,
  ListRowDescription,
  ListRowIcon,
  ListRowLeading,
  ListRowTitle,
} from "../../_components/list-group";
import {
  PageSection,
  PageSectionDetail,
  PageSectionHeader,
  PageSectionTitle,
} from "../../_components/page";
import { StepOpenFailed } from "../../_components/step-open-failed";
import { useFormatDuration } from "../../_utils/time-format";
import { BlockMark } from "../../session/block-mark";
import { DayStepOpener } from "../../session/day-step-opener";
import { type DayStep } from "../../session/session-types";
import { useBlockTitle } from "../../session/use-block-copy";
import { isFinished, splitTodayQueue } from "../../today/today-queue";
import { useStepLabel } from "../../today/use-row-label";

/** Lands on the moment's third beat, after the check and the lesson count. */
function NextTag({ children }: { children: string }) {
  const celebrate = useCelebration();

  return (
    <span
      className={cn("inline-block", celebrate && "animate-settle")}
      style={celebrate ? { animationDelay: `${2 * BEAT_MS}ms` } : undefined}
    >
      <span className="text-success-text font-medium">{children}</span>
      {" ·\u00A0"}
    </span>
  );
}

function TodayRow({
  block,
  line,
  locked,
  onOpen,
  tag,
}: {
  block: DayStep;
  line: string | null;
  locked: boolean;
  onOpen: (() => Promise<boolean>) | null;
  tag: string | null;
}) {
  const t = useExtracted();
  const title = useBlockTitle();
  const formatDuration = useFormatDuration();
  const [pending, startTransition] = useTransition();
  const [failed, setFailed] = useState(false);
  const details = [line, formatDuration(block.estimatedMinutes)].filter(Boolean);

  const content = (
    <>
      <ListRowLeading>
        <ListRowIcon>
          <BlockMark block={block} />
        </ListRowIcon>
      </ListRowLeading>

      <ListRowContent>
        <ListRowTitle className={cn(isFinished(block) && "text-muted-foreground")}>
          {title(block)}
        </ListRowTitle>

        <ListRowDescription>
          {block.status === "completed" && `${t("Done")} · `}
          {tag && <NextTag>{tag}</NextTag>}
          {details.join(" · ")}
        </ListRowDescription>
      </ListRowContent>
    </>
  );

  if (!onOpen) {
    return <ListRow data-highlighted={tag ? "" : undefined}>{content}</ListRow>;
  }

  const open = () => {
    setFailed(false);

    startTransition(async () => {
      const { data: opened } = await safeAsync(onOpen);
      setFailed(!opened);
    });
  };

  const busy = pending || locked;

  // A submit of the list's form, so a tap before the page hydrates opens the step once it does.
  return (
    <>
      <ListRowButton
        aria-busy={pending || undefined}
        data-highlighted={tag ? "" : undefined}
        disabled={busy}
        formAction={busy ? undefined : () => open()}
        type={busy ? "button" : "submit"}
      >
        {content}
      </ListRowButton>

      {failed && <StepOpenFailed className="-mt-0.5 pb-2.75 pl-7" />}
    </>
  );
}

function useFormatDay() {
  const format = useFormatter();

  return (date: Date) =>
    format.dateTime(date, { day: "numeric", month: "short", timeZone: "UTC", weekday: "short" });
}

function opensFromReveal(block: DayStep): boolean {
  return !isFinished(block) && !block.waitReason;
}

/** The step Start opens, as its tagged row does; null sends Start to Today instead. */
export function findRevealStart(reveal: PlanRevealDays | null): DayStep | null {
  const session = reveal?.today;
  const next = session?.blocks.find((block) => block.position === session.nextPosition);
  return next && opensFromReveal(next) ? next : null;
}

/**
 * The reveal's rows and Start open a step through one opener, which ends the reveal
 * (`markRevealed`) first, so Today never sends the learner back here. Null without a day to open.
 */
export function RevealDayOpener({
  children,
  goalId,
  markRevealed,
  refresh,
  reveal,
}: {
  children: (open: ((step: DayStep) => Promise<boolean>) | null) => React.ReactNode;
  goalId: string;
  markRevealed: () => Promise<boolean>;
  refresh: () => void;
  reveal: PlanRevealDays | null;
}) {
  if (!reveal) {
    return children(null);
  }

  return (
    <DayStepOpener beforeOpen={markRevealed} day={reveal.today} goalId={goalId} refresh={refresh}>
      {children}
    </DayStepOpener>
  );
}

/** Today's own day, in Today's order: what the learner finished, then where they go on. */
export function RevealToday({
  locked,
  open,
  reveal,
}: {
  /** While Start opens its step, so a row tapped meanwhile can't open another. */
  locked: boolean;
  open: ((step: DayStep) => Promise<boolean>) | null;
  reveal: PlanRevealDays | null;
}) {
  const t = useExtracted();
  const session = reveal?.today;
  const formatDay = useFormatDay();
  const formatDuration = useFormatDuration();
  const catchUp = new Set(session?.catchUp?.positions);
  const label = useStepLabel((step) => catchUp.has(step.position));
  const next = session?.blocks.find((block) => block.position === session.nextPosition);

  if (!reveal || !session || session.blocks.length === 0) {
    return null;
  }

  const { after, before, done } = next
    ? splitTodayQueue({ blocks: session.blocks, nextPosition: next.position })
    : { after: [], before: [], done: session.blocks };

  const nextTag = done.length > 0 ? t("Up next") : t("Start here");

  return (
    <PageSection aria-labelledby="reveal-today">
      <PageSectionHeader>
        <PageSectionTitle id="reveal-today">{t("Today")}</PageSectionTitle>
        <PageSectionDetail>
          {`${formatDay(session.localDate)} · ${formatDuration(reveal.minutes)}`}
        </PageSectionDetail>
      </PageSectionHeader>

      <form className="contents">
        <ListGroup>
          {[...done, ...before, ...(next ? [next] : []), ...after].map((block) => (
            <TodayRow
              block={block}
              key={block.position}
              line={label(block)}
              locked={locked}
              onOpen={open && opensFromReveal(block) ? () => open(block) : null}
              tag={block === next ? nextTag : null}
            />
          ))}
        </ListGroup>
      </form>
    </PageSection>
  );
}
