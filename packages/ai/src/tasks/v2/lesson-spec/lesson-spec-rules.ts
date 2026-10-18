import { type CourseLevel } from "../curriculum/_utils/course-levels";

/**
 * What each planned screen does. Writers map them to step kinds: `application`
 * becomes a check (or an activity) set in a realistic situation.
 */
export const LESSON_SCREEN_KINDS = [
  "hook",
  "explanation",
  "workedExample",
  "check",
  "activity",
  "application",
] as const;

export type LessonScreenKind = (typeof LESSON_SCREEN_KINDS)[number];

/** New ideas start with the explanation; ideas most learners partly know start with a question. */
export const SUPPORT_MODES = ["explanationFirst", "questionFirst"] as const;

export type SupportMode = (typeof SUPPORT_MODES)[number];

export type LessonSpecSkill = {
  /** One thing the learner can do, as an action ("Calculate a percent change"). */
  name: string;
  /** The canonical topic name, used as a lesson title when a split gives this skill its own lesson. */
  topic: string;
  /** The idea in one sentence: the front of the skill's study card. */
  description: string;
  /** A concrete example in one line: the back of the skill's study card. */
  example: string;
  /** Where the skill shows up in real life, in one line. */
  useCase: string;
  /** Hard skills get a worked example before the learner tries alone. */
  hard: boolean;
};

export type LessonScreen = {
  kind: LessonScreenKind;
  /** Indexes into the lesson's `skills`. */
  skills: number[];
  /** What the screen does, for the writer. */
  brief: string;
  /** A picture that teaches (diagram, before and after, labeled scene), or null. */
  visual: string | null;
  /** Activity template id from the catalog, only on activity screens. */
  activityTemplate: string | null;
};

export type LessonSpec = {
  title: string;
  /** One line on what the lesson covers and why it's useful. */
  description: string;
  /** What the learner can do afterwards, shown on session tiles. */
  canDo: string;
  supportMode: SupportMode;
  skills: LessonSpecSkill[];
  screens: LessonScreen[];
  /** Computed from the screen plan, never written by a model. */
  estimatedMinutes: number;
};

export const LESSON_SIZE = {
  maxMinutes: 5,
  maxScreens: 12,
  maxScreensWithoutCheck: 3,
  maxSkills: 3,
  /** An advanced idea that can't be split, such as a derivation. */
  maxUnsplittableMinutes: 6,
  minMinutes: 2,
  minScreens: 5,
} as const;

const SECONDS_PER_MINUTE = 60;

/** Reading or doing time per screen for a typical learner, calibrated to 5 to 12 screens in 2 to 5 minutes. */
const SCREEN_SECONDS: Record<LessonScreenKind, number> = {
  activity: 40,
  application: 40,
  check: 20,
  explanation: 25,
  hook: 15,
  workedExample: 45,
};

const TEACHING_KINDS: ReadonlySet<LessonScreenKind> = new Set(["explanation", "workedExample"]);
const PRACTICE_KINDS: ReadonlySet<LessonScreenKind> = new Set(["check", "activity", "application"]);

const SKILL_TEACHING_KINDS: ReadonlySet<LessonScreenKind> = new Set([
  ...TEACHING_KINDS,
  "activity",
]);

type LessonSpecIssueCode =
  | "activityTemplate"
  | "application"
  | "checkGap"
  | "hook"
  | "screenCount"
  | "skillCount"
  | "skillReference"
  | "supportMode"
  | "tooLong"
  | "unpracticedSkill"
  | "untaughtSkill"
  | "workedExample";

export type LessonSpecIssue = { code: LessonSpecIssueCode; detail: string };

function isTeachingScreen(kind: LessonScreenKind): boolean {
  return TEACHING_KINDS.has(kind);
}

function isPracticeScreen(kind: LessonScreenKind): boolean {
  return PRACTICE_KINDS.has(kind);
}

/** Estimated minutes from the screen plan, so the size rules never depend on a model's guess. */
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

/** Whether a lesson is small enough to keep as one lesson. */
export function fitsLesson({ level, spec }: { level: CourseLevel; spec: LessonSpec }): boolean {
  return (
    spec.skills.length <= LESSON_SIZE.maxSkills &&
    spec.screens.length <= LESSON_SIZE.maxScreens &&
    spec.estimatedMinutes <= getMaxLessonMinutes({ level, skillCount: spec.skills.length })
  );
}

/** Support mode implied by the first screen after the hook. */
export function getSupportModeFromScreens(screens: readonly LessonScreen[]): SupportMode {
  const first = screens.find((screen) => screen.kind !== "hook");
  return first && isPracticeScreen(first.kind) ? "questionFirst" : "explanationFirst";
}

function getLongestTeachingRun(screens: readonly LessonScreen[]): number {
  return screens.reduce(
    (state, screen) => {
      const current = isTeachingScreen(screen.kind) ? state.current + 1 : 0;
      return { current, longest: Math.max(state.longest, current) };
    },
    { current: 0, longest: 0 },
  ).longest;
}

function getSizeIssues({ level, spec }: { level: CourseLevel; spec: LessonSpec }) {
  const maxMinutes = getMaxLessonMinutes({ level, skillCount: spec.skills.length });
  const skillCount = spec.skills.length;
  const screenCount = spec.screens.length;

  return [
    (skillCount === 0 || skillCount > LESSON_SIZE.maxSkills) && {
      code: "skillCount" as const,
      detail: `Teaches ${skillCount} skills; a lesson teaches 1 to ${LESSON_SIZE.maxSkills}.`,
    },
    (screenCount < LESSON_SIZE.minScreens || screenCount > LESSON_SIZE.maxScreens) && {
      code: "screenCount" as const,
      detail: `Plans ${screenCount} screens; a lesson has ${LESSON_SIZE.minScreens} to ${LESSON_SIZE.maxScreens}.`,
    },
    spec.estimatedMinutes > maxMinutes && {
      code: "tooLong" as const,
      detail: `Takes about ${spec.estimatedMinutes} minutes; the limit is ${maxMinutes}.`,
    },
  ].filter((issue) => issue !== false);
}

function getShapeIssues(spec: LessonSpec) {
  const { screens } = spec;
  const hooks = screens.filter((screen) => screen.kind === "hook").length;
  const applications = screens.filter((screen) => screen.kind === "application").length;
  const longestRun = getLongestTeachingRun(screens);

  return [
    (screens[0]?.kind !== "hook" || hooks !== 1) && {
      code: "hook" as const,
      detail: "The lesson must open with exactly one hook screen.",
    },
    (applications !== 1 || screens.at(-1)?.kind !== "application") && {
      code: "application" as const,
      detail: `Has ${applications} application screens; a lesson ends with exactly one.`,
    },
    longestRun > LESSON_SIZE.maxScreensWithoutCheck && {
      code: "checkGap" as const,
      detail: `Has ${longestRun} teaching screens in a row; a check comes every 2 or 3 screens.`,
    },
    getSupportModeFromScreens(screens) !== spec.supportMode && {
      code: "supportMode" as const,
      detail: `Says ${spec.supportMode} but the screen after the hook doesn't match.`,
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
      skill.hard &&
        !screensFor({ kinds: new Set(["workedExample"]), screens, skill: index }) && {
          code: "workedExample" as const,
          detail: `"${skill.name}" is hard but has no worked example.`,
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
 * The size and shape rules every lesson spec must pass before a writer uses
 * it: 1 to 3 skills, 5 to 12 screens, 2 to 5 minutes, a hook first, a check
 * every 2 or 3 screens, one application at the end, and a worked example for
 * each hard skill. An empty list means the spec passes.
 */
export function getLessonSpecIssues({
  level,
  spec,
}: {
  level: CourseLevel;
  spec: LessonSpec;
}): LessonSpecIssue[] {
  return [...getSizeIssues({ level, spec }), ...getShapeIssues(spec), ...getSkillIssues(spec)];
}
