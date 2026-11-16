"use client";

import { type LanguageTodayView } from "@zoonk/core/view-models/language/contract";
import { useExtracted } from "next-intl";
import { useFormatShare } from "../_utils/percent";
import { useLanguageNameInSentence } from "../_utils/use-language-name";
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
  targetLanguage,
}: {
  className?: string;
  level: NonNullable<LanguageTodayView["level"]>;
  targetLanguage: string;
}) {
  const t = useExtracted();
  const ids = useCardIds();
  const languageName = useLanguageNameInSentence();

  return (
    <ProgressCard
      className={className}
      ids={ids}
      title={t("{language} level", { language: languageName(targetLanguage) })}
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
  language = null,
}: {
  className?: string;
  knownLessons: number;
  language?: Pick<LanguageTodayView, "level" | "targetLanguage"> | null;
}) {
  const { today } = useTodayScreen();
  const { progress } = today;

  if (today.goal.kind === "language") {
    return language?.level ? (
      <LevelCard
        className={className}
        level={language.level}
        targetLanguage={language.targetLanguage}
      />
    ) : null;
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
