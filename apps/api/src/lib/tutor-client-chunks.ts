import {
  LESSON_QUESTION_PLAN_CHANGE_PART,
  LESSON_QUESTION_REPLACED_CHANGES_PART,
  LESSON_QUESTION_TOOL_OFFER_PART,
} from "@zoonk/core/lesson-questions/contract";
import { type TutorAnswerRun } from "@zoonk/core/lesson-questions/tutor-answer";
import { createEmDashReplacer } from "@zoonk/utils/string";
import { type UIMessageChunk } from "ai";

const STEP_BREAK = "\n\n";
const PROPOSE_PLAN_CHANGE_TOOL = "proposePlanChange";
const OFFER_APP_TOOL = "offerAppTool";

type SentParts = { offers: number; proposals: number };

function toToolParts({
  run,
  sent,
  toolName,
}: {
  run: TutorAnswerRun;
  sent: SentParts;
  toolName: string | undefined;
}): UIMessageChunk[] {
  if (toolName === PROPOSE_PLAN_CHANGE_TOOL) {
    const proposal = run.proposals[sent.proposals];

    if (!proposal) {
      return [];
    }

    sent.proposals += 1;

    const replaced: UIMessageChunk = {
      data: { ids: proposal.replaced },
      type: LESSON_QUESTION_REPLACED_CHANGES_PART,
    };

    return [
      { data: proposal.change, type: LESSON_QUESTION_PLAN_CHANGE_PART },
      ...(proposal.replaced.length > 0 ? [replaced] : []),
    ];
  }

  if (toolName === OFFER_APP_TOOL) {
    const offer = run.offers[sent.offers];
    sent.offers += offer ? 1 : 0;
    return offer ? [{ data: offer, type: LESSON_QUESTION_TOOL_OFFER_PART }] : [];
  }

  return [];
}

/**
 * Tool calls stay on the server: only a proposed plan change or an offered app tool reaches the
 * client, as one data part each.
 */
export function toClientChunks(run: TutorAnswerRun) {
  const text = { pendingBreak: false, written: false };
  const toolNames = new Map<string, string>();
  const replacers = new Map<string, ReturnType<typeof createEmDashReplacer>>();
  const sent: SentParts = { offers: 0, proposals: 0 };

  return new TransformStream<UIMessageChunk, UIMessageChunk>({
    transform(chunk, controller) {
      if (chunk.type === "tool-input-available") {
        toolNames.set(chunk.toolCallId, chunk.toolName);
        return;
      }

      if (chunk.type === "tool-output-available") {
        toToolParts({ run, sent, toolName: toolNames.get(chunk.toolCallId) }).forEach((part) =>
          controller.enqueue(part),
        );

        return;
      }

      if (chunk.type.startsWith("tool-")) {
        return;
      }

      if (chunk.type === "text-start") {
        text.pendingBreak = text.written;
        replacers.set(chunk.id, createEmDashReplacer());
      }

      if (chunk.type === "text-delta" && chunk.delta) {
        if (text.pendingBreak) {
          controller.enqueue({ delta: STEP_BREAK, id: chunk.id, type: "text-delta" });
          text.pendingBreak = false;
        }

        text.written = true;
        const delta = replacers.get(chunk.id)?.push(chunk.delta) ?? chunk.delta;

        if (delta) {
          controller.enqueue({ ...chunk, delta });
        }

        return;
      }

      if (chunk.type === "text-end") {
        const rest = replacers.get(chunk.id)?.end();
        replacers.delete(chunk.id);

        if (rest) {
          controller.enqueue({ delta: rest, id: chunk.id, type: "text-delta" });
        }
      }

      controller.enqueue(chunk);
    },
  });
}
