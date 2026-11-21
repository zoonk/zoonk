import { type MockQuestionWrites } from "@zoonk/core/exams/mocks/prep";
import { describe, expect, it, vi } from "vitest";
import { writeMockQuestions } from "./mock-question-writes";
import { mockSupplyWorkflow } from "./mock-questions-workflow";
import { listMockPrepWritesStep } from "./steps/mock-question-steps";

vi.mock("./mock-question-writes", () => ({
  prepareMockRecordings: vi.fn(),
  writeMockQuestions: vi.fn(),
}));

vi.mock("./steps/mock-question-steps", () => ({
  checkMockSupplyStep: vi.fn(),
  listExamSupplyGoalsStep: vi.fn(),
  listMockPrepWritesStep: vi.fn(),
}));

function paper(
  key: string,
  { alternative, later = true }: { alternative?: true; later?: boolean } = {},
) {
  return {
    alternative,
    key,
    later,
    quickFormat: "multipleChoice",
    writes: [],
  } satisfies MockQuestionWrites;
}

describe(mockSupplyWorkflow, () => {
  it.each([true, false])("prioritizes the waiting paper when waiting is %s", async (waiting) => {
    const waitedOn = paper("waited on", { later: !waiting });
    const scheduled = paper("scheduled");
    const full = paper("full", { alternative: true });
    const half = paper("half", { alternative: true });
    const otherDay = paper("other day", { alternative: true });
    const written: string[] = [];

    vi.mocked(writeMockQuestions)
      .mockClear()
      .mockImplementation(async ({ key }) => {
        written.push(key);
        return { failed: 0, written: 1 };
      });

    vi.mocked(listMockPrepWritesStep).mockImplementation(async ({ only }) => ({
      papers: only
        ? [full, half, otherDay].filter(
            ({ key }) => key === only && !(key === half.key && written.includes(full.key)),
          )
        : [scheduled, waitedOn, full, half, otherDay],
      urgentShort: false,
    }));

    await mockSupplyWorkflow({
      ask: { id: crypto.randomUUID(), revision: 0 },
      examBlueprintId: null,
      goalId: "goal",
      later: !waiting,
      paper: waiting ? waitedOn.key : undefined,
    });

    expect(written).toStrictEqual(
      waiting
        ? [waitedOn.key, scheduled.key]
        : [scheduled.key, waitedOn.key, full.key, otherDay.key],
    );

    expect(vi.mocked(writeMockQuestions).mock.calls.map(([{ later }]) => later)).toStrictEqual(
      waiting ? [false, true] : [true, true, true, true],
    );
  });
});
