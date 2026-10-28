import { toPlainLine } from "@zoonk/utils/text-repairs";
import {
  type LessonScreen,
  type LessonScreenKind,
  type LessonSpec,
  type LessonSpecSkill,
  type SupportMode,
  estimateLessonMinutes,
  getSupportModeFromScreens,
} from "./lesson-spec-rules";

/** Skills are numbered from 1 in the order the lesson lists them. */
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

function cleanSkill(skill: LessonSpecSkill): LessonSpecSkill {
  const name = toPlainLine(skill.name);

  return {
    description: toPlainLine(skill.description),
    example: toPlainLine(skill.example),
    hard: skill.hard,
    name,
    topic: toPlainLine(skill.topic) || name,
    useCase: toPlainLine(skill.useCase),
  };
}

/** In a lesson of one skill, a screen past the hook that names none is about that skill. */
function toSkillIndexes({
  kind,
  numbers,
  skillCount,
}: {
  kind: LessonScreenKind;
  numbers: number[];
  skillCount: number;
}) {
  const indexes = numbers
    .map((number) => number - 1)
    .filter((index) => Number.isInteger(index) && index >= 0 && index < skillCount);

  return indexes.length === 0 && kind !== "hook" && skillCount === 1 ? [0] : [...new Set(indexes)];
}

type TemplateSets = { exploreIds: ReadonlySet<string>; templateIds: ReadonlySet<string> };

/**
 * The writer can only build catalog templates, so an activity naming another becomes a regular
 * check with its brief.
 */
function normalizeActivity({
  exploreIds,
  screen,
  templateIds,
}: TemplateSets & { screen: RawLessonScreen }): Pick<LessonScreen, "activityTemplate" | "kind"> {
  const template = screen.activityTemplate?.trim() ?? "";

  if (screen.kind === "explanation") {
    return { activityTemplate: exploreIds.has(template) ? template : null, kind: screen.kind };
  }

  if (screen.kind !== "activity") {
    return { activityTemplate: null, kind: screen.kind };
  }

  return templateIds.has(template)
    ? { activityTemplate: template, kind: "activity" }
    : { activityTemplate: null, kind: "check" };
}

function normalizeScreen({
  exploreIds,
  screen,
  skillCount,
  templateIds,
}: TemplateSets & { screen: RawLessonScreen; skillCount: number }): LessonScreen {
  const visual = screen.visual?.trim() ?? "";

  return {
    ...normalizeActivity({ exploreIds, screen, templateIds }),
    brief: screen.brief.trim(),
    skills: toSkillIndexes({ kind: screen.kind, numbers: screen.skills, skillCount }),
    visual: visual || null,
  };
}

export function normalizeLessonSpec({
  exploreIds,
  raw,
  templateIds,
}: TemplateSets & { raw: RawLessonSpec }): LessonSpec {
  const skills = raw.skills.map((skill) => cleanSkill(skill));

  const screens = raw.screens.map((screen) =>
    normalizeScreen({ exploreIds, screen, skillCount: skills.length, templateIds }),
  );

  return {
    canDo: toPlainLine(raw.canDo),
    description: toPlainLine(raw.description),
    estimatedMinutes: estimateLessonMinutes(screens.map((screen) => screen.kind)),
    screens,
    skills,
    // The writer builds an explanation on the check before it, so the screen plan decides.
    supportMode: getSupportModeFromScreens(screens),
    title: toPlainLine(raw.title),
  };
}
