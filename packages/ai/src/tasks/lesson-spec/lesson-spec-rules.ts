import { type VisualFloor } from "../_utils/visual-floor";
import { type CourseLevel } from "../curriculum/_utils/course-levels";
import { type LessonVisualKind, getVisualFloorIssues, isTeachingScreen } from "./lesson-visuals";

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
  /** The lesson's title when a split gives this skill its own lesson. */
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
  /** Set on each lesson after the first that the code split off one plan: the plan's guess stays in the first. */
  laterPart?: boolean;
};

/** Screens are a tweet long, so a lesson goes deep in more of them rather than longer ones. */
export const LESSON_SIZE = {
  maxMinutes: 5,
  maxScreens: 16,
  maxScreensWithoutCheck: 4,
  maxSkills: 3,
  /** An advanced idea that can't be split, such as a derivation. */
  maxUnsplittableMinutes: 6,
  minMinutes: 2,
  minScreens: 5,
  noviceTeachingBeforeFirstCheck: 2,
  teachingBeforeFirstCheck: 1,
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
  | "checkGap"
  | "earlyCheck"
  | "guess"
  | "hook"
  | "screenCount"
  | "skillCount"
  | "skillReference"
  | "teachingVisual"
  | "tooLong"
  | "unpracticedSkill"
  | "untaughtSkill"
  | "workedExample";

export type LessonSpecIssue = { code: LessonSpecIssueCode; detail: string };

function isPracticeScreen(kind: LessonScreenKind): boolean {
  return PRACTICE_KINDS.has(kind);
}

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

export function fitsLesson({ level, spec }: { level: CourseLevel; spec: LessonSpec }): boolean {
  return (
    spec.skills.length <= LESSON_SIZE.maxSkills &&
    spec.screens.length <= LESSON_SIZE.maxScreens &&
    spec.estimatedMinutes <= getMaxLessonMinutes({ level, skillCount: spec.skills.length })
  );
}

/** The guess isn't practice, so teaching around it counts as one run. */
function getLongestTeachingRun(screens: readonly LessonScreen[]): number {
  return screens.reduce(
    (state, screen) => {
      if (screen.kind === "guess") {
        return state;
      }

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

function countTeachingBeforePractice(screens: readonly LessonScreen[]): number {
  const firstPractice = screens.findIndex((screen) => isPracticeScreen(screen.kind));
  const before = firstPractice === -1 ? screens : screens.slice(0, firstPractice);

  return before.filter((screen) => isTeachingScreen(screen.kind)).length;
}

function getEarlyCheckIssue({
  novice,
  screens,
}: {
  novice: boolean;
  screens: readonly LessonScreen[];
}) {
  const teaching = countTeachingBeforePractice(screens);

  const needed = novice
    ? LESSON_SIZE.noviceTeachingBeforeFirstCheck
    : LESSON_SIZE.teachingBeforeFirstCheck;

  return (
    teaching < needed && {
      code: "earlyCheck" as const,
      detail: `Has ${teaching} explanations or worked examples before the first check; this lesson needs ${needed}.`,
    }
  );
}

function getGuessIssue({ laterPart, screens }: LessonSpec) {
  const guesses = screens.filter((screen) => screen.kind === "guess").length;
  const firstTeaching = screens.findIndex((screen) => isTeachingScreen(screen.kind));
  const at = screens.findIndex((screen) => screen.kind === "guess");
  const next = screens[at + 1];

  if (laterPart && guesses === 0) {
    return false;
  }

  return (
    (guesses !== 1 || at !== firstTeaching + 1 || !next || !isTeachingScreen(next.kind)) && {
      code: "guess" as const,
      detail:
        "A lesson has exactly one guess, right after its first explanation or worked example and followed by another.",
    }
  );
}

function getShapeIssues({
  novice,
  spec,
  visualFloor,
}: {
  novice: boolean;
  spec: LessonSpec;
  visualFloor?: VisualFloor;
}) {
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
      detail: `Has ${longestRun} teaching screens in a row; a check comes after at most ${LESSON_SIZE.maxScreensWithoutCheck}.`,
    },
    getEarlyCheckIssue({ novice, screens }),
    screens.some((screen) => screen.kind === "activity" && !screen.activityTemplate) && {
      code: "activityTemplate" as const,
      detail: "An activity screen has no template from the catalog.",
    },
    getGuessIssue(spec),
    ...(visualFloor ? getVisualFloorIssues({ screens, visualFloor }) : []),
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
 * `novice` is `readsNoviceRules` for the lesson, and `visualFloor` is `getVisualFloor`, whose floor
 * is checked when given.
 */
export function getLessonSpecIssues({
  level,
  novice = false,
  spec,
  visualFloor,
}: {
  level: CourseLevel;
  novice?: boolean;
  spec: LessonSpec;
  visualFloor?: VisualFloor;
}): LessonSpecIssue[] {
  return [
    ...getSizeIssues({ level, spec }),
    ...getShapeIssues({ novice, spec, visualFloor }),
    ...getSkillIssues(spec),
  ];
}
