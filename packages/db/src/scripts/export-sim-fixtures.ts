/**
 * Writes the learner simulator's fixture libraries (`packages/core/src/plans/_test-utils/sim`) from
 * the local development database: the shared Library content behind real goals (an exam's skill
 * graph, notice, topic frequency and weights, its skills, prerequisites, courses, chapters and
 * lessons), with short ids. Read-only: one READ ONLY transaction, on the local `zoonk` database
 * only. No learner's data leaves it: a goal's graph is the exam's or the course's, and its details
 * keep only the facts the planner reads about the exam or the language level.
 *
 * Run from packages/db: `pnpm sim:export-fixtures` (`--out <dir>` writes elsewhere), then format
 * the files with `pnpm format:fix` from the repository root.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseArgs } from "node:util";
import { logError, logInfo } from "@zoonk/utils/logger";
import { type TransactionClient, prisma } from "../index";
import { isLocalDevelopmentDatabase } from "../local-database";
import { buildCourseGraph, loadGoalSource, loadLibrary } from "./_sim-fixtures/load-library";
import { type Graph, inTeachingOrder, pickDetails } from "./_sim-fixtures/read-graph";
import { type FixtureSource, SOURCES } from "./_sim-fixtures/sources";

const DEFAULT_OUT = resolve(
  import.meta.dirname,
  "../../../core/src/plans/_test-utils/sim/fixtures",
);

const EXPORT_TIMEOUT_MS = 120_000;

/**
 * The goal details the planner reads (see `readCourseWeights`, `getOwnLevel`, `sizeLanguageGraph`):
 * the exam's course weights and edition, and a language goal's levels. An exam's target score is
 * the learner's own, so only a language goal's (a CEFR level) is kept.
 */
const PLANNER_DETAILS: Record<string, readonly string[]> = {
  exam: ["courseWeights", "examMonth", "examYear", "institution", "level", "targetCourse"],
  language: ["level", "targetLevel", "targetScore"],
  learn: ["level"],
};

const CHALLENGE_KEY = /(?:^|:)challenge:(?<id>[\da-f-]{36})$/u;
const QUICK_KEY = /(?:^|:)quick:(?<id>[\da-f-]{36})$/u;

type IdKind = "chapter" | "course" | "lesson" | "skill";
type ShortIds = (kind: IdKind, id: string) => string;

/** Each kind's short id prefix: `s1` for skills, `k1` courses, `c1` chapters, `l1` lessons. */
const PREFIXES: Record<IdKind, string> = { chapter: "c", course: "k", lesson: "l", skill: "s" };

/** Short, stable ids in a fixture, numbered per kind in the order they're first met. */
function createIds(): ShortIds {
  const maps = new Map<IdKind, Map<string, string>>();

  return (kind, id) => {
    const map = maps.get(kind) ?? new Map<string, string>();
    const short = map.get(id) ?? `${PREFIXES[kind]}${map.size + 1}`;

    map.set(id, short);
    maps.set(kind, map);
    return short;
  };
}

/** A lesson's part in planning that its identity key says: a chapter's challenge, a quick lesson. */
function getLessonRole({ identityKey, toShort }: { identityKey: string; toShort: ShortIds }) {
  const challenge = CHALLENGE_KEY.exec(identityKey)?.groups?.id;
  const quick = QUICK_KEY.exec(identityKey)?.groups?.id;

  if (challenge) {
    return `challenge:${toShort("chapter", challenge)}`;
  }

  return quick ? `quick:${toShort("skill", quick)}` : null;
}

/** The goal and graph of a fixture: a goal's, or a career built from courses. */
async function loadSource(tx: TransactionClient, source: FixtureSource) {
  if (source.kind === "courses") {
    const graph = await buildCourseGraph(tx, source);
    return { blueprint: null, goal: null, graph, graphSource: "shared courses" };
  }

  return loadGoalSource(tx, source);
}

function toShortGraph({ graph, toShort }: { graph: Graph; toShort: ShortIds }) {
  return {
    phases: graph.phases,
    skills: graph.skills.map((skill) => ({
      ...skill,
      ...(skill.courseIds && {
        courseIds: skill.courseIds.map((courseId) => toShort("course", courseId)),
      }),
      skillId: toShort("skill", skill.skillId),
    })),
  };
}

async function exportFixture(tx: TransactionClient, source: FixtureSource) {
  const loaded = await loadSource(tx, source);
  const { blueprint, goal, graphSource } = loaded;
  const primaryCourseId = goal?.primaryCourseId ?? null;
  const library = await loadLibrary({ graph: loaded.graph, primaryCourseId, tx });

  const graph =
    source.kind === "courses"
      ? inTeachingOrder({ graph: loaded.graph, prerequisites: library.prerequisites })
      : loaded.graph;

  const toShort = createIds();
  const kind = goal?.kind ?? "learn";

  // Ids in a stable order: the graph's skills, then each table's rows as the queries ordered them.
  const skills = graph.skills.map((skill) => toShort("skill", skill.skillId));
  library.courses.forEach((course) => toShort("course", course.id));
  library.chapters.forEach((chapter) => toShort("chapter", chapter.id));
  library.lessons.forEach((lesson) => toShort("lesson", lesson.id));
  const levels = new Map(library.skillRows.map((row) => [row.id, row.level]));
  const chapterIds = new Set(library.chapters.map((chapter) => chapter.id));

  return {
    about: source.about,
    blueprint: blueprint
      ? {
          edition: blueprint.edition,
          owned: blueprint.ownerId !== null,
          structure: blueprint.structure,
          topicFrequency: blueprint.topicFrequency,
        }
      : null,
    chapters: library.chapters.map((chapter) => ({
      courses: chapter.courses.map((placement) => [
        toShort("course", placement.courseId),
        placement.level,
        placement.position,
      ]),
      id: toShort("chapter", chapter.id),
      lessons: chapter.lessons.map((entry) => [toShort("lesson", entry.lessonId), entry.position]),
      level: chapter.level,
      skills: chapter.goalSkills.map((link) => toShort("skill", link.skillId)),
      title: chapter.title,
      tools: chapter.tools,
    })),
    courses: library.courses.map((course) => [toShort("course", course.id), course.title]),
    exportedFrom: { at: new Date().toISOString().slice(0, 10), graph: graphSource },
    format: 1,
    goal: {
      details: goal
        ? pickDetails({ details: goal.details, keys: PLANNER_DETAILS[kind] ?? [] })
        : {},
      kind,
      language: goal?.language ?? (source.kind === "courses" ? source.language : "pt"),
      primaryCourse: primaryCourseId ? toShort("course", primaryCourseId) : null,
      targetLanguage: goal?.targetLanguage ?? null,
    },
    graph: toShortGraph({ graph, toShort }),
    lessonSkills: library.lessonSkills.map((row) => [
      toShort("lesson", row.lessonId),
      toShort("skill", row.skillId),
    ]),
    lessons: library.lessons.map((lesson) => [
      toShort("lesson", lesson.id),
      lesson.title,
      lesson.estimatedMinutes,
      lesson.level,
      lesson.homeChapterId && chapterIds.has(lesson.homeChapterId)
        ? toShort("chapter", lesson.homeChapterId)
        : null,
      lesson.setAsideAt ? "setAside" : getLessonRole({ identityKey: lesson.identityKey, toShort }),
    ]),
    name: source.name,
    prerequisites: library.prerequisites.map((row) => [
      toShort("skill", row.skillId),
      toShort("skill", row.prerequisiteId),
    ]),
    skills: graph.skills.map((skill, index) => [skills[index], levels.get(skill.skillId) ?? null]),
  };
}

async function exportFixtures(): Promise<void> {
  const { values } = parseArgs({ options: { out: { default: DEFAULT_OUT, type: "string" } } });

  if (!isLocalDevelopmentDatabase(process.env.DATABASE_URL ?? "")) {
    throw new Error("Refusing to read: DATABASE_URL isn't the local development database.");
  }

  mkdirSync(values.out, { recursive: true });

  const fixtures = await prisma.$transaction(
    async (tx) => {
      await tx.$executeRaw`SET TRANSACTION READ ONLY`;

      // One query at a time inside the transaction's connection.
      return SOURCES.reduce<Promise<Awaited<ReturnType<typeof exportFixture>>[]>>(
        async (previous, source) => [...(await previous), await exportFixture(tx, source)],
        Promise.resolve([]),
      );
    },
    { timeout: EXPORT_TIMEOUT_MS },
  );

  for (const fixture of fixtures) {
    const path = resolve(values.out, `${fixture.name}.json`);
    writeFileSync(path, `${JSON.stringify(fixture, null, 2)}\n`);

    logInfo(
      `${fixture.name}: ${fixture.graph.skills.length} skills, ${fixture.chapters.length} chapters, ${fixture.lessons.length} lessons → ${path}`,
    );
  }
}

try {
  await exportFixtures();
} catch (error) {
  logError(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
