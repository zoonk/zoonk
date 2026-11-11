import "server-only";
import { type ServiceTier } from "@zoonk/ai/provider-options";
import { type generateSkillGraph } from "@zoonk/ai/tasks/curriculum/skill-graph";
import { prisma } from "@zoonk/db";
import { type LibraryProvenance } from "../_utils/library-rows";
import { getContentCountryScope } from "../content-country";
import { setSkillsPrerequisites } from "../skills/create-skill";
import {
  type CurriculumAnalytics,
  type CurriculumScope,
  getGraphCourseCountry,
} from "./curriculum-scope";
import { resolveScopeSkills } from "./resolve-lesson-skills";

export type GoalSkillGraph = Awaited<ReturnType<typeof generateSkillGraph>>["data"];
type GraphSkill = GoalSkillGraph["skills"][number];

/** A reused skill is still the Library's when it's still public and was never merged away. */
async function findReusedIds({
  scope,
  skills,
}: {
  scope: CurriculumScope;
  skills: readonly GraphSkill[];
}): Promise<Set<string>> {
  const libraryIds = skills.flatMap((skill) => skill.libraryId ?? []);

  if (scope.ownerId || libraryIds.length === 0) {
    return new Set();
  }

  const rows = await prisma.skill.findMany({
    select: { id: true },
    where: {
      country: getContentCountryScope(scope),
      id: { in: libraryIds },
      language: scope.language,
      mergedIntoId: null,
      targetLanguage: scope.targetLanguage,
      visibility: "public",
    },
  });

  return new Set(rows.map((row) => row.id));
}

/** Internal workflow bridge: the owner must come from the goal the public boundary authorized. */
async function saveGoalSkillsInScope({
  analytics,
  provenance,
  scope,
  serviceTier,
  skills,
}: {
  analytics?: CurriculumAnalytics;
  provenance: LibraryProvenance;
  scope: CurriculumScope;
  serviceTier?: ServiceTier;
  skills: readonly GraphSkill[];
}): Promise<Record<string, string>> {
  const reused = await findReusedIds({ scope, skills });
  const isReused = (skill: GraphSkill) => Boolean(skill.libraryId && reused.has(skill.libraryId));
  const fresh = skills.filter((skill) => !isReused(skill));

  const ids = await resolveScopeSkills({
    analytics,
    provenance,
    scope,
    serviceTier,
    skills: fresh.map((skill) => ({ ...skill, course: skill.area })),
  });

  const freshIds = new Map(fresh.map((skill, index) => [skill.key, ids[index] ?? ""]));

  return Object.fromEntries(
    skills.map((skill) => [
      skill.key,
      isReused(skill) ? (skill.libraryId ?? "") : (freshIds.get(skill.key) ?? ""),
    ]),
  );
}

export async function saveGoalSkills({
  courses,
  ...input
}: Parameters<typeof saveGoalSkillsInScope>[0] & {
  courses?: readonly { key: string; countrySpecific?: boolean }[];
}): Promise<Record<string, string>> {
  if (!courses) {
    return saveGoalSkillsInScope(input);
  }

  const groups = Map.groupBy(input.skills, (skill) => {
    const course = courses.find((candidate) => candidate.key === skill.course);
    return course ? getGraphCourseCountry({ course, scope: input.scope }) : null;
  });

  const saved = await Promise.all(
    [...groups].map(([country, skills]) =>
      saveGoalSkillsInScope({ ...input, scope: { ...input.scope, country }, skills }),
    ),
  );

  return Object.fromEntries(saved.flatMap((ids) => Object.entries(ids)));
}

export async function linkGoalSkillPrerequisites({
  idsByKey,
  skills,
}: {
  idsByKey: Readonly<Record<string, string>>;
  skills: readonly Pick<GraphSkill, "key" | "libraryId" | "prerequisites">[];
}): Promise<void> {
  const among = new Set(Object.values(idsByKey).filter(Boolean));

  const listed = skills.reduce((bySkill, skill) => {
    const skillId = idsByKey[skill.key];

    // A reused skill keeps its own prerequisite links: one exam's graph never rewrites another's.
    if (!skillId || skillId === skill.libraryId) {
      return bySkill;
    }

    const prerequisiteIds = skill.prerequisites.flatMap((key) => idsByKey[key] ?? []);
    return bySkill.set(skillId, [...(bySkill.get(skillId) ?? []), ...prerequisiteIds]);
  }, new Map<string, string[]>());

  await setSkillsPrerequisites({ among, prerequisitesBySkill: listed });
}
