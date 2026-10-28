import { type LessonQuestionPriorTurn } from "../../lessons/lesson-question";
import { type PlanScopeContext } from "../../lessons/lesson-question-context";
import { type GoalTutorLinks, stringifyWithLinks } from "./goal-tutor-pages";

/**
 * Memory follows the learner's message, so OpenAI's cache would stop before it: marking the message
 * lets the next one read the conversation up to it from the cache. Other providers ignore the mark.
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

/**
 * Whether its Library text is public is the search's to know (`privateContent`), never the model's.
 */
function createContextMessage({
  contextSnapshot,
  links,
}: {
  contextSnapshot: PlanScopeContext;
  links: GoalTutorLinks;
}) {
  const { privateContent: _privateContent, ...context } = contextSnapshot;

  return textMessage({
    role: "user",
    text: [
      "<CURRENT_CONTEXT>",
      stringifyWithLinks(context, links.toLink),
      "</CURRENT_CONTEXT>",
    ].join("\n"),
  });
}

/**
 * Picked for each message, so it comes last: the history only ever repeats what comes before it.
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
 * Ordered for the providers' prompt caches, which reuse the longest shared prefix: the goal's
 * context, which stays the same until the plan changes, then the conversation, which only grows,
 * then what's new in this message.
 */
export function createGoalTutorMessages({
  contextSnapshot,
  learnerMemory,
  links,
  priorTurns,
  question,
}: {
  contextSnapshot: PlanScopeContext;
  learnerMemory?: readonly string[];
  links: GoalTutorLinks;
  priorTurns: readonly LessonQuestionPriorTurn[];
  question: string;
}) {
  return [
    createContextMessage({ contextSnapshot, links }),
    ...toHistoryMessages(priorTurns),
    learnerMessage({ breakpoint: true, question }),
    ...createMemoryMessages(learnerMemory),
  ];
}

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
