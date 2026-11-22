import { captureException } from "@sentry/nextjs";
import { type MockQuestionWrites } from "@zoonk/core/exams/mocks/prep";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createHook, getWritable } from "workflow";
import { mockHookConflict } from "../../../mocks/workflow";
import { getStreamedEvents } from "../_test-utils/parse-stream-events";
import { writeMockQuestions } from "./mock-question-writes";
import { mockSupplyWorkflow } from "./mock-questions-workflow";
import { pickMockSetTargetsStep, prepareItemSet } from "./steps/item-set-step";
import {
  checkMockSupplyStep,
  listExamSupplyGoalsStep,
  listMockPrepWritesStep,
} from "./steps/mock-question-steps";

vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn(), flush: vi.fn() }));

vi.mock("./mock-question-writes", () => ({
  prepareMockRecordings: vi.fn(),
  writeMockQuestions: vi.fn(),
}));

vi.mock(import("./steps/mock-question-steps"), async (importOriginal) => ({
  ...(await importOriginal()),
  checkMockSupplyStep: vi.fn(),
  listExamSupplyGoalsStep: vi.fn(),
  listMockPrepWritesStep: vi.fn(),
}));

// Choosing a paper's shared texts reads the exam's bank; core's tests cover it.
vi.mock("./steps/item-set-step", () => ({
  pickMockSetTargetsStep: vi.fn().mockResolvedValue([]),
  prepareItemSet: vi.fn(),
}));

function paper(
  key: string,
  { alternative, later = true, ...rest }: Partial<MockQuestionWrites> = {},
) {
  return {
    alternative,
    key,
    later,
    quickFormat: "multipleChoice",
    writes: [],
    ...rest,
  } satisfies MockQuestionWrites;
}

const GOAL_ID = "goal";
const DAY_1 = JSON.stringify(["full", 1, null]);
const DAY_2 = JSON.stringify(["full", 2, null]);
const SCHEDULED = "2026-11-21T00:00:00.000Z";

function waitedRequest() {
  const ask = { id: crypto.randomUUID(), revision: 0 };
  return { ask, examBlueprintId: null, goalId: GOAL_ID, later: false, paper: DAY_1 };
}

/** Each planning read in turn: the first plan, a recount after texts if any, then whether it's written. */
function plan(...reads: MockQuestionWrites[][]) {
  const planned = vi.mocked(listMockPrepWritesStep).mockReset();

  for (const papers of reads) {
    planned.mockResolvedValueOnce({ papers, urgentShort: false });
  }

  planned.mockResolvedValue({ papers: [], urgentShort: false });
}

function streamedSteps(key: string) {
  const calls = vi.mocked(getWritable).mock.calls;
  const namespace = `mock-paper:${GOAL_ID}:${key}`;

  return getStreamedEvents()
    .filter((_, index) => calls[index]?.[0]?.namespace === namespace)
    .map((event) => `${String(event.step)}:${String(event.status)}`);
}

describe(mockSupplyWorkflow, () => {
  beforeEach(() => {
    vi.mocked(pickMockSetTargetsStep).mockReset().mockResolvedValue([]);
  });

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

  it("says a recount-complete paper is ready even when its shared texts fail", async () => {
    const waited = paper(DAY_1, { allowStimulusSets: true, later: false });
    const scheduled = paper(DAY_2, { allowStimulusSets: true });
    const written: string[] = [];

    plan([waited, scheduled]);

    vi.mocked(pickMockSetTargetsStep).mockImplementation(async ({ writes }) =>
      writes === waited.writes ? [{} as never] : [],
    );

    const error = new Error("The set writer gave up");
    vi.mocked(prepareItemSet).mockRejectedValueOnce(error);

    vi.mocked(writeMockQuestions)
      .mockReset()
      .mockImplementation(async ({ key }) => {
        written.push(key);
        return { failed: 0, written: 1 };
      });

    await expect(mockSupplyWorkflow(waitedRequest())).resolves.toBeUndefined();

    expect(written).toStrictEqual([DAY_1, DAY_2]);
    expect(checkMockSupplyStep).toHaveBeenCalledWith(GOAL_ID, { priority: DAY_1 });

    expect(captureException).toHaveBeenCalledExactlyOnceWith(error, {
      tags: { "workflow.name": "mockSupplyWorkflow", "workflow.run_id": "test-run-id" },
    });

    expect(streamedSteps(DAY_1).at(-1)).toBe("mockPaperReady:completed");
    expect(streamedSteps(DAY_2).at(-1)).toBe("mockPaperReady:completed");
  });

  describe("the learner waiting for a paper", () => {
    beforeEach(() => {
      vi.mocked(writeMockQuestions).mockReset().mockResolvedValue({ failed: 0, written: 1 });
    });

    it("streams its texts, questions and listening, then says it's written", async () => {
      const recordings = { exam: {} as never, parts: [] };
      const waited = paper(DAY_1, { allowStimulusSets: true, later: false, recordings });

      plan([waited, paper(DAY_2)], []);

      await mockSupplyWorkflow(waitedRequest());

      expect(createHook).toHaveBeenCalledWith({ token: `mock-paper:${GOAL_ID}:${DAY_1}` });

      expect(streamedSteps(DAY_1)).toStrictEqual([
        "writeMockTexts:started",
        "writeMockTexts:completed",
        "writeMockQuestions:started",
        "writeMockQuestions:completed",
        "recordMockListening:started",
        "recordMockListening:completed",
        "mockPaperReady:completed",
      ]);

      expect(writeMockQuestions).toHaveBeenCalledTimes(2);
    });

    it("releases a paper's claim before writing the next paper", async () => {
      plan([paper(DAY_1, { later: false }), paper(DAY_2)]);

      let releasesAtNextPaper = 0;

      vi.mocked(writeMockQuestions).mockImplementation(async ({ key }) => {
        if (key === DAY_2) {
          const claim = vi
            .mocked(createHook)
            .mock.results.find(
              (result) =>
                result.type === "return" && result.value.token === `mock-paper:${GOAL_ID}:${DAY_1}`,
            );

          releasesAtNextPaper = claim ? vi.mocked(claim.value.dispose).mock.calls.length : 0;
        }

        return { failed: 0, written: 1 };
      });

      await mockSupplyWorkflow(waitedRequest());

      expect(releasesAtNextPaper).toBe(1);
      expect(streamedSteps(DAY_1).at(-1)).toBe("mockPaperReady:completed");
      expect(streamedSteps(DAY_2).at(-1)).toBe("mockPaperReady:completed");
    });

    it("says the paper is still short when its questions didn't fill it", async () => {
      plan([paper(DAY_1, { later: false })], [paper(DAY_1, { later: false })]);

      await mockSupplyWorkflow(waitedRequest());

      expect(streamedSteps(DAY_1)).toStrictEqual([
        "writeMockQuestions:started",
        "writeMockQuestions:completed",
        "workflowError:error",
      ]);
    });

    it("says it's written at once when a run before this one wrote it", async () => {
      plan([paper(DAY_2)]);

      await mockSupplyWorkflow(waitedRequest());

      expect(streamedSteps(DAY_1)).toStrictEqual(["mockPaperReady:completed"]);
      expect(writeMockQuestions).toHaveBeenCalledOnce();
    });

    it("ends the wait when question writing fails", async () => {
      const waited = paper(DAY_1, { later: false });
      plan([waited], [waited]);
      const error = new Error("Provider unavailable");
      vi.mocked(writeMockQuestions).mockRejectedValueOnce(error);

      await mockSupplyWorkflow(waitedRequest());

      expect(captureException).toHaveBeenCalledExactlyOnceWith(error, expect.any(Object));

      expect(streamedSteps(DAY_1)).toStrictEqual([
        "writeMockQuestions:started",
        "workflowError:error",
      ]);
    });

    it("leaves the stream to the run already writing the paper, which the wait follows", async () => {
      mockHookConflict(
        { returnValue: Promise.resolve(null), runId: "paper-writer" },
        { tokens: /^mock-paper:/u },
      );

      plan([paper(DAY_1, { later: false })]);

      await mockSupplyWorkflow(waitedRequest());

      expect(streamedSteps(DAY_1)).toStrictEqual([]);
      expect(writeMockQuestions).toHaveBeenCalledOnce();
    });

    it("streams each paper separately when a system run writes ahead", async () => {
      const alternative = paper(DAY_2, { alternative: true });
      vi.mocked(listExamSupplyGoalsStep).mockResolvedValueOnce([GOAL_ID]);
      plan([paper(SCHEDULED), alternative], [], [alternative], [alternative], [alternative]);

      await mockSupplyWorkflow({ examBlueprintId: null, goalId: GOAL_ID, later: true });

      expect(createHook).toHaveBeenCalledWith({ token: `mock-paper:${GOAL_ID}:${SCHEDULED}` });
      expect(createHook).toHaveBeenCalledWith({ token: `mock-paper:${GOAL_ID}:${DAY_2}` });

      expect(streamedSteps(SCHEDULED)).toStrictEqual([
        "writeMockQuestions:started",
        "writeMockQuestions:completed",
        "mockPaperReady:completed",
      ]);

      expect(streamedSteps(DAY_2)).toStrictEqual([
        "writeMockQuestions:started",
        "writeMockQuestions:completed",
        "workflowError:error",
      ]);
    });
  });
});
