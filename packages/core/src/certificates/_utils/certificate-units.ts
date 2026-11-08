import { type CourseLevel, type Goal, type PlanItem } from "@zoonk/db";
import { CourseLevel as COURSE_LEVELS } from "@zoonk/db/enums";
import { isHalfStudied, measureStudied } from "../../plans/_utils/half-studied";
import { areLessonsFinished, isTodo } from "../../plans/_utils/plan-end";
import { getWorkProgress } from "../../plans/_utils/work-progress";
import { LEARN_KINDS } from "../../plans/planner/plan-item-rules";
import { type PlanGraphSkill, type PlanPhase } from "../../plans/planner/plan-state";

const LEVEL_ORDER = Object.values(COURSE_LEVELS);

const COURSE_GOALS: ReadonlySet<Goal["kind"]> = new Set(["learn", "exam"]);

export type CertifiableItem = Pick<
  PlanItem,
  "completedAt" | "kind" | "lessonId" | "lessons" | "minutes" | "phase" | "skillId" | "status"
> & {
  /** The chapter a learn item counts in: its own, or its lesson's home chapter. */
  chapterId: string | null;
  /** That chapter's level in the primary course, or a stand-in's skill level. */
  level: CourseLevel | null;
};

export type LevelChapter = {
  chapterId: string;
  createdAt: Date;
  level: CourseLevel;
  /**
   * The plan's finished lessons taught every skill its lessons teach: a course-start plan teaches
   * a skill once, so it leaves out a chapter whose skills an earlier chapter already teaches.
   */
  taughtInPlan: boolean;
};

export type CertificateUnit = {
  /** The chapters its learn items count in, in plan order. */
  chapterIds: string[];
  courseLevel: CourseLevel | null;
  finished: boolean;
  /** Its learn items and the challenges of their phases. */
  items: CertifiableItem[];
  key: string;
};

type UnitDates = { studiesPastTarget: boolean; targetDate: Date | null };

type GraphSkill = Pick<PlanGraphSkill, "lessons" | "plannedLessons" | "skillId">;

function getCourseLevelKey({ courseId, level }: { courseId: string; level: CourseLevel }) {
  return `${courseId}:${level}`;
}

function isStudied(item: CertifiableItem): boolean {
  return getWorkProgress(item.status) === "studied";
}

function isUnitHalfStudied({
  graphSkills,
  learn,
}: {
  graphSkills: readonly GraphSkill[];
  learn: readonly CertifiableItem[];
}): boolean {
  const skillIds = new Set(learn.flatMap((item) => item.skillId ?? []));

  return isHalfStudied(
    measureStudied({
      graphSkills: graphSkills.filter((skill) => skillIds.has(skill.skillId)),
      items: learn,
    }),
  );
}

/**
 * Every lesson studied or tested out, at least half of its skills' lessons studied, and every
 * challenge of their phases won. An exam's mocks and reviews rehearse the exam rather than teach, so
 * they never count.
 */
function isUnitDone({
  challenges,
  dates,
  graphSkills,
  learn,
  phases,
}: {
  challenges: readonly CertifiableItem[];
  dates: UnitDates;
  graphSkills: readonly GraphSkill[];
  learn: readonly CertifiableItem[];
  phases: readonly Pick<PlanPhase, "challengeLeftOut">[];
}): boolean {
  return (
    areLessonsFinished({ items: learn, ...dates }) &&
    isUnitHalfStudied({ graphSkills, learn }) &&
    !phases.some((phase) => phase.challengeLeftOut) &&
    !challenges.some((item) => isTodo(item))
  );
}

function listChapterIds(learn: readonly CertifiableItem[]): string[] {
  return [...new Set(learn.flatMap((item) => item.chapterId ?? []))];
}

/**
 * The level as it stood when the plan began must all be in it: a mid-level start or a plan that
 * took part of a level doesn't certify it, while chapters added after the plan began, or whose
 * skills the plan teaches elsewhere, don't block it. It reads only what core wrote, never the
 * goal's details, which the learner can edit.
 */
function holdsWholeLevel({
  chapterIds,
  level,
  levelChapters,
  planCreatedAt,
}: {
  chapterIds: readonly string[];
  level: CourseLevel;
  levelChapters: readonly LevelChapter[];
  planCreatedAt: Date;
}): boolean {
  const held = new Set(chapterIds);

  return levelChapters
    .filter((chapter) => chapter.level === level && chapter.createdAt <= planCreatedAt)
    .every((chapter) => held.has(chapter.chapterId) || chapter.taughtInPlan);
}

/**
 * A plan earns a certificate per level of its primary course it finishes whole, when that course
 * is a Library path (`levelCourseId`), and one for the plan itself once it's finished with studied
 * lessons no certified level covers: a plan without levels, a partial level, other courses'
 * lessons. A level the learner certified in another goal covers its lessons here too.
 */
export function listCertificateUnits({
  goal,
  graphSkills,
  heldKeys,
  items,
  levelChapters,
  levelCourseId,
  phases,
  planCreatedAt,
  studiesPastTarget,
}: {
  goal: Pick<Goal, "id" | "kind" | "targetDate">;
  graphSkills: readonly GraphSkill[];
  heldKeys: ReadonlySet<string>;
  items: readonly CertifiableItem[];
  levelChapters: readonly LevelChapter[];
  levelCourseId: string | null;
  phases: readonly Pick<PlanPhase, "challengeLeftOut">[];
  planCreatedAt: Date;
  studiesPastTarget: boolean;
}): CertificateUnit[] {
  if (!COURSE_GOALS.has(goal.kind)) {
    return [];
  }

  const dates = { studiesPastTarget, targetDate: goal.targetDate };
  const learn = items.filter((item) => LEARN_KINDS.has(item.kind));
  const challenges = items.filter((item) => item.kind === "boss");

  const levelUnits = levelCourseId
    ? LEVEL_ORDER.flatMap((level) => {
        const unitLearn = learn.filter((item) => item.level === level);

        if (unitLearn.length === 0) {
          return [];
        }

        const phaseIndexes = new Set(unitLearn.map((item) => item.phase));
        const unitChallenges = challenges.filter((item) => phaseIndexes.has(item.phase));
        const chapterIds = listChapterIds(unitLearn);

        const finished =
          holdsWholeLevel({ chapterIds, level, levelChapters, planCreatedAt }) &&
          isUnitDone({
            challenges: unitChallenges,
            dates,
            graphSkills,
            learn: unitLearn,
            phases: phases.filter((_phase, index) => phaseIndexes.has(index)),
          });

        return [
          {
            chapterIds,
            courseLevel: level,
            finished,
            items: [...unitLearn, ...unitChallenges],
            key: getCourseLevelKey({ courseId: levelCourseId, level }),
          },
        ];
      })
    : [];

  const covered = new Set(
    levelUnits.flatMap((unit) => (unit.finished || heldKeys.has(unit.key) ? unit.courseLevel : [])),
  );

  const planUnit: CertificateUnit = {
    chapterIds: listChapterIds(learn),
    courseLevel: null,
    finished:
      learn.some((item) => isStudied(item) && (!item.level || !covered.has(item.level))) &&
      isUnitDone({ challenges, dates, graphSkills, learn, phases }),
    items: [...learn, ...challenges],
    key: goal.id,
  };

  return [...levelUnits, planUnit];
}
