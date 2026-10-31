import { MOCK_SCORINGS } from "@zoonk/core/exams/mocks/contract";
import { EXAM_SCALES } from "@zoonk/core/exams/scales";
import { z } from "zod";

export const examScoringSchema = z.object({
  method: z.enum(MOCK_SCORINGS).meta({ description: "How the exam's mocks score it" }),
  note: z.string().nullable(),
  noticeScale: z
    .object({
      max: z.number(),
      min: z.number(),
      name: z.string().nullable(),
      passScore: z.number().nullable(),
    })
    .nullable()
    .meta({
      description:
        "The scale the notice says the exam reports its score on (EXANI-II's 700 to 1300), with the score that passes on it; null when it states none",
    }),
  rule: z
    .enum(["irt", "net", "raw"])
    .nullable()
    .meta({
      description:
        "The notice's rule that changes how to answer: item response theory, wrong answers costing points (`wrongPenalty`), or each right answer a point; null when the notice doesn't say",
    }),
  scale: z
    .enum(EXAM_SCALES)
    .nullable()
    .meta({ description: "The exam's own scale, which estimates and results use" }),
  stated: z
    .boolean()
    .meta({
      description:
        "The notice says how the exam is scored. False when `method` is the mocks' default (a class test from the learner's material, a notice that doesn't say): don't give advice from it",
    }),
  wrongPenalty: z
    .number()
    .min(0)
    .max(1)
    .meta({
      description:
        "The share of a right answer each wrong one takes away (1: a wrong answer cancels a right one; 0.25: JEE's -1 against +4); 0 when wrong answers cost nothing. Answering pays above penalty / (1 + penalty) sure",
    }),
});
