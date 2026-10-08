import { isJsonObject } from "@zoonk/utils/json";
import { normalizeString } from "@zoonk/utils/string";
import { z } from "zod";
import { type PlanGraph } from "./plan-state";

const courseWeightsSchema = z.object({
  course: z.string(),
  edition: z.string().nullable().default(null),
  institution: z.string(),
  source: z.object({ title: z.string().nullable(), url: z.string() }).nullable().default(null),
  status: z.enum(["found", "unknown"]),
  /** Each part of the exam (a notice subject) and its weight, when found. */
  subjects: z.array(z.object({ name: z.string(), weight: z.number().positive() })).default([]),
});

/**
 * What research found about how the learner's course weighs the exam's parts at their institution
 * (SISU's weights for Medicina at UFMG), stored on the goal's details as `courseWeights`, with the
 * course and institution it's for, so a learner who changes either gets it looked up again.
 */
export type CourseWeights = z.infer<typeof courseWeightsSchema>;

function readText(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

/**
 * The course weights stored on a goal's details when they were found for the course and
 * institution the goal names now; null otherwise.
 */
export function readCourseWeights(details: unknown): CourseWeights | null {
  const record = isJsonObject(details) ? details : {};
  const parsed = courseWeightsSchema.safeParse(record.courseWeights).data;
  const course = readText(record.targetCourse);
  const institution = readText(record.institution);

  const isCurrent =
    parsed?.status === "found" &&
    parsed.subjects.length > 0 &&
    course !== null &&
    institution !== null &&
    normalizeString(parsed.course) === normalizeString(course) &&
    normalizeString(parsed.institution) === normalizeString(institution);

  return isCurrent ? parsed : null;
}

/**
 * The graph with each skill's exam weight scaled by how much the learner's course weighs its part
 * of the exam, relative to the parts' average: a Medicina candidate's Natureza and redação count
 * double where the institution counts them double, so they get more of the plan's time. Skills in
 * an area the course doesn't weigh (exam strategy) keep theirs. The stored graph never changes:
 * only the planner reads the weighted copy.
 */
export function weighGraphByCourse({
  graph,
  weights,
}: {
  graph: PlanGraph;
  weights: CourseWeights | null;
}): PlanGraph {
  const subjects = weights?.subjects ?? [];

  if (subjects.length === 0) {
    return graph;
  }

  const mean = subjects.reduce((sum, subject) => sum + subject.weight, 0) / subjects.length;

  const factors = new Map(
    subjects.map((subject) => [normalizeString(subject.name), subject.weight / mean]),
  );

  return {
    ...graph,
    skills: graph.skills.map((skill) => {
      const factor = skill.area ? factors.get(normalizeString(skill.area)) : undefined;
      return factor === undefined ? skill : { ...skill, weight: (skill.weight ?? 1) * factor };
    }),
  };
}
