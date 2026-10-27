import { AsyncLocalStorage } from "node:async_hooks";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import * as calendarDay from "@/lib/public/calendar-day";
import * as cacheTags from "@zoonk/core/cache-tags";
import {
  getCourseCacheTag,
  getCourseCurriculumCacheTag,
  getExamBlueprintCacheTag,
} from "@zoonk/core/cache-tags";
import * as estimate from "@zoonk/core/catalog/course-estimate";
import * as examDays from "@zoonk/core/catalog/course-exam-days";
import { prisma } from "@zoonk/db";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { courseBandsFixture } from "@zoonk/testing/fixtures/library-chapters";
import { examBlueprintFixture } from "@zoonk/testing/fixtures/sources";
import { MS_PER_DAY } from "@zoonk/utils/date";
import * as logger from "@zoonk/utils/logger";
import { cacheTag } from "next/cache";
import { loadBindings, transform } from "next/dist/build/swc";
import * as navigation from "next/navigation";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { buildPlan } from "../../../../../packages/core/src/plans/planner/build-plan";
import { type getCoursePlanExample } from "./course-plan";
import * as planEstimate from "./plan-estimate";

type CachedRead = (...args: unknown[]) => Promise<unknown>;
type CacheEntry = { revalidateAt: number; result: Promise<unknown>; tags: Set<string> };

/** Next.js' default cache profile works a shared entry out again 15 minutes after it was made. */
const DEFAULT_REVALIDATE_MS = 15 * 60 * 1000;

type GetCoursePlanExample = typeof getCoursePlanExample;

vi.mock("../../../../../packages/core/src/plans/planner/build-plan", { spy: true });

const SOURCE = new URL("course-plan.ts", import.meta.url).pathname;

/**
 * Vitest doesn't compile cache directives, so the module is compiled with the installed Next
 * compiler and run on a stand-in for the app's shared cache: entries kept across requests for the
 * default profile's revalidation time, with the tags their reads (core's too) attached, and tag
 * expiry. Core's reads and PostgreSQL stay real; a write is a database write followed by the tag
 * expiry its app sends.
 */
function cachePlatform(code: string) {
  const sharedEntries = new Map<string, CacheEntry>();
  const requestEntries = new Map<string, CacheEntry>();
  const activeEntry = new AsyncLocalStorage<CacheEntry>();

  /** A private cache keeps its entries for one request only; a shared one, across requests. */
  function cache(kind: string, id: string, _bound: number, read: CachedRead, args: unknown[]) {
    const entries = kind === "private" ? requestEntries : sharedEntries;
    const key = JSON.stringify([id, args]);
    const tags = new Set<string>();

    const found = entries.get(key);
    const kept = found && found.revalidateAt > Date.now();

    const entry: CacheEntry = kept
      ? found
      : {
          result: Promise.resolve().then(() => activeEntry.run(entry, () => read(...args))),
          revalidateAt: Date.now() + DEFAULT_REVALIDATE_MS,
          tags,
        };

    entries.set(key, entry);
    return entry.result;
  }

  vi.mocked(cacheTag).mockImplementation((...tags) => {
    tags.forEach((tag) => activeEntry.getStore()?.tags.add(tag));
  });

  const imports: Record<string, unknown> = {
    "./plan-estimate": planEstimate,
    "@/lib/public/calendar-day": calendarDay,
    "@zoonk/core/cache-tags": cacheTags,
    "@zoonk/core/catalog/course-estimate": estimate,
    "@zoonk/core/catalog/course-exam-days": examDays,
    "@zoonk/utils/logger": logger,
    "next/cache": { cacheTag },
    "next/navigation": navigation,
    "private-next-rsc-cache-wrapper": { cache },
    "private-next-rsc-server-reference": { registerServerReference: (read: unknown) => read },
    react: { cache: (read: unknown) => read },
    "server-only": {},
  };

  const compiled = {} as { getCoursePlanExample: GetCoursePlanExample };

  runInNewContext(code, {
    Date,
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
    expireTag: (tag: string) => {
      sharedEntries.forEach((entry, key) => {
        if (entry.tags.has(tag)) {
          sharedEntries.delete(key);
        }
      });
    },
    getCoursePlanExample: compiled.getCoursePlanExample,
    nextRequest: () => requestEntries.clear(),
    tags: () => new Set([...sharedEntries.values()].flatMap((entry) => [...entry.tags])),
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
      {
        citation: { passage: "Exam day", sourceId: "notice" },
        date,
        kind: "exam",
        label: "Exam",
        startTime: null,
      },
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

  afterEach(() => vi.useRealTimers());

  it("keeps the example for every visitor until a notice revised elsewhere expires its tag", async () => {
    const platform = cachePlatform(compiled.code);
    const { blueprint, course } = await examCourse(dayIn(40));

    const first = await platform.getCoursePlanExample(course);
    expect(first.exam?.days).toStrictEqual([dayIn(40)]);

    expect(platform.tags()).toStrictEqual(
      new Set([
        getCourseCacheTag(course.id),
        getCourseCurriculumCacheTag(course.id),
        getExamBlueprintCacheTag(blueprint.id),
      ]),
    );

    // The API's notice research revises the edition; until its tag reaches this app, every
    // visitor's static course page keeps the sitting it showed.
    await prisma.examBlueprint.update({
      data: { edition: edition(dayIn(54)) },
      where: { id: blueprint.id },
    });

    platform.nextRequest();
    const kept = await platform.getCoursePlanExample(course);
    expect(kept.exam?.days).toStrictEqual([dayIn(40)]);

    platform.expireTag(getExamBlueprintCacheTag(blueprint.id));

    const next = await platform.getCoursePlanExample(course);
    expect(next.exam?.days).toStrictEqual([dayIn(54)]);
  });

  it("builds one default example on a miss and none for another visitor, then keys a new revision", async () => {
    const platform = cachePlatform(compiled.code);
    const course = await courseFixture({ isPublished: true, visibility: "public" });

    await courseBandsFixture({
      courseId: course.id,
      levels: ["beginner", "intermediate", "advanced"],
    });

    vi.mocked(buildPlan).mockClear();

    const first = await platform.getCoursePlanExample(course);
    expect(first.pace?.minutes).toBe(15);
    expect(buildPlan).toHaveBeenCalledOnce();
    platform.nextRequest();
    await expect(platform.getCoursePlanExample(course)).resolves.toStrictEqual(first);
    expect(buildPlan).toHaveBeenCalledOnce();

    const revision = await prisma.course.update({
      data: { updatedAt: new Date(course.updatedAt.getTime() + 1000) },
      where: { id: course.id },
    });

    platform.nextRequest();
    await platform.getCoursePlanExample(revision);
    expect(buildPlan).toHaveBeenCalledTimes(2);
  });

  it("renews the selected estimate when the notice changes but its exam day stays the same", async () => {
    const platform = cachePlatform(compiled.code);
    const { blueprint, course } = await examCourse(dayIn(40));
    vi.mocked(buildPlan).mockClear();
    await platform.getCoursePlanExample(course);
    // An exam's estimate may build again to measure what fits: count each miss as one estimate.
    const perMiss = vi.mocked(buildPlan).mock.calls.length;
    expect(perMiss).toBeGreaterThan(0);
    const first = vi.mocked(buildPlan).mock.calls[0]?.[0].fullMockMinutes;

    await prisma.examBlueprint.update({
      data: {
        structure: {
          formats: [],
          mock: {
            adaptive: false,
            citations: [],
            order: null,
            scoring: { description: "", method: "raw" },
            sections: [{ day: null, kind: "objective", minutes: 90, name: "Paper", questions: 30 }],
            timeLimitMinutes: 90,
            totalQuestions: 30,
          },
          rules: [],
          subjects: [],
        },
      },
      where: { id: blueprint.id },
    });

    platform.expireTag(getExamBlueprintCacheTag(blueprint.id));
    platform.nextRequest();
    await platform.getCoursePlanExample(course);
    expect(buildPlan).toHaveBeenCalledTimes(2 * perMiss);
    expect(vi.mocked(buildPlan).mock.calls[perMiss]?.[0].fullMockMinutes).toBe(90);
    expect(first).not.toBe(90);
  });

  it("renews the selected exam example by the hour and the exam's own day", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-09-30T12:15:00Z"));
    const platform = cachePlatform(compiled.code);
    const { blueprint, course } = await examCourse("2026-10-01");

    await prisma.examBlueprint.update({
      data: { edition: { ...edition("2026-10-01"), timeZone: "Pacific/Honolulu" } },
      where: { id: blueprint.id },
    });

    vi.mocked(buildPlan).mockClear();
    const first = await platform.getCoursePlanExample(course);
    expect(first.exam?.days).toStrictEqual(["2026-10-01"]);
    const perMiss = vi.mocked(buildPlan).mock.calls.length;
    expect(perMiss).toBeGreaterThan(0);

    vi.setSystemTime(new Date("2026-09-30T13:16:00Z"));
    platform.nextRequest();
    await platform.getCoursePlanExample(course);
    expect(buildPlan).toHaveBeenCalledTimes(2 * perMiss);

    // UTC is already October 1, but the sitting is still tomorrow in its own zone.
    vi.setSystemTime(new Date("2026-10-01T00:15:00Z"));
    platform.nextRequest();
    const sameExamDay = await platform.getCoursePlanExample(course);
    expect(sameExamDay.exam?.days).toStrictEqual(["2026-10-01"]);
    // The countdown keeps the exam-zone day, while the UTC estimate has no study day left.
    expect(sameExamDay.pace).toBeNull();

    vi.setSystemTime(new Date("2026-10-01T10:16:00Z"));
    platform.nextRequest();
    const afterExam = await platform.getCoursePlanExample(course);
    expect(afterExam.exam?.days).not.toStrictEqual(["2026-10-01"]);
    expect(afterExam.exam).toMatchObject({ estimated: true, timeZone: "Pacific/Honolulu" });
    expect(afterExam.pace?.minutes).toBe(30);
  });
});
