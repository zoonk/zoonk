"use client";

import { type ChallengeCall } from "@zoonk/core/checkpoints/challenge-contract";
import { useExtracted } from "next-intl";
import { PageSectionTitle } from "../_components/page";
import { StepCard } from "../_components/step-card";
import { TaskAsideContent } from "../_components/task-layout";
import { TaskMeta } from "../_components/task-meta";
import { useFormatDuration } from "../_utils/time-format";
import { useCheckpointEyebrow } from "../checkpoints/checkpoint-labels";
import { ChecklistRow, ChecklistRows } from "../language/checklist-rows";
import { useChallengeScreen } from "./challenge-context";
import { IntroHeading, useEyebrow, usePrizeFact } from "./challenge-intro-parts";

/**
 * The call's goals as its own intro lists them, under the facts on a phone and beside the intro
 * from `lg`, where the aside's header names them (`useChallengeIntroAside`). Nothing while the
 * unit's call isn't written.
 */
function CallGoals({ call }: { call: ChallengeCall }) {
  const t = useExtracted();

  if (!call.goals) {
    return null;
  }

  return (
    <TaskAsideContent className="flex w-full flex-col gap-1">
      <PageSectionTitle className="lg:sr-only">{t("What to get across")}</PageSectionTitle>
      <ChecklistRows>
        {call.goals.map((goal) => (
          <ChecklistRow
            description={goal.description}
            done={false}
            key={goal.label}
            lang={call.targetLanguage}
          >
            {goal.label}
          </ChecklistRow>
        ))}
      </ChecklistRows>
    </TaskAsideContent>
  );
}

/**
 * A language goal's phase checkpoint: the unit's call, never the Trickster's duel. How long it
 * talks and at what level, then, once the unit's call is written, its name, how many goals it has
 * and how many of them win it, with the prize last, and the goals themselves.
 */
export function CallIntro({ call }: { call: ChallengeCall }) {
  const t = useExtracted();
  const formatDuration = useFormatDuration();
  const { challenge } = useChallengeScreen();
  const eyebrow = useEyebrow();
  const prize = usePrizeFact();

  return (
    <StepCard>
      <IntroHeading
        detail={t("A live call where you get your point across. Speak or type.")}
        eyebrow={eyebrow}
        title={call.title ?? t("The unit's call")}
      />

      <TaskMeta
        facts={[
          t("{time} · Level {level}", { level: call.level, time: formatDuration(call.minutes) }),
          call.goals &&
            t("{count, plural, one {# goal} other {# goals}}", { count: call.goals.length }),
          challenge.passMark !== null && t("{count} to win", { count: String(challenge.passMark) }),
        ]}
        reward={prize}
      />

      <CallGoals call={call} />
    </StepCard>
  );
}

/** A unit's call already won: how many of its goals got across, never the call's rules again. */
export function WonCallIntro() {
  const t = useExtracted();
  const { challenge } = useChallengeScreen();
  const eyebrow = useCheckpointEyebrow(challenge);
  const { result } = challenge;

  return (
    <StepCard>
      <IntroHeading eyebrow={eyebrow} title={t("Challenge passed")} />

      {result && (
        <TaskMeta
          className="text-sm leading-6"
          facts={[
            t(
              "{correct, plural, =0 {# of {total} goals} one {# of {total} goals} other {# of {total} goals}}",
              { correct: result.correct, total: String(result.total) },
            ),
          ]}
        />
      )}
    </StepCard>
  );
}
