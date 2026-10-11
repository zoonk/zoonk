import { createHash } from "node:crypto";
import { prisma } from "@zoonk/db";
import { normalizeString } from "@zoonk/utils/string";
import { type PlanGraph } from "../../planner/plan-state";
import { type SimFixture, type SimFixtureName, readSimFixture } from "./sim-fixture";

export const SIM_PROVENANCE = {
  model: "sim/fixture",
  promptVersion: "sim-v1",
  runId: "sim-library",
};

/** Rows keep the fixture's order, which the planner breaks ties by (creation order). */
const ORDER_BASE = new Date("2026-01-01T00:00:00Z").getTime();

/**
 * A fixture's library in the test database: its rows have stable UUIDs made from the fixture's
 * short ids and a namespace, so a life can have a copy of its own (whose skills it lands) while
 * the shared copy is seeded once per run.
 */
export type SimLibrary = {
  /** The exam's blueprint, unless it's the learner's own (a class test: `createOwnBlueprint`). */
  blueprintId: string | null;
  fixture: SimFixture;
  /** The fixture's graph with row ids. */
  graph: PlanGraph;
  namespace: string;
  primaryCourseId: string | null;
  /** The short id a row id stands for, for readable repros. */
  short: (id: string) => string;
  /** The row id of a short id. */
  toId: (shortId: string) => string;
};

/** A stable UUID (version 4 shaped) for a key: the same rows in every run. */
function toSimUuid(key: string): string {
  const hex = createHash("sha1").update(`zoonk-sim:${key}`).digest("hex");

  return hex.replace(
    /^(?<a>\w{8})(?<b>\w{4})\w(?<c>\w{3})\w(?<d>\w{3})(?<e>\w{12}).*$/u,
    "$<a>-$<b>-4$<c>-8$<d>-$<e>",
  );
}

function orderedAt(index: number): Date {
  return new Date(ORDER_BASE + index);
}

function toLessonKey({
  library,
  role,
  shortId,
}: {
  library: Pick<SimLibrary, "toId">;
  role: string | null;
  shortId: string;
}): string {
  if (role?.startsWith("challenge:")) {
    return `challenge:${library.toId(role.slice("challenge:".length))}`;
  }

  if (role?.startsWith("quick:")) {
    return `quick:${library.toId(role.slice("quick:".length))}`;
  }

  return `sim-lesson-${library.toId(shortId)}`;
}

/** The skills each lesson is tied to directly (the fixture's lesson links), by row id. */
export function listTaughtBy(library: Pick<SimLibrary, "fixture" | "toId">): Map<string, string[]> {
  return new Map(
    [...Map.groupBy(library.fixture.lessonSkills, ([lessonId]) => lessonId)].map(
      ([lessonId, links]) => [
        library.toId(lessonId),
        links.map(([, skillId]) => library.toId(skillId)),
      ],
    ),
  );
}

/** The links that tie lessons to skills: held back for skills not outlined yet. */
export function listSkillLinks({
  library,
  skills,
}: {
  library: SimLibrary;
  skills: ReadonlySet<string>;
}) {
  const { fixture, toId } = library;

  return {
    chapterSkills: fixture.chapters.flatMap((chapter) =>
      chapter.skills
        .filter((skillId) => skills.has(skillId))
        .map((skillId) => ({ chapterId: toId(chapter.id), skillId: toId(skillId) })),
    ),
    lessonSkills: fixture.lessonSkills
      .filter(([, skillId]) => skills.has(skillId))
      .map(([lessonId, skillId]) => ({ lessonId: toId(lessonId), skillId: toId(skillId) })),
  };
}

async function insertRows({
  library,
  pending,
}: {
  library: SimLibrary;
  pending: ReadonlySet<string>;
}) {
  const { fixture, toId } = library;
  const { language } = fixture.goal;
  const skillNames = new Map(fixture.graph.skills.map((skill) => [skill.skillId, skill.name]));

  await prisma.course.createMany({
    data: fixture.courses.map(([id, title]) => ({
      id: toId(id),
      language,
      normalizedTitle: normalizeString(title),
      slug: `sim-${library.namespace}-${id}`,
      title,
    })),
    skipDuplicates: true,
  });

  await prisma.chapter.createMany({
    data: fixture.chapters.map((chapter) => ({
      description: chapter.title,
      id: toId(chapter.id),
      identityKey: `sim-chapter-${toId(chapter.id)}`,
      language,
      level: chapter.level,
      normalizedTitle: normalizeString(chapter.title),
      outlineStatus: "completed" as const,
      slug: `sim-${chapter.id}`,
      title: chapter.title,
      tools: chapter.tools ?? [],
      ...SIM_PROVENANCE,
    })),
    skipDuplicates: true,
  });

  await prisma.courseChapter.createMany({
    data: fixture.chapters.flatMap((chapter, chapterIndex) =>
      chapter.courses.map(([courseId, level, position], index) => ({
        chapterId: toId(chapter.id),
        courseId: toId(courseId),
        createdAt: orderedAt(chapterIndex * 10 + index),
        level,
        position,
      })),
    ),
    skipDuplicates: true,
  });

  await prisma.skill.createMany({
    data: fixture.skills.map(([id, level]) => {
      const name = skillNames.get(id) ?? id;

      return {
        description: name,
        id: toId(id),
        identityKey: `sim-skill-${toId(id)}`,
        language,
        level,
        name,
        normalizedName: normalizeString(name),
        ...SIM_PROVENANCE,
      };
    }),
    skipDuplicates: true,
  });

  await prisma.lesson.createMany({
    data: fixture.lessons.map(([id, title, minutes, level, home, role], index) => ({
      createdAt: orderedAt(index),
      description: title,
      estimatedMinutes: minutes,
      homeChapterId: home ? toId(home) : null,
      id: toId(id),
      identityKey: toLessonKey({ library, role, shortId: id }),
      language,
      level,
      normalizedTitle: normalizeString(title),
      setAsideAt: role === "setAside" ? orderedAt(0) : null,
      slug: `sim-${id}`,
      title,
      ...SIM_PROVENANCE,
    })),
    skipDuplicates: true,
  });

  const outlined = new Set(fixture.skills.map(([id]) => id).filter((id) => !pending.has(id)));
  const links = listSkillLinks({ library, skills: outlined });

  await Promise.all([
    prisma.chapterLesson.createMany({
      data: fixture.chapters.flatMap((chapter) =>
        chapter.lessons.map(([lessonId, position]) => ({
          chapterId: toId(chapter.id),
          lessonId: toId(lessonId),
          position,
        })),
      ),
      skipDuplicates: true,
    }),
    prisma.lessonSkill.createMany({ data: links.lessonSkills, skipDuplicates: true }),
    prisma.chapterSkill.createMany({ data: links.chapterSkills, skipDuplicates: true }),
    prisma.skillPrerequisite.createMany({
      data: fixture.prerequisites.map(([skillId, prerequisiteId]) => ({
        prerequisiteId: toId(prerequisiteId),
        skillId: toId(skillId),
      })),
      skipDuplicates: true,
    }),
  ]);

  if (fixture.blueprint && !fixture.blueprint.owned) {
    await prisma.examBlueprint.createMany({
      data: [blueprintData({ library, ownerId: null })],
      skipDuplicates: true,
    });
  }
}

function blueprintData({ library, ownerId }: { library: SimLibrary; ownerId: string | null }) {
  const { blueprint, goal } = library.fixture;
  const key = ownerId ? `${library.namespace}-${ownerId}` : library.namespace;

  return {
    country: "BR",
    edition: blueprint?.edition ?? undefined,
    id: ownerId
      ? toSimUuid(`${library.namespace}:blueprint:${ownerId}`)
      : toSimUuid(`${library.namespace}:blueprint`),
    identityKey: `sim-${key}`,
    language: goal.language,
    name: `Sim ${library.fixture.name}`,
    ownerId,
    structure: blueprint?.structure ?? {},
    topicFrequency: blueprint?.topicFrequency ?? undefined,
    visibility: ownerId ? ("private" as const) : ("public" as const),
    ...SIM_PROVENANCE,
  };
}

/** A class test's blueprint is its learner's own, read from their material. */
export async function createOwnBlueprint({
  library,
  ownerId,
}: {
  library: SimLibrary;
  ownerId: string;
}): Promise<string> {
  const data = blueprintData({ library, ownerId });
  await prisma.examBlueprint.createMany({ data: [data], skipDuplicates: true });
  return data.id;
}

function createLibrary({
  name,
  namespace,
}: {
  name: SimFixtureName;
  namespace: string;
}): SimLibrary {
  const fixture = readSimFixture(name);
  const ids = new Map<string, string>();
  const shorts = new Map<string, string>();

  const toId = (shortId: string) => {
    const known = ids.get(shortId);

    if (known) {
      return known;
    }

    const id = toSimUuid(`${namespace}:${shortId}`);
    ids.set(shortId, id);
    shorts.set(id, shortId);
    return id;
  };

  for (const [id] of fixture.skills) {
    toId(id);
  }

  return {
    blueprintId:
      fixture.blueprint && !fixture.blueprint.owned ? toSimUuid(`${namespace}:blueprint`) : null,
    fixture,
    graph: {
      phases: fixture.graph.phases,
      skills: fixture.graph.skills.map((skill) => ({
        ...skill,
        ...(skill.courseIds && { courseIds: skill.courseIds.map((id) => toId(id)) }),
        skillId: toId(skill.skillId),
      })),
    },
    namespace,
    primaryCourseId: fixture.goal.primaryCourse ? toId(fixture.goal.primaryCourse) : null,
    short: (id) => shorts.get(id) ?? id,
    toId,
  };
}

const seeded = new Map<SimFixtureName, Promise<SimLibrary>>();

/** Seeds a fixture's shared library once per test run (idempotent across files sharing the database). */
export function seedSimLibrary(name: SimFixtureName): Promise<SimLibrary> {
  const existing = seeded.get(name);

  if (existing) {
    return existing;
  }

  const library = createLibrary({ name, namespace: name });
  const promise = insertRows({ library, pending: new Set() }).then(() => library);
  seeded.set(name, promise);
  return promise;
}

/**
 * A life's own copy of a fixture's library, whose `pending` skills (short ids) the Library hasn't
 * outlined yet: their lessons aren't tied to them until `landSimSkills`.
 */
export async function seedSimLibraryCopy({
  name,
  namespace,
  pending,
}: {
  name: SimFixtureName;
  namespace: string;
  pending: ReadonlySet<string>;
}): Promise<SimLibrary> {
  const library = createLibrary({ name, namespace: `${name}:${namespace}` });
  await insertRows({ library, pending });
  return library;
}
