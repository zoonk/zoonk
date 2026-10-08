"use client";

import { type ProgressView } from "@zoonk/core/view-models/progress/get";
import { cn } from "@zoonk/ui/lib/utils";
import { ChevronRightIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { KindTile } from "../../_components/kind-tile";
import { PlusMark } from "../../_components/plus-lock";
import { ProgressRing } from "../../_components/progress-ring";
import { SectionLabel } from "../../_components/section-label";
import { useFormatShare } from "../../_utils/percent";
import { useScoreRange } from "../../_utils/use-score-range";
import { LearnLink } from "../../learn-link";
import { type Preparation, usePreparationParts } from "./use-preparation-parts";
import { type StillNeededItem, useStillNeeded } from "./use-still-needed";

/**
 * The estimated score exists only after a mock exam, always as a range and always labeled
 * "Estimated", so it never reads as a promise.
 */
function EstimatedScore({ preparation }: { preparation: Preparation }) {
  const t = useExtracted();
  const scoreRange = useScoreRange();
  const score = preparation.estimatedScore;

  if (!score) {
    return null;
  }

  return (
    <div
      className="bg-muted/60 flex items-center gap-4 rounded-2xl p-4"
      data-slot="estimated-score"
    >
      <KindTile kind="mock" />
      <p className="flex min-w-0 flex-col">
        <span className="text-muted-foreground text-xs font-medium">{t("Estimated score")}</span>
        <span className="text-2xl font-bold tracking-tight tabular-nums">{scoreRange(score)}</span>
        <span className="text-muted-foreground text-xs">
          {t(
            "{count, plural, one {Based on your last mock exam} other {Based on your last # mock exams}}",
            { count: score.mocks },
          )}
        </span>
      </p>
    </div>
  );
}

/** How the number is made, and the test it waits for: the one the learner's plan has. */
function MeasureNote({
  forExam,
  testKind,
}: {
  forExam: boolean;
  testKind: Preparation["components"]["mocks"]["kind"];
}) {
  const t = useExtracted();

  if (!forExam) {
    return t(
      "Your progress is how much you've studied times how well you know it: right answers, memory and weekly challenges. Harder topics count more, and it stays under 75% until you've answered them and taken a weekly challenge.",
    );
  }

  return testKind === "fullReviews"
    ? t(
        "Your preparation is how much you've studied times how well you know it: right answers, memory and full reviews. Harder and more frequent topics count more, and it stays under 75% until you've answered them and done a full review in your test's format.",
      )
    : t(
        "Your preparation is how much you've studied times how well you know it: right answers, memory and mock exams. Harder and more frequent topics count more, and it stays under 75% until you've answered them and taken a mock exam.",
      );
}

/**
 * The four parts of preparation as four small rings side by side, each with its share inside (a
 * dash until there's evidence), its name and its evidence in a few words.
 */
function PreparationParts({
  forExam,
  preparation,
}: {
  forExam: boolean;
  preparation: Preparation;
}) {
  const t = useExtracted();
  const parts = usePreparationParts(preparation);
  const formatShare = useFormatShare();

  return (
    <section aria-labelledby="preparation-parts-title" className="flex flex-col gap-4">
      <SectionLabel className="sr-only" id="preparation-parts-title">
        {forExam ? t("How it's measured") : t("How your progress is measured")}
      </SectionLabel>

      <ul className="grid grid-cols-2 gap-x-4 gap-y-5 sm:grid-cols-4">
        {parts.map((part) => (
          <li
            className="flex items-center gap-3 sm:flex-col sm:items-start"
            data-part={part.key}
            key={part.key}
          >
            <ProgressRing className="size-14" share={part.value ?? 0}>
              <span
                className={cn(
                  "text-sm font-semibold tabular-nums",
                  part.value === null && "text-muted-foreground",
                )}
              >
                {part.value === null ? "–" : formatShare(part.value)}
              </span>
            </ProgressRing>
            <span className="flex min-w-0 flex-col">
              <span className="text-sm leading-snug font-medium">
                {part.label}
                {part.value !== null && (
                  <span className="sr-only">{`: ${formatShare(part.value)}`}</span>
                )}
              </span>
              <span className="text-muted-foreground text-xs">{part.caption}</span>
            </span>
          </li>
        ))}
      </ul>

      <p className="text-muted-foreground text-xs">
        <MeasureNote forExam={forExam} testKind={preparation.components.mocks.kind} />
      </p>
    </section>
  );
}

function StillNeededRow({ examHref, item }: { examHref: string | null; item: StillNeededItem }) {
  const content = (
    <>
      <KindTile kind={item.kind} size="sm" />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-sm font-medium">{item.label}</span>
        {item.detail && <span className="text-muted-foreground text-xs">{item.detail}</span>}
      </span>
      {item.plusRequired && <PlusMark />}
    </>
  );

  // A mock exam is taken from the exam's page.
  if (item.key === "test" && item.kind === "mock" && examHref) {
    return (
      <LearnLink
        className="hover:bg-muted/60 focus-visible:ring-ring/50 -mx-2 flex min-h-12 items-center gap-3 rounded-xl px-2 py-1.5 transition-colors outline-none focus-visible:ring-[3px]"
        href={examHref}
      >
        {content}
        <ChevronRightIcon aria-hidden="true" className="text-muted-foreground size-4 shrink-0" />
      </LearnLink>
    );
  }

  return <div className="flex min-h-12 items-center gap-3 py-1.5">{content}</div>;
}

/** The one or two things still to do to reach the goal, as rows to act on. */
function StillNeeded({
  examHref,
  preparation,
  stillNeeded,
}: {
  examHref: string | null;
  preparation: Preparation;
  stillNeeded: ProgressView["stillNeeded"];
}) {
  const t = useExtracted();
  const items = useStillNeeded({ preparation, stillNeeded });

  if (items.length === 0) {
    return null;
  }

  return (
    <section aria-labelledby="still-needed-title" className="flex flex-col gap-2">
      <SectionLabel id="still-needed-title">{t("Still to do")}</SectionLabel>
      <ul className="flex flex-col">
        {items.map((item) => (
          <li key={item.key}>
            <StillNeededRow examHref={examHref} item={item} />
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * What's behind the preparation number, at a glance: the estimated score after a mock, the four
 * parts as small rings, and the one or two things still to do. A goal that isn't an exam calls the
 * number progress, never preparation.
 */
export function PreparationDetails({
  examHref,
  forExam,
  preparation,
  stillNeeded,
}: {
  /** The exam's page, where mock exams are taken; null for goals without one. */
  examHref: string | null;
  forExam: boolean;
  preparation: Preparation;
  stillNeeded: ProgressView["stillNeeded"];
}) {
  return (
    <div className="flex flex-col gap-7">
      <EstimatedScore preparation={preparation} />
      <PreparationParts forExam={forExam} preparation={preparation} />
      <StillNeeded examHref={examHref} preparation={preparation} stillNeeded={stillNeeded} />
    </div>
  );
}
