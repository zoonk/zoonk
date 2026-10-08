import { type LessonQuestionPriorTurn } from "../../lessons/lesson-question";
import { type PlanScopeContext } from "../../lessons/lesson-question-context";

/**
 * OpenAI caches a prompt up to its latest message on its own. Memory follows the learner's
 * message, so the message itself is marked too: the next message then reads the conversation up
 * to it from the cache. Other providers ignore the mark.
 */
const CACHE_BREAKPOINT = { openai: { promptCacheBreakpoint: { mode: "explicit" } } } as const;

function textMessage({
  breakpoint = false,
  role,
  text,
}: {
  breakpoint?: boolean;
  role: "assistant" | "user";
  text: string;
}) {
  return {
    content: [
      { text, type: "text" as const, ...(breakpoint ? { providerOptions: CACHE_BREAKPOINT } : {}) },
    ],
    role,
  };
}

/** A learner's message reads the same in the history as when it was the latest one. */
function learnerMessage({ breakpoint, question }: { breakpoint?: boolean; question: string }) {
  return textMessage({
    breakpoint,
    role: "user",
    text: ["<LEARNER_MESSAGE>", question, "</LEARNER_MESSAGE>"].join("\n"),
  });
}

function toHistoryMessages(priorTurns: readonly LessonQuestionPriorTurn[]) {
  return priorTurns.flatMap(({ answer, question }) => [
    learnerMessage({ question }),
    textMessage({ role: "assistant", text: answer }),
  ]);
}

function createContextMessage(contextSnapshot: PlanScopeContext) {
  return textMessage({
    role: "user",
    text: ["<CURRENT_CONTEXT>", JSON.stringify(contextSnapshot), "</CURRENT_CONTEXT>"].join("\n"),
  });
}

/**
 * The memory is picked for each message, so it comes last, after the learner's message: the
 * history only ever repeats what comes before it.
 */
function createMemoryMessages(learnerMemory: readonly string[] | undefined) {
  if (!learnerMemory || learnerMemory.length === 0) {
    return [];
  }

  const facts = learnerMemory.map((fact) => `- ${fact}`);

  return [
    textMessage({
      role: "user",
      text: ["<LEARNER_MEMORY>", ...facts, "</LEARNER_MEMORY>"].join("\n"),
    }),
  ];
}

/**
 * The buddy's messages, ordered for the providers' prompt caches, which reuse the longest prefix a
 * request shares with an earlier one. The instructions and tools every learner's request repeats
 * come before these; then the goal's context, which stays the same message after message until
 * the plan changes; then the conversation, which only grows; and last what's new in this message.
 * A follow-up reads all but its newest turn from the cache, and so does each step after a tool
 * round.
 */
export function createGoalTutorMessages({
  contextSnapshot,
  learnerMemory,
  priorTurns,
  question,
}: {
  contextSnapshot: PlanScopeContext;
  /** Facts the learner shared before, picked for this message. */
  learnerMemory?: readonly string[];
  priorTurns: readonly LessonQuestionPriorTurn[];
  question: string;
}) {
  return [
    createContextMessage(contextSnapshot),
    ...toHistoryMessages(priorTurns),
    learnerMessage({ breakpoint: true, question }),
    ...createMemoryMessages(learnerMemory),
  ];
}

/** The messages as plain text, for evals to show what the model read. */
export function serializeGoalTutorMessages(
  messages: ReturnType<typeof createGoalTutorMessages>,
): string {
  return messages
    .map(({ content, role }) => {
      const text = content.map((part) => part.text).join("\n");
      return `${role.toUpperCase()}:\n${text}`;
    })
    .join("\n\n");
}
