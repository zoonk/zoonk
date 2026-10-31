"use client";

import { type LanguageTodayView } from "@zoonk/core/view-models/language/contract";
import { useExtracted } from "next-intl";
import { useFormatShare } from "../_utils/percent";
import { LevelLadder } from "../language/progress/level-ladder";
import { LevelValue } from "../language/progress/level-value";
import { useTodayScreen } from "./today-context";
import { LessonsCard } from "./today-lessons-card";
import { ProgressCard, useCardIds } from "./today-progress-card";
import { SubjectRows, type TodaySyllabus, useSubjectRows } from "./today-subject-rows";

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
  syllabus,
  value,
  weekGain,
}: {
  className?: string;
  syllabus: TodaySyllabus | null;
  value: number;
  weekGain: number;
}) {
  const t = useExtracted();
  const formatShare = useFormatShare();
  const ids = useCardIds();
  const rows = useSubjectRows(syllabus);
  const gain = useWeekGain(weekGain);

  return (
    <ProgressCard
      className={className}
      detail={gain}
      ids={ids}
      title={t("Preparation")}
      value={formatShare(value)}
    >
      <SubjectRows labelledBy={ids.title} rows={rows} />
    </ProgressCard>
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

export function TodayPreparation({
  className,
  level = null,
  syllabus,
}: {
  className?: string;
  level?: LanguageTodayView["level"];
  syllabus: TodaySyllabus | null;
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
      <PreparationCard
        className={className}
        syllabus={syllabus}
        value={progress.value}
        weekGain={progress.weekGain}
      />
    );
  }

  return (
    <LessonsCard
      className={className}
      lessons={progress.lessons}
      syllabus={syllabus}
      value={progress.value}
    />
  );
}
