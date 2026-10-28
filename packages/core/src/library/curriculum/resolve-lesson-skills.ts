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
import { type NewLessonDetails, createHomeChapterLessons } from "../lessons/create-library-lesson";
import { createSkill } from "../skills/create-skill";
import {
  type CurriculumAnalytics,
  type CurriculumScope,
  type GoalSkillRef,
} from "./curriculum-scope";

type LessonSkillName = { name: string; description: string };

type ResolvedLessonSkill = { id: string; name: string };

type ScopeContext = {
  analytics?: CurriculumAnalytics;
  provenance: LibraryProvenance;
  scope: CurriculumScope;
};

type ScopeLesson = NewLessonDetails & {
  description: string;
  estimatedMinutes: number;
  skills: readonly LessonSkillName[];
  title: string;
};

type LessonContext = ScopeContext & {
  course: IdentityCourse | null;
  goalSkills: readonly GoalSkillRef[];
  homeChapterId: string | null;
  level: CourseLevel;
};

function withResolutions<T>(
  items: readonly T[],
  resolutions: readonly LibraryIdentityResolution[],
): { item: T; resolution: LibraryIdentityResolution }[] {
  return items.flatMap((item, index) => {
    const resolution = resolutions[index];
    return resolution ? [{ item, resolution }] : [];
  });
}

function uniqueByName<T extends { name: string }>(skills: readonly T[]): T[] {
  const names = skills.map((skill) => normalizeString(skill.name));
  return skills.filter((_, index) => names.indexOf(names[index] ?? "") === index);
}

type ResolvedSkillRow = { created: boolean; id: string };

async function toSkillRow({
  provenance,
  resolution,
  scope,
  skill,
}: Omit<ScopeContext, "analytics"> & {
  resolution: LibraryIdentityResolution;
  skill: LessonSkillName & { level: CourseLevel };
}): Promise<ResolvedSkillRow> {
  if (resolution.kind === "existing") {
    return { created: false, id: resolution.id };
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

  return { created: true, id: created.skill.id };
}

type ScopeSkillsInput = ScopeContext & {
  skills: readonly (LessonSkillName & { course?: string | null; level: CourseLevel })[];
};

async function resolveScopeSkillRows({
  analytics,
  provenance,
  scope,
  skills,
}: ScopeSkillsInput): Promise<ResolvedSkillRow[]> {
  const unique = uniqueByName(skills);

  const resolutions = await resolveLibraryIdentities({
    analytics,
    requests: unique.map((skill) => ({
      course: skill.course ?? null,
      description: skill.description,
      goal: scope.generalGoal,
      kind: "skill",
      language: scope.language,
      name: skill.name,
      ownerId: scope.ownerId,
      targetLanguage: scope.targetLanguage,
    })),
  });

  const rows = await Promise.all(
    withResolutions(unique, resolutions).map(async ({ item, resolution }) => {
      const row = await toSkillRow({ provenance, resolution, scope, skill: item });
      return [normalizeString(item.name), row] as const;
    }),
  );

  const rowByName = new Map(rows);

  return skills.map(
    (skill) => rowByName.get(normalizeString(skill.name)) ?? { created: false, id: "" },
  );
}

/** Returns one skill id per requested name, preserving input order. */
export async function resolveScopeSkills(input: ScopeSkillsInput): Promise<string[]> {
  const rows = await resolveScopeSkillRows(input);
  return rows.map((row) => row.id);
}

type ResolvedLessonSkills = { newSkills: boolean; skills: ResolvedLessonSkill[] };

async function resolveLessonSkills({
  goalSkills,
  lessons,
  level,
  ...context
}: LessonContext & { lessons: readonly ScopeLesson[] }): Promise<ResolvedLessonSkills[]> {
  const goalSkillRows = goalSkills.map(
    (skill) => [normalizeString(skill.name), { created: false, id: skill.id }] as const,
  );

  const goalSkillNames = new Set(goalSkillRows.map(([name]) => name));

  const others = lessons
    .flatMap((lesson) => lesson.skills)
    .filter((skill) => !goalSkillNames.has(normalizeString(skill.name)))
    .map((skill) => ({ ...skill, course: context.course?.title ?? null, level }));

  const otherRows = await resolveScopeSkillRows({ ...context, skills: others });

  const rows = new Map([
    ...goalSkillRows,
    ...others.map(
      (skill, index) =>
        [normalizeString(skill.name), otherRows[index] ?? { created: false, id: "" }] as const,
    ),
  ]);

  return lessons.map((lesson) => {
    const resolved = lesson.skills.map((skill) => ({
      ...(rows.get(normalizeString(skill.name)) ?? { created: false, id: "" }),
      name: skill.name,
    }));

    const unique = resolved.filter(
      (skill, index) => skill.id && resolved.findIndex((other) => other.id === skill.id) === index,
    );

    return {
      newSkills: unique.length > 0 && unique.every((skill) => skill.created),
      skills: unique.map(({ id, name }) => ({ id, name })),
    };
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

function toNewLesson({
  context,
  identityKey,
  lesson,
  skills,
}: {
  context: LessonContext;
  identityKey: string;
  lesson: ScopeLesson;
  skills: readonly ResolvedLessonSkill[];
}) {
  const { level, provenance, scope } = context;

  return {
    canDo: lesson.canDo,
    description: lesson.description,
    estimatedMinutes: lesson.estimatedMinutes,
    identityKey,
    language: scope.language,
    level,
    provenance,
    skillIds: skills.map((skill) => skill.id),
    spec: lesson.spec,
    specRunId: lesson.specRunId,
    specStatus: lesson.specStatus,
    targetLanguage: scope.targetLanguage,
    title: lesson.title,
  };
}

function toSkillSet(skills: readonly ResolvedLessonSkill[]): string {
  return skills
    .map((skill) => skill.id)
    .toSorted()
    .join("+");
}

function findSharedSkillSets(lessonSkills: readonly (readonly ResolvedLessonSkill[])[]) {
  const sets = lessonSkills.map((skills) => toSkillSet(skills));
  return new Set(sets.filter((set, index) => sets.indexOf(set) !== index));
}

/** Preserves input order; returns null for a lesson whose skills cannot be resolved. */
export async function resolveScopeLessons({
  lessons,
  ...context
}: LessonContext & { lessons: readonly ScopeLesson[] }): Promise<(string | null)[]> {
  const [lessonSkills, searchTerms] = await Promise.all([
    resolveLessonSkills({ ...context, lessons }),
    writeLessonSearchTerms({ context, lessons }),
  ]);

  const requested = lessons.flatMap((lesson, index) => {
    const { newSkills = false, skills = [] } = lessonSkills[index] ?? {};
    return skills.length > 0 ? [{ index, lesson, newSkills, skills }] : [];
  });

  const sharedSkillSets = findSharedSkillSets(requested.map((entry) => entry.skills));

  const resolutions = await resolveLibraryIdentities({
    analytics: context.analytics,
    requests: requested.map(({ lesson, newSkills, skills }) => ({
      ...toLessonBase({ context, lesson }),
      kind: "lesson",
      newSkills,
      ownerId: context.scope.ownerId,
      sharesSkills: sharedSkillSets.has(toSkillSet(skills)),
      skills,
    })),
    searchTerms: searchTerms && requested.map((entry) => searchTerms[entry.index] ?? []),
  });

  const resolved = withResolutions(requested, resolutions);

  const newLessons = resolved.flatMap(({ item, resolution }) =>
    resolution.kind === "generate" ? [{ identityKey: resolution.identityKey, item }] : [],
  );

  const created = await createHomeChapterLessons({
    homeChapterId: context.homeChapterId,
    lessons: newLessons.map(({ identityKey, item }) =>
      toNewLesson({ context, identityKey, lesson: item.lesson, skills: item.skills }),
    ),
    ownerId: context.scope.ownerId,
  });

  const ids = new Map([
    ...resolved.flatMap(({ item, resolution }) =>
      resolution.kind === "existing" ? [[item.index, resolution.id] as const] : [],
    ),
    ...newLessons.map(({ item }, position) => [item.index, created[position]?.lesson.id] as const),
  ]);

  return lessons.map((_, index) => ids.get(index) ?? null);
}
