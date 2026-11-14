import { sql } from "@zoonk/db";
import { writeSkillsPrerequisites } from "../../../library/skills/create-skill";
import { collectionHandler, collectionIds, sharedProblem } from "./collection-handler";

const rules =
  "Every skill exists, is public, unmerged, with no owner and shares the language and target language. Kept memberships keep createdAt. Plans refresh on their next planning write; learner history stays.";

export const chapterSkills = collectionHandler({
  load: async (db, id, value) => {
    const after = collectionIds.parse(value);

    const [row, skills] = await Promise.all([
      db.chapter.findUnique({
        include: { goalSkills: { orderBy: { skillId: "asc" } } },
        where: { id },
      }),
      db.skill.findMany({ where: { id: { in: after } } }),
    ]);

    return (
      row && {
        before: row.goalSkills.map((skill) => skill.skillId),
        problem: sharedProblem(row, skills, after),
        roots: {
          chapterIds: [id],
          skillIds: [...new Set([...after, ...row.goalSkills.map((skill) => skill.skillId)])],
        },
        unit: { id, kind: "chapter" },
      }
    );
  },
  model: "Chapter",
  op: "setSkills",
  rules: `setSkills: [skillId, …], the final skills. ${rules}`,
  schema: collectionIds.transform((ids) => ids.toSorted()),
  table: sql`library_chapters`,
  write: async (tx, id, value) => {
    const skillIds = collectionIds.parse(value);
    await tx.chapterSkill.deleteMany({ where: { chapterId: id, skillId: { notIn: skillIds } } });

    await tx.chapterSkill.createMany({
      data: skillIds.map((skillId) => ({ chapterId: id, skillId })),
      skipDuplicates: true,
    });
  },
});

export const lessonSkills = collectionHandler({
  load: async (db, id, value) => {
    const after = collectionIds.parse(value);

    const [row, skills] = await Promise.all([
      db.lesson.findUnique({ include: { skills: { orderBy: { skillId: "asc" } } }, where: { id } }),
      db.skill.findMany({ where: { id: { in: after } } }),
    ]);

    return (
      row && {
        before: row.skills.map((skill) => skill.skillId),
        problem: sharedProblem(row, skills, after),
        roots: {
          lessonIds: [id],
          skillIds: [...new Set([...after, ...row.skills.map((skill) => skill.skillId)])],
        },
        unit: { id, kind: "lesson" },
      }
    );
  },
  model: "Lesson",
  op: "setSkills",
  rules: `setSkills: [skillId, …], the final skills. ${rules}`,
  schema: collectionIds.transform((ids) => ids.toSorted()),
  table: sql`library_lessons`,
  write: async (tx, id, value) => {
    const skillIds = collectionIds.parse(value);
    await tx.lessonSkill.deleteMany({ where: { lessonId: id, skillId: { notIn: skillIds } } });

    await tx.lessonSkill.createMany({
      data: skillIds.map((skillId) => ({ lessonId: id, skillId })),
      skipDuplicates: true,
    });
  },
});

export const skillPrerequisites = collectionHandler({
  load: async (db, id, value) => {
    const after = collectionIds.parse(value);

    const [row, skills] = await Promise.all([
      db.skill.findUnique({
        include: { prerequisites: { orderBy: { prerequisiteId: "asc" } } },
        where: { id },
      }),
      db.skill.findMany({ where: { id: { in: after } } }),
    ]);

    if (!row) {
      return null;
    }

    const before = row.prerequisites.map((edge) => edge.prerequisiteId);
    const added = after.filter((skillId) => !before.includes(skillId));

    const [result] = await db.$queryRaw<{ cycle: boolean }[]>`
      WITH RECURSIVE reachable(id) AS (
        SELECT unnest(${added}::uuid[])
        UNION
        SELECT edge.prerequisite_id FROM skill_prerequisites edge
        JOIN reachable ON edge.skill_id = reachable.id
        WHERE edge.skill_id <> ${id}::uuid
      )
      SELECT EXISTS(SELECT 1 FROM reachable WHERE id = ${id}::uuid) AS cycle
    `;

    const cycle = result?.cycle ?? false;

    return {
      before,
      problem:
        sharedProblem(row, skills, after) ??
        (cycle ? "A new prerequisite edge would create a cycle." : undefined),
      roots: { skillIds: [...new Set([id, ...before, ...after])] },
      unit: { id, kind: "skill" },
    };
  },
  model: "Skill",
  op: "setPrerequisites",
  rules: `setPrerequisites: [skillId, …], the skill's final prerequisites. ${rules} Only new edges that make a cycle are refused.`,
  schema: collectionIds.transform((ids) => ids.toSorted()),
  table: sql`skills`,
  write: async (tx, id, value) => {
    const ids = collectionIds.parse(value);

    const previous = await tx.skillPrerequisite.findMany({ where: { skillId: id } });

    await writeSkillsPrerequisites(tx, {
      among: new Set([...ids, ...previous.map((edge) => edge.prerequisiteId)]),
      updates: [{ kept: ids, skillId: id }],
    });
  },
});
