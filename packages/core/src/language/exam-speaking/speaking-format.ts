import { type SpeakingExam } from "@zoonk/ai/tasks/v2/language/exam-speaking-exams";
import { type CefrLevel } from "@zoonk/utils/cefr";

type SpeakingRole = "examiner" | "partner";

type SpeakingMode = "monologue" | "interaction" | "monologueThenInteraction" | "rolePlay";

type SpeakingStimulus = "topic" | "photos" | "text" | "data";

type SpeakingCue = { atSeconds: number; say: string };

export type SpeakingTaskFormat = {
  key: string;
  name: string;
  role: SpeakingRole;
  mode: SpeakingMode;
  minutes: { max: number; min: number };
  prepMinutes: number;
  options: number;
  stimulus: SpeakingStimulus;
  brief: string;
  cues: readonly SpeakingCue[];
  continues?: string;
};

type SpeakingBandDisplay = "band" | "letter" | "points";

export type SpeakingCriterionFormat = {
  key: string;
  name: string;
  scope: "task" | "test";
  maxBand: number;
  halfBands: boolean;
  levelBand: number | null;
  display: SpeakingBandDisplay;
  sound: boolean;
  voiceOnly: boolean;
  interactive?: boolean;
};

type CriterionFields = Pick<SpeakingCriterionFormat, "key" | "name"> &
  Partial<Omit<SpeakingCriterionFormat, "key" | "name">>;

export function speakingCriteria(
  scale: Pick<SpeakingCriterionFormat, "display" | "halfBands" | "levelBand" | "maxBand" | "scope">,
) {
  return ({
    sound = false,
    voiceOnly = sound,
    ...fields
  }: CriterionFields): SpeakingCriterionFormat => ({ ...scale, ...fields, sound, voiceOnly });
}

export type SpeakingScoreRow = {
  criterion: string;
  task: string | null;
  points: readonly number[];
};

type SpeakingPassRule =
  | { kind: "group"; min: number; of: number }
  | { kind: "paper"; min: number }
  | { kind: "floor"; min: number }
  | { kind: "none" };

export type SpeakingFormat = {
  exam: SpeakingExam;
  level: CefrLevel;
  title: string;
  paper: string;
  minutes: { max: number; min: number };
  prepMinutes: number;
  prepTasks: readonly string[];
  tasks: readonly SpeakingTaskFormat[];
  criteria: readonly SpeakingCriterionFormat[];
  rows: readonly SpeakingScoreRow[];
  total: number;
  pass: SpeakingPassRule;
  source: string;
};

export function evenPoints({ max, maxBand }: { max: number; maxBand: number }): number[] {
  return Array.from({ length: maxBand + 1 }, (_, band) => (band * max) / maxBand);
}

type TaskDefaults = "cues" | "options" | "prepMinutes";

export function speakingTask(
  task: Omit<SpeakingTaskFormat, TaskDefaults> & Partial<Pick<SpeakingTaskFormat, TaskDefaults>>,
): SpeakingTaskFormat {
  return { cues: [], options: 1, prepMinutes: 0, ...task };
}
