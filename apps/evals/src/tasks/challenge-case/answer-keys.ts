import { answerKeyEvidence } from "@/lib/answer-key-evidence";
import { type WrittenChallengeCase } from "@zoonk/ai/tasks/challenge/schema";

export function challengeAnswerKeys(written: WrittenChallengeCase) {
  return answerKeyEvidence((label) => ({
    ...written,
    nodes: written.nodes.map((node, index) => label(node, `nodes[${index}]`)),
  }));
}
