"use client";

import { type ChallengeView } from "@zoonk/core/checkpoints/challenge-contract";
import { getBreakEven } from "@zoonk/core/exams/net-score";
import { EyeOffIcon, ScaleIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { Callout } from "../_components/callout";
import { StepCard } from "../_components/step-card";
import { TaskAsideContent } from "../_components/task-layout";
import { TaskMeta } from "../_components/task-meta";
import { useFormatShare } from "../_utils/percent";
import { useFormatDuration } from "../_utils/time-format";
import { useCheckpointEyebrow } from "../checkpoints/checkpoint-labels";
import { TricksterArt } from "../checkpoints/trickster-art";
import { useMockDaySizeLabel } from "../mock/mock-labels";
import { MockLeftOutNote } from "../mock/mock-notes";
import { type TaskFrameAside } from "../shell/task-frame";
import { CallIntro, WonCallIntro } from "./challenge-call-intro";
import { useChallengeScreen } from "./challenge-context";
import { IntroHeading, useEyebrow, usePrizeFact, useQuestionsFact } from "./challenge-intro-parts";
import { useChallengeWhen } from "./challenge-labels";
import { ChallengeTopics, DuelBriefing, useTopicsTitle } from "./challenge-topics";

function useTricksterDetail(): string {
  const t = useExtracted();
  const { challenge } = useChallengeScreen();

  if (challenge.recordings === null) {
    return t("Questions on recordings from this phase, played as in the exam, with no hints.");
  }

  if (challenge.recordings > 0) {
    return t(
      "{count, plural, one {Questions on a recording from this phase, played as in the exam, with no hints.} other {Questions on # recordings from this phase, each played as in the exam, with no hints.}}",
      { count: challenge.recordings },
    );
  }

  return t("Mixed questions from this phase, with no hints.");
}

function TricksterIntro() {
  const t = useExtracted();
  const { challenge } = useChallengeScreen();
  const eyebrow = useEyebrow();
  const detail = useTricksterDetail();
  const questions = useQuestionsFact();
  const prize = usePrizeFact();

  return (
    <StepCard>
      <TricksterArt reacts />
      <IntroHeading detail={detail} eyebrow={eyebrow} title={t("The Trickster")} />

      <TaskMeta
        facts={[
          challenge.questions !== null && challenge.questions > 0 && questions(challenge.questions),
          challenge.passMark !== null &&
            challenge.passMark > 0 &&
            t("{count, plural, one {# right to win} other {# right to win}}", {
              count: challenge.passMark,
            }),
        ]}
        reward={prize}
      />

      <DuelBriefing
        rule={t(
          "You'll see right or wrong after each answer, and why at the end, with the traps he set.",
        )}
      />
    </StepCard>
  );
}

function WonIntro() {
  const t = useExtracted();
  const { challenge } = useChallengeScreen();
  const eyebrow = useCheckpointEyebrow(challenge);
  const { result } = challenge;

  return (
    <StepCard>
      <TricksterArt beaten />
      <IntroHeading eyebrow={eyebrow} title={t("You beat the Trickster!")} />

      {result && (
        <TaskMeta
          className="text-sm leading-6"
          facts={[
            t(
              "{correct, plural, =0 {# of {total} right} one {# of {total} right} other {# of {total} right}}",
              { correct: result.correct, total: String(result.total) },
            ),
          ]}
        />
      )}

      <TaskAsideContent className="w-full">
        <ChallengeTopics />
      </TaskAsideContent>
    </StepCard>
  );
}

function WeeklyIntro() {
  const t = useExtracted();
  const { challenge } = useChallengeScreen();
  const when = useChallengeWhen(challenge);
  const questions = useQuestionsFact();
  const prize = usePrizeFact();

  return (
    <StepCard>
      <IntroHeading
        detail={t("Questions from what you studied this week, with no hints.")}
        title={t("Weekly challenge")}
        when={challenge.startTime ? when : null}
      />

      <TaskMeta
        facts={[
          challenge.questions !== null && challenge.questions > 0 && questions(challenge.questions),
        ]}
        reward={prize}
      />

      <DuelBriefing rule={t("You'll see right or wrong after each answer, and why at the end.")} />
    </StepCard>
  );
}

function describeTasks(tasks: ChallengeView["written"][number]["tasks"]): string {
  return tasks
    .map((task) => (task.count === null ? task.description : `${task.count} × ${task.description}`))
    .join(" · ");
}

function MockSections() {
  const t = useExtracted();
  const duration = useFormatDuration();
  const { challenge } = useChallengeScreen();

  if (challenge.sections.length + challenge.written.length <= 1) {
    return null;
  }

  return (
    <ol className="border-border flex w-full flex-col border-t text-left">
      {challenge.sections.map((section) => (
        <li
          className="border-border flex items-baseline justify-between gap-3 border-b py-2.75 text-sm last:border-b-0"
          key={section.index}
        >
          <span className="flex min-w-0 flex-col gap-0.5">
            <span className="font-medium">{section.name ?? t("Questions")}</span>
            {section.tools && (
              <span className="text-muted-foreground text-xs">{section.tools}</span>
            )}
          </span>
          <span className="text-muted-foreground shrink-0 font-mono text-xs tabular-nums">
            {t("{count, plural, one {# question} other {# questions}} · {time}", {
              count: section.questions,
              time: duration(section.minutes),
            })}
          </span>
        </li>
      ))}
      {challenge.written.map((part) => (
        <li
          className="border-border flex flex-col gap-1 border-b py-2.75 text-sm last:border-b-0"
          key={part.name}
        >
          <span className="flex items-baseline justify-between gap-3">
            <span className="min-w-0 font-medium">{part.name}</span>
            {part.minutes !== null && (
              <span className="text-muted-foreground shrink-0 font-mono text-xs tabular-nums">
                {duration(part.minutes)}
              </span>
            )}
          </span>
          <span className="text-muted-foreground text-xs">{describeTasks(part.tasks)}</span>
          <span className="text-muted-foreground text-xs">
            {part.asked
              ? t("Written in the mock, graded by the exam's criteria after you hand it in.")
              : t(
                  "Written: you practice it in your essay sessions, graded by the exam's criteria.",
                )}
          </span>
        </li>
      ))}
    </ol>
  );
}

function PenaltyRule() {
  const t = useExtracted();
  const formatShare = useFormatShare();
  const { challenge } = useChallengeScreen();

  if (challenge.wrongPenalty === 1) {
    return t(
      "A wrong answer cancels a right one, so leave a statement blank when you're not sure.",
    );
  }

  return t({
    description: '{share} and {breakEven} are percentages, like "25%".',
    message:
      "A wrong answer costs {share} of a right one, so leave a question blank when you're less than {breakEven} sure.",
    values: {
      breakEven: formatShare(getBreakEven(challenge.wrongPenalty)),
      share: formatShare(challenge.wrongPenalty),
    },
  });
}

function MockIntro() {
  const t = useExtracted();
  const daySize = useMockDaySizeLabel();
  const duration = useFormatDuration();
  const { challenge } = useChallengeScreen();
  const when = useChallengeWhen(challenge);
  const questions = useQuestionsFact();
  const [section] = challenge.sections;
  const objectiveOnly = challenge.leftOut.some((part) => part.part === "writtenInFull");

  // Half a day isn't named by its day ("… e redação"), which would say its written part is asked.
  const area =
    challenge.sections.length === 1 && challenge.written.length === 0 && !objectiveOnly
      ? section?.name
      : null;

  return (
    <StepCard>
      <IntroHeading
        detail={[challenge.examName, area].filter(Boolean).join(" · ")}
        title={t("Mock exam {number}", { number: String(challenge.number ?? 1) })}
        when={when}
      />

      <TaskMeta
        facts={[
          challenge.questions !== null && challenge.questions > 0 && questions(challenge.questions),
          challenge.minutes !== null && duration(challenge.minutes),
          !challenge.fullLength && daySize({ fullLength: false }),
          objectiveOnly && t("Objective part only"),
        ]}
      />

      <TaskAsideContent className="flex w-full flex-col items-start gap-5">
        <MockSections />
        <MockLeftOutNote
          leftOut={challenge.leftOut.filter(
            (part) => part.part !== "written" && part.part !== "writtenInFull",
          )}
        />

        <Callout>
          {challenge.netScored ? (
            <ScaleIcon aria-hidden="true" />
          ) : (
            <EyeOffIcon aria-hidden="true" />
          )}
          <p>
            {challenge.netScored ? (
              <PenaltyRule />
            ) : (
              t("Your result only shows at the end, like on exam day.")
            )}
          </p>
        </Callout>
      </TaskAsideContent>
    </StepCard>
  );
}

/** Every intro has one, so the route's skeleton draws it before knowing which challenge it is. */
export function useChallengeIntroAside(): TaskFrameAside {
  const t = useExtracted();
  const { challenge } = useChallengeScreen();
  const name = useCheckpointEyebrow(challenge);
  const callGoals = challenge.call?.goals && challenge.status !== "done";

  const title =
    useTopicsTitle() ??
    (challenge.mock ? challenge.examName : null) ??
    (callGoals ? t("What to get across") : null);

  return { label: title ?? name, title };
}

export function ChallengeIntro() {
  const { challenge } = useChallengeScreen();

  if (challenge.mock) {
    return <MockIntro />;
  }

  if (challenge.kind === "weekly") {
    return <WeeklyIntro />;
  }

  const won = challenge.status === "done";

  if (challenge.call) {
    return won ? <WonCallIntro /> : <CallIntro call={challenge.call} />;
  }

  return won ? <WonIntro /> : <TricksterIntro />;
}
