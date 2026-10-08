import { describe, expect, it } from "vitest";
import { type PlanScopeContext } from "../../lessons/lesson-question-context";
import { createGoalTutorMessages, serializeGoalTutorMessages } from "./goal-tutor-messages";

const CONTEXT = {
  goal: { dailyMinutes: 30, kind: "exam", target: null, targetDate: "2026-11-08", title: "ENEM" },
  language: "pt",
  scope: { kind: "plan" },
  version: 1,
} as PlanScopeContext;

const FIRST = "o que é quórum de maioria absoluta?";
const SECOND = "e maioria simples?";
const MEMORY = ["Trabalha como advogada"];

function texts(messages: ReturnType<typeof createGoalTutorMessages>) {
  return messages.map(({ content, role }) => ({ role, text: content.map((part) => part.text) }));
}

describe(createGoalTutorMessages, () => {
  it("sends the context first, then the conversation, the learner's message and its memory", () => {
    const messages = createGoalTutorMessages({
      contextSnapshot: CONTEXT,
      learnerMemory: MEMORY,
      priorTurns: [{ answer: "Mais da metade dos membros.", question: FIRST }],
      question: SECOND,
    });

    expect(texts(messages)).toStrictEqual([
      { role: "user", text: [`<CURRENT_CONTEXT>\n${JSON.stringify(CONTEXT)}\n</CURRENT_CONTEXT>`] },
      { role: "user", text: [`<LEARNER_MESSAGE>\n${FIRST}\n</LEARNER_MESSAGE>`] },
      { role: "assistant", text: ["Mais da metade dos membros."] },
      { role: "user", text: [`<LEARNER_MESSAGE>\n${SECOND}\n</LEARNER_MESSAGE>`] },
      { role: "user", text: ["<LEARNER_MEMORY>\n- Trabalha como advogada\n</LEARNER_MEMORY>"] },
    ]);
  });

  it("repeats every message before the newest one word for word, so the next request reads them from the cache", () => {
    const first = createGoalTutorMessages({
      contextSnapshot: CONTEXT,
      learnerMemory: MEMORY,
      priorTurns: [],
      question: FIRST,
    });

    const next = createGoalTutorMessages({
      contextSnapshot: CONTEXT,
      learnerMemory: ["Estuda à noite"],
      priorTurns: [{ answer: "Mais da metade dos membros.", question: FIRST }],
      question: SECOND,
    });

    // Everything up to the first learner message, memory aside, is the next request's prefix.
    expect(texts(next).slice(0, 2)).toStrictEqual(texts(first).slice(0, 2));
  });

  it("marks the learner's newest message as a cache breakpoint and nothing else", () => {
    const messages = createGoalTutorMessages({
      contextSnapshot: CONTEXT,
      learnerMemory: MEMORY,
      priorTurns: [{ answer: "Mais da metade dos membros.", question: FIRST }],
      question: SECOND,
    });

    const marked = messages.flatMap(({ content }, index) =>
      content.some((part) => "providerOptions" in part) ? [index] : [],
    );

    expect(marked).toStrictEqual([3]);
  });

  it("leaves memory out when there is none", () => {
    const messages = createGoalTutorMessages({
      contextSnapshot: CONTEXT,
      learnerMemory: [],
      priorTurns: [],
      question: FIRST,
    });

    expect(serializeGoalTutorMessages(messages)).toBe(
      `USER:\n<CURRENT_CONTEXT>\n${JSON.stringify(CONTEXT)}\n</CURRENT_CONTEXT>\n\nUSER:\n<LEARNER_MESSAGE>\n${FIRST}\n</LEARNER_MESSAGE>`,
    );
  });
});
