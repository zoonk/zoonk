import "server-only";
import { type CourseLevel } from "@zoonk/db";
import { normalizeString } from "@zoonk/utils/string";
import { type LibraryProvenance } from "../_utils/library-rows";
import { type IdentityCourse } from "../identity/_utils/identity-requests";
import { toLessonIdentitySubject } from "../identity/kinds/lesson-identity";
import {
  type LibraryIdentityResolution,
  resolveLibraryIdentities,
} from "../identity/resolve-library-identity";
import { writeSearchTerms } from "../identity/write-search-terms";
import { createLibraryLesson } from "../lessons/create-library-lesson";
import { createSkill } from "../skills/create-skill";
import {
  type CurriculumAnalytics,
  type CurriculumScope,
  type GoalSkillRef,
} from "./curriculum-scope";

type LessonSkillName = {
  name: string;
  /** The idea in one sentence, for a skill the Library doesn't have yet. */
  description: string;
};

type ResolvedLessonSkill = { id: string; name: string };

type ScopeContext = {
  analytics?: CurriculumAnalytics;
  provenance: LibraryProvenance;
  scope: CurriculumScope;
};

type ScopeLesson = {
  description: string;
  estimatedMinutes: number;
  skills: readonly LessonSkillName[];
  title: string;
};

type LessonContext = ScopeContext & {
  course: IdentityCourse | null;
  goalSkills: readonly GoalSkillRef[];
  /** The chapter whose outline first needs these lessons; it gives a new lesson its URL. */
  homeChapterId: string | null;
  level: CourseLevel;
};

/** Pairs each item with the resolution of its request, which `resolveLibraryIdentities` keeps in order. */
function withResolutions<T>(
  items: readonly T[],
  resolutions: readonly LibraryIdentityResolution[],
): { item: T; resolution: LibraryIdentityResolution }[] {
  return items.flatMap((item, index) => {
    const resolution = resolutions[index];
    return resolution ? [{ item, resolution }] : [];
  });
}

/** Each name once, as first asked for. */
function uniqueByName<T extends { name: string }>(skills: readonly T[]): T[] {
  const names = skills.map((skill) => normalizeString(skill.name));
  return skills.filter((_, index) => names.indexOf(names[index] ?? "") === index);
}

async function toSkillId({
  provenance,
  resolution,
  scope,
  skill,
}: Omit<ScopeContext, "analytics"> & {
  resolution: LibraryIdentityResolution;
  skill: LessonSkillName & { level: CourseLevel };
}): Promise<string> {
  if (resolution.kind === "existing") {
    return resolution.id;
  }

  const created = await createSkill({
    description: skill.description,
    example: null,
    identityKey: resolution.identityKey,
    language: scope.language,
    level: skill.level,
    name: skill.name,
    ownerId: scope.ownerId,
    provenance,
    targetLanguage: scope.targetLanguage,
  });

  return created.skill.id;
}

/**
 * Finds the Library skills that already teach these, or creates each under the identity key the
 * search returned, so two goals or lessons that need "Calculate a percentage" share one skill. The
 * skills resolve together, their search terms written in one model call, and a name asked for
 * twice resolves once. Returns each skill's id, in the order asked for.
 */
export async function resolveScopeSkills({
  analytics,
  provenance,
  scope,
  skills,
}: ScopeContext & { skills: readonly (LessonSkillName & { level: CourseLevel })[] }): Promise<
  string[]
> {
  const unique = uniqueByName(skills);

  const resolutions = await resolveLibraryIdentities({
    analytics,
    requests: unique.map((skill) => ({
      description: skill.description,
      goal: scope.generalGoal,
      kind: "skill",
      language: scope.language,
      name: skill.name,
      ownerId: scope.ownerId,
      targetLanguage: scope.targetLanguage,
    })),
  });

  const ids = await Promise.all(
    withResolutions(unique, resolutions).map(async ({ item, resolution }) => {
      const id = await toSkillId({ provenance, resolution, scope, skill: item });
      return [normalizeString(item.name), id] as const;
    }),
  );

  const idByName = new Map(ids);

  return skills.map((skill) => idByName.get(normalizeString(skill.name)) ?? "");
}

/**
 * Turns the 1 to 3 skill names each lesson has into Library skills. A name that is one of the
 * goal's own skills is that skill; the others resolve together (`resolveScopeSkills`), so lessons
 * in different courses that teach "Calculate a percentage" share one skill. Each lesson keeps its
 * names' order, and duplicates collapse.
 */
async function resolveLessonSkills({
  goalSkills,
  lessons,
  level,
  ...context
}: LessonContext & { lessons: readonly ScopeLesson[] }): Promise<ResolvedLessonSkill[][]> {
  const goalSkillIds = new Map(goalSkills.map((skill) => [normalizeString(skill.name), skill.id]));

  const others = lessons
    .flatMap((lesson) => lesson.skills)
    .filter((skill) => !goalSkillIds.has(normalizeString(skill.name)))
    .map((skill) => ({ ...skill, level }));

  const otherIds = await resolveScopeSkills({ ...context, skills: others });

  const ids = new Map([
    ...goalSkillIds,
    ...others.map((skill, index) => [normalizeString(skill.name), otherIds[index] ?? ""] as const),
  ]);

  return lessons.map((lesson) => {
    const resolved = lesson.skills.map((skill) => ({
      id: ids.get(normalizeString(skill.name)) ?? "",
      name: skill.name,
    }));

    return resolved.filter(
      (skill, index) => skill.id && resolved.findIndex((other) => other.id === skill.id) === index,
    );
  });
}

function toLessonBase({ context, lesson }: { context: LessonContext; lesson: ScopeLesson }) {
  const { course, level, scope } = context;

  return {
    course,
    description: lesson.description,
    goal: scope.generalGoal,
    language: scope.language,
    level,
    targetLanguage: scope.targetLanguage,
    title: lesson.title,
  };
}

/**
 * The lessons' search terms, written from their skill names while the skills resolve instead of
 * after. Private lessons never search, so they need none.
 */
async function writeLessonSearchTerms({
  context,
  lessons,
}: {
  context: LessonContext;
  lessons: readonly ScopeLesson[];
}): Promise<string[][] | undefined> {
  if (context.scope.ownerId) {
    return undefined;
  }

  return writeSearchTerms({
    analytics: context.analytics,
    subjects: lessons.map((lesson) =>
      toLessonIdentitySubject({ ...toLessonBase({ context, lesson }), skills: lesson.skills }),
    ),
  });
}

async function toLessonId({
  context,
  lesson,
  resolution,
  skills,
}: {
  context: LessonContext;
  lesson: ScopeLesson;
  resolution: LibraryIdentityResolution;
  skills: readonly ResolvedLessonSkill[];
}): Promise<{ created: boolean; id: string }> {
  if (resolution.kind === "existing") {
    return { created: false, id: resolution.id };
  }

  const { homeChapterId, level, provenance, scope } = context;

  const created = await createLibraryLesson({
    description: lesson.description,
    estimatedMinutes: lesson.estimatedMinutes,
    homeChapterId,
    identityKey: resolution.identityKey,
    language: scope.language,
    level,
    ownerId: scope.ownerId,
    provenance,
    skillIds: skills.map((skill) => skill.id),
    targetLanguage: scope.targetLanguage,
    title: lesson.title,
  });

  return { created: true, id: created.lesson.id };
}

/** A lesson's skills as one value, the same in any order: what its identity is made of. */
function toSkillSet(skills: readonly ResolvedLessonSkill[]): string {
  return skills
    .map((skill) => skill.id)
    .toSorted()
    .join("+");
}

/**
 * The skill sets more than one of these lessons teach. A lesson is its skills at one level of one
 * course, so an outline that splits one skill set into several lessons would otherwise save them
 * all as the first one.
 */
function findSharedSkillSets(lessonSkills: readonly (readonly ResolvedLessonSkill[])[]) {
  const sets = lessonSkills.map((skills) => toSkillSet(skills));
  return new Set(sets.filter((set, index) => sets.indexOf(set) !== index));
}

/**
 * Finds the Library lessons that already teach these skills at this level (in this course, or
 * another course's the reuse decision finds on the same subject), or creates them in their home
 * chapter. Lessons known together, such as a chapter's, resolve together: their skills in one
 * batch and, beside it, their search terms in one model call, then the lessons themselves. Lessons
 * of the batch that teach the same skills stay apart by title (`findSharedSkillSets`). Returns
 * each lesson in the order asked for; `created` tells the caller the lesson is new, so it can
 * write what only a new lesson needs. Null for a lesson none of whose skills resolve.
 */
export async function resolveScopeLessons({
  lessons,
  ...context
}: LessonContext & { lessons: readonly ScopeLesson[] }): Promise<
  ({ created: boolean; id: string } | null)[]
> {
  const [lessonSkills, searchTerms] = await Promise.all([
    resolveLessonSkills({ ...context, lessons }),
    writeLessonSearchTerms({ context, lessons }),
  ]);

  const requested = lessons.flatMap((lesson, index) => {
    const skills = lessonSkills[index] ?? [];
    return skills.length > 0 ? [{ index, lesson, skills }] : [];
  });

  const sharedSkillSets = findSharedSkillSets(requested.map((entry) => entry.skills));

  const resolutions = await resolveLibraryIdentities({
    analytics: context.analytics,
    requests: requested.map(({ lesson, skills }) => ({
      ...toLessonBase({ context, lesson }),
      kind: "lesson",
      ownerId: context.scope.ownerId,
      sharesSkills: sharedSkillSets.has(toSkillSet(skills)),
      skills,
    })),
    searchTerms: searchTerms && requested.map((entry) => searchTerms[entry.index] ?? []),
  });

  const saved = await Promise.all(
    withResolutions(requested, resolutions).map(async ({ item, resolution }) => {
      const lesson = await toLessonId({
        context,
        lesson: item.lesson,
        resolution,
        skills: item.skills,
      });

      return [item.index, lesson] as const;
    }),
  );

  const byIndex = new Map(saved);

  return lessons.map((_, index) => byIndex.get(index) ?? null);
}
