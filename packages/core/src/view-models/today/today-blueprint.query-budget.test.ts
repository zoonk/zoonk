import { prisma } from "@zoonk/db";
import { examBlueprintFixture } from "@zoonk/testing/fixtures/sources";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { countDatabaseStatements } from "@zoonk/testing/statement-counter";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../../_test-utils/mock-session";
import { getMockOptions } from "../../exams/mocks/get-mock-options";
import { readExamBlueprint } from "../../learner/facts/exam-blueprint";
import { getGoalUploadRequest } from "../../library/sources/goal-upload-request";
import { listGoalChangeNotices } from "../../library/sources/source-change-notices";
import { listCurrentUserMistakes } from "../../mistakes/list-current-user-mistakes";
import {
  SESSION_NOW,
  checkpointItemFixture,
  sessionGoalFixture,
} from "../../sessions/_test-utils/session-goal";
import { openStudyDay } from "../../sessions/open-study-day";
import { getSyllabusView } from "../syllabus/get-syllabus-view";
import { getTodayView } from "./get-today-view";

// Only observe the request's blueprint fact; its read is unchanged. Vitest has no Next request,
// so the fact's one read per request is the production harness's to prove: here, every other read
// of the blueprint's full row has to go through it.
vi.mock("../../learner/facts/exam-blueprint", async (importOriginal) => {
  const actual = await importOriginal<{ readExamBlueprint: typeof readExamBlueprint }>();
  return { ...actual, readExamBlueprint: vi.fn(actual.readExamBlueprint) };
});

const citation = { passage: "", sourceId: "notice" };

/** An exam goal with a mock this week, so Today's weekly card reads the exam too. */
async function setup() {
  const user = await userFixture();

  const blueprint = await examBlueprintFixture({
    edition: {
      check: null,
      citations: [],
      dates: [{ citation, date: "2026-11-08", kind: "exam", label: "Day 1", startTime: "13:30" }],
      noticeUrl: null,
      questionCount: 90,
      sourceHash: null,
      timeZone: "America/Sao_Paulo",
      year: 2026,
    },
    name: "ENEM",
  });

  const { goal, plan } = await sessionGoalFixture({
    goal: {
      examBlueprintId: blueprint.id,
      kind: "exam",
      targetDate: new Date("2026-11-08T00:00:00Z"),
    },
    userId: user.id,
  });

  await checkpointItemFixture({
    kind: "mock",
    planId: plan.id,
    position: 99,
    scheduledFor: new Date("2026-10-04T00:00:00Z"),
  });

  mockSession(user.id);
  return { blueprint, goal };
}

/** Today's API for an exam goal (`loadTodayScreen` in main): the day, then the cards beside it. */
async function loadToday(goalId: string) {
  const today = await getTodayView({});

  await Promise.all([
    getMockOptions({ goalId }),
    listCurrentUserMistakes({ goalId, limit: 1, offset: 0, status: "open" }),
    getSyllabusView({ goalId }),
    listGoalChangeNotices({ goalId }),
    getGoalUploadRequest({ goalId }),
  ]);

  return today;
}

/** Full-row blueprint reads that skip the request fact, and the blueprints the fact read. */
async function countBlueprintReads(goalId: string) {
  vi.mocked(readExamBlueprint).mockClear();
  const findUnique = vi.spyOn(prisma.examBlueprint, "findUnique");
  const { result, writes } = await countDatabaseStatements(() => loadToday(goalId));
  const fullRows = findUnique.mock.calls.filter(([args]) => !args.select).length;
  const factReads = vi.mocked(readExamBlueprint).mock.calls.map(([blueprintId]) => blueprintId);
  findUnique.mockRestore();

  return {
    direct: fullRows - factReads.length,
    factBlueprintIds: [...new Set(factReads)],
    today: result,
    writes,
  };
}

describe("Today's exam blueprint reads", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(SESSION_NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it.each(["unopened", "opened"] as const)(
    "reads the goal's blueprint once per request on an %s day",
    async (day) => {
      const { blueprint, goal } = await setup();

      if (day === "opened") {
        await openStudyDay({
          goalId: goal.id,
          keepEmpty: true,
          shownDate: "2026-09-30",
          timeZone: "UTC",
        });
      }

      const reads = await countBlueprintReads(goal.id);

      expect(reads.today.status).toBe("ready");

      if (reads.today.status !== "ready") {
        throw new Error("Expected Today");
      }

      expect(reads.today.today.weeklyChallenge).toMatchObject({ kind: "mock" });

      expect(reads).toMatchObject({ direct: 0, factBlueprintIds: [blueprint.id], writes: 0 });
    },
  );
});
