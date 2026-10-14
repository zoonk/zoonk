import { createHash } from "node:crypto";
import { buildSkillIdentityKey } from "@zoonk/utils/identity-key";
import { isJsonObject } from "@zoonk/utils/json";
import { type TransactionClient } from "../../index";
import { type SeedLanguage } from "../../prisma/seed/v2/_utils/localize";
import { anaGraph } from "../../prisma/seed/v2/learners/personas/ana-graph";
import { enemCourse } from "../../prisma/seed/v2/library/enem/enem-course";
import { libraryIds } from "../../prisma/seed/v2/library/library-ids";
import { getExamCourseLink, getReviewedLinkFingerprint } from "./course-link";
import {
  type AreaSource,
  createAreaLineage,
  getLineageFingerprintSources,
  normalizeEnemArea,
} from "./lineage";
import { readProposal } from "./proposal";

export type EnemAreaScope = { blueprintId: string; courseId: string; language: SeedLanguage };
export type BackfillTarget = { database: string; host: string; port: string };
function readGraphSources(graph: unknown): AreaSource[] {
  if (!isJsonObject(graph) || !Array.isArray(graph.skills)) {
    return [];
  }

  return graph.skills.flatMap((skill) =>
    isJsonObject(skill) &&
    typeof skill.skillId === "string" &&
    typeof skill.area === "string" &&
    skill.area.trim().length > 0
      ? [{ area: skill.area, skillId: skill.skillId }]
      : [],
  );
}

async function loadSources({ db, scope }: { db: TransactionClient; scope: EnemAreaScope }) {
  const course = await db.course.findFirst({
    where: {
      id: scope.courseId,
      isPublished: true,
      language: scope.language,
      visibility: "public",
    },
  });

  if (!course) {
    throw new Error("ENEM scope is not a public published course in the requested language");
  }

  const [placements, skills, edges, graph] = await Promise.all([
    db.courseChapter.findMany({
      orderBy: { chapterId: "asc" },
      select: {
        area: true,
        chapter: {
          select: {
            goalSkills: { orderBy: { skillId: "asc" }, select: { skillId: true } },
            lessons: {
              orderBy: { lessonId: "asc" },
              select: {
                lesson: {
                  select: {
                    id: true,
                    skills: { orderBy: { skillId: "asc" }, select: { skillId: true } },
                  },
                },
              },
              where: { lesson: { visibility: "public" } },
            },
            title: true,
          },
        },
        chapterId: true,
      },
      where: { chapter: { visibility: "public" }, courseId: scope.courseId },
    }),
    db.skill.findMany({
      orderBy: { id: "asc" },
      select: { id: true, identityKey: true, mergedIntoId: true },
      where: { language: scope.language, visibility: "public" },
    }),
    db.skillPrerequisite.findMany({
      orderBy: [{ skillId: "asc" }, { prerequisiteId: "asc" }],
      select: { prerequisiteId: true, skillId: true },
      where: {
        prerequisite: { language: scope.language, visibility: "public" },
        skill: { language: scope.language, visibility: "public" },
      },
    }),
    db.examSkillGraph.findFirst({
      omit: { updatedAt: true },
      where: {
        examBlueprint: { language: scope.language, ownerId: null, visibility: "public" },
        examBlueprintId: scope.blueprintId,
      },
    }),
  ]);

  return { edges, examGraph: graph, graph: readGraphSources(graph?.graph), placements, skills };
}

/** Fresh manifest; the caller owns a read-only or serializable transaction and its target. */
export async function prepareEnemAreaManifest({
  db,
  reviewedLink,
  scope,
  target,
}: {
  db: TransactionClient;
  reviewedLink?: unknown;
  scope: EnemAreaScope;
  target: BackfillTarget;
}) {
  const sources = await loadSources({ db, scope });
  const { language } = scope;
  const byIdentity = new Map(sources.skills.map((skill) => [skill.identityKey, skill.id]));
  const publicIds = new Set(sources.skills.map((skill) => skill.id));

  const seedIds = new Map(
    enemCourse.skills.map((skill) => [
      skill.key,
      byIdentity.get(
        buildSkillIdentityKey({
          name: skill.name.in(language),
          targetLanguage: enemCourse.targetLanguage ?? null,
        }),
      ) ?? libraryIds.skill("enem", skill.key, language),
    ]),
  );

  const seedSources = enemCourse.chapters.flatMap((chapter) =>
    chapter.lessons.flatMap((lesson) =>
      lesson.skills.flatMap((key) => {
        const skillId = seedIds.get(key);
        const area = chapter.area?.in(language);
        return skillId && area ? [{ area, skillId }] : [];
      }),
    ),
  );

  const personaSources = anaGraph.flatMap((entry) => {
    const skillId = seedIds.get(entry.skill);
    return skillId ? [{ area: entry.area.in(language), skillId }] : [];
  });

  const authoritative = [...seedSources, ...personaSources, ...sources.graph].filter((source) =>
    publicIds.has(source.skillId),
  );

  const lineage = createAreaLineage({
    edges: sources.edges,
    language,
    skills: sources.skills,
    sources: authoritative,
  });

  const seeded = new Map(
    enemCourse.chapters.map((chapter) => [
      libraryIds.chapter("enem", chapter.key, language),
      chapter.area?.in(language),
    ]),
  );

  const rows = sources.placements.map((placement) => {
    const seedArea = seeded.get(placement.chapterId);
    const tags = placement.chapter.goalSkills.map((tag) => tag.skillId);

    const lessonIds = [
      ...new Set(
        placement.chapter.lessons.flatMap((entry) =>
          entry.lesson.skills.map((skill) => skill.skillId),
        ),
      ),
    ];

    const evidence = (tags.length > 0 ? tags : lessonIds).map((id) => lineage.evidence(id));
    const areas = [...new Set(evidence.flatMap((entry) => entry.areas))].toSorted();

    const complete =
      evidence.length > 0 &&
      evidence.every((entry) => entry.areas.length === 1) &&
      areas.length === 1;

    const area = seedArea ?? (complete ? areas[0] : null);

    return {
      area: area ?? null,
      chapterId: placement.chapterId,
      currentArea: placement.area,
      evidence,
      source: seedArea ? "seed chapter" : "public skill lineage",
      title: placement.chapter.title,
    };
  });

  const candidates = rows.flatMap((row) => (row.area ? [{ ...row, area: row.area }] : []));

  const fingerprintSources = getLineageFingerprintSources({
    edges: sources.edges,
    skillIds: [
      ...authoritative.map((source) => source.skillId),
      ...rows.flatMap((row) => row.evidence.map((entry) => entry.skillId)),
    ],
    skills: sources.skills,
  });

  const fingerprintSource = {
    scope,
    seedSources: [...seedSources, ...personaSources],
    seeded: [...seeded],
    sources: {
      ...sources,
      ...fingerprintSources,
      examGraph: getReviewedLinkFingerprint({
        courseId: scope.courseId,
        graph: sources.examGraph,
        reviewed: reviewedLink,
      }),
      placements: sources.placements.map(({ area: _area, ...placement }) => placement),
    },
  };

  return {
    candidates,
    examCourseLink: getExamCourseLink({ courseId: scope.courseId, graph: sources.examGraph }),
    scope,
    sourceFingerprint: createHash("sha256").update(JSON.stringify(fingerprintSource)).digest("hex"),
    target,
    unresolved: rows.filter((row) => row.area === null),
    version: 2 as const,
  };
}

/** Apply exactly reviewed evidence. Existing areas are never overwritten, including conflicts. */
export async function applyEnemAreaManifest({
  db,
  manifest,
  scope,
  target,
}: {
  db: TransactionClient;
  manifest: unknown;
  scope: EnemAreaScope;
  target: BackfillTarget;
}) {
  if (!isJsonObject(manifest) || JSON.stringify(manifest.scope) !== JSON.stringify(scope)) {
    throw new Error(
      "Reviewed manifest does not match the exact ENEM course, blueprint and language",
    );
  }

  if (!("examCourseLink" in manifest)) {
    throw new Error("Reviewed manifest lacks the explicit exam-course link");
  }

  if (JSON.stringify(manifest.target) !== JSON.stringify(target)) {
    throw new Error("Reviewed manifest target differs from this database");
  }

  const current = await prepareEnemAreaManifest({
    db,
    reviewedLink: manifest.examCourseLink,
    scope,
    target,
  });

  if (
    manifest.version !== current.version ||
    manifest.sourceFingerprint !== current.sourceFingerprint
  ) {
    throw new Error("Source changed since review; refusing backfill");
  }

  if (
    JSON.stringify(readProposal(manifest.candidates)) !==
    JSON.stringify(readProposal(current.candidates))
  ) {
    throw new Error("Reviewed proposal differs from freshly computed lineage");
  }

  const conflicts = current.candidates.filter(
    (row) =>
      row.currentArea !== null &&
      normalizeEnemArea({ area: row.currentArea, language: current.scope.language }) !== row.area,
  );

  if (conflicts.length > 0) {
    throw new Error(
      `Existing conflicting area on ${conflicts.map((row) => row.chapterId).join(", ")}; refusing backfill`,
    );
  }

  const results = await Promise.all(
    current.candidates.map((row) =>
      db.courseChapter.updateMany({
        data: { area: row.area },
        where: { area: null, chapterId: row.chapterId, courseId: current.scope.courseId },
      }),
    ),
  );

  const link = current.examCourseLink;

  const linkResult =
    link && link.currentPrimaryCourseId !== link.nextPrimaryCourseId
      ? await db.examSkillGraph.updateMany({
          data: { primaryCourseId: link.nextPrimaryCourseId },
          where: {
            examBlueprintId: scope.blueprintId,
            id: link.graphId,
            primaryCourseId: link.currentPrimaryCourseId,
          },
        })
      : { count: 0 };

  if (link && link.currentPrimaryCourseId !== link.nextPrimaryCourseId && linkResult.count !== 1) {
    throw new Error("Exam course link changed during repair; transaction refused");
  }

  return {
    alreadyAssigned: current.candidates.filter((row) => row.currentArea !== null).length,
    examCourseLinkUpdated: linkResult.count > 0,
    updated: results.reduce((sum, row) => sum + row.count, 0),
  };
}
