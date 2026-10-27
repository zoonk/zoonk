import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { goalFixture } from "@zoonk/testing/fixtures/goals";
import { onboardingDraftFixture } from "@zoonk/testing/fixtures/onboarding-drafts";
import { examBlueprintFixture, sourceFixture } from "@zoonk/testing/fixtures/sources";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it } from "vitest";
import { mockSession } from "../../_test-utils/mock-session";
import { buildExamIdentityKey } from "../../library/exams/exam-identity";
import { isInputRangeError } from "../../plans/target-date-range";
import { type GoalUnderstandingView } from "./onboarding-contract";
import { reviseOnboardingDraft } from "./revise-onboarding-draft";

/** An exam with the 2099 notice stored: two exam days read from its official source. */
async function createExam() {
  const examName = `Test Exam ${randomUUID()}`;
  const source = await sourceFixture({ title: "Official notice" });
  const citation = { passage: "The exam takes place on", sourceId: source.id };

  const blueprint = await examBlueprintFixture({
    edition: {
      citations: [],
      dates: [
        { citation, date: "2099-11-08", kind: "exam", label: "Day 1", startTime: null },
        { citation, date: "2099-11-15", kind: "exam", label: "Day 2", startTime: null },
      ],
      noticeUrl: null,
      questionCount: null,
      sourceHash: null,
      timeZone: null,
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

  it("keeps the learner's own deadline in place of the exam's dates, and null brings them back", async () => {
    const { draft } = await setup();

    const ownDate = `${new Date().getUTCFullYear() + 2}-09-30`;

    const own = readCard(
      await reviseOnboardingDraft({
        draftId: draft.id,
        edit: { field: "targetDate", goal: 0, value: ownDate },
      }),
    );

    expect(own.goals[0]?.draft.targetDate).toBe(ownDate);

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

  it("refuses a deadline past what a plan reaches before the card is saved", async () => {
    const { draft } = await setup();
    // A plan reaches 3,650 days from today: eleven years is past it.
    const value = `${new Date().getUTCFullYear() + 11}-01-01`;

    await expect(
      reviseOnboardingDraft({ draftId: draft.id, edit: { field: "targetDate", goal: 1, value } }),
    ).rejects.toSatisfy(isInputRangeError);

    const stored = await prisma.onboardingDraft.findUniqueOrThrow({ where: { id: draft.id } });
    expect(stored.updatedAt).toStrictEqual(draft.updatedAt);
  });

  it("refuses fixes that don't apply to the goal", async () => {
    const { draft } = await setup();

    const results = await Promise.all([
      reviseOnboardingDraft({
        draftId: draft.id,
        edit: { field: "targetDate", goal: 0, value: "2001-01-01" },
      }),
      reviseOnboardingDraft({
        draftId: draft.id,
        edit: { field: "title", goal: 5, value: "More" },
      }),
    ]);

    expect(results.map((result) => result.status)).toStrictEqual(["invalid", "invalid"]);

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
