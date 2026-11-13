import { type Task } from "@/lib/types";
import { type ChallengeEdit, fixChallengeCase } from "@zoonk/ai/tasks/challenge/fix";
import { type WrittenChallengeCase } from "@zoonk/ai/tasks/challenge/schema";
import { type ChallengeFinding } from "@zoonk/ai/tasks/quality/challenge-quality-check";
import { checkWrittenChallenge } from "@zoonk/core/library/challenges/case-content";
import { applyChallengeEdits } from "@zoonk/core/library/challenges/edits";
import cases from "./cases.json";

type FixInput = { findings: ChallengeFinding[]; written: WrittenChallengeCase };

type Label = { evidence: string; label: string };

function describeLabels(labels: Label[]): string {
  return labels
    .map(({ evidence, label }, index) =>
      label === "real"
        ? `Finding ${index + 1} is a confirmed error (${evidence}): the edits must make those words true on every route that reaches them.`
        : `Finding ${index + 1} is wrong (${evidence}): leaving that part as it is, or a harmless rewording, is right; an edit that makes the case wrong there fails the case.`,
    )
    .join("\n");
}

export const challengeFixTask: Task<FixInput, { edits: ChallengeEdit[] }> = {
  description:
    "Fix what a reviewer found in a held challenge with find/replace edits: the 15 drafts the trade-off lane fixed, with hand labels for each finding",
  generate: async ({ findings, written, ...options }) => {
    const result = await fixChallengeCase({ ...options, findings, written });
    const fixed = applyChallengeEdits({ edits: result.data.edits, written });

    if (!fixed) {
      throw new Error("An edit's text doesn't occur exactly once in the case");
    }

    const checked = checkWrittenChallenge({
      variant: written.deadline === null ? "whatIf" : "work",
      written: fixed,
    });

    if (!checked.content) {
      throw new Error(checked.problems.join(" "));
    }

    return result;
  },
  id: "challenge-fix",
  name: "Challenge Fix",
  testCases: cases.map((saved) => ({
    expectations: `${describeLabels(saved.labels)}
Every other word of the case stays as it was: ids, structure, meters, correct numbers, tone and language. Any new error an edit introduces on any route fails the case.`,
    id: saved.id,
    language: saved.language,
    userInput: { findings: saved.findings, written: saved.written as WrittenChallengeCase },
  })),
};
