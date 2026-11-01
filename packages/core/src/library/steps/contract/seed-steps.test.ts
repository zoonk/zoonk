import { describe, expect, it } from "vitest";
import { localizeObject } from "../../../../../db/src/prisma/seed/_utils/localize";
import { enemCourse } from "../../../../../db/src/prisma/seed/library/enem/enem-course";
import { englishCourse } from "../../../../../db/src/prisma/seed/library/english/english-course";
import { physicsCourse } from "../../../../../db/src/prisma/seed/library/physics/physics-course";
import { stockMarketCourse } from "../../../../../db/src/prisma/seed/library/stock-market/stock-market-course";
import { describeContentIssues, safeParseStepContent } from "./step-contract";

const courses = [enemCourse, englishCourse, physicsCourse, stockMarketCourse];

const seededSteps = courses.flatMap((course) =>
  [...course.chapters.flatMap((chapter) => chapter.lessons), ...(course.explanations ?? [])]
    .flatMap((lesson) => (lesson.steps ?? []).map((step, position) => ({ lesson, position, step })))
    .flatMap(({ lesson, position, step }) =>
      course.languages.map((language) => ({
        content: localizeObject(step.content, language),
        kind: step.kind,
        name: `${course.key}/${lesson.key} step ${String(position)} (${language})`,
      })),
    ),
);

describe("seeded lesson steps", () => {
  it("follow the step contract, which the player needs to show them", () => {
    const issues = seededSteps.flatMap(({ content, kind, name }) => {
      const result = safeParseStepContent(kind, content);
      return result.success ? [] : [`${name}: ${describeContentIssues(result.error).join("; ")}`];
    });

    expect(seededSteps.length).toBeGreaterThan(0);
    expect(issues).toStrictEqual([]);
  });
});
