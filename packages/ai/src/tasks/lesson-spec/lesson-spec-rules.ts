import { type VisualFloor } from "../_utils/visual-floor";
import { type CourseLevel } from "../curriculum/_utils/course-levels";

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

/** New ideas start with the explanation; ideas most learners partly know start with a question. */
export const SUPPORT_MODES = ["explanationFirst", "questionFirst"] as const;

export type SupportMode = (typeof SUPPORT_MODES)[number];

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
  visual: string | null;
  /** Only on activity screens. */
  activityTemplate: string | null;
};

export type LessonSpec = {
  title: string;
  description: string;
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
  noviceTeachingBeforeFirstCheck: 2,
  teachingScreensPerVisual: 3,
} as const;

const SECONDS_PER_MINUTE = 60;

/** Reading or doing time per screen for a typical learner, calibrated to 5 to 12 screens in 2 to 5 minutes. */
const SCREEN_SECONDS: Record<LessonScreenKind, number> = {
  activity: 40,
  application: 40,
  check: 20,
  explanation: 25,
  guess: 20,
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
  | "earlyCheck"
  | "guess"
  | "hook"
  | "hookPicture"
  | "screenCount"
  | "skillCount"
  | "skillReference"
  | "supportMode"
  | "teachingVisual"
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

function countTeachingBeforePractice(screens: readonly LessonScreen[]): number {
  const firstPractice = screens.findIndex((screen) => isPracticeScreen(screen.kind));
  const before = firstPractice === -1 ? screens : screens.slice(0, firstPractice);

  return before.filter((screen) => isTeachingScreen(screen.kind)).length;
}

function getTeachingVisualIssue(screens: readonly LessonScreen[]) {
  const teaching = screens.filter((screen) => isTeachingScreen(screen.kind));
  const shown = teaching.filter((screen) => screen.visual || screen.activityTemplate).length;
  const needed = Math.ceil(teaching.length / LESSON_SIZE.teachingScreensPerVisual);

  return (
    shown < needed && {
      code: "teachingVisual" as const,
      detail: `${shown} of ${teaching.length} explanations and worked examples show a picture or a template to explore; the lesson needs at least ${needed}.`,
    }
  );
}

/** A floor, not a share to fill: the hook's picture in a shared lesson and a few more visuals. */
function getVisualFloorIssues({
  screens,
  visualFloor,
}: {
  screens: readonly LessonScreen[];
  visualFloor: VisualFloor;
}) {
  if (visualFloor === "none") {
    return [];
  }

  return [
    visualFloor === "pictures" &&
      screens[0]?.kind === "hook" &&
      !screens[0].visual && {
        code: "hookPicture" as const,
        detail: "The hook has no picture of the lesson's main example.",
      },
    getTeachingVisualIssue(screens),
  ].filter((issue) => issue !== false);
}

/** The guess needs the story's first idea before it, and the application stays last. */
function getGuessIssue(screens: readonly LessonScreen[]) {
  const guesses = screens.flatMap((screen, index) => (screen.kind === "guess" ? [index] : []));
  const at = guesses[0];

  if (at === undefined) {
    return false;
  }

  const taughtBefore = screens.slice(0, at).some((screen) => isTeachingScreen(screen.kind));

  return (
    (guesses.length > 1 || !taughtBefore) && {
      code: "guess" as const,
      detail: "A lesson has at most one guess, after at least one explanation or worked example.",
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
  visualFloor: VisualFloor;
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
      detail: `Has ${longestRun} teaching screens in a row; a check comes every 2 or 3 screens.`,
    },
    novice &&
      countTeachingBeforePractice(screens) < LESSON_SIZE.noviceTeachingBeforeFirstCheck && {
        code: "earlyCheck" as const,
        detail: `The first check comes before ${LESSON_SIZE.noviceTeachingBeforeFirstCheck} explanations or worked examples.`,
      },
    getSupportModeFromScreens(screens) !== spec.supportMode && {
      code: "supportMode" as const,
      detail: `Says ${spec.supportMode} but the screen after the hook doesn't match.`,
    },
    screens.some((screen) => screen.kind === "activity" && !screen.activityTemplate) && {
      code: "activityTemplate" as const,
      detail: "An activity screen has no template from the catalog.",
    },
    getGuessIssue(screens),
    ...getVisualFloorIssues({ screens, visualFloor }),
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
 * An empty list means the spec passes. `novice` is `readsNoviceRules` for the lesson, and
 * `visualFloor` is `getVisualFloor`.
 */
export function getLessonSpecIssues({
  level,
  novice = false,
  spec,
  visualFloor = "none",
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
