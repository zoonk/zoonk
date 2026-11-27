"use client";

import { type MockResult } from "@zoonk/core/exams/mocks/contract";
import { type MockAdaptView } from "@zoonk/core/exams/mocks/view-contract";
import { Button } from "@zoonk/ui/components/button";
import { Meter, MeterFill } from "@zoonk/ui/components/meter";
import { CircleCheckIcon } from "lucide-react";
import { useExtracted, useFormatter } from "next-intl";
import { useId, useState, useTransition } from "react";
import { Eyebrow } from "../_components/eyebrow";
import { useChangeSaveErrorMessage } from "../_components/save-error";
import { StepCard, StepHeader, StepTitle } from "../_components/step-card";
import { useFormatShare } from "../_utils/percent";
import { TaskMainButton } from "../shell/task-frame";
import { type MockPlanOfferOutcome, useMockScreen } from "./mock-context";
import { BAR_SECOND_ACTION_CLASS } from "./mock-result-actions";

type Answer = { outcome: MockPlanOfferOutcome } | { declined: true } | { failed: true };

const TOPICS_NAMED = 3;

/** The one offer a result can make: skipping lessons the mock showed the learner already knows. */
export function usePlanChange(adapt: MockAdaptView | null) {
  const { actions } = useMockScreen();
  const [answer, setAnswer] = useState<Answer | null>(null);
  const [isPending, startTransition] = useTransition();
  const open = adapt !== null && (answer === null || "failed" in answer);

  return {
    accept: () =>
      startTransition(async () => {
        const outcome = await actions.adapt().catch(() => null);
        setAnswer(outcome ? { outcome } : { failed: true });
      }),
    adapt,
    answer,
    decline: () => setAnswer({ declined: true }),
    isPending,
    open,
  };
}

export type PlanChange = ReturnType<typeof usePlanChange>;

/** Declining writes nothing, so the step says the plan stays rather than reading as still open. */
function useAnswerLine() {
  const t = useExtracted();
  const saveError = useChangeSaveErrorMessage();

  return (answer: Answer): string => {
    if ("declined" in answer) {
      return t("Your plan stays as it is.");
    }

    if ("failed" in answer) {
      return saveError;
    }

    if (answer.outcome.status !== "applied") {
      return t("Your plan didn't need to change.");
    }

    return t("{count, plural, one {# lesson} other {# lessons}} skipped.", {
      count: answer.outcome.lessonsSkipped,
    });
  };
}

function PlanChangeStatus({ answer }: { answer: Answer | null }) {
  const answerLine = useAnswerLine();

  if (!answer) {
    return null;
  }

  const applied = "outcome" in answer && answer.outcome.status === "applied";

  return (
    <div className="text-muted-foreground flex flex-col gap-1 text-sm" role="status">
      <p className="flex items-start gap-2">
        {applied && (
          <CircleCheckIcon
            aria-hidden="true"
            className="text-success-text mt-0.5 size-4 shrink-0"
          />
        )}
        {answerLine(answer)}
      </p>
    </div>
  );
}

function useOfferCopy(adapt: MockAdaptView) {
  const t = useExtracted();
  const format = useFormatter();
  const { topics } = adapt.skip;
  const named = topics.slice(0, TOPICS_NAMED);
  const more = topics.length - named.length;

  const names =
    more > 0
      ? t("{names} and {count, plural, one {# more topic} other {# more topics}}", {
          count: more,
          names: named.join(", "),
        })
      : format.list(named, { type: "conjunction" });

  return {
    accept: t("Skip them"),
    decline: t("Keep them"),
    line: t("You got everything right in {topics}.", { topics: names }),
    title: t("Skip {count, plural, one {# lesson} other {# lessons}} you already know?", {
      count: adapt.skip.lessons,
    }),
  };
}

type OpenPlanChange = PlanChange & { adapt: MockAdaptView };

/**
 * `answers={false}` leaves the open question's answers to the result's bar (`MockPlanDecline`,
 * `MockPlanAccept`), where the step that asks it is the last one.
 */
export function MockPlanChange({
  answers = true,
  change,
  showTitle = true,
}: {
  answers?: boolean;
  change: OpenPlanChange;
  showTitle?: boolean;
}) {
  const titleId = useId();
  const copy = useOfferCopy(change.adapt);

  return (
    <div className="flex w-full flex-col items-start gap-4">
      <PlanChangeStatus answer={change.answer} />

      {change.open && (
        <div
          aria-labelledby={showTitle ? titleId : undefined}
          className="flex w-full flex-col items-start gap-3"
          role="group"
        >
          <div className="flex flex-col gap-1">
            {showTitle && (
              <p className="text-sm" id={titleId}>
                {copy.title}
              </p>
            )}
            <p className="text-muted-foreground text-sm">{copy.line}</p>
          </div>

          {answers && (
            <div className="flex flex-wrap gap-2">
              <form action={() => change.accept()} className="contents">
                <Button busy={change.isPending} size="sm" type="submit" variant="outline">
                  {copy.accept}
                </Button>
              </form>
              <Button
                disabled={change.isPending}
                focusableWhenDisabled
                onClick={change.decline}
                size="sm"
                variant="ghost"
              >
                {copy.decline}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * The open question's answers in the result's bar, in place of its way on: "Continue" there would
 * leave the question unanswered as if it were an answer. The way on comes back once it's answered.
 * Declining is the bar's second action and accepting its main one.
 */
export function MockPlanDecline({ change }: { change: OpenPlanChange }) {
  const copy = useOfferCopy(change.adapt);

  return (
    <Button
      className={BAR_SECOND_ACTION_CLASS}
      disabled={change.isPending}
      focusableWhenDisabled
      onClick={change.decline}
      size="xl"
      variant="outline"
    >
      {copy.decline}
    </Button>
  );
}

export function MockPlanAccept({ change }: { change: OpenPlanChange }) {
  const copy = useOfferCopy(change.adapt);

  return (
    <TaskMainButton busy={change.isPending} onClick={change.accept}>
      {copy.accept}
    </TaskMainButton>
  );
}

export function hasPlanChange(change: PlanChange): change is OpenPlanChange {
  return change.adapt !== null;
}

function OfferTitle({ adapt }: { adapt: MockAdaptView }) {
  return useOfferCopy(adapt).title;
}

type Preparation = NonNullable<MockResult["preparation"]>;

export function PreparationReadout({ change }: { change: Preparation }) {
  const t = useExtracted();
  const formatShare = useFormatShare();
  const before = formatShare(change.before);

  return (
    <>
      <span className="text-readout text-5xl">{formatShare(change.after)}</span>
      <span className="text-muted-foreground font-mono text-xs font-normal tracking-normal tabular-nums">
        {change.after < change.before
          ? t("Down from {before}", { before })
          : t("Up from {before}", { before })}
      </span>
    </>
  );
}

export function PreparationMeter({ change }: { change: Preparation }) {
  return (
    <Meter className="h-1.5 w-full">
      <MeterFill className="bg-success" share={change.after} />
    </Meter>
  );
}

type MovedTopics = MockResult["movedTopics"];

function useMovedTitle() {
  const t = useExtracted();

  return () =>
    t({
      description:
        "On a mock exam's result: the plan moved the topics the learner missed earlier. The topics follow, one per line.",
      message: "What you missed now comes sooner",
    });
}

/** The plan already moved these earlier when the mock finished: there's nothing to answer. */
export function MockMovedTopics({
  showTitle = true,
  topics,
}: {
  showTitle?: boolean;
  topics: NonNullable<MovedTopics>;
}) {
  const movedTitle = useMovedTitle();

  return (
    <div className="flex flex-col gap-1" data-slot="mock-moved-topics">
      {showTitle && <p className="text-sm">{movedTitle()}</p>}
      <ul className="text-muted-foreground flex flex-col gap-1 text-sm">
        {topics.slice(0, TOPICS_NAMED).map((topic) => (
          <li key={topic}>{topic}</li>
        ))}
      </ul>
    </div>
  );
}

export function MockPlanStep({
  change,
  movedTopics,
  preparation,
}: {
  change: PlanChange;
  movedTopics: MovedTopics;
  preparation: MockResult["preparation"];
}) {
  const t = useExtracted();
  const movedTitle = useMovedTitle();
  const movedIsTitle = !preparation && Boolean(movedTopics);

  return (
    <StepCard>
      <StepHeader>
        {/* The moved title already says it's the plan; a chip saying so would repeat it. */}
        {!movedIsTitle && <Eyebrow>{preparation ? t("Your preparation") : t("Your plan")}</Eyebrow>}
        <StepTitle>
          {preparation && <PreparationReadout change={preparation} />}
          {movedIsTitle && movedTitle()}
          {!preparation && !movedTopics && change.adapt && <OfferTitle adapt={change.adapt} />}
        </StepTitle>
      </StepHeader>

      {preparation && <PreparationMeter change={preparation} />}
      {movedTopics && <MockMovedTopics showTitle={!movedIsTitle} topics={movedTopics} />}
      {hasPlanChange(change) && (
        <MockPlanChange
          answers={false}
          change={change}
          showTitle={Boolean(preparation || movedTopics)}
        />
      )}
    </StepCard>
  );
}
