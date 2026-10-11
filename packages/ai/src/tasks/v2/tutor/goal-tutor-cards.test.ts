import { type ModelMessage } from "ai";
import { describe, expect, it, vi } from "vitest";
import {
  type GoalTutorAppToolRequest,
  type GoalTutorAppToolResult,
  type GoalTutorPlanChangeResult,
  createCardTools,
} from "./goal-tutor-cards";

const QUESTION: ModelMessage = {
  content: "quero treinar falando e quero aulas de SQL",
  role: "user",
};

const FIRST_STEP = [QUESTION];

/** The next step's conversation: the first one with its calls and their results. */
const SECOND_STEP: ModelMessage[] = [
  QUESTION,
  { content: [], role: "assistant" },
  { content: [], role: "tool" },
];

const CALL: GoalTutorAppToolRequest = {
  area: null,
  goal: null,
  tool: "conversationCall",
  topic: null,
};

const OFFERED: GoalTutorAppToolResult = {
  offered: { minutes: [1, 2] },
  status: "offered",
  tool: "conversationCall",
};

const PROPOSED: GoalTutorPlanChangeResult = {
  cautions: [],
  changes: "SQL, dashboards and stakeholders come into the plan",
  effect: null,
  leftOut: [],
  officialExamDate: null,
  status: "proposed",
};

function setup(change: GoalTutorPlanChangeResult = PROPOSED) {
  const offerAppTool = vi.fn(async () => OFFERED);
  const proposePlanChange = vi.fn(async () => change);
  const tools = createCardTools({ offerAppTool, proposePlanChange });

  /** The model asks for a plan change in a step: the SDK announces it before any call runs. */
  const askChange = ({ messages, toolCallId }: { messages: ModelMessage[]; toolCallId: string }) =>
    tools.proposePlanChange.onInputAvailable?.({
      context: {},
      input: { request: "add SQL lessons" },
      messages,
      toolCallId,
    });

  const runChange = ({ messages, toolCallId }: { messages: ModelMessage[]; toolCallId: string }) =>
    tools.proposePlanChange.execute?.(
      { request: "add SQL lessons" },
      { context: {}, messages, toolCallId },
    );

  const runOffer = ({ messages, toolCallId }: { messages: ModelMessage[]; toolCallId: string }) =>
    tools.offerAppTool.execute?.(CALL, { context: {}, messages, toolCallId });

  return { askChange, offerAppTool, proposePlanChange, runChange, runOffer };
}

describe("one card per message", () => {
  // Marcos asked for a speaking call and for SQL lessons in one message: the call's card won.
  it("gives the card to a plan change asked for in the same step, even when the feature runs first", async () => {
    const { askChange, offerAppTool, runChange, runOffer } = setup();
    await askChange({ messages: FIRST_STEP, toolCallId: "change" });

    const [offer, change] = await Promise.all([
      runOffer({ messages: FIRST_STEP, toolCallId: "call" }),
      runChange({ messages: FIRST_STEP, toolCallId: "change" }),
    ]);

    expect(offer).toStrictEqual({
      reason: "changeFirst",
      status: "unavailable",
      tool: "conversationCall",
    });

    expect(change).toStrictEqual(PROPOSED);
    expect(offerAppTool).not.toHaveBeenCalled();
  });

  it("turns away a feature after a plan change in the same step showed its card", async () => {
    const { askChange, offerAppTool, runChange, runOffer } = setup();
    await askChange({ messages: FIRST_STEP, toolCallId: "change" });

    const [change, offer] = await Promise.all([
      runChange({ messages: FIRST_STEP, toolCallId: "change" }),
      runOffer({ messages: FIRST_STEP, toolCallId: "call" }),
    ]);

    expect(change).toStrictEqual(PROPOSED);

    expect(offer).toStrictEqual({
      reason: "onePerMessage",
      status: "unavailable",
      tool: "conversationCall",
    });

    expect(offerAppTool).not.toHaveBeenCalled();
  });

  it("shows the feature when the plan change it waited for shows no card", async () => {
    const { askChange, offerAppTool, runChange, runOffer } = setup({ status: "notUnderstood" });
    await askChange({ messages: FIRST_STEP, toolCallId: "change" });

    const [waited] = await Promise.all([
      runOffer({ messages: FIRST_STEP, toolCallId: "call" }),
      runChange({ messages: FIRST_STEP, toolCallId: "change" }),
    ]);

    expect(waited).toMatchObject({ reason: "changeFirst" });

    // The model offers it again in its next step, and the card is free.
    await expect(runOffer({ messages: SECOND_STEP, toolCallId: "call-again" })).resolves.toBe(
      OFFERED,
    );

    expect(offerAppTool).toHaveBeenCalledOnce();
  });

  it("keeps a feature's card when a plan change comes only in a later step", async () => {
    const { askChange, proposePlanChange, runChange, runOffer } = setup();

    await expect(runOffer({ messages: FIRST_STEP, toolCallId: "call" })).resolves.toBe(OFFERED);

    await askChange({ messages: SECOND_STEP, toolCallId: "change" });

    await expect(runChange({ messages: SECOND_STEP, toolCallId: "change" })).resolves.toStrictEqual(
      { reason: "onePerMessage", status: "notPossible" },
    );

    expect(proposePlanChange).not.toHaveBeenCalled();
  });

  it("shows one feature when a step offers two", async () => {
    const { offerAppTool, runOffer } = setup();

    const [first, second] = await Promise.all([
      runOffer({ messages: FIRST_STEP, toolCallId: "call" }),
      runOffer({ messages: FIRST_STEP, toolCallId: "call-2" }),
    ]);

    expect(first).toBe(OFFERED);
    expect(second).toMatchObject({ reason: "onePerMessage" });
    expect(offerAppTool).toHaveBeenCalledOnce();
  });
});
