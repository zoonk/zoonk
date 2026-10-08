import { randomUUID } from "node:crypto";
import { findExamDate } from "@zoonk/ai/tasks/v2/goals/find-exam-date";
import { prisma } from "@zoonk/db";
import { goalFixture } from "@zoonk/testing/fixtures/goals";
import { onboardingDraftFixture } from "@zoonk/testing/fixtures/onboarding-drafts";
import { examBlueprintFixture, sourceFixture } from "@zoonk/testing/fixtures/sources";
import { usageRecordsFixture } from "@zoonk/testing/fixtures/usage";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it, vi } from "vitest";
import { mockSession } from "../../_test-utils/mock-session";
import { buildExamIdentityKey } from "../../library/exams/exam-identity";
import { type GoalUnderstandingView } from "./onboarding-contract";
import { reviseOnboardingDraft } from "./revise-onboarding-draft";
import type * as RateLimit from "@zoonk/auth/rate-limit";

vi.mock("../../users/get-session", () => ({ getSession: vi.fn() }));
vi.mock("next/headers", () => ({ headers: vi.fn(async () => new Headers()) }));

/** The Vercel Firewall only answers on Vercel, so tests stand in for the adapter that asks it. */
vi.mock("@zoonk/auth/rate-limit", async (importOriginal) => ({
  ...(await importOriginal<typeof RateLimit>()),
  isRateLimited: vi.fn(async () => false),
}));

/** The quick search for a published notice is a web search: here nothing is published. */
vi.mock("@zoonk/ai/tasks/v2/goals/find-exam-date", () => ({
  findExamDate: vi.fn(async () => ({ data: { dates: [], source: null, status: "unknown" } })),
}));

/** An exam with the 2099 notice stored: two exam days read from its official source. */
async function createExam() {
  const examName = `Test Exam ${randomUUID()}`;
  const source = await sourceFixture({ title: "Official notice" });
  const citation = { passage: "The exam takes place on", sourceId: source.id };

  const blueprint = await examBlueprintFixture({
    edition: {
      citations: [],
      dates: [
        { citation, date: "2099-11-08", kind: "exam", label: "Day 1" },
        { citation, date: "2099-11-15", kind: "exam", label: "Day 2" },
      ],
      noticeUrl: null,
      questionCount: null,
      sourceHash: null,
      year: 2099,
    },
    identityKey: buildExamIdentityKey({ name: examName, ownerId: null, role: null }),
    name: examName,
  });

  return { blueprint, examName, source };
}

/** "Pass the exam by June 2099, and English": an exam with its own deadline and a learn goal. */
function examCard({ blueprintId, examName }: { blueprintId: string; examName: string }) {
  return {
    goals: [
      {
        draft: {
          details: { examName, examYear: 2099, studyTimeNote: "At night", targetScore: "700" },
          examBlueprintId: blueprintId,
          kind: "exam" as const,
          language: "en",
          prompt: "pass the exam by june 2099",
          targetDate: "2099-06-01",
          title: "Pass the exam in 2099",
        },
        examDates: [],
      },
      {
        draft: {
          details: { studyTimeNote: "At night", subject: "English" },
          kind: "learn" as const,
          language: "en",
          prompt: "pass the exam by june 2099",
          title: "Learn English",
        },
        examDates: [],
      },
    ],
    schedule: { dailyMinutes: 15, studyDays: null, studyTime: null, studyTimeNote: "At night" },
    status: "goals" as const,
  };
}

async function setup() {
  const [user, exam] = await Promise.all([userFixture(), createExam()]);
  mockSession(user.id);

  const draft = await onboardingDraftFixture({
    understanding: examCard({ blueprintId: exam.blueprint.id, examName: exam.examName }),
    userId: user.id,
  });

  return { draft, exam, user };
}

type Goals = Extract<GoalUnderstandingView, { status: "goals" }>;

function readCard(result: Awaited<ReturnType<typeof reviseOnboardingDraft>>): Goals {
  const understanding = result.status === "revised" ? result.draft.understanding : null;

  if (understanding?.status !== "goals") {
    throw new Error(`Expected a revised card, got ${result.status}`);
  }

  return understanding;
}

describe(reviseOnboardingDraft, () => {
  it("renames one goal and leaves the rest of the card as it was", async () => {
    const { draft } = await setup();

    const card = readCard(
      await reviseOnboardingDraft({
        draftId: draft.id,
        edit: { field: "title", goal: 1, value: "Speak English at work" },
      }),
    );

    expect(card.goals.map((goal) => goal.draft.title)).toStrictEqual([
      "Pass the exam in 2099",
      "Speak English at work",
    ]);

    expect(card.goals[1]?.draft.details?.onboardingId).toBe(draft.id);
  });

  it("reads another exam year's dates and drops the deadline set for the old one", async () => {
    const { draft, exam } = await setup();

    const later = readCard(
      await reviseOnboardingDraft({
        draftId: draft.id,
        edit: { field: "examYear", goal: 0, value: 2100 },
      }),
    );

    const [goal] = later.goals;

    expect(goal?.draft.targetDate).toBeUndefined();
    expect(goal?.draft.examBlueprintId).toBe(exam.blueprint.id);
    expect(goal?.draft.details?.examYear).toBe(2100);
    expect(goal?.draft.title).toBe("Pass the exam in 2100");
    expect(goal?.examDates.length).toBeGreaterThan(0);

    expect(goal?.examDates.every((date) => date.estimated && date.date.startsWith("2100-"))).toBe(
      true,
    );

    const official = readCard(
      await reviseOnboardingDraft({
        draftId: draft.id,
        edit: { field: "examYear", goal: 0, value: 2099 },
      }),
    );

    const source = { title: "Official notice", url: exam.source.url };

    expect(official.goals[0]?.examDates).toStrictEqual([
      { date: "2099-11-08", estimated: false, label: "Day 1", source },
      { date: "2099-11-15", estimated: false, label: "Day 2", source },
    ]);
  });

  it("searches another year's day only as small AI help, and past the cap leaves it to be confirmed", async () => {
    const { draft, user } = await setup();

    readCard(
      await reviseOnboardingDraft({
        draftId: draft.id,
        edit: { field: "examYear", goal: 0, value: 2101 },
      }),
    );

    expect(findExamDate).toHaveBeenCalledOnce();

    await expect(
      prisma.usageRecord.count({ where: { kind: "assist", userId: user.id } }),
    ).resolves.toBe(1);

    await usageRecordsFixture({ count: 99, kind: "assist", userId: user.id });
    vi.mocked(findExamDate).mockClear();

    const capped = readCard(
      await reviseOnboardingDraft({
        draftId: draft.id,
        edit: { field: "examYear", goal: 0, value: 2102 },
      }),
    );

    expect(findExamDate).not.toHaveBeenCalled();
    expect(capped.goals[0]?.draft.details?.examYear).toBe(2102);
  });

  it("keeps the learner's own deadline in place of the exam's dates, and null brings them back", async () => {
    const { draft } = await setup();

    const own = readCard(
      await reviseOnboardingDraft({
        draftId: draft.id,
        edit: { field: "targetDate", goal: 0, value: "2099-09-30" },
      }),
    );

    expect(own.goals[0]?.draft.targetDate).toBe("2099-09-30");

    const cleared = readCard(
      await reviseOnboardingDraft({
        draftId: draft.id,
        edit: { field: "targetDate", goal: 0, value: null },
      }),
    );

    expect(cleared.goals[0]?.draft).not.toHaveProperty("targetDate");
  });

  it("changes or removes a detail the words gave", async () => {
    const { draft } = await setup();

    const changed = readCard(
      await reviseOnboardingDraft({
        draftId: draft.id,
        edit: { field: "targetScore", goal: 0, value: "750" },
      }),
    );

    expect(changed.goals[0]?.draft.details?.targetScore).toBe("750");

    const removed = readCard(
      await reviseOnboardingDraft({
        draftId: draft.id,
        edit: { field: "targetScore", goal: 0, value: null },
      }),
    );

    expect(removed.goals[0]?.draft.details).not.toHaveProperty("targetScore");
  });

  it("sets a study time on every goal in place of when the words said", async () => {
    const { draft } = await setup();

    const card = readCard(
      await reviseOnboardingDraft({
        draftId: draft.id,
        edit: { field: "studyTime", value: "07:30" },
      }),
    );

    expect(card.schedule).toMatchObject({ studyTime: "07:30", studyTimeNote: null });
    expect(card.goals.every((goal) => !("studyTimeNote" in (goal.draft.details ?? {})))).toBe(true);
  });

  it("refuses fixes that don't apply to the goal", async () => {
    const { draft } = await setup();

    const results = await Promise.all([
      reviseOnboardingDraft({
        draftId: draft.id,
        edit: { field: "examYear", goal: 1, value: 2100 },
      }),
      reviseOnboardingDraft({
        draftId: draft.id,
        edit: { field: "examYear", goal: 0, value: 2001 },
      }),
      reviseOnboardingDraft({
        draftId: draft.id,
        edit: { field: "targetDate", goal: 0, value: "2001-01-01" },
      }),
      reviseOnboardingDraft({
        draftId: draft.id,
        edit: { field: "title", goal: 5, value: "More" },
      }),
    ]);

    expect(results.map((result) => result.status)).toStrictEqual([
      "invalid",
      "invalid",
      "invalid",
      "invalid",
    ]);

    const stored = await prisma.onboardingDraft.findUniqueOrThrow({ where: { id: draft.id } });
    expect(stored.updatedAt).toStrictEqual(draft.updatedAt);
  });

  it("applies two fixes saved at the same moment one after the other", async () => {
    const { draft } = await setup();

    await Promise.all([
      reviseOnboardingDraft({ draftId: draft.id, edit: { field: "title", goal: 0, value: "One" } }),
      reviseOnboardingDraft({ draftId: draft.id, edit: { field: "title", goal: 1, value: "Two" } }),
    ]);

    const stored = await prisma.onboardingDraft.findUniqueOrThrow({ where: { id: draft.id } });

    expect(stored.understanding).toMatchObject({
      goals: [{ draft: { title: "One" } }, { draft: { title: "Two" } }],
    });
  });

  it("can't fix a card still being read or already confirmed", async () => {
    const user = await userFixture();
    mockSession(user.id);

    const [reading, confirmed] = await Promise.all([
      onboardingDraftFixture({ status: "understanding", userId: user.id }),
      onboardingDraftFixture({ userId: user.id }),
    ]);

    await goalFixture({ details: { onboardingId: confirmed.id }, userId: user.id });
    const edit = { field: "title" as const, goal: 0, value: "Something else" };

    await expect(reviseOnboardingDraft({ draftId: reading.id, edit })).resolves.toStrictEqual({
      status: "conflict",
    });

    await expect(reviseOnboardingDraft({ draftId: confirmed.id, edit })).resolves.toStrictEqual({
      status: "conflict",
    });
  });

  it("only fixes the learner's own drafts", async () => {
    const [owner, other] = await Promise.all([userFixture(), userFixture()]);
    const draft = await onboardingDraftFixture({ userId: owner.id });
    mockSession(other.id);

    await expect(
      reviseOnboardingDraft({
        draftId: draft.id,
        edit: { field: "title", goal: 0, value: "Mine" },
      }),
    ).resolves.toStrictEqual({ status: "notFound" });
  });
});
