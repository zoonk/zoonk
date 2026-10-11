"use client";

import { type ChallengeView } from "@zoonk/core/checkpoints/challenge-contract";
import { getBreakEven } from "@zoonk/core/exams/net-score";
import {
  ClockIcon,
  EyeOffIcon,
  ListChecksIcon,
  ScaleIcon,
  TargetIcon,
  TrophyIcon,
} from "lucide-react";
import { useExtracted } from "next-intl";
import { Callout } from "../_components/callout";
import { FactChip, FactChips } from "../_components/fact-chips";
import { KindTile } from "../_components/kind-tile";
import { toLabelCase } from "../_utils/label-case";
import { useFormatShare } from "../_utils/percent";
import { useFormatDuration } from "../_utils/time-format";
import { useCheckpointEyebrow, useCheckpointWorth } from "../checkpoints/checkpoint-labels";
import { TricksterArt } from "../checkpoints/trickster-art";
import { MockLeftOutNote } from "../mock/mock-notes";
import { useChallengeScreen } from "./challenge-context";
import { useChallengeWhen } from "./challenge-labels";

/**
 * The challenge as one card: its art or kind tile to anchor it, the name big, when or what it is
 * under it, and its facts as chips. The rule and the reward sit under the card, and the footer's
 * action right under them.
 */
function IntroCard({ anchor, children }: { anchor: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="bg-card flex flex-col items-center gap-5 rounded-3xl border px-6 py-8 text-center shadow-xs sm:px-8">
      {anchor}
      {children}
    </section>
  );
}

function IntroHeading({
  detail,
  eyebrow,
  title,
}: {
  detail?: string | null;
  eyebrow?: string | null;
  title: string;
}) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      {eyebrow && (
        <p className="text-muted-foreground text-sm font-medium">{toLabelCase(eyebrow)}</p>
      )}
      <h1 className="text-3xl font-bold tracking-tight text-balance sm:text-4xl">{title}</h1>
      {detail && <p className="text-muted-foreground text-balance">{detail}</p>}
    </div>
  );
}

function QuestionsChip({ count }: { count: number }) {
  const t = useExtracted();

  return (
    <FactChip>
      <ListChecksIcon aria-hidden="true" />
      {t("{count, plural, one {# question} other {# questions}}", { count })}
    </FactChip>
  );
}

/** What winning or finishing is worth, as the reward under the card. */
function WorthCallout() {
  const { challenge } = useChallengeScreen();

  const worth = useCheckpointWorth({
    brainPower: challenge.reward.brainPower,
    kind: challenge.kind,
    phase: challenge.phase,
  });

  return (
    <Callout>
      <TrophyIcon aria-hidden="true" />
      <p>{worth}</p>
    </Callout>
  );
}

/** "Phase 2 checkpoint", or a new try at it. Its day, before it opens, is the footer's to say. */
function useEyebrow(): string {
  const t = useExtracted();
  const { challenge } = useChallengeScreen();
  const name = useCheckpointEyebrow(challenge);

  return challenge.rematch ? t("New try · {name}", { name }) : name;
}

/**
 * What the Trickster asks: mixed questions from the phase, or, for a phase practiced through
 * recordings (an exam's Listening), questions on recordings played as strictly as in the exam.
 */
function useTricksterDetail(): string {
  const t = useExtracted();
  const { challenge } = useChallengeScreen();

  if (challenge.recordings > 0) {
    return t(
      "{count, plural, one {Questions on a recording from this phase, played as in the exam, with no hints.} other {Questions on # recordings from this phase, each played as in the exam, with no hints.}}",
      { count: challenge.recordings },
    );
  }

  return t("Mixed questions from this phase, with no hints.");
}

/** The phase's checkpoint: the Trickster, how many questions and how many right to win. */
function TricksterIntro() {
  const t = useExtracted();
  const { challenge } = useChallengeScreen();
  const eyebrow = useEyebrow();
  const detail = useTricksterDetail();

  return (
    <>
      <IntroCard anchor={<TricksterArt />}>
        <IntroHeading detail={detail} eyebrow={eyebrow} title={t("The Trickster")} />

        <FactChips className="justify-center">
          <QuestionsChip count={challenge.questions} />
          {challenge.passMark !== null && (
            <FactChip>
              <TargetIcon aria-hidden="true" />
              {t("{count} right to win", { count: String(challenge.passMark) })}
            </FactChip>
          )}
        </FactChips>
      </IntroCard>

      <WorthCallout />
    </>
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

  const score = result
    ? t("{correct} of {total} right", {
        correct: String(result.correct),
        total: String(result.total),
      })
    : null;

  return (
    <IntroCard anchor={<TricksterArt beaten />}>
      <IntroHeading detail={score} eyebrow={eyebrow} title={t("You beat the Trickster!")} />
    </IntroCard>
  );
}

/** The week's challenge outside exams: questions from the week. */
function WeeklyIntro() {
  const t = useExtracted();
  const { challenge } = useChallengeScreen();
  const when = useChallengeWhen(challenge);

  // Its day is the footer's to say before it opens; a time of its own is said up top.
  return (
    <>
      <IntroCard anchor={<KindTile kind="challenge" size="lg" />}>
        <IntroHeading
          detail={t("Questions from what you studied this week, with no hints.")}
          eyebrow={challenge.startTime ? when : null}
          title={t("Weekly challenge")}
        />

        <FactChips className="justify-center">
          <QuestionsChip count={challenge.questions} />
        </FactChips>
      </IntroCard>

      <WorthCallout />
    </>
  );
}

/** Each task with its count, in the notice's words: "2 × short discursive answers · 1 × legal brief". */
function describeTasks(tasks: ChallengeView["written"][number]["tasks"]): string {
  return tasks
    .map((task) => (task.count === null ? task.description : `${task.count} × ${task.description}`))
    .join(" · ");
}

/**
 * A mock with several sections lists them, inside its card; one section names it in the title.
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
    <ol className="bg-muted/50 flex w-full flex-col rounded-2xl px-4 text-left">
      {challenge.sections.map((section) => (
        <li
          className="border-border flex items-baseline justify-between gap-3 border-b py-3 text-sm last:border-b-0"
          key={section.index}
        >
          <span className="flex min-w-0 flex-col gap-0.5">
            <span className="font-medium">{section.name ?? t("Questions")}</span>
            {section.tools && (
              <span className="text-muted-foreground text-xs">{section.tools}</span>
            )}
          </span>
          <span className="text-muted-foreground shrink-0 tabular-nums">
            {t("{count, plural, one {# question} other {# questions}} · {time}", {
              count: section.questions,
              time: duration(section.minutes),
            })}
          </span>
        </li>
      ))}
      {challenge.written.map((part) => (
        <li
          className="border-border flex flex-col gap-1 border-b py-3 text-sm last:border-b-0"
          key={part.name}
        >
          <span className="flex items-baseline justify-between gap-3">
            <span className="min-w-0 font-medium">{part.name}</span>
            {part.minutes !== null && (
              <span className="text-muted-foreground shrink-0 tabular-nums">
                {duration(part.minutes)}
              </span>
            )}
          </span>
          <span className="text-muted-foreground">{describeTasks(part.tasks)}</span>
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
    <>
      <IntroCard anchor={<KindTile kind="mock" size="lg" />}>
        <IntroHeading
          detail={[challenge.examName, area].filter(Boolean).join(" · ")}
          eyebrow={when}
          title={t("Mock exam {number}", { number: String(challenge.number ?? 1) })}
        />

        <FactChips className="justify-center">
          <QuestionsChip count={challenge.questions} />
          <FactChip>
            <ClockIcon aria-hidden="true" />
            {t("About {time}", { time: duration(challenge.estimatedMinutes) })}
          </FactChip>
          {!challenge.fullLength && <FactChip>{t("Half the exam")}</FactChip>}
          {objectiveOnly && <FactChip>{t("Objective part only")}</FactChip>}
        </FactChips>

        <MockSections />
        {/* Written parts are listed with the sections; the rest of what it leaves out, here. */}
        <MockLeftOutNote
          leftOut={challenge.leftOut.filter(
            (part) => part.part !== "written" && part.part !== "writtenInFull",
          )}
        />
      </IntroCard>

      <Callout>
        {challenge.netScored ? <ScaleIcon aria-hidden="true" /> : <EyeOffIcon aria-hidden="true" />}
        <p>
          {challenge.netScored ? (
            <PenaltyRule />
          ) : (
            t("Your result only shows at the end, like on exam day.")
          )}
        </p>
      </Callout>
    </>
  );
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

  // A phase checkpoint is done once won.
  return challenge.status === "done" ? <WonIntro /> : <TricksterIntro />;
}
