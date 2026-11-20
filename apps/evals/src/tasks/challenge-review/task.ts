import { type Task } from "@/lib/types";
import { type WrittenChallengeCase } from "@zoonk/ai/tasks/challenge/schema";
import { checkChallengeQuality } from "@zoonk/ai/tasks/quality/challenge-quality-check";
import { checkWrittenChallenge } from "@zoonk/core/library/challenges/case-content";
import { renderChallengeMap } from "@zoonk/core/library/challenges/render";
import { type CourseLevel } from "@zoonk/db";
import cases from "./cases.json";

type ReviewInput = {
  written: WrittenChallengeCase;
  language: string;
  level: CourseLevel;
  field: string | null;
  writerModel: string;
};

export const challengeReviewTask: Task<
  ReviewInput,
  Awaited<ReturnType<typeof checkChallengeQuality>>["data"]
> = {
  criteria: [
    {
      expectations:
        "Every confirmed error in the case is found, with a concrete location, path and evidence a fixer can act on. Notice a missed error, or one named so vaguely a fixer couldn't find it. Cost: a flawed challenge reaches every learner who plays it.",
      id: "catchesErrors",
      label: "Catches the real errors",
    },
    {
      expectations:
        "Findings are only real errors: no style preferences, missing detail, hypothetical risks or defensible choices, and a clean case gets no findings. Notice a finding the case doesn't support. Cost: a needless fix call that can make a good challenge worse.",
      id: "noFalseFlags",
      label: "No false flags",
    },
  ],
  description:
    "Errors-only review of saved challenges: 19 confirmed errors and 12 clean controls from the review lane, including six route errors missed by its original labels",
  generate: async ({ written, language, level, field, writerModel, ...options }) => {
    const checked = checkWrittenChallenge({
      variant: written.deadline === null ? "whatIf" : "work",
      written,
    });

    if (!checked.content) {
      throw new Error(checked.problems.join(" "));
    }

    return checkChallengeQuality({
      ...options,
      field,
      language,
      level,
      renderedCase: renderChallengeMap({ ...checked.content, summary: written.summary }).text,
      skills: written.skills,
      writerModels: [writerModel],
    });
  },
  id: "challenge-review",
  name: "Challenge review",
  priorities: {
    comparison: {
      criteria: { catchesErrors: "counts", noFalseFlags: "counts" },
      preference: "canBlock",
      trade: null,
    },
    distribution: "shared",
    first: "quality",
    reads: "Code: its findings decide whether to fix or hold back the case",
    reason: "A missed flaw reaches every learner; a false flag costs a fix call",
    waits: "Set by the lesson's wait",
  },
  testCases: cases.map((saved) => ({
    expectations:
      saved.errors.length > 0
        ? `The reviewer must identify these confirmed errors with a concrete location, path and evidence: ${saved.errors.join("; ")}. Score missed errors down. Do not reward stylistic findings or claims unsupported by the case. Other findings count only if demonstrably correct.`
        : "This case is a hand-checked clean control. Return an empty findings array. Style, missing detail, hypothetical risk and defensible choices are not errors.",
    id: saved.id,
    language: saved.language,
    userInput: {
      field: saved.field,
      language: saved.language,
      level: saved.level as CourseLevel,
      writerModel: saved.writerModel,
      written: saved.written as WrittenChallengeCase,
    },
  })),
};
