"use client";

import { type MockResult } from "@zoonk/core/exams/mocks/contract";
import { type MockAdaptView } from "@zoonk/core/exams/mocks/view-contract";
import { Button } from "@zoonk/ui/components/button";
import { CircleCheckIcon } from "lucide-react";
import { useExtracted, useFormatter } from "next-intl";
import { useId, useState, useTransition } from "react";
import { Eyebrow } from "../_components/eyebrow";
import { Meter, MeterFill } from "../_components/meter";
import { useChangeSaveErrorMessage } from "../_components/save-error";
import { StepCard, StepHeader, StepTitle } from "../_components/step-card";
import { useFormatShare } from "../_utils/percent";
import { type MockPlanOffer, type MockPlanOfferOutcome, useMockScreen } from "./mock-context";

type Answer = { outcome: MockPlanOfferOutcome } | { declined: true } | { failed: true };

type Answers = Partial<Record<MockPlanOffer, Answer>>;

const TOPICS_NAMED = 3;

function getOffers(adapt: MockAdaptView): MockPlanOffer[] {
  return [adapt.skip && "skip", adapt.focus && "focus"].filter(
    (offer): offer is MockPlanOffer => typeof offer === "string",
  );
}

function isSettled(answer: Answer | undefined): boolean {
  return answer !== undefined && !("failed" in answer);
}

/** One question at a time: the next offer shows once the learner answered the one before it. */
export function usePlanChange(adapt: MockAdaptView | null) {
  const { actions } = useMockScreen();
  const [answers, setAnswers] = useState<Answers>({});
  const [isPending, startTransition] = useTransition();
  const offers = adapt ? getOffers(adapt) : [];
  const open = offers.find((offer) => !isSettled(answers[offer])) ?? null;

  return {
    accept: () =>
      startTransition(async () => {
        if (!open) {
          return;
        }

        const outcome = await actions.adapt(open).catch(() => null);
        setAnswers((current) => ({ ...current, [open]: outcome ? { outcome } : { failed: true } }));
      }),
    adapt,
    answers,
    decline: () => open && setAnswers((current) => ({ ...current, [open]: { declined: true } })),
    isPending,
    offers,
    open,
  };
}

export type PlanChange = ReturnType<typeof usePlanChange>;

function useAnswerLine(adapt: MockAdaptView) {
  const t = useExtracted();
  const saveError = useChangeSaveErrorMessage();

  return ({ answer, offer }: { answer: Answer; offer: MockPlanOffer }): string => {
    if ("declined" in answer) {
      return "";
    }

    if ("failed" in answer) {
      return saveError;
    }

    if (answer.outcome.status !== "applied") {
      return t("Your plan didn't need to change.");
    }

    return offer === "skip"
      ? t("{count, plural, one {# lesson} other {# lessons}} skipped.", {
          count: answer.outcome.lessonsSkipped,
        })
      : t("Your plan gives {area} more time.", { area: adapt.focus?.area ?? "" });
  };
}

function PlanChangeStatus({ change }: { change: PlanChange & { adapt: MockAdaptView } }) {
  const answerLine = useAnswerLine(change.adapt);

  const told = change.offers.flatMap((offer) => {
    const answer = change.answers[offer];
    const line = answer ? answerLine({ answer, offer }) : null;
    const applied = answer && "outcome" in answer && answer.outcome.status === "applied";
    return line ? [{ applied, line }] : [];
  });

  if (told.length === 0) {
    return null;
  }

  return (
    <div className="text-muted-foreground flex flex-col gap-1 text-sm" role="status">
      {told.map(({ applied, line }) => (
        <p className="flex items-start gap-2 text-pretty" key={line}>
          {applied && (
            <CircleCheckIcon
              aria-hidden="true"
              className="text-success-text mt-0.5 size-4 shrink-0"
            />
          )}
          {line}
        </p>
      ))}
    </div>
  );
}

function useOfferCopy(adapt: MockAdaptView | null) {
  const t = useExtracted();
  const format = useFormatter();

  return (
    offer: MockPlanOffer,
  ): { accept: string; decline: string; line: string; title: string } => {
    if (offer === "skip") {
      const topics = adapt?.skip?.topics ?? [];
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
          count: adapt?.skip?.lessons ?? 0,
        }),
      };
    }

    return {
      accept: t("Change my plan"),
      decline: t("Keep my plan"),
      line: t(
        "You got {correct, plural, =0 {# of {total} right} one {# of {total} right} other {# of {total} right}} there.",
        {
          // `#` shows up to three decimals; partial credit reads to the hundredth.
          correct: Math.round((adapt?.focus?.correct ?? 0) * 100) / 100,
          total: String(adapt?.focus?.total ?? 0),
        },
      ),
      title: t("Focus more on {area}?", { area: adapt?.focus?.area ?? "" }),
    };
  };
}

export function MockPlanChange({
  change,
  showTitle = true,
}: {
  change: PlanChange & { adapt: MockAdaptView };
  showTitle?: boolean;
}) {
  const titleId = useId();
  const offerCopy = useOfferCopy(change.adapt);
  const copy = change.open ? offerCopy(change.open) : null;

  return (
    <div className="flex w-full flex-col items-start gap-4">
      <PlanChangeStatus change={change} />

      {copy && (
        <div
          aria-labelledby={showTitle ? titleId : undefined}
          className="flex w-full flex-col items-start gap-3"
          role="group"
        >
          <div className="flex flex-col gap-1">
            {showTitle && (
              <p className="text-sm text-pretty" id={titleId}>
                {copy.title}
              </p>
            )}
            <p className="text-muted-foreground text-sm text-pretty">{copy.line}</p>
          </div>

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
        </div>
      )}
    </div>
  );
}

export function hasPlanChange(change: PlanChange): change is PlanChange & { adapt: MockAdaptView } {
  return change.adapt !== null && change.offers.length > 0;
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

export function MockPlanStep({
  change,
  preparation,
}: {
  change: PlanChange;
  preparation: MockResult["preparation"];
}) {
  const t = useExtracted();
  const offerCopy = useOfferCopy(change.adapt);
  const [firstOffer] = change.offers;
  const question = change.open ?? firstOffer;

  return (
    <StepCard>
      <StepHeader>
        <Eyebrow>{preparation ? t("Your preparation") : t("Your plan")}</Eyebrow>
        <StepTitle>
          {preparation ? (
            <PreparationReadout change={preparation} />
          ) : (
            question && offerCopy(question).title
          )}
        </StepTitle>
      </StepHeader>

      {preparation && <PreparationMeter change={preparation} />}
      {hasPlanChange(change) && <MockPlanChange change={change} showTitle={Boolean(preparation)} />}
    </StepCard>
  );
}
