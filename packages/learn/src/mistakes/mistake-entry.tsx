"use client";

import { type TrueFalseLabels } from "@zoonk/core/library/exams/true-false-labels";
import { buttonVariants } from "@zoonk/ui/components/button";
import { LineMarker } from "@zoonk/ui/components/line-marker";
import { cn } from "@zoonk/ui/lib/utils";
import {
  CircleDashedIcon,
  EyeIcon,
  HandIcon,
  LightbulbIcon,
  type LucideIcon,
  TimerIcon,
  TriangleAlertIcon,
} from "lucide-react";
import { useExtracted, useFormatter } from "next-intl";
import { ANSWER_TONE } from "../_components/answer-tone";
import { LearnLink } from "../learn-link";
import { ItemLine, ItemStem, ItemText } from "../questions/item-text";
import { useTrueFalseLabels } from "../questions/use-true-false-labels";
import { MistakeStimulus } from "./mistake-stimulus";
import { type MistakeEntry } from "./mistakes-notebook";
import { useCauseLabel } from "./use-cause-label";

const CAUSE_ICON: Readonly<Record<NonNullable<MistakeEntry["cause"]> | "unsorted", LucideIcon>> = {
  gap: LightbulbIcon,
  guess: HandIcon,
  misread: EyeIcon,
  time: TimerIcon,
  trap: TriangleAlertIcon,
  unsorted: CircleDashedIcon,
};

function MistakeCauseLabel({
  cause,
  fixed = false,
}: {
  cause: MistakeEntry["cause"];
  fixed?: boolean;
}) {
  const t = useExtracted();
  const causeLabel = useCauseLabel();
  const CauseIcon = CAUSE_ICON[cause ?? "unsorted"];

  return (
    <p className="text-muted-foreground flex min-w-0 items-center gap-1.5 text-xs font-medium">
      <CauseIcon aria-hidden="true" className="size-3.5 shrink-0" />
      {fixed ? t("{cause} · Fixed", { cause: causeLabel(cause) }) : causeLabel(cause)}
    </p>
  );
}

function useEntryDate() {
  const format = useFormatter();

  return (date: Date) =>
    format.dateTime(date, {
      day: "numeric",
      month: "short",
      ...(date.getFullYear() === new Date().getFullYear() ? {} : { year: "numeric" }),
    });
}

export function MistakeAnswer({
  children,
  kind,
}: {
  children: React.ReactNode;
  kind: "learner" | "right";
}) {
  const t = useExtracted();
  const right = kind === "right";

  return (
    <p
      className={cn(
        "rounded-option flex w-full items-start gap-3 px-3.5 py-3 text-[0.9375rem] leading-6 font-medium",
        right ? ANSWER_TONE.right : ANSWER_TONE.wrong,
      )}
      data-slot="mistake-answer"
    >
      <span className="min-w-0 flex-1">
        <span className="sr-only">{right ? t("Right answer:") : t("You answered:")} </span>
        {children}
      </span>
      <LineMarker
        aria-hidden="true"
        className={cn(
          "text-[0.71875rem] font-[550]",
          right ? "text-success-text" : "text-destructive-text",
        )}
      >
        {right ? t("Correct") : t("Your answer")}
      </LineMarker>
    </p>
  );
}

type MistakeEntryLinks = { lesson: string | null; practiceSkill: string | null };

export function getMistakeEntryLinks({
  hrefs,
  mistake,
}: {
  hrefs: { lesson: string; practice: string };
  mistake: MistakeEntry;
}): MistakeEntryLinks {
  const skillId = mistake.practiceAvailable ? mistake.skill?.id : undefined;

  return {
    lesson: mistake.lesson ? `${hrefs.lesson}/${mistake.lesson.id}` : null,
    practiceSkill: skillId ? `${hrefs.practice}?${new URLSearchParams({ skill: skillId })}` : null,
  };
}

function MistakeEntryActions({
  links,
  availableTomorrow,
}: {
  links: MistakeEntryLinks;
  availableTomorrow: boolean;
}) {
  const t = useExtracted();

  if (!links.practiceSkill && !links.lesson && !availableTomorrow) {
    return null;
  }

  return (
    <div className="flex flex-wrap items-center gap-2 pt-1" data-slot="mistake-entry-actions">
      {availableTomorrow && (
        <p className="text-muted-foreground text-xs">{t("Practice tomorrow")}</p>
      )}
      {links.practiceSkill && (
        <LearnLink
          className={buttonVariants({ size: "sm", variant: "outline" })}
          href={links.practiceSkill}
          // Practice picks a fresh set of mistakes when it opens, so it isn't prefetched.
          prefetch={false}
        >
          {t("Practice this skill")}
        </LearnLink>
      )}

      {links.lesson && (
        <LearnLink
          className={buttonVariants({ size: "sm", variant: "ghost" })}
          href={links.lesson}
          // The lesson may still be unwritten (it writes itself once opened), as in lesson lists.
          prefetch="auto"
        >
          {t("Open the lesson")}
        </LearnLink>
      )}
    </div>
  );
}

export function MistakeEntryCard({
  continued = false,
  links,
  mistake,
  trueFalseLabels,
}: {
  continued?: boolean;
  links: MistakeEntryLinks;
  mistake: MistakeEntry;
  trueFalseLabels: TrueFalseLabels;
}) {
  const entryDate = useEntryDate();
  const { answerText } = useTrueFalseLabels(trueFalseLabels);
  const { snapshot } = mistake;
  const answer = answerText(snapshot.answer);
  const correct = answerText(snapshot.correctAnswer);
  const date = mistake.status === "fixed" && mistake.fixedAt ? mistake.fixedAt : mistake.createdAt;

  return (
    <li
      className="border-border lg:max-w-column flex flex-col gap-3 border-t py-4 text-sm first:border-t-0 first:pt-1"
      data-slot="mistake-entry"
      data-status={mistake.status}
    >
      <div className="text-muted-foreground flex items-center justify-between gap-3 text-xs">
        <MistakeCauseLabel cause={mistake.cause} fixed={mistake.status === "fixed"} />
        {/* Formatted in the viewer's time zone, which the server can't know. */}
        <time
          className="shrink-0 font-mono tabular-nums"
          dateTime={date.toISOString()}
          suppressHydrationWarning
        >
          {entryDate(date)}
        </time>
      </div>

      <MistakeStimulus continued={continued} snapshot={snapshot} />

      <div className="text-[0.9375rem] leading-snug font-medium lg:text-[1.1875rem] lg:leading-snug">
        <ItemStem text={snapshot.question} />
      </div>

      {(answer || correct) && (
        <div className="flex flex-col gap-2">
          {answer && (
            <MistakeAnswer kind="learner">
              <ItemLine text={answer} />
            </MistakeAnswer>
          )}
          {correct && (
            <MistakeAnswer kind="right">
              <ItemLine text={correct} />
            </MistakeAnswer>
          )}
        </div>
      )}

      {snapshot.explanation && (
        <ItemText className="text-muted-foreground leading-relaxed" text={snapshot.explanation} />
      )}

      <MistakeEntryActions links={links} availableTomorrow={mistake.practiceAvailableTomorrow} />
    </li>
  );
}
