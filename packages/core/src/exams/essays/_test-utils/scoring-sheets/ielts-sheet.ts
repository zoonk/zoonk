import { type WritingSheet } from "../../../../library/exams/written-grading";
import { from } from "./cite";

const bands = from("ielts-band-descriptors");

function ieltsBands(
  texts: readonly [string, string, string, string, string, string, string, string, string],
) {
  return [
    bands("Did not attempt the task, or wrote a wholly memorised response.", { points: 0 }),
    ...texts.map((text, index) => bands(text, { points: index + 1 })),
  ];
}

export const IELTS_GRADING: WritingSheet = {
  combination: from("ielts-scoring")(
    "The four criteria count equally; the mark is their mean, reported in whole and half bands.",
    { method: "mean" as const, step: 0.5 },
  ),
  criteria: [
    bands("Task response", {
      awards: ieltsBands([
        "The answer is completely unrelated to the task.",
        "Barely responds to the task; no position; one or two ideas with no development.",
        "Does not adequately address any part of the task; no clear position; few ideas, largely undeveloped or irrelevant.",
        "Responds only minimally or on a tangent; the position is unclear; main ideas are hard to identify, repetitive or unsupported.",
        "Addresses the task only partly; states a position without always developing it; main ideas are limited and may include irrelevant detail.",
        "Addresses all parts, some more fully than others; a relevant position, though conclusions may be unclear or repetitive; some main ideas are underdeveloped.",
        "Addresses all parts; a clear position throughout; main ideas are extended and supported, though it may over-generalise or lose focus.",
        "Sufficiently addresses all parts; a well-developed response with relevant, extended and supported ideas.",
        "Fully addresses all parts; a fully developed position with relevant, fully extended and well-supported ideas.",
      ]),
      id: "task-response",
      points: 9,
    }),
    bands("Coherence and cohesion", {
      awards: ieltsBands([
        "Fails to communicate any message.",
        "Very little control of organisational features.",
        "Does not organise ideas logically; a very limited range of cohesive devices, which may not show how ideas relate.",
        "Information and ideas are not arranged coherently and do not progress; basic cohesive devices, inaccurate or repetitive; paragraphing absent or confusing.",
        "Some organisation, without overall progression; cohesive devices are inadequate, inaccurate or overused; paragraphing absent or inadequate.",
        "Arranged coherently with clear overall progression; cohesive devices work, though cohesion can be faulty or mechanical; paragraphing is not always logical.",
        "Logically organised with clear progression throughout; a range of cohesive devices, with some under- or over-use; each paragraph has a clear central topic.",
        "Sequences information and ideas logically; manages all aspects of cohesion well; paragraphing is sufficient and appropriate.",
        "Cohesion attracts no attention; paragraphing is handled skilfully.",
      ]),
      id: "coherence-cohesion",
      points: 9,
    }),
    bands("Lexical resource", {
      awards: ieltsBands([
        "Only a few isolated words.",
        "An extremely limited range of vocabulary; essentially no control of word formation or spelling.",
        "A very limited range of words and expressions with very limited control; errors may severely distort the message.",
        "Only basic vocabulary, repeated or inappropriate for the task; limited control of word formation and spelling; errors may strain the reader.",
        "A limited range, minimally adequate for the task; noticeable errors in spelling and word formation that may cause some difficulty.",
        "An adequate range for the task; attempts less common vocabulary with some inaccuracy; errors in spelling and word formation do not impede communication.",
        "A sufficient range for some flexibility and precision; less common items with awareness of style and collocation; occasional errors in word choice, spelling or word formation.",
        "A wide range used fluently and flexibly for precise meanings; uncommon items used skilfully, with occasional inaccuracies; rare spelling errors.",
        "A wide range with very natural and sophisticated control; rare minor errors occur only as slips.",
      ]),
      id: "lexical-resource",
      points: 9,
    }),
    bands("Grammatical range and accuracy", {
      awards: ieltsBands([
        "Cannot use sentence forms at all.",
        "Cannot use sentence forms except in memorised phrases.",
        "Attempts sentence forms, but errors in grammar and punctuation predominate and distort meaning.",
        "A very limited range of structures with rare subordinate clauses; some structures are accurate, but errors predominate; punctuation is often faulty.",
        "A limited range of structures; complex sentences are attempted but less accurate than simple ones; frequent grammatical errors and faulty punctuation.",
        "A mix of simple and complex sentence forms; some errors in grammar and punctuation, which rarely reduce communication.",
        "A variety of complex structures; frequent error-free sentences; good control of grammar and punctuation, with a few errors.",
        "A wide range of structures; most sentences are error-free, with only very occasional errors.",
        "A wide range of structures with full flexibility and accuracy; rare minor errors occur only as slips.",
      ]),
      id: "grammar",
      points: 9,
    }),
  ],
  language: null,
  rounding: null,
  zeroing: [],
};
