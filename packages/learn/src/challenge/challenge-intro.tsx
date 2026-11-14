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
import { TricksterArt } from "../checkpoints/trickster-art";
import { type TaskFrameAside } from "../shell/task-frame";
import { CallIntro, WonCallIntro } from "./challenge-call-intro";
import { useChallengeScreen } from "./challenge-context";
import {
  IntroHeading,
  usePrizeFact,
  useQuestionsFact,
  useRematchEyebrow,
} from "./challenge-intro-parts";
import { useChallengeWhen } from "./challenge-labels";
import { ChallengeTopics, DuelTopics, useTopicsTitle } from "./challenge-topics";

function useTricksterDetail(): string {
  const t = useExtracted();
  const { challenge } = useChallengeScreen();
  const { passMark, questions } = challenge;
  const sized = Boolean(questions && passMark);

  if (challenge.recordings !== 0) {
    return sized
      ? t(
          "{count, plural, one {# question on a recording, played as in the exam. Get {passMark} right to win.} other {# questions on recordings, played as in the exam. Get {passMark} right to win.}}",
          { count: questions ?? 0, passMark: String(passMark) },
        )
      : t("Questions on recordings, played as in the exam.");
  }

  return sized
    ? t(
        "{count, plural, one {# question on what you just learned. Get {passMark} right to win.} other {# questions on what you just learned. Get {passMark} right to win.}}",
        { count: questions ?? 0, passMark: String(passMark) },
      )
    : t("Questions on what you just learned.");
}

function TricksterIntro() {
  const t = useExtracted();
  const eyebrow = useRematchEyebrow();
  const detail = useTricksterDetail();
  const prize = usePrizeFact();

  return (
    <StepCard>
      <TricksterArt reacts />
      <IntroHeading detail={detail} eyebrow={eyebrow} title={t("Beat the Trickster")} />
      <TaskMeta facts={[]} reward={prize} />
      <DuelTopics />
    </StepCard>
  );
}

function WonIntro() {
  const t = useExtracted();
  const { challenge } = useChallengeScreen();
  const { result } = challenge;

  return (
    <StepCard>
      <TricksterArt cracks={2} outcome="won" />
      <IntroHeading title={t("You beat the Trickster!")} />

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
        detail={t("Questions on what you studied this week.")}
        title={t("Weekly challenge")}
      />

      <TaskMeta
        facts={[
          challenge.startTime && when,
          challenge.questions !== null && challenge.questions > 0 && questions(challenge.questions),
        ]}
        reward={prize}
      />

      <DuelTopics />
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
  const written = challenge.written.filter((part) => part.asked);

  if (challenge.sections.length + written.length <= 1) {
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
      {written.map((part) => (
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
  const duration = useFormatDuration();
  const { challenge } = useChallengeScreen();
  const when = useChallengeWhen(challenge);
  const questions = useQuestionsFact();
  const [section] = challenge.sections;

  // Named only when the mock exam is one subject: a day's name would list parts it may not ask.
  const subject =
    challenge.sections.length === 1 &&
    challenge.written.length === 0 &&
    !challenge.leftOut.some((part) => part.part === "writtenInFull")
      ? section?.name
      : null;

  return (
    <StepCard>
      <IntroHeading
        detail={subject}
        title={t("Mock exam {number}", { number: String(challenge.number ?? 1) })}
      />

      <TaskMeta
        facts={[
          when,
          challenge.questions !== null && challenge.questions > 0 && questions(challenge.questions),
          challenge.minutes !== null && duration(challenge.minutes),
        ]}
      />

      <TaskAsideContent className="flex w-full flex-col items-start gap-5">
        <MockSections />

        <Callout>
          {challenge.netScored ? (
            <ScaleIcon aria-hidden="true" />
          ) : (
            <EyeOffIcon aria-hidden="true" />
          )}
          <p>{challenge.netScored ? <PenaltyRule /> : t("You see your result at the end.")}</p>
        </Callout>
      </TaskAsideContent>
    </StepCard>
  );
}

/**
 * The route's skeleton draws one before knowing which challenge it is; an intro with nothing to
 * list drops it rather than keep an empty rail on screen.
 */
export function useChallengeIntroAside(): TaskFrameAside | null {
  const t = useExtracted();
  const { challenge } = useChallengeScreen();
  const callGoals = challenge.call?.goals && challenge.status !== "done";

  const title =
    useTopicsTitle() ??
    (challenge.mock ? challenge.examName : null) ??
    (callGoals ? t("What to get across") : null);

  return title ? { label: title, title } : null;
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
