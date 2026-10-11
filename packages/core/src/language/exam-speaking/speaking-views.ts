import { SPEAKING_EXAM_LANGUAGES } from "@zoonk/ai/tasks/v2/language/exam-speaking-exams";
import {
  type ExamTaskSnapshot,
  type ExamTaskView,
  type SpeakingCriterionView,
  type SpeakingPaperTaskView,
  type SpeakingPaperView,
  type SpeakingTaskView,
} from "./speaking-contract";
import { type SpeakingFormat, type SpeakingTaskFormat } from "./speaking-format";
import { getSpeakingFormat, listTaskCriteria } from "./speaking-formats";
import { getLevelMark } from "./speaking-standing";

/** The exam's preparation when this task shares it with others, with their numbers. */
function getSharedPrep({
  format,
  task,
}: {
  format: SpeakingFormat;
  task: SpeakingTaskFormat;
}): SpeakingTaskView["prepShared"] {
  const shared =
    task.prepMinutes > 0 && format.prepTasks.length > 1 && format.prepTasks.includes(task.key);

  if (!shared) {
    return null;
  }

  return {
    minutes: format.prepMinutes,
    tasks: format.prepTasks.map((key) => format.tasks.findIndex((item) => item.key === key) + 1),
  };
}

export function toSpeakingTaskView({
  format,
  task,
}: {
  format: SpeakingFormat;
  task: SpeakingTaskFormat;
}): SpeakingTaskView {
  return {
    key: task.key,
    minutes: task.minutes,
    mode: task.mode,
    name: task.name,
    options: task.options,
    prepMinutes: task.prepMinutes,
    prepShared: getSharedPrep({ format, task }),
    role: task.role,
    stimulus: task.stimulus,
  };
}

/**
 * A goal's paper as its page lists it: each task with the criteria it's rated on and the learner's
 * last finished try (`lastTries`, by task key).
 */
export function toSpeakingPaperView({
  access,
  format,
  lastTries,
}: {
  access: SpeakingPaperView["access"];
  format: SpeakingFormat;
  lastTries: ReadonlyMap<string, SpeakingPaperTaskView["lastTry"]>;
}): SpeakingPaperView {
  return {
    access,
    exam: format.exam,
    language: SPEAKING_EXAM_LANGUAGES[format.exam],
    level: format.level,
    minutes: format.minutes,
    paper: format.paper,
    prepMinutes: format.prepMinutes,
    prepTasks: [...format.prepTasks],
    source: format.source,
    tasks: format.tasks.map((task) => ({
      ...toSpeakingTaskView({ format, task }),
      criteria: listTaskCriteria({ format, task: task.key }).map(({ key, name }) => ({
        key,
        name,
      })),
      lastTry: lastTries.get(task.key) ?? null,
    })),
    title: format.title,
  };
}

/** A criterion as a task shows it, with the points its line on the mark sheet gives each band. */
function toCriterionView({
  criterion,
  format,
  task,
}: {
  criterion: SpeakingFormat["criteria"][number];
  format: SpeakingFormat;
  task: string;
}): SpeakingCriterionView {
  const row =
    format.rows.find((item) => item.criterion === criterion.key && item.task === task) ??
    format.rows.find((item) => item.criterion === criterion.key && item.task === null);

  return {
    display: criterion.display,
    halfBands: criterion.halfBands,
    key: criterion.key,
    levelBand: criterion.levelBand,
    levelMark: getLevelMark(criterion),
    maxBand: criterion.maxBand,
    name: criterion.name,
    points: row ? [...row.points] : null,
    sound: criterion.sound,
    voiceOnly: criterion.voiceOnly,
  };
}

/** An exam task's call as its screen shows it; null when its paper or task no longer exists. */
export function toExamTaskView({
  sectionId,
  snapshot,
}: {
  sectionId: string | null;
  snapshot: ExamTaskSnapshot;
}): ExamTaskView | null {
  const format = getSpeakingFormat({ exam: snapshot.exam, level: snapshot.level });
  const index = format?.tasks.findIndex((item) => item.key === snapshot.task) ?? -1;
  const task = format?.tasks[index];

  if (!format || !task) {
    return null;
  }

  return {
    card: snapshot.card,
    criteria: listTaskCriteria({ format, task: task.key }).map((criterion) =>
      toCriterionView({ criterion, format, task: task.key }),
    ),
    cues: task.cues.map((cue) => ({ ...cue })),
    exam: format.exam,
    language: SPEAKING_EXAM_LANGUAGES[format.exam],
    level: format.level,
    nextTask: format.tasks[index + 1]?.key ?? null,
    number: index + 1,
    paper: format.paper,
    sectionId,
    source: format.source,
    task: toSpeakingTaskView({ format, task }),
    taskCount: format.tasks.length,
    title: format.title,
  };
}
