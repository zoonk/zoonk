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
import { MockLeftOutNote } from "../mock/mock-notes";
import { type TaskFrameAside } from "../shell/task-frame";
import { CallIntro, WonCallIntro } from "./challenge-call-intro";
import { useChallengeScreen } from "./challenge-context";
import { IntroHeading, useEyebrow, usePrizeFact, useQuestionsFact } from "./challenge-intro-parts";
import { useChallengeWhen } from "./challenge-labels";
import { ChallengeTopics, DuelBriefing, useTopicsTitle } from "./challenge-topics";

/**
 * What the Trickster asks: mixed questions from the phase, or, for a phase practiced through
 * recordings (an exam's Listening), questions on recordings played as strictly as in the exam.
 */
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

/**
 * The phase's checkpoint: the Trickster, how many questions and how many right to win. Before its
 * day, a phase with nothing to ask yet says neither (never "0 questions · 0 right to win"): the
 * footer says when it opens.
 */
function TricksterIntro() {
  const t = useExtracted();
  const { challenge } = useChallengeScreen();
  const eyebrow = useEyebrow();
  const detail = useTricksterDetail();
  const questions = useQuestionsFact();
  const prize = usePrizeFact();

  return (
    <StepCard>
      <TricksterArt />
      <IntroHeading detail={detail} eyebrow={eyebrow} title={t("The Trickster")} />

      <TaskMeta
        facts={[
          challenge.questions !== null && challenge.questions > 0 && questions(challenge.questions),
          (challenge.passMark ?? 0) > 0 &&
            t("{count} right to win", { count: String(challenge.passMark) }),
        ]}
        reward={prize}
      />

      <DuelBriefing
        rule={t("You'll see why each answer was right or wrong at the end, with the traps he set.")}
      />
    </StepCard>
  );
}

/**
 * A phase checkpoint already won: how it went, never the rules of a duel already played. The
 * footer opens the full result when its block is there.
 */
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
            t("{correct} of {total} right", {
              correct: String(result.correct),
              total: String(result.total),
            }),
          ]}
        />
      )}

      <TaskAsideContent className="w-full">
        <ChallengeTopics />
      </TaskAsideContent>
    </StepCard>
  );
}

/** The week's challenge outside exams: questions from the week. */
function WeeklyIntro() {
  const t = useExtracted();
  const { challenge } = useChallengeScreen();
  const when = useChallengeWhen(challenge);
  const questions = useQuestionsFact();
  const prize = usePrizeFact();

  // Its day is the footer's to say before it opens; a time of its own is said up top.
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

      <DuelBriefing rule={t("You'll see why each answer was right or wrong at the end.")} />
    </StepCard>
  );
}

/** Each task with its count, in the notice's words: "2 × short discursive answers · 1 × legal brief". */
function describeTasks(tasks: ChallengeView["written"][number]["tasks"]): string {
  return tasks
    .map((task) => (task.count === null ? task.description : `${task.count} × ${task.description}`))
    .join(" · ");
}

/**
 * A mock with several sections lists them, as flat rows; one section names it in the title.
 * A written part (a discursive test, a legal brief) lists what the notice asks: written in the
 * mock and graded after hand-in, or, while the exam has no essay for it yet, in essay practice.
 */
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

/** Where a wrong answer costs points, when leaving a question blank pays, from the notice. */
function PenaltyRule() {
  const t = useExtracted();
  const formatShare = useFormatShare();
  const { challenge } = useChallengeScreen();

  if (challenge.wrongPenalty === 1) {
    return t(
      "A wrong answer cancels a right one, so leave a statement blank when you're not sure.",
    );
  }

  return t(
    "A wrong answer costs {share} of a right one, so leave a question blank when you're less than {breakEven} sure.",
    {
      breakEven: formatShare(getBreakEven(challenge.wrongPenalty)),
      share: formatShare(challenge.wrongPenalty),
    },
  );
}

/**
 * The week's mock: when it is (with the real exam's start time), its size and about how long it
 * takes (half the exam before the final stretch), and the one rule that changes how to take it.
 */
function MockIntro() {
  const t = useExtracted();
  const duration = useFormatDuration();
  const { challenge } = useChallengeScreen();
  const when = useChallengeWhen(challenge);
  const questions = useQuestionsFact();
  const [section] = challenge.sections;
  // Half the exam leaves the day's written part for the full mocks: the day's name ("Linguagens,
  // Ciências Humanas e redação") would say it's asked.
  const objectiveOnly = challenge.leftOut.some((part) => part.part === "writtenInFull");
  // One section names the mock's area; a day with a written part is the whole exam day.
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
          // The time on its clock, the same the plan saves for it and the real exam gives.
          challenge.minutes !== null && duration(challenge.minutes),
          !challenge.fullLength && t("Half an exam day"),
          objectiveOnly && t("Objective part only"),
        ]}
      />

      {/* Under the facts on a phone, beside the intro from `lg`: rendered once. */}
      <TaskAsideContent className="flex w-full flex-col items-start gap-5">
        <MockSections />
        {/* Written parts are listed with the sections; the rest of what it leaves out, here. */}
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

/**
 * The intro's aside from `lg`: what a duel asks and its rule, or a mock's sections and rule, which
 * the intro places there (`TaskAsideContent`), under the topics' name or the mock's exam. The
 * challenge's own name already heads the intro, so it only names the aside for screen readers.
 * Every intro has one, so the route's skeleton draws it before knowing which challenge it is.
 */
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

/** A challenge said plainly: the Trickster's checkpoint, the week's challenge or its mock. */
export function ChallengeIntro() {
  const { challenge } = useChallengeScreen();

  if (challenge.mock) {
    return <MockIntro />;
  }

  if (challenge.kind === "weekly") {
    return <WeeklyIntro />;
  }

  const won = challenge.status === "done";

  // A language goal's phase checkpoint is the unit's call; any phase checkpoint is done once won.
  if (challenge.call) {
    return won ? <WonCallIntro /> : <CallIntro call={challenge.call} />;
  }

  return won ? <WonIntro /> : <TricksterIntro />;
}
