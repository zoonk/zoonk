import { type Task } from "@/lib/types";
import { type WrittenChallengeCase } from "@zoonk/ai/tasks/challenge/case";
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
  description:
    "Errors-only review of saved challenges: 18 confirmed errors and 13 clean controls from the review lane, including five route errors missed by its original labels",
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
  name: "Challenge Review",
  testCases: cases.map((saved) => ({
    expectations:
      saved.errors.length > 0
        ? `The reviewer must identify these confirmed errors with a concrete location, path and evidence: ${saved.errors.join("; ")}. Score missed errors down. Do not reward stylistic findings or claims unsupported by the case. Other findings count only if demonstrably correct.`
        : "This case is a hand-checked clean control. Return an empty findings array. Style, missing detail, hypothetical risk and defensible choices are not errors.",
    id: saved.id,
    language: /[ãõç]/u.test(saved.written.title) ? "pt" : "en",
    userInput: {
      field: saved.field,
      language: saved.language,
      level: saved.level as CourseLevel,
      writerModel: saved.writerModel,
      written: saved.written as WrittenChallengeCase,
    },
  })),
};
