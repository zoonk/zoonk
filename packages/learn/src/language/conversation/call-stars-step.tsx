"use client";

import {
  type CallFeedback,
  type LanguageConversationView,
} from "@zoonk/core/language/conversations/contract";
import { CountUp } from "@zoonk/ui/components/count-up";
import { useCelebration } from "@zoonk/ui/hooks/celebration";
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
import { StepWithDayMoment } from "../../session/day-moment";
import { useConversationTitle } from "./conversation-labels";

type Result = NonNullable<LanguageConversationView["result"]>;

const MAX_STARS = 3;

function Stars({ lost, stars }: { lost: boolean; stars: number }) {
  const t = useExtracted();
  const celebrate = useCelebration();

  return (
    <p
      aria-label={t("{stars, plural, =0 {# of 3 stars} one {# of 3 stars} other {# of 3 stars}}", {
        stars,
      })}
      className="text-readout flex items-center gap-1.5 text-2xl"
      role="img"
    >
      <StarIcon
        aria-hidden="true"
        className={cn(
          "fill-success text-success size-5",
          celebrate && !lost && stars > 0 && "animate-settle",
        )}
      />
      <span aria-hidden="true">
        {stars}
        <span className="text-muted-foreground">{`/${MAX_STARS}`}</span>
      </span>
    </p>
  );
}

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
          value={
            <CountUp
              format={(points) => format.number(points, { signDisplay: "always" })}
              value={result.brainPower}
            />
          }
        />
      )}
    </StatTiles>
  );
}

export function StarsStep({
  conversation,
  dayMoment,
  feedback,
  result,
}: {
  conversation: LanguageConversationView;
  dayMoment: React.ReactNode;
  feedback: CallFeedback | null;
  result: Result;
}) {
  const t = useExtracted();
  const title = useConversationTitle(conversation);
  const headline = useHeadline({ conversation, result });
  const lost = conversation.kind === "checkpoint" && !result.passed;

  return (
    <StepWithDayMoment dayMoment={dayMoment}>
      <StepCard>
        <Stars lost={lost} stars={result.stars} />
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
    </StepWithDayMoment>
  );
}
