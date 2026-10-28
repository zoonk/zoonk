import { type SpeakingExam } from "@zoonk/ai/tasks/v2/language/exam-speaking-exams";
import { CEFR_LEVELS, type CefrLevel } from "@zoonk/utils/cefr";
import { CAMBRIDGE_FORMATS } from "./formats/cambridge";
import { DELE_FORMATS } from "./formats/dele";
import { DELF_FORMATS } from "./formats/delf";
import { GOETHE_FORMATS } from "./formats/goethe";
import {
  type SpeakingCriterionFormat,
  type SpeakingFormat,
  type SpeakingTaskFormat,
} from "./speaking-format";

const FORMATS: readonly SpeakingFormat[] = [
  ...DELE_FORMATS,
  ...DELF_FORMATS,
  ...GOETHE_FORMATS,
  ...CAMBRIDGE_FORMATS,
];

export function getSpeakingFormat({
  exam,
  level,
}: {
  exam: SpeakingExam;
  level: CefrLevel;
}): SpeakingFormat | null {
  return FORMATS.find((format) => format.exam === exam && format.level === level) ?? null;
}

export function listSpeakingLevels(exam: SpeakingExam): CefrLevel[] {
  return CEFR_LEVELS.filter((level) => getSpeakingFormat({ exam, level }));
}

export function getSpeakingTask({
  format,
  task,
}: {
  format: SpeakingFormat;
  task: string;
}): SpeakingTaskFormat | null {
  return format.tasks.find((item) => item.key === task) ?? null;
}

export function listTaskCriteria({
  format,
  task,
}: {
  format: SpeakingFormat;
  task: string;
}): SpeakingCriterionFormat[] {
  const alone = format.tasks.find((item) => item.key === task)?.mode === "monologue";

  return format.criteria.filter((criterion) =>
    criterion.scope === "test"
      ? !(alone && criterion.interactive)
      : format.rows.some((row) => row.criterion === criterion.key && row.task === task),
  );
}
