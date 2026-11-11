import { type CourseLevel } from "../curriculum/_utils/course-levels";
import { type LessonVisualKind } from "./lesson-visuals";

/**
 * `application` becomes a check (or an activity) set in a realistic situation. `guess` is the
 * unscored question that follows the first explanation.
 */
export const LESSON_SCREEN_KINDS = [
  "hook",
  "explanation",
  "guess",
  "workedExample",
  "check",
  "activity",
  "application",
] as const;

export type LessonScreenKind = (typeof LESSON_SCREEN_KINDS)[number];

export type LessonSpecSkill = {
  name: string;
  topic: string;
  description: string;
  example: string;
  useCase: string;
  /** Hard skills get a worked example before the learner tries alone. */
  hard: boolean;
};

export type LessonScreen = {
  kind: LessonScreenKind;
  /** Indexes into the lesson's `skills`. */
  skills: number[];
  brief: string;
  visualKind: LessonVisualKind;
  /** The picture's description, only when `visualKind` is a picture. */
  visual: string | null;
  /** On activity screens, and on an explanation that shows a template to explore. */
  activityTemplate: string | null;
};

export type LessonSpec = {
  title: string;
  description: string;
  canDo: string;
  skills: LessonSpecSkill[];
  screens: LessonScreen[];
  /** Computed from the screen plan, never written by a model. */
  estimatedMinutes: number;
};

/** Screens are a tweet long, so a lesson goes deep in more of them rather than longer ones. */
export const LESSON_SIZE = {
  maxMinutes: 5,
  /** An advanced idea that can't be split, such as a derivation. */
  maxUnsplittableMinutes: 6,
  minMinutes: 2,
} as const;

const SECONDS_PER_MINUTE = 60;

/** Reading or doing time per screen for a typical learner, calibrated to 5 to 16 screens in 2 to 5 minutes. */
const SCREEN_SECONDS: Record<LessonScreenKind, number> = {
  activity: 40,
  application: 40,
  check: 20,
  explanation: 15,
  guess: 20,
  hook: 15,
  workedExample: 45,
};

const PRACTICE_KINDS: ReadonlySet<LessonScreenKind> = new Set(["check", "activity", "application"]);

const SKILL_TEACHING_KINDS: ReadonlySet<LessonScreenKind> = new Set([
  "activity",
  "explanation",
  "workedExample",
]);

type LessonSpecIssueCode =
  | "activityTemplate"
  | "application"
  | "hook"
  | "skillReference"
  | "unpracticedSkill"
  | "untaughtSkill";

export type LessonSpecIssue = { code: LessonSpecIssueCode; detail: string };

export function estimateLessonMinutes(kinds: readonly LessonScreenKind[]): number {
  const seconds = kinds.reduce((total, kind) => total + SCREEN_SECONDS[kind], 0);
  return Math.max(LESSON_SIZE.minMinutes, Math.round(seconds / SECONDS_PER_MINUTE));
}

/** An advanced lesson may run a minute longer when its single idea can't be split. */
export function getMaxLessonMinutes({
  level,
  skillCount,
}: {
  level: CourseLevel;
  skillCount: number;
}): number {
  return level === "advanced" && skillCount === 1
    ? LESSON_SIZE.maxUnsplittableMinutes
    : LESSON_SIZE.maxMinutes;
}

function getShapeIssues(spec: LessonSpec) {
  const { screens } = spec;
  const hooks = screens.filter((screen) => screen.kind === "hook").length;
  const applications = screens.filter((screen) => screen.kind === "application").length;

  return [
    (screens[0]?.kind !== "hook" || hooks !== 1) && {
      code: "hook" as const,
      detail: "The lesson must open with exactly one hook screen.",
    },
    (applications !== 1 || screens.at(-1)?.kind !== "application") && {
      code: "application" as const,
      detail: `Has ${applications} application screens; a lesson ends with exactly one.`,
    },
    screens.some((screen) => screen.kind === "activity" && !screen.activityTemplate) && {
      code: "activityTemplate" as const,
      detail: "An activity screen has no template from the catalog.",
    },
  ].filter((issue) => issue !== false);
}

function screensFor({
  kinds,
  screens,
  skill,
}: {
  kinds: ReadonlySet<LessonScreenKind>;
  screens: readonly LessonScreen[];
  skill: number;
}): boolean {
  return screens.some((screen) => kinds.has(screen.kind) && screen.skills.includes(skill));
}

function getSkillIssues(spec: LessonSpec): LessonSpecIssue[] {
  const { screens, skills } = spec;

  const badReference = screens.some(
    (screen) =>
      screen.kind !== "hook" &&
      (screen.skills.length === 0 || screen.skills.some((skill) => skill >= skills.length)),
  );

  const perSkill = skills.flatMap((skill, index) =>
    [
      !screensFor({ kinds: SKILL_TEACHING_KINDS, screens, skill: index }) && {
        code: "untaughtSkill" as const,
        detail: `No screen teaches "${skill.name}".`,
      },
      !screensFor({ kinds: PRACTICE_KINDS, screens, skill: index }) && {
        code: "unpracticedSkill" as const,
        detail: `No check or activity makes the learner use "${skill.name}".`,
      },
    ].filter((issue) => issue !== false),
  );

  return [
    ...(badReference
      ? [
          {
            code: "skillReference" as const,
            detail: "A screen points at no skill or a missing one.",
          },
        ]
      : []),
    ...perSkill,
  ];
}

/**
 * Only a part the lesson can't do without, or a reference the writer can't follow, is a rule. Size
 * and pacing (screens before a check, the guess, a worked example for a hard skill) are
 * targets the prompt sets: a plan a little off them reads fine, and a second plan rarely changes it.
 */
export function getLessonSpecIssues(spec: LessonSpec): LessonSpecIssue[] {
  return [...getShapeIssues(spec), ...getSkillIssues(spec)];
}
