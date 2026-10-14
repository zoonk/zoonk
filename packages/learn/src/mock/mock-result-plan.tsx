"use client";

import { type MockResult } from "@zoonk/core/exams/mocks/contract";
import { type MockAdaptView } from "@zoonk/core/exams/mocks/view-contract";
import { Button } from "@zoonk/ui/components/button";
import { Spinner } from "@zoonk/ui/components/spinner";
import { cn } from "@zoonk/ui/lib/utils";
import { CircleCheckIcon } from "lucide-react";
import { useExtracted, useFormatter } from "next-intl";
import { useId, useState, useTransition } from "react";
import { type DiffLine, DiffLines } from "../_components/diff-lines";
import { Meter, MeterFill } from "../_components/meter";
import { StepCard, StepDetail, StepEyebrow, StepHeader, StepTitle } from "../_components/step-card";
import { useFormatShare } from "../_utils/percent";
import { type MockPlanOffer, type MockPlanOfferOutcome, useMockScreen } from "./mock-context";

/** A plan offer once answered: what the learner said, and what it did. */
type Answer = { outcome: MockPlanOfferOutcome } | { declined: true } | { failed: true };

type Answers = Partial<Record<MockPlanOffer, Answer>>;

/** Topics named in the change: the first three, then how many more. */
const TOPICS_NAMED = 3;

/** The offers a finished mock makes, in the order they're applied: skip first, then focus. */
function getOffers(adapt: MockAdaptView): MockPlanOffer[] {
  return [adapt.skip && "skip", adapt.focus && "focus"].filter(
    (offer): offer is MockPlanOffer => typeof offer === "string",
  );
}

function isSettled(answer: Answer | undefined): boolean {
  return answer !== undefined && !("failed" in answer);
}

/** Applies the offers one after the other (both change the plan), each with what it came to. */
function applyOffers({
  adapt,
  offers,
}: {
  adapt: (offer: MockPlanOffer) => Promise<MockPlanOfferOutcome | null>;
  offers: readonly MockPlanOffer[];
}): Promise<Answers> {
  return offers.reduce<Promise<Answers>>(async (previous, offer) => {
    const answers = await previous;
    const outcome = await adapt(offer).catch(() => null);
    return { ...answers, [offer]: outcome ? { outcome } : { failed: true } };
  }, Promise.resolve({}));
}

/**
 * What a finished mock offers to change in the plan (`MockAdaptView`), as one change the learner
 * applies or not: skip the lessons of the topics it showed they know and give the area that went
 * worst more time. Nothing changes until they say so. One state for every place it's drawn (a
 * phone's step, a wide screen's aside), so applying it in one shows in the other.
 */
export function usePlanChange(adapt: MockAdaptView | null) {
  const { actions } = useMockScreen();
  const [answers, setAnswers] = useState<Answers>({});
  const [isPending, startTransition] = useTransition();
  const offers = adapt ? getOffers(adapt) : [];
  const open = offers.filter((offer) => !isSettled(answers[offer]));

  return {
    adapt,
    answers,
    apply: () =>
      startTransition(async () => {
        const applied = await applyOffers({ adapt: actions.adapt, offers: open });
        setAnswers((current) => ({ ...current, ...applied }));
      }),
    isPending,
    // What already went through stays; only what's still open is kept as it was.
    keep: () =>
      setAnswers((current) => ({
        ...current,
        ...Object.fromEntries(open.map((offer) => [offer, { declined: true }])),
      })),
    offers,
    settled: open.length === 0,
  };
}

export type PlanChange = ReturnType<typeof usePlanChange>;

function useAnswerLine() {
  const t = useExtracted();

  return ({ answer, offer }: { answer: Answer; offer: MockPlanOffer }): string => {
    if ("declined" in answer) {
      return t("Your plan stays as it is.");
    }

    if ("failed" in answer) {
      return t("That didn't go through. Try again.");
    }

    const { outcome } = answer;

    if (outcome.status === "applied") {
      return offer === "skip"
        ? t("Done: {count, plural, one {# lesson} other {# lessons}} off your plan.", {
            count: outcome.lessonsSkipped,
          })
        : t("Done: your plan gives it more time from now on.");
    }

    if (outcome.reason === "alreadyIn") {
      return t("Your plan already has every lesson of it, so nothing had to move.");
    }

    return outcome.reason === "cantMove"
      ? t("It already starts as early as what it builds on allows.")
      : t("Your plan already changed, so there's nothing left to do here.");
  };
}

function isApplied(answer: Answer): boolean {
  return "outcome" in answer && answer.outcome.status === "applied";
}

/**
 * What the change came to, one line per offer; keeping the plan is one line, said only when
 * nothing was applied.
 */
function PlanChangeStatus({ change }: { change: PlanChange }) {
  const answerLine = useAnswerLine();

  const answered = change.offers.flatMap((offer) => {
    const answer = change.answers[offer];
    return answer ? [{ answer, offer }] : [];
  });

  const applied = answered.some(({ answer }) => isApplied(answer));
  const told = answered.filter(({ answer }) => !(applied && "declined" in answer));
  const lines = [...new Set(told.map((entry) => answerLine(entry)))];

  if (lines.length === 0) {
    return null;
  }

  return (
    <div className="text-muted-foreground flex items-start gap-2 text-sm" role="status">
      {applied && (
        <CircleCheckIcon aria-hidden="true" className="text-success-text mt-0.5 size-4 shrink-0" />
      )}
      <div className="flex flex-col gap-1">
        {lines.map((line) => (
          <p className="text-pretty" key={line}>
            {line}
          </p>
        ))}
      </div>
    </div>
  );
}

/**
 * The change as a diff, colored by what it means as every plan change is: each topic it showed the
 * learner knows going out is good news (green), with the lessons it saves, and the area that went
 * worst getting more time is a plain change, with its score.
 */
function usePlanChangeLines(adapt: MockAdaptView): DiffLine[] {
  const t = useExtracted();
  const format = useFormatter();
  const { focus, skip } = adapt;
  const named = skip?.topics.slice(0, TOPICS_NAMED) ?? [];
  const more = (skip?.topics.length ?? 0) - named.length;

  const lines: (DiffLine | false | null)[] = [
    ...named.map((topic): DiffLine => ({ kind: "removed", text: topic, tone: "good" })),
    more > 0 && {
      kind: "removed" as const,
      text: t("{count, plural, one {# more topic} other {# more topics}}", { count: more }),
      tone: "good" as const,
    },
    skip && {
      kind: "context" as const,
      text: t("{count, plural, one {# lesson less} other {# lessons less}}", {
        count: skip.lessons,
      }),
    },
    focus && {
      kind: "added" as const,
      text: t("More time for {area} ({correct} of {total} right)", {
        area: focus.area,
        correct: format.number(focus.correct, { maximumFractionDigits: 2 }),
        total: String(focus.total),
      }),
      tone: "neutral" as const,
    },
  ];

  return lines.filter((line): line is DiffLine => typeof line === "object" && line !== null);
}

/**
 * What the change is about, in a sentence: the topics the mock got all right, or the area to focus
 * on; null when it offers none.
 */
function usePlanChangeTitle(adapt: MockAdaptView | null): string | null {
  const t = useExtracted();

  if (adapt?.skip) {
    return t("You got everything right in {count, plural, one {# topic} other {# topics}}", {
      count: adapt.skip.topics.length,
    });
  }

  return adapt?.focus ? t("Focus more on {area}?", { area: adapt.focus.area }) : null;
}

/**
 * The plan change itself: its sentence (unless it's the step's title already), the diff, Apply or
 * Keep my plan, and then what it came to. A failed one can be tried again.
 */
export function MockPlanChange({
  change,
  showTitle = true,
}: {
  change: PlanChange & { adapt: MockAdaptView };
  showTitle?: boolean;
}) {
  const t = useExtracted();
  const titleId = useId();
  const title = usePlanChangeTitle(change.adapt);
  const lines = usePlanChangeLines(change.adapt);

  return (
    <div
      aria-labelledby={showTitle ? titleId : undefined}
      className="flex w-full flex-col items-start gap-3"
      role="group"
    >
      {showTitle && (
        <p className="text-sm font-medium text-pretty" id={titleId}>
          {title}
        </p>
      )}

      <DiffLines
        className="w-full"
        labels={{ added: t("New"), removed: t("Off your plan") }}
        lines={lines}
      />

      {!change.settled && (
        <div className="flex flex-wrap gap-2">
          <Button disabled={change.isPending} onClick={change.apply} size="sm" variant="outline">
            {change.isPending && <Spinner aria-hidden="true" />}
            {t("Apply")}
          </Button>
          <Button disabled={change.isPending} onClick={change.keep} size="sm" variant="ghost">
            {t("Keep my plan")}
          </Button>
        </div>
      )}

      <PlanChangeStatus change={change} />
    </div>
  );
}

/** Whether the mock offers a change to the plan. */
export function hasPlanChange(change: PlanChange): change is PlanChange & { adapt: MockAdaptView } {
  return change.adapt !== null && change.offers.length > 0;
}

/** "29% → 33%": preparation before and after the mock, the number before muted. */
export function PreparationNumbers({ change }: { change: NonNullable<MockResult["preparation"]> }) {
  const formatShare = useFormatShare();

  return (
    <>
      <span className="text-muted-foreground">{`${formatShare(change.before)} → `}</span>
      {formatShare(change.after)}
    </>
  );
}

/** Preparation's bar and what moved it: the answers the mock gave count, never more than that. */
export function PreparationMeter({ change }: { change: NonNullable<MockResult["preparation"]> }) {
  const t = useExtracted();
  const fell = change.after < change.before;

  return (
    <>
      <Meter className="h-1.5 w-full max-w-xs">
        <MeterFill share={change.after} />
      </Meter>
      <StepDetail className="text-sm">
        {fell
          ? t("The mock exam showed what's still missing.")
          : t("What you showed in this mock exam counts toward it.")}
      </StepDetail>
    </>
  );
}

/**
 * A phone's plan step after the score: how preparation moved, big in the mono face, and the change
 * the mock offers for the plan, as one diff to apply or not. Without a preparation move, the
 * change's sentence is the step's title.
 */
export function MockPlanStep({
  change,
  preparation,
}: {
  change: PlanChange;
  preparation: MockResult["preparation"];
}) {
  const t = useExtracted();
  const changeTitle = usePlanChangeTitle(change.adapt);

  return (
    <StepCard>
      <StepHeader>
        <StepEyebrow>{preparation ? t("Your preparation") : t("Your plan")}</StepEyebrow>
        <StepTitle
          className={cn(
            preparation && "font-mono text-5xl font-medium tracking-[-0.04em] tabular-nums",
          )}
        >
          {preparation ? <PreparationNumbers change={preparation} /> : changeTitle}
        </StepTitle>
      </StepHeader>

      {preparation && <PreparationMeter change={preparation} />}
      {hasPlanChange(change) && <MockPlanChange change={change} showTitle={Boolean(preparation)} />}
    </StepCard>
  );
}
