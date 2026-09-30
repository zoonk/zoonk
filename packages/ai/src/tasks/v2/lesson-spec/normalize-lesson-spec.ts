import {
  type LessonScreen,
  type LessonScreenKind,
  type LessonSpec,
  type LessonSpecSkill,
  type SupportMode,
  estimateLessonMinutes,
} from "./lesson-spec-rules";

/** A screen as the model writes it: skills are numbered from 1 in the order the lesson lists them. */
type RawLessonScreen = {
  activityTemplate: string | null;
  brief: string;
  kind: LessonScreenKind;
  skills: number[];
  visual: string | null;
};

export type RawLessonSpec = {
  canDo: string;
  description: string;
  screens: RawLessonScreen[];
  skills: LessonSpecSkill[];
  supportMode: SupportMode;
  title: string;
};

function trimSkill(skill: LessonSpecSkill): LessonSpecSkill {
  return {
    description: skill.description.trim(),
    example: skill.example.trim(),
    hard: skill.hard,
    name: skill.name.trim(),
    topic: skill.topic.trim() || skill.name.trim(),
    useCase: skill.useCase.trim(),
  };
}

function toSkillIndexes({ numbers, skillCount }: { numbers: number[]; skillCount: number }) {
  const indexes = numbers
    .map((number) => number - 1)
    .filter((index) => Number.isInteger(index) && index >= 0 && index < skillCount);

  return [...new Set(indexes)];
}

/**
 * An activity only stays when the spec names a template the catalog has, since
 * the writer can't build anything else. Otherwise the screen keeps its brief
 * and becomes a regular check, so the learner still uses the idea there.
 */
function normalizeActivity({
  screen,
  templateIds,
}: {
  screen: RawLessonScreen;
  templateIds: ReadonlySet<string>;
}): Pick<LessonScreen, "activityTemplate" | "kind"> {
  const template = screen.activityTemplate?.trim() ?? "";

  if (screen.kind !== "activity") {
    return { activityTemplate: null, kind: screen.kind };
  }

  return templateIds.has(template)
    ? { activityTemplate: template, kind: "activity" }
    : { activityTemplate: null, kind: "check" };
}

function normalizeScreen({
  screen,
  skillCount,
  templateIds,
}: {
  screen: RawLessonScreen;
  skillCount: number;
  templateIds: ReadonlySet<string>;
}): LessonScreen {
  const visual = screen.visual?.trim() ?? "";

  return {
    ...normalizeActivity({ screen, templateIds }),
    brief: screen.brief.trim(),
    skills: toSkillIndexes({ numbers: screen.skills, skillCount }),
    visual: visual || null,
  };
}

/**
 * Turns the model's lesson into a stored spec: trimmed text, skill numbers
 * turned into indexes (unknown ones dropped), activities limited to the
 * catalog and minutes computed from the screen plan.
 */
export function normalizeLessonSpec({
  raw,
  templateIds,
}: {
  raw: RawLessonSpec;
  templateIds: ReadonlySet<string>;
}): LessonSpec {
  const skills = raw.skills.map((skill) => trimSkill(skill));

  const screens = raw.screens.map((screen) =>
    normalizeScreen({ screen, skillCount: skills.length, templateIds }),
  );

  return {
    canDo: raw.canDo.trim(),
    description: raw.description.trim(),
    estimatedMinutes: estimateLessonMinutes(screens.map((screen) => screen.kind)),
    screens,
    skills,
    supportMode: raw.supportMode,
    title: raw.title.trim(),
  };
}
