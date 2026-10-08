import { type GoalTutorAppToolResult } from "@zoonk/ai/tasks/v2/tutor/goal-tutor";
import { type GoalTutorAppTool } from "@zoonk/ai/tasks/v2/tutor/goal-tutor-tools";
import { type TutorToolOffer } from "@zoonk/core/lesson-questions/contract";
import { type offerTutorTool } from "@zoonk/core/lesson-questions/offer-tool";

type OfferedDetails = Extract<GoalTutorAppToolResult, { status: "offered" }>["offered"];

/** What the card opens, in the few facts the buddy says about it; the learner sees the card. */
function describeOffer(offer: TutorToolOffer): OfferedDetails {
  switch (offer.kind) {
    case "startGoal":
      return offer.course ? { course: offer.course.title } : {};
    case "chapterTest":
      return { chapter: offer.chapterTitle, lessonsLeft: offer.lessonsLeft };
    case "mockExam":
      return { subjects: offer.subjects };
    case "essay":
      return { cadence: offer.cadence, subject: offer.subject };
    case "mistakes":
      return { mistakes: offer.open };
    case "conversationCall":
      return offer.call.limit
        ? { callTimeUsed: offer.call.limit.period, unit: offer.unitTitle }
        : { minutes: offer.call.minutes, unit: offer.unitTitle };
    case "pronunciation":
      return { words: offer.words };
    case "plus":
      return { subscribed: offer.subscribed };
    case "chooseFocus":
    case "stats":
    case "logbook":
    case "memory":
      return {};
    default:
      return offer satisfies never;
  }
}

/** A feature the learner's plan doesn't include: its card shows it locked, never hidden. */
function isLocked(offer: TutorToolOffer): boolean {
  return "access" in offer && offer.access === "plusRequired";
}

/** What the model reads back after offering a feature; the learner sees its card instead. */
export function toAppToolResult({
  result,
  tool,
}: {
  result: Awaited<ReturnType<typeof offerTutorTool>>;
  tool: GoalTutorAppTool;
}): GoalTutorAppToolResult {
  if (result.status !== "offered") {
    return {
      reason: result.status === "unavailable" ? result.reason : "unavailable",
      status: "unavailable",
      tool,
    };
  }

  const offered = describeOffer(result.offer);

  return isLocked(result.offer)
    ? { offered, plusRequired: true, status: "offered", tool }
    : { offered, status: "offered", tool };
}
