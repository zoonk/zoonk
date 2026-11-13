"use client";

import { type LanguageTodayView } from "@zoonk/core/view-models/language/contract";
import { useExtracted } from "next-intl";
import { useFormatShare } from "../_utils/percent";
import { LevelLadder } from "../language/progress/level-ladder";
import { LevelValue } from "../language/progress/level-value";
import { useTodayScreen } from "./today-context";
import { LessonsCard } from "./today-lessons-card";
import { ProgressCard, useCardIds } from "./today-progress-card";

const PERCENT = 100;

function useWeekGain(gain: number): React.ReactNode {
  const t = useExtracted();
  const points = Math.round(gain * PERCENT);

  if (points === 0) {
    return null;
  }

  return points > 0 ? (
    <span className="text-success-text">{t("+{points, number} this week", { points })}</span>
  ) : (
    t("{points, number} this week", { points })
  );
}

function PreparationCard({
  className,
  value,
  weekGain,
}: {
  className?: string;
  value: number;
  weekGain: number;
}) {
  const t = useExtracted();
  const formatShare = useFormatShare();
  const ids = useCardIds();
  const gain = useWeekGain(weekGain);

  return (
    <ProgressCard
      className={className}
      detail={gain}
      ids={ids}
      title={t("Preparation")}
      value={formatShare(value)}
    />
  );
}

function LevelCard({
  className,
  level,
}: {
  className?: string;
  level: NonNullable<LanguageTodayView["level"]>;
}) {
  const t = useExtracted();
  const ids = useCardIds();

  return (
    <ProgressCard
      className={className}
      ids={ids}
      title={t("Level")}
      value={<LevelValue {...level} />}
    >
      <LevelLadder {...level} />
    </ProgressCard>
  );
}

/** The goal's one number; its parts are the Plan's to list. */
export function TodayPreparation({
  className,
  knownLessons,
  level = null,
}: {
  className?: string;
  knownLessons: number;
  level?: LanguageTodayView["level"];
}) {
  const { today } = useTodayScreen();
  const { progress } = today;

  if (today.goal.kind === "language") {
    return level ? <LevelCard className={className} level={level} /> : null;
  }

  if (!progress) {
    return null;
  }

  if (progress.measure === "preparation") {
    return (
      <PreparationCard className={className} value={progress.value} weekGain={progress.weekGain} />
    );
  }

  return (
    <LessonsCard
      className={className}
      knownLessons={knownLessons}
      lessons={progress.lessons}
      value={progress.value}
    />
  );
}
