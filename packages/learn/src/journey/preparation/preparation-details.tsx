"use client";

import { type ProgressView } from "@zoonk/core/view-models/progress/get";
import { useExtracted } from "next-intl";
import { BigQuantity } from "../../_components/big-quantity";
import { KindDot, KindMark } from "../../_components/kind-tile";
import { ListRowChevron } from "../../_components/list-group";
import { Meter, MeterFill } from "../../_components/meter";
import { QuietDisclosure } from "../../_components/quiet-disclosure";
import { SectionLabel } from "../../_components/section-label";
import { useScoreRange } from "../../_utils/use-score-range";
import { LearnLink } from "../../learn-link";
import { type Lessons, type Preparation, usePreparationParts } from "./use-preparation-parts";
import { type StillNeededItem, useStillNeeded } from "./use-still-needed";

function EstimateWaits({ preparation }: { preparation: Preparation }) {
  const t = useExtracted();
  const { mocks } = preparation.components;

  if (mocks.kind !== "mockExams" || mocks.taken === 0) {
    return null;
  }

  return (
    <p
      className="text-muted-foreground flex items-baseline gap-3 text-sm"
      data-slot="estimate-waits"
    >
      <KindDot className="-translate-y-px" kind="mock" />
      {t("Take a full or half mock exam to see your estimated score.")}
    </p>
  );
}

/** Always a range labeled "Estimated", so it never reads as a promise. */
function EstimatedScore({ preparation }: { preparation: Preparation }) {
  const t = useExtracted();
  const scoreRange = useScoreRange();
  const score = preparation.estimatedScore;

  if (!score) {
    return <EstimateWaits preparation={preparation} />;
  }

  return (
    <div className="flex flex-col" data-slot="estimated-score">
      <p className="flex min-w-0 flex-col gap-1">
        <span className="text-label">{t("Estimated score")}</span>
        <span className="text-readout text-2xl leading-tight">{scoreRange(score)}</span>
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

function useMeasureNote(forExam: boolean): string {
  const t = useExtracted();

  return forExam
    ? t(
        "Each subject counts as much as it's worth on the exam. A subject's number is how much of it you've studied times how well you answer, and it stays under 75% until you take a mock exam.",
      )
    : t(
        "The share of your plan's lessons you've studied or already knew. Right answers, what you remember and weekly challenges show how well you know them.",
      );
}

function Readout({ share, value }: { share: number; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2" data-slot="preparation-readout">
      <span className="text-readout text-[2.5rem] leading-none">
        {typeof value === "string" ? <BigQuantity>{value}</BigQuantity> : value}
      </span>
      <Meter>
        <MeterFill className="bg-success" share={share} />
      </Meter>
    </div>
  );
}

function PreparationParts({
  forExam,
  lessons,
  preparation,
}: {
  forExam: boolean;
  lessons: Lessons | null;
  preparation: Preparation;
}) {
  const parts = usePreparationParts({ lessons: forExam ? null : lessons, preparation });

  return (
    <dl className="flex flex-col text-sm [&>div+div]:border-t" data-slot="preparation-parts">
      {parts.map((part) => (
        <div
          className="flex min-h-11 items-center justify-between gap-4 py-2"
          data-part={part.key}
          key={part.key}
        >
          <dt className="text-muted-foreground">{part.label}</dt>
          <dd className="font-mono tabular-nums">{part.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function StillNeededRow({ examHref, item }: { examHref: string | null; item: StillNeededItem }) {
  const content = (
    <>
      <KindMark kind={item.kind} />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-sm font-medium">{item.label}</span>
        {item.detail && <span className="text-muted-foreground text-xs">{item.detail}</span>}
      </span>
    </>
  );

  if (item.key === "test" && item.kind === "mock" && examHref) {
    return (
      <LearnLink
        className="hover:bg-muted/70 focus-visible:ring-ring/50 -mx-2.5 flex min-h-12 items-center gap-3 rounded-lg px-2.5 py-1.5 transition-colors outline-none focus-visible:ring-[3px]"
        href={examHref}
      >
        {content}
        <ListRowChevron />
      </LearnLink>
    );
  }

  return <div className="flex min-h-12 items-center gap-3 py-1.5">{content}</div>;
}

function StillNeeded({
  examHref,
  forExam,
  preparation,
  stillNeeded,
}: {
  examHref: string | null;
  forExam: boolean;
  preparation: Preparation;
  stillNeeded: ProgressView["stillNeeded"];
}) {
  const t = useExtracted();
  const items = useStillNeeded({ forExam, preparation, stillNeeded });

  if (items.length === 0) {
    return null;
  }

  return (
    <section aria-labelledby="still-needed-title" className="flex flex-col gap-2">
      <SectionLabel id="still-needed-title">{t("Next")}</SectionLabel>
      <ul className="flex flex-col [&>li+li]:border-t">
        {items.map((item) => (
          <li key={item.key}>
            <StillNeededRow examHref={examHref} item={item} />
          </li>
        ))}
      </ul>
    </section>
  );
}

export function PreparationDetails({
  examHref,
  forExam,
  lessons,
  preparation,
  share,
  stillNeeded,
  value,
}: {
  examHref: string | null;
  forExam: boolean;
  lessons: Lessons | null;
  preparation: Preparation;
  share: number;
  stillNeeded: ProgressView["stillNeeded"];
  value: React.ReactNode;
}) {
  const t = useExtracted();
  const note = useMeasureNote(forExam);

  return (
    <div className="flex flex-col gap-6">
      <Readout share={share} value={value} />
      <EstimatedScore preparation={preparation} />
      <PreparationParts forExam={forExam} lessons={lessons} preparation={preparation} />
      <StillNeeded
        examHref={examHref}
        forExam={forExam}
        preparation={preparation}
        stillNeeded={stillNeeded}
      />
      <QuietDisclosure label={t("How it's calculated")}>
        <p className="text-muted-foreground text-compact pt-2 leading-normal text-pretty">{note}</p>
      </QuietDisclosure>
    </div>
  );
}
