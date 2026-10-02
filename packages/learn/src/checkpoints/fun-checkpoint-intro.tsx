"use client";

import { Buddy } from "@zoonk/ui/components/buddy";
import { LineMarker } from "@zoonk/ui/components/line-marker";
import { Trickster } from "@zoonk/ui/components/trickster";
import { RotateCcwIcon, ShieldIcon, SwordsIcon } from "lucide-react";
import { useExtracted, useFormatter } from "next-intl";
import { BigChallengeCard } from "../_components/big-challenge-card";
import { BuddySpeech, useBuddyLine } from "../buddies/buddy-lines";
import { useCheckpointScreen } from "./checkpoint-context";
import { CheckpointFrame, CheckpointStartFooter } from "./checkpoint-frame";
import { useCheckpointEyebrow, useCheckpointRules } from "./checkpoint-labels";
import { CheckpointRewards } from "./checkpoint-rewards";
import { TricksterShield } from "./trickster-shield";

const EYEBROW_CLASS = "text-fun-accent-lime text-xs font-semibold tracking-[0.18em] uppercase";

function PhaseChip() {
  const { checkpoint } = useCheckpointScreen();

  if (!checkpoint.phase?.name) {
    return null;
  }

  return (
    <span className="fun-glass text-fun-fg inline-flex max-w-40 items-center gap-1.5 truncate rounded-full px-3 py-1.5 text-xs font-medium">
      <span aria-hidden="true" className="bg-fun-accent-cyan size-1.5 shrink-0 rounded-full" />
      {checkpoint.phase.name}
    </span>
  );
}

function IntroBuddy({ expression }: { expression: "kind" | "think" }) {
  const { buddy } = useCheckpointScreen();

  if (!buddy) {
    return null;
  }

  return (
    <Buddy
      beltColor={buddy.beltColor}
      className="size-28 sm:size-32"
      energy={buddy.energy}
      expression={expression}
      glasses={buddy.glasses}
      kind={buddy.kind}
    />
  );
}

/** The phase boss: the Trickster, the rules as a shield to crack and what winning is worth. */
function FunBossIntro() {
  const t = useExtracted();
  const { checkpoint, buddy } = useCheckpointScreen();
  const eyebrow = useCheckpointEyebrow(checkpoint);
  const rules = useCheckpointRules(checkpoint);
  const line = useBuddyLine("boss");

  return (
    <CheckpointFrame
      footer={
        <CheckpointStartFooter>
          <SwordsIcon aria-hidden="true" />
          {checkpoint.rematch ? t("Rematch") : t("Take it on")}
        </CheckpointStartFooter>
      }
      headerEnd={<PhaseChip />}
    >
      <div className="flex flex-col gap-2 pt-2">
        <p className={EYEBROW_CLASS}>{eyebrow}</p>
        <h1 className="font-fun-display text-4xl leading-tight font-bold text-balance">
          {t("The Trickster")}
        </h1>
        <p className="text-fun-fg2">{t("Master of questions that look easy.")}</p>
      </div>

      <div className="flex items-end justify-between gap-2">
        <div className="flex flex-col items-start gap-2">
          {buddy && <BuddySpeech>{line}</BuddySpeech>}
          <IntroBuddy expression="think" />
        </div>
        <Trickster className="animate-fun-ceremony size-40 sm:size-48" pose="hero" />
      </div>

      <section className="fun-glass flex flex-col gap-3 rounded-3xl p-4">
        <p className="flex items-start gap-3 font-medium">
          <LineMarker>
            <ShieldIcon aria-hidden="true" className="text-fun-accent-violet size-5" />
          </LineMarker>
          {rules}
        </p>
        <TricksterShield cracked={0} segments={checkpoint.passMark} />
      </section>

      <section className="fun-glass flex flex-col gap-3 rounded-3xl p-4">
        <h2 className="text-fun-fg2 text-xs font-semibold tracking-[0.18em] uppercase">
          {t("If you win")}
        </h2>
        <CheckpointRewards layout="tiles" />
      </section>

      <p className="text-fun-fg2 flex items-start gap-2 text-sm">
        <LineMarker>
          <RotateCcwIcon aria-hidden="true" className="size-4" />
        </LineMarker>
        {t(
          "If it doesn't work out, there's a rematch tomorrow after {lessons} short lessons. Nothing is lost.",
          { lessons: String(checkpoint.reinforcementLessons) },
        )}
      </p>
    </CheckpointFrame>
  );
}

function ChallengeStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <span className="font-fun-display text-2xl font-bold tabular-nums">{value}</span>
      <span className="text-fun-fg2 text-xs">{label}</span>
    </div>
  );
}

/** The weekly Big Challenge: this week's mix as an event. */
function FunBigChallengeIntro() {
  const t = useExtracted();
  const format = useFormatter();
  const { checkpoint, buddy } = useCheckpointScreen();
  const line = useBuddyLine("bigChallenge");
  const points = format.number(checkpoint.reward.brainPower);

  return (
    <CheckpointFrame footer={<CheckpointStartFooter>{t("I'm in")}</CheckpointStartFooter>}>
      <div className="flex items-end gap-3 pt-2">
        <IntroBuddy expression="kind" />
        {buddy && <BuddySpeech>{line}</BuddySpeech>}
      </div>

      <BigChallengeCard
        eyebrow={t("Today")}
        reward={t("+{points} Brain Power for finishing", { points })}
        subtitle={checkpoint.title ?? t("This week's mix")}
      >
        <div className="flex gap-8">
          <ChallengeStat label={t("questions")} value={String(checkpoint.questions.length)} />
        </div>
      </BigChallengeCard>
    </CheckpointFrame>
  );
}

/** Fun: the Trickster before a boss, the Big Challenge before the week's mix. */
export function FunCheckpointIntro() {
  const { checkpoint } = useCheckpointScreen();

  return checkpoint.kind === "weekly" ? <FunBigChallengeIntro /> : <FunBossIntro />;
}
