"use client";

import { type MockAdaptView } from "@zoonk/core/exams/mocks/contract";
import { Button } from "@zoonk/ui/components/button";
import { Spinner } from "@zoonk/ui/components/spinner";
import { CircleCheckIcon } from "lucide-react";
import { useExtracted, useFormatter } from "next-intl";
import { useState, useTransition } from "react";
import { KindTile } from "../_components/kind-tile";
import { StepCard, StepDetail, StepEyebrow, StepHeader, StepTitle } from "../_components/step-card";
import { type MockPlanOffer, type MockPlanOfferOutcome, useMockScreen } from "./mock-context";

/** A plan offer once answered: what the learner said, and what it did. */
type Answer = { outcome: MockPlanOfferOutcome } | { declined: true } | { failed: true } | null;

/** Topics named in a line: the first three, then how many more. */
const TOPICS_NAMED = 3;

function useTopicList() {
  const t = useExtracted();
  const format = useFormatter();

  return (topics: readonly string[]): string => {
    const named = topics.slice(0, TOPICS_NAMED);
    const more = topics.length - named.length;

    return more > 0
      ? t("{topics} and {count, plural, one {# more topic} other {# more topics}}", {
          count: more,
          topics: format.list(named, { type: "unit" }),
        })
      : format.list(named, { type: "conjunction" });
  };
}

function useAnswerLine() {
  const t = useExtracted();

  return ({ answer, offer }: { answer: Answer; offer: MockPlanOffer }): string => {
    if (!answer) {
      return "";
    }

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

/** Yes or no to one offer, then the line saying what happened. */
function OfferAnswer({ accept, offer }: { accept: string; offer: MockPlanOffer }) {
  const t = useExtracted();
  const { actions } = useMockScreen();
  const [answer, setAnswer] = useState<Answer>(null);
  const [isPending, startTransition] = useTransition();
  const answerLine = useAnswerLine();
  const line = answerLine({ answer, offer });
  const settled = answer !== null && !("failed" in answer);

  const yes = () =>
    startTransition(async () => {
      const outcome = await actions.adapt(offer).catch(() => null);
      setAnswer(outcome ? { outcome } : { failed: true });
    });

  return (
    <div className="flex w-full flex-col items-center gap-3">
      {!settled && (
        <div className="flex w-full flex-col gap-2 sm:flex-row sm:justify-center">
          <Button disabled={isPending} onClick={yes} size="lg" variant="outline">
            {isPending && <Spinner aria-hidden="true" />}
            {accept}
          </Button>
          <Button
            disabled={isPending}
            onClick={() => setAnswer({ declined: true })}
            size="lg"
            variant="ghost"
          >
            {t("Keep my plan")}
          </Button>
        </div>
      )}

      {line && (
        <p
          className="text-muted-foreground flex items-center gap-2 text-sm text-balance"
          role="status"
        >
          {answer && "outcome" in answer && answer.outcome.status === "applied" && (
            <CircleCheckIcon aria-hidden="true" className="text-success size-4 shrink-0" />
          )}
          {line}
        </p>
      )}
    </div>
  );
}

/** The topics it showed the learner knows, and the offer to skip their lessons. */
export function MockSkipStep({ skip }: { skip: NonNullable<MockAdaptView["skip"]> }) {
  const t = useExtracted();
  const topicList = useTopicList();

  return (
    <StepCard>
      <KindTile kind="lesson" size="lg" />
      <StepHeader>
        <StepEyebrow>{t("Your plan")}</StepEyebrow>
        <StepTitle>
          {t("You got everything right in {count, plural, one {# topic} other {# topics}}", {
            count: skip.topics.length,
          })}
        </StepTitle>
        <StepDetail>
          {t("{topics}. Skip {count, plural, one {its lesson} other {their # lessons}}?", {
            count: skip.lessons,
            topics: topicList(skip.topics),
          })}
        </StepDetail>
      </StepHeader>

      <OfferAnswer
        accept={t("{count, plural, one {Skip the lesson} other {Skip the # lessons}}", {
          count: skip.lessons,
        })}
        offer="skip"
      />
    </StepCard>
  );
}

/** The area that went worst, and the offer to give it more of the plan's time. */
export function MockFocusStep({ focus }: { focus: NonNullable<MockAdaptView["focus"]> }) {
  const t = useExtracted();

  return (
    <StepCard>
      <KindTile kind="practice" size="lg" />
      <StepHeader>
        <StepEyebrow>{t("Your plan")}</StepEyebrow>
        <StepTitle>{t("Focus more on {area}?", { area: focus.area })}</StepTitle>
        <StepDetail>
          {t(
            "It went hardest: {correct} of {total} right. Your plan can give it more time and start it sooner.",
            { correct: String(focus.correct), total: String(focus.total) },
          )}
        </StepDetail>
      </StepHeader>

      <OfferAnswer accept={t("Focus more on it")} offer="focus" />
    </StepCard>
  );
}
