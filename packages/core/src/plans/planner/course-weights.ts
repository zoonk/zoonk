import { isJsonObject } from "@zoonk/utils/json";
import { normalizeString } from "@zoonk/utils/string";
import { z } from "zod";
import { type PlanGraph } from "./plan-state";

const courseWeightSubjectsSchema = z.array(
  z.object({ name: z.string(), weight: z.number().positive() }),
);

const courseWeightsSchema = z.object({
  course: z.string(),
  edition: z.string().nullable().default(null),
  institution: z.string(),
  source: z.object({ title: z.string().nullable(), url: z.string() }).nullable().default(null),
  status: z.enum(["found", "unknown"]),
  subjects: courseWeightSubjectsSchema.default([]),
});

export type CourseWeights = z.infer<typeof courseWeightsSchema>;

export function readCourseWeightSubjects(value: unknown): CourseWeights["subjects"] {
  return courseWeightSubjectsSchema.safeParse(value).data ?? [];
}

function readText(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

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
