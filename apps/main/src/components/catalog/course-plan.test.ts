import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import * as calendarDay from "@/lib/public/calendar-day";
import * as estimate from "@zoonk/core/catalog/course-estimate";
import * as examDays from "@zoonk/core/catalog/course-exam-days";
import { prisma } from "@zoonk/db";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { courseBandsFixture } from "@zoonk/testing/fixtures/library-chapters";
import { examBlueprintFixture } from "@zoonk/testing/fixtures/sources";
import { MS_PER_DAY } from "@zoonk/utils/date";
import * as logger from "@zoonk/utils/logger";
import { loadBindings, transform } from "next/dist/build/swc";
import * as navigation from "next/navigation";
import { beforeAll, describe, expect, it } from "vitest";
import * as planEstimate from "./plan-estimate";

type CachedRead = (...args: unknown[]) => Promise<unknown>;

type GetCoursePlanExample = (course: {
  format: string;
  id: string;
}) => Promise<{ exam: { days: string[] } | null }>;

const SOURCE = new URL("course-plan.ts", import.meta.url).pathname;

/**
 * Vitest doesn't compile cache directives, so the module is compiled with the installed Next
 * compiler and run on a stand-in for its cache platform: entries a `"use cache"` read keeps for
 * the app (across requests), and those a `"use cache: private"` read keeps for one request. Core's
 * reads and PostgreSQL stay real; another app's write is a database write this app's tags never
 * hear about.
 */
function cachePlatform(code: string) {
  const shared = new Map<string, Promise<unknown>>();
  const request = new Map<string, Promise<unknown>>();

  function cache(kind: string, id: string, _bound: number, read: CachedRead, args: unknown[]) {
    const entries = kind === "private" ? request : shared;
    const key = JSON.stringify([id, args]);
    const entry = entries.get(key) ?? read(...args);
    entries.set(key, entry);
    return entry;
  }

  const imports: Record<string, unknown> = {
    "./plan-estimate": planEstimate,
    "@/lib/public/cache-until-midnight": { cacheUntilMidnight: () => null },
    "@/lib/public/calendar-day": calendarDay,
    "@zoonk/core/catalog/course-estimate": estimate,
    "@zoonk/core/catalog/course-exam-days": examDays,
    "@zoonk/utils/logger": logger,
    "next/navigation": navigation,
    "private-next-rsc-cache-wrapper": { cache },
    "private-next-rsc-server-reference": { registerServerReference: (read: unknown) => read },
    react: { cache: (read: unknown) => read },
    "server-only": {},
  };

  const compiled = {} as { getCoursePlanExample: GetCoursePlanExample };

  runInNewContext(code, {
    exports: compiled,
    module: { exports: compiled },
    require: (name: string) => {
      if (!(name in imports)) {
        throw new Error(`Unexpected course-plan dependency: ${name}`);
      }

      return imports[name];
    },
  });

  return {
    getCoursePlanExample: compiled.getCoursePlanExample,
    nextRequest: () => request.clear(),
  };
}

/** A day some days from now ("YYYY-MM-DD", UTC). */
function dayIn(days: number): string {
  return new Date(Date.now() + days * MS_PER_DAY).toISOString().slice(0, 10);
}

/** A notice edition with one exam day, in UTC. */
function edition(date: string) {
  return {
    citations: [],
    dates: [
      { citation: { passage: "Exam day", sourceId: "notice" }, date, kind: "exam", label: "Exam" },
    ],
    noticeUrl: null,
    questionCount: null,
    sourceHash: null,
    timeZone: "UTC",
    year: Number(date.slice(0, 4)),
  };
}

/** A published exam course whose stored exam graph starts on it. */
async function examCourse(date: string) {
  const [course, blueprint] = await Promise.all([
    courseFixture({ format: "exam", isPublished: true, visibility: "public" }),
    examBlueprintFixture({ edition: edition(date) }),
  ]);

  const [band] = await courseBandsFixture({ courseId: course.id, levels: ["beginner"] });

  await prisma.examSkillGraph.create({
    data: {
      examBlueprintId: blueprint.id,
      generatedAt: new Date(),
      graph: {
        phases: [{ milestone: null, name: "Exam" }],
        skills: [
          {
            area: null,
            courseIds: [course.id],
            lessons: 1,
            name: band?.skill.name ?? "",
            phase: 0,
            skillId: band?.skill.id ?? "",
            weight: null,
          },
        ],
      },
      model: "fixture",
      primaryCourseId: course.id,
      promptVersion: "fixture",
      runId: "fixture",
    },
  });

  return { blueprint, course };
}

describe("the course page's example plan cache", () => {
  const compiled = { code: "" };

  beforeAll(async () => {
    await loadBindings();

    const result = await transform(readFileSync(SOURCE, "utf8"), {
      filename: SOURCE,
      jsc: { parser: { syntax: "typescript" }, target: "es2022" },
      module: { type: "commonjs" },
      serverActions: {
        cacheKinds: ["default", "private", "remote"],
        hashSalt: "course-plan-test",
        isDevelopment: false,
        isReactServerLayer: true,
        useCacheEnabled: true,
      },
    });

    compiled.code = result.code;
  });

  it("reads an exam notice another app revised on the next request, though the course row didn't change", async () => {
    const platform = cachePlatform(compiled.code);
    const { blueprint, course } = await examCourse(dayIn(40));

    const first = await platform.getCoursePlanExample(course);
    expect(first.exam?.days).toStrictEqual([dayIn(40)]);

    // The API's notice research revises the edition: this app's tags and the course row stay as
    // they were.
    await prisma.examBlueprint.update({
      data: { edition: edition(dayIn(54)) },
      where: { id: blueprint.id },
    });

    platform.nextRequest();
    const next = await platform.getCoursePlanExample(course);

    expect(next.exam?.days).toStrictEqual([dayIn(54)]);
  });
});
