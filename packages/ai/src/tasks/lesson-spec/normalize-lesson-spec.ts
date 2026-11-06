import { toPlainLine } from "@zoonk/utils/text-repairs";
import {
  type LessonScreen,
  type LessonScreenKind,
  type LessonSpec,
  type LessonSpecSkill,
  estimateLessonMinutes,
} from "./lesson-spec-rules";
import { type LessonVisualKind } from "./lesson-visuals";

/** Skills are numbered from 1 in the order the lesson lists them. */
type RawLessonScreen = {
  activityTemplate: string | null;
  brief: string;
  kind: LessonScreenKind;
  skills: number[];
  visual: string | null;
  visualKind: LessonVisualKind;
};

export type RawLessonSpec = {
  canDo: string;
  description: string;
  screens: RawLessonScreen[];
  skills: LessonSpecSkill[];
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

type ScreenVisual = Pick<LessonScreen, "activityTemplate" | "visual" | "visualKind">;

const DRAWN_FROM_BRIEF: ReadonlySet<LessonVisualKind> = new Set(["chart", "table", "timeline"]);

/**
 * A screen shows one visual. What the app draws from the brief's data needs nothing more; a
 * picture needs its description and a template its id, so a kind without one falls back to the
 * other one the plan filled in.
 */
function toVisual({
  activityTemplate,
  kind,
  picture,
  visualKind,
}: {
  activityTemplate: string | null;
  kind: LessonScreenKind;
  picture: string;
  visualKind: LessonVisualKind;
}): ScreenVisual {
  const nothing: ScreenVisual = { activityTemplate: null, visual: null, visualKind: "none" };

  // An activity draws itself; its picture is one its template asks for.
  if (kind === "activity") {
    return { activityTemplate, visual: picture || null, visualKind: "template" };
  }

  if (DRAWN_FROM_BRIEF.has(visualKind)) {
    return { ...nothing, visualKind };
  }

  const asPicture: ScreenVisual | null = picture
    ? { activityTemplate: null, visual: picture, visualKind: "picture" }
    : null;

  const asTemplate: ScreenVisual | null = activityTemplate
    ? { activityTemplate, visual: null, visualKind: "template" }
    : null;

  const preferred = visualKind === "picture" ? [asPicture, asTemplate] : [asTemplate, asPicture];

  return preferred.find((visual) => visual !== null) ?? nothing;
}

function normalizeScreen({
  exploreIds,
  screen,
  skillCount,
  templateIds,
}: TemplateSets & { screen: RawLessonScreen; skillCount: number }): LessonScreen {
  const activity = normalizeActivity({ exploreIds, screen, templateIds });

  return {
    ...activity,
    ...toVisual({
      activityTemplate: activity.activityTemplate,
      kind: activity.kind,
      picture: screen.visual?.trim() ?? "",
      visualKind: screen.visualKind,
    }),
    brief: screen.brief.trim(),
    skills: toSkillIndexes({ kind: screen.kind, numbers: screen.skills, skillCount }),
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
    title: toPlainLine(raw.title),
  };
}
