"use client";

import { Buddy } from "@zoonk/ui/components/buddy";
import { LineMarker } from "@zoonk/ui/components/line-marker";
import { Trickster } from "@zoonk/ui/components/trickster";
import { cn } from "@zoonk/ui/lib/utils";
import { FlagIcon, RotateCcwIcon, StarIcon } from "lucide-react";
import { useExtracted, useFormatter } from "next-intl";
import { BuddySpeech, useBuddyLine } from "../buddies/buddy-lines";
import { useBuddyName } from "../buddies/use-buddy-name";
import { useExperienceMode } from "../mode-provider";
import { TaskMainLink } from "../shell/task-frame";
import { useCheckpointScreen } from "./checkpoint-context";
import { CheckpointFrame } from "./checkpoint-frame";
import { usePhaseLabel } from "./checkpoint-labels";
import { CheckpointReview } from "./checkpoint-review";
import { CheckpointRewards } from "./checkpoint-rewards";

type Outcome = { correct: number; passed: boolean; total: number };

/** How it went: from the moment it finished, or from the saved block when reopened later. */
function useOutcome(): Outcome | null {
  const { checkpoint, duel } = useCheckpointScreen();
  const fresh = duel.state.completion?.checkpoint;

  return fresh
    ? { correct: fresh.correct, passed: fresh.passed, total: fresh.total }
    : checkpoint.result;
}

/** One star per question, lit for each right answer, in the order they were answered. */
function ScoreStars() {
  const { checkpoint, duel } = useCheckpointScreen();
  const answers = duel.state.completion?.checkpoint?.answers;

  const stars =
    answers?.map((answer) => ({ id: answer.itemId, isLit: answer.isCorrect })) ??
    checkpoint.questions.map((question) => ({
      id: question.itemId,
      isLit: question.answered?.isCorrect ?? false,
    }));

  return (
    <div aria-hidden="true" className="flex flex-wrap justify-center gap-1">
      {stars.map((star) => (
        <StarIcon
          className={cn(
            "size-5",
            star.isLit ? "fill-fun-accent-amber text-fun-accent-amber" : "text-fun-dash",
          )}
          key={star.id}
        />
      ))}
    </div>
  );
}

function useHeadline(outcome: Outcome): string {
  const t = useExtracted();
  const mode = useExperienceMode();
  const { checkpoint } = useCheckpointScreen();

  if (checkpoint.kind === "weekly") {
    return mode === "fun" ? t("Big Challenge done!") : t("Weekly challenge done");
  }

  if (outcome.passed) {
    return mode === "fun" ? t("You won!") : t("Checkpoint passed");
  }

  return mode === "fun" ? t("Good fight!") : t("Not passed yet");
}

/** A lost boss costs nothing: a rematch tomorrow after short lessons, and the next phase is open. */
function RematchNote() {
  const t = useExtracted();
  const phaseLabel = usePhaseLabel();
  const { checkpoint } = useCheckpointScreen();

  return (
    <ul className="border-border in-data-[mode=fun]:fun-glass flex flex-col rounded-3xl border px-4">
      <li className="border-border flex items-start gap-3 border-b py-3">
        <LineMarker>
          <RotateCcwIcon aria-hidden="true" className="size-5" />
        </LineMarker>
        <span className="flex flex-col">
          <span className="font-semibold">{t("Rematch tomorrow")}</span>
          <span className="text-muted-foreground text-sm">
            {t("After {lessons} short lessons on what tripped you up. Nothing is lost.", {
              lessons: String(checkpoint.reinforcementLessons),
            })}
          </span>
        </span>
      </li>
      {checkpoint.nextPhase && (
        <li className="flex items-start gap-3 py-3">
          <LineMarker>
            <FlagIcon aria-hidden="true" className="size-5" />
          </LineMarker>
          <span className="flex flex-col">
            <span className="font-semibold">
              {t("{phase} is open", { phase: phaseLabel(checkpoint.nextPhase) })}
            </span>
            <span className="text-muted-foreground text-sm">
              {t("You can keep going while you prepare the rematch.")}
            </span>
          </span>
        </li>
      )}
    </ul>
  );
}

function FunResultArt({ outcome }: { outcome: Outcome }) {
  const { checkpoint, buddy } = useCheckpointScreen();
  const won = outcome.passed || checkpoint.kind === "weekly";
  const line = useBuddyLine(won ? "bossWon" : "bossLost");
  const buddyName = useBuddyName(buddy ?? { kind: "zu", name: null });

  return (
    <div className="flex flex-col items-center gap-2">
      {buddy && <BuddySpeech>{line}</BuddySpeech>}
      <div className="flex items-end justify-center gap-4">
        {buddy && (
          <Buddy
            beltColor={buddy.beltColor}
            className="animate-fun-ceremony size-32"
            energy={buddy.energy}
            expression={won ? "cheer" : "kind"}
            glasses={buddy.glasses}
            kind={buddy.kind}
            label={buddyName}
          />
        )}
        {checkpoint.kind !== "weekly" && (
          <Trickster className={cn("size-20", won && "rotate-12 opacity-80")} />
        )}
      </div>
    </div>
  );
}

function ScoreLine({ outcome }: { outcome: Outcome }) {
  const t = useExtracted();
  const { checkpoint } = useCheckpointScreen();
  const score = { correct: String(outcome.correct), total: String(outcome.total) };

  if (outcome.passed || checkpoint.kind === "weekly") {
    return <p className="text-muted-foreground">{t("{correct} of {total} right", score)}</p>;
  }

  return (
    <p className="text-muted-foreground">
      {t("{correct} of {total} right. Winning takes {passMark}.", {
        ...score,
        passMark: String(checkpoint.passMark),
      })}
    </p>
  );
}

/**
 * The end of a checkpoint. A win lists what it earned; a loss is kind and concrete: a rematch
 * tomorrow after short lessons, and the next phase stays open. The answers and the traps are
 * explained now, one tap away.
 */
export function CheckpointResultView() {
  const t = useExtracted();
  const format = useFormatter();
  const mode = useExperienceMode();
  const { checkpoint, duel, hrefs } = useCheckpointScreen();
  const outcome = useOutcome();
  const headline = useHeadline(outcome ?? { correct: 0, passed: false, total: 0 });
  const earned = duel.state.completion?.brainPower;
  const won = Boolean(outcome?.passed) || checkpoint.kind === "weekly";

  return (
    <CheckpointFrame footer={<TaskMainLink href={hrefs.continue}>{t("Continue")}</TaskMainLink>}>
      {mode === "fun" && outcome && <FunResultArt outcome={outcome} />}

      <div className="flex flex-col items-center gap-2 text-center" role="status">
        <h1 className="in-data-[mode=fun]:font-fun-display text-3xl font-bold text-balance">
          {headline}
        </h1>
        {mode === "fun" && outcome && <ScoreStars />}
        {outcome && <ScoreLine outcome={outcome} />}
        {earned !== undefined && earned > 0 && (
          <p className="text-sm font-medium">
            {t("+{points} Brain Power", { points: format.number(earned) })}
          </p>
        )}
      </div>

      {won ? (
        <CheckpointRewards layout="rows" withBrainPower={earned === undefined} />
      ) : (
        <RematchNote />
      )}
      <CheckpointReview />
    </CheckpointFrame>
  );
}
