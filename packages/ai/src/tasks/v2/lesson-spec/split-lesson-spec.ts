import { type CourseLevel } from "../curriculum/_utils/course-levels";
import {
  LESSON_SIZE,
  type LessonScreen,
  type LessonScreenKind,
  type LessonSpec,
  type LessonSpecSkill,
  estimateLessonMinutes,
  fitsLesson,
  getMaxLessonMinutes,
  getSupportModeFromScreens,
} from "./lesson-spec-rules";

/** One skill with the screens that teach and check it, between the hook and the application. */
type SkillSegment = { screens: LessonScreen[]; skill: number };

/** Every lesson made by a split gets its own hook and application. */
const FRAME_KINDS: readonly LessonScreenKind[] = ["hook", "application"];

function isFrameScreen(screen: LessonScreen): boolean {
  return FRAME_KINDS.includes(screen.kind);
}

/** A screen about several skills belongs with the last of them, since it needs all of them taught. */
function getOwnerSkill(screen: LessonScreen): number {
  return Math.max(0, ...screen.skills);
}

function getSegments(spec: LessonSpec): SkillSegment[] {
  const bodyScreens = spec.screens.filter((screen) => !isFrameScreen(screen));

  return spec.skills.map((_, skill) => ({
    screens: bodyScreens.filter((screen) => getOwnerSkill(screen) === skill),
    skill,
  }));
}

function getGroupKinds(segments: readonly SkillSegment[]): LessonScreenKind[] {
  return [
    ...FRAME_KINDS,
    ...segments.flatMap((segment) => segment.screens.map((screen) => screen.kind)),
  ];
}

/** A single skill always forms a group, since a skill is never cut in half. */
function canFormGroup({
  group,
  level,
}: {
  group: readonly SkillSegment[];
  level: CourseLevel;
}): boolean {
  const kinds = getGroupKinds(group);

  return (
    group.length === 1 ||
    (group.length <= LESSON_SIZE.maxSkills &&
      kinds.length <= LESSON_SIZE.maxScreens &&
      estimateLessonMinutes(kinds) <= getMaxLessonMinutes({ level, skillCount: group.length }))
  );
}

/** A way to cut the first skills into lessons, with its smallest lesson's screen count. */
type Grouping = { groups: SkillSegment[][]; smallest: number };

/** Fewer lessons first; then the one whose smallest lesson is biggest, so no lesson ends up tiny. */
function isBetterGrouping(candidate: Grouping, current: Grouping): boolean {
  return (
    candidate.groups.length < current.groups.length ||
    (candidate.groups.length === current.groups.length && candidate.smallest > current.smallest)
  );
}

/**
 * Cuts skills, in teaching order, into the fewest lessons that fit, and among
 * those picks the most even cut. Each prefix keeps only its best cut, which is
 * enough because a worse prefix can never lead to a better whole.
 */
function groupSegments({
  level,
  segments,
}: {
  level: CourseLevel;
  segments: readonly SkillSegment[];
}): SkillSegment[][] {
  const empty: Grouping = { groups: [], smallest: Number.POSITIVE_INFINITY };

  const bestByPrefix = segments.reduce<Grouping[]>(
    (best, _, index) => {
      const candidates = best.flatMap((prefix, start) => {
        const group = segments.slice(start, index + 1);

        return canFormGroup({ group, level })
          ? [
              {
                groups: [...prefix.groups, group],
                smallest: Math.min(prefix.smallest, getGroupKinds(group).length),
              },
            ]
          : [];
      });

      best.push(
        candidates.reduce((current, candidate) =>
          isBetterGrouping(current, candidate) ? current : candidate,
        ),
      );

      return best;
    },
    [empty],
  );

  return bestByPrefix.at(-1)?.groups ?? [];
}

function remapScreen({
  fallback,
  remap,
  screen,
}: {
  fallback: number[];
  remap: ReadonlyMap<number, number>;
  screen: LessonScreen;
}): LessonScreen {
  const skills = screen.skills.flatMap((skill) => {
    const mapped = remap.get(skill);
    return mapped === undefined ? [] : [mapped];
  });

  return { ...screen, skills: skills.length > 0 ? skills : fallback };
}

function createFrameScreen({
  brief,
  kind,
  skills,
}: {
  brief: string;
  kind: LessonScreenKind;
  skills: number[];
}): LessonScreen {
  return { activityTemplate: null, brief, kind, skills, visual: null };
}

/**
 * The first lesson keeps the original hook and the last keeps the original
 * application. The others open with a real situation and close by applying
 * their skills to where they show up in real life.
 */
function getFrame({
  isFirst,
  isLast,
  remap,
  skills,
  spec,
}: {
  isFirst: boolean;
  isLast: boolean;
  remap: ReadonlyMap<number, number>;
  skills: readonly LessonSpecSkill[];
  spec: LessonSpec;
}): { application: LessonScreen; hook: LessonScreen } {
  const allSkills = skills.map((_, index) => index);
  const hook = isFirst ? spec.screens.find((screen) => screen.kind === "hook") : undefined;

  const application = isLast
    ? spec.screens.findLast((screen) => screen.kind === "application")
    : undefined;

  return {
    application: application
      ? remapScreen({ fallback: allSkills, remap, screen: application })
      : createFrameScreen({
          brief: skills.at(-1)?.useCase ?? "",
          kind: "application",
          skills: allSkills,
        }),
    hook: hook
      ? remapScreen({ fallback: [0], remap, screen: hook })
      : createFrameScreen({ brief: skills[0]?.useCase ?? "", kind: "hook", skills: [0] }),
  };
}

function formatTopics({ language, topics }: { language: string; topics: string[] }): string {
  return new Intl.ListFormat(language, { style: "long", type: "conjunction" }).format(topics);
}

function buildPart({
  group,
  index,
  language,
  spec,
  total,
}: {
  group: readonly SkillSegment[];
  index: number;
  language: string;
  spec: LessonSpec;
  total: number;
}): LessonSpec {
  const originalIndexes = group.map((segment) => segment.skill);
  const remap = new Map(originalIndexes.map((original, position) => [original, position]));
  const skills = originalIndexes.flatMap((original) => spec.skills[original] ?? []);

  const frame = getFrame({
    isFirst: index === 0,
    isLast: index === total - 1,
    remap,
    skills,
    spec,
  });

  const body = group.flatMap((segment) =>
    segment.screens.map((screen) => remapScreen({ fallback: [0], remap, screen })),
  );

  const screens = [frame.hook, ...body, frame.application];
  const [lead] = skills;

  return {
    canDo: lead?.name ?? spec.canDo,
    description: lead?.description ?? spec.description,
    estimatedMinutes: estimateLessonMinutes(screens.map((screen) => screen.kind)),
    screens,
    skills,
    supportMode: getSupportModeFromScreens(screens),
    title: formatTopics({ language, topics: skills.map((skill) => skill.topic) }),
  };
}

/**
 * The split rule: a lesson that doesn't fit (more than 3 skills, more than 12
 * screens or more than 5 minutes) becomes as few lessons as fit, cut at skill
 * boundaries in teaching order and as even in size as possible.
 * A skill is never cut in half, because a lesson's identity is its skills:
 * one skill too big for a lesson stays whole and fails the size check instead.
 * Each new lesson gets a hook, its skills' screens and one application, and is
 * named after its skills' topics.
 */
export function splitLessonSpec({
  language,
  level,
  spec,
}: {
  language: string;
  level: CourseLevel;
  spec: LessonSpec;
}): LessonSpec[] {
  if (spec.skills.length <= 1 || fitsLesson({ level, spec })) {
    return [spec];
  }

  const groups = groupSegments({ level, segments: getSegments(spec) });

  if (groups.length === 1) {
    return [spec];
  }

  return groups.map((group, index) =>
    buildPart({ group, index, language, spec, total: groups.length }),
  );
}
