"use client";

import {
  type CallFeedback,
  type LanguageConversationView,
} from "@zoonk/core/language/conversations/contract";
import { cn } from "@zoonk/ui/lib/utils";
import { BrainIcon, StarIcon, TargetIcon } from "lucide-react";
import { useExtracted, useFormatter } from "next-intl";
import { StatTile, StatTiles } from "../../_components/stat-tile";
import {
  StepCard,
  StepDetail,
  StepEyebrow,
  StepHeader,
  StepTitle,
} from "../../_components/step-card";
import { ChallengeCallPlusNotice } from "../../challenge/challenge-plus-lock";
import { useConversationTitle } from "./conversation-labels";

type Result = NonNullable<LanguageConversationView["result"]>;

const MAX_STARS = 3;

/**
 * The call's stars, from what the learner did and never at random, as a readout ("2/3") after one
 * small star in progress's blue (what the call reached): the result's anchor.
 */
function Stars({ stars }: { stars: number }) {
  const t = useExtracted();

  return (
    <p
      aria-label={t("{stars, number} of 3 stars", { stars })}
      className="text-readout flex items-center gap-1.5 text-2xl"
      role="img"
    >
      <StarIcon aria-hidden="true" className="fill-success text-success size-5" />
      <span aria-hidden="true">
        {stars}
        <span className="text-muted-foreground">{`/${MAX_STARS}`}</span>
      </span>
    </p>
  );
}

/** A checkpoint says whether it was passed; a practice call or a mock is named by its title. */
function useHeadline({
  conversation,
  result,
}: {
  conversation: LanguageConversationView;
  result: Result;
}): string {
  const t = useExtracted();

  if (conversation.kind !== "checkpoint") {
    return conversation.title;
  }

  return result.passed ? t("Challenge passed") : t("Not this time");
}

/**
 * What the call came to, as tiles: the goals got across of all of them, and the Brain Power it
 * paid. Each shows only when it has something to say.
 */
function CallFacts({
  conversation,
  result,
}: {
  conversation: LanguageConversationView;
  result: Result;
}) {
  const t = useExtracted();
  const format = useFormatter();
  const total = conversation.objectives.length;
  const met = conversation.objectives.filter((objective) => objective.met).length;
  const showsBrainPower = result.brainPower > 0;

  if (total === 0 && !showsBrainPower) {
    return null;
  }

  return (
    <StatTiles className={cn((total === 0 || !showsBrainPower) && "grid-cols-1")}>
      {total > 0 && (
        <StatTile
          icon={<TargetIcon />}
          label={t("Goals")}
          tone="success"
          value={
            // "2/3", as the stars count over it; screen readers hear "2 of 3".
            <>
              <span aria-hidden="true">
                {met}
                <span className="text-muted-foreground">{`/${total}`}</span>
              </span>
              <span className="sr-only">
                {t("{done, number} of {total, number}", { done: met, total })}
              </span>
            </>
          }
        />
      )}
      {showsBrainPower && (
        <StatTile
          icon={<BrainIcon />}
          label={t("Brain Power")}
          tone="brain"
          value={format.number(result.brainPower, { signDisplay: "always" })}
        />
      )}
    </StatTiles>
  );
}

/**
 * The stars, the call's verdict or name, what it came to as tiles under them, how to earn the
 * missing stars in one quiet line, and last, what the call did to the day. A lost
 * checkpoint says it comes back to try again, or, once the learner's plan leaves it to Plus
 * (`locked`: Plus lapsed), says so as its challenge does, with "See Plus" beside Continue.
 */
export function StarsStep({
  conversation,
  dayMoment,
  feedback,
  result,
}: {
  conversation: LanguageConversationView;
  /** What the call just did to the day (`DayMoment`). */
  dayMoment: React.ReactNode;
  feedback: CallFeedback | null;
  result: Result;
}) {
  const t = useExtracted();
  const title = useConversationTitle(conversation);
  const headline = useHeadline({ conversation, result });
  const lost = conversation.kind === "checkpoint" && !result.passed;

  return (
    <>
      <StepCard>
        <Stars stars={result.stars} />
        <StepHeader>
          <StepEyebrow>
            {conversation.kind === "checkpoint" ? conversation.title : title}
          </StepEyebrow>
          <StepTitle>{headline}</StepTitle>
          {feedback?.encouragement && <StepDetail>{feedback.encouragement}</StepDetail>}
        </StepHeader>
      </StepCard>

      <CallFacts conversation={conversation} result={result} />

      {lost && conversation.locked && <ChallengeCallPlusNotice cta />}

      {lost && !conversation.locked && (
        <p className="text-muted-foreground text-[0.8125rem] text-pretty">
          {t("Nothing is lost: the call comes back so you can try again.")}
        </p>
      )}

      {!lost && result.stars < MAX_STARS && (
        <p className="text-muted-foreground text-[0.8125rem] text-pretty">
          {t("A star for finishing, one for getting everything across and one without Help.")}
        </p>
      )}

      {dayMoment}
    </>
  );
}
