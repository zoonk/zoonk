import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { z } from "zod";
import { planGraphSchema } from "../../planner/plan-state";

/**
 * The simulator's library: a class test rebuilt from persona Pedro's notes. Ids are short (`s1`
 * skills, `k1` courses, `c1` chapters, `l1` lessons); `seedSimLibrary` turns them into rows.
 */
const SIM_FIXTURES = ["class-test"] as const;

export type SimFixtureName = (typeof SIM_FIXTURES)[number];

const levelSchema = z.enum(["overview", "beginner", "intermediate", "advanced"]);
const pairSchema = z.tuple([z.string(), z.string()]);

/** A chapter's place in a course: `[course, band, position]`. */
const placementSchema = z.tuple([z.string(), levelSchema, z.int()]);

/** A chapter's lesson: `[lesson, position]`. */
const chapterLessonSchema = z.tuple([z.string(), z.int()]);

/** `[id, title, minutes, level, home chapter, role]`: a role is `challenge:c1`, `quick:s1` or `setAside`. */
const lessonSchema = z.tuple([
  z.string(),
  z.string(),
  z.int(),
  levelSchema,
  z.string().nullable(),
  z.string().nullable(),
]);

const chapterSchema = z.object({
  courses: z.array(placementSchema),
  id: z.string(),
  lessons: z.array(chapterLessonSchema),
  level: levelSchema,
  skills: z.array(z.string()),
  title: z.string(),
  tools: z.json(),
});

const blueprintSchema = z.object({
  edition: z.json(),
  owned: z.boolean(),
  structure: z.record(z.string(), z.json()),
  topicFrequency: z.json(),
});

const goalSchema = z.object({
  details: z.record(z.string(), z.json()),
  kind: z.enum(["exam", "language", "learn"]),
  language: z.string(),
  primaryCourse: z.string().nullable(),
  targetLanguage: z.string().nullable(),
});

const fixtureSchema = z.object({
  about: z.string(),
  blueprint: blueprintSchema.nullable(),
  chapters: z.array(chapterSchema),
  courses: z.array(pairSchema),
  format: z.literal(1),
  goal: goalSchema,
  graph: planGraphSchema,
  /** `[lesson, skill]` */
  lessonSkills: z.array(pairSchema),
  lessons: z.array(lessonSchema),
  name: z.enum(SIM_FIXTURES),
  /** `[skill, prerequisite]` */
  prerequisites: z.array(pairSchema),
  /** `[skill, its Library band]` */
  skills: z.array(z.tuple([z.string(), levelSchema.nullable()])),
});

export type SimFixture = z.infer<typeof fixtureSchema>;

const cache = new Map<SimFixtureName, SimFixture>();

export function readSimFixture(name: SimFixtureName): SimFixture {
  const cached = cache.get(name);

  if (cached) {
    return cached;
  }

  const path = resolve(import.meta.dirname, "fixtures", `${name}.json`);
  const fixture = fixtureSchema.parse(JSON.parse(readFileSync(path, "utf8")));

  cache.set(name, fixture);
  return fixture;
}
