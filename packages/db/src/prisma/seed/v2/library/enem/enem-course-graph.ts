import { type PrismaClient } from "../../../../../generated/prisma/client";
import { SEED_LANGUAGES } from "../../_utils/localize";
import { SEED_PROVENANCE } from "../../_utils/provenance";
import { anaGraph } from "../../learners/personas/ana-graph";
import { libraryIds } from "../library-ids";
import { findSkillIds, skillIdOf } from "../write-skills";
import { enemCourse } from "./enem-course";

/**
 * Publishes the seed's hand-written exam curriculum as the same public course/blueprint link a
 * generated curriculum records. Repairs its explicit umbrella link while keeping a graph the
 * app already wrote; learner plans aren't read.
 */
export async function writeEnemCourseGraph(prisma: PrismaClient) {
  await Promise.all(
    SEED_LANGUAGES.map(async (language) => {
      const skills = await findSkillIds({ course: enemCourse, language, prisma });

      const graph = {
        phases: [{ milestone: null, name: enemCourse.title.in(language) }],
        skills: anaGraph.map((entry) => ({
          area: entry.area.in(language),
          courseIds: [libraryIds.course("enem", language)],
          lessons: entry.lessons,
          name:
            enemCourse.skills.find((skill) => skill.key === entry.skill)?.name.in(language) ??
            entry.skill,
          ...(entry.outcome && { outcome: true }),
          phase: 0,
          skillId: skillIdOf(enemCourse, skills, entry.skill),
          topics: entry.topics.map((topic) => topic.in(language)),
          weight: entry.weight,
        })),
      };

      await prisma.examSkillGraph.upsert({
        create: {
          examBlueprintId: libraryIds.blueprint("enem", language),
          generatedAt: new Date(),
          graph,
          primaryCourseId: libraryIds.course("enem", language),
          ...SEED_PROVENANCE,
        },
        update: { primaryCourseId: libraryIds.course("enem", language) },
        where: { examBlueprintId: libraryIds.blueprint("enem", language) },
      });
    }),
  );
}
