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

/**
 * "+4 this week": what an exam's preparation gained since the learner's week began, blue when it
 * rose, as the Plan says it. Nothing in a week without a whole point either way.
 */
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

/**
 * An exam's preparation, as the Plan's first number says it, with its gain this week and its
 * subjects on the same scale, those today's session still studies marked.
 */
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

/**
 * A language goal's level and the one it aims for ("A2+ → B1+"), as the Plan says it, on the CEFR
 * scale: the half steps reached in blue and the ones up to the target outlined.
 */
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

/**
 * Where the goal stands, beside the session from `sm`, in its one measure as the Plan says it and
 * drawn in the goal's own units: an exam's preparation with its subjects, another goal's lessons
 * as cells, a language goal's level on the CEFR scale. The whole card leads to the Plan. A phone
 * leaves it to the Plan.
 */
export function TodayPreparation({
  className,
  level = null,
  syllabus,
}: {
  className?: string;
  /** A language goal's level and the one it aims for; null for other goals and before any. */
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
