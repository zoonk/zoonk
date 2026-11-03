import { type SpeakingMockExam } from "@zoonk/ai/tasks/language/exam-speaking-exams";
import { z } from "zod";
import { SPEAKING_MOCK_CRITERIA, SPEAKING_MOCK_SCALES } from "./speaking-mock-format";

export const callFeedbackSchema = z
  .object({
    encouragement: z.string(),
    improve: z
      .object({ better: z.string(), said: z.string(), why: z.string() })
      .nullable()
      .meta({ description: "The one thing to fix, with what the learner said and a better way" }),
    kind: z.literal("call"),
    pronunciation: z
      .array(z.object({ respelling: z.string(), tip: z.string(), word: z.string() }))
      .meta({ description: "At most two words the learner said that are often hard to say" }),
    wentWell: z.array(z.string()).meta({ description: "Phrases the learner said well" }),
  })
  .meta({ id: "LanguageCallFeedback" });

const HALF_BAND = 0.5;

function speakingMockFeedbackFor<const TExam extends SpeakingMockExam>(exam: TExam) {
  const { halfBands, maxBand, minBand } = SPEAKING_MOCK_SCALES[exam];
  const step = halfBands ? HALF_BAND : 1;
  const band = z.number().min(minBand).max(maxBand).multipleOf(step);
  const criterion = z.enum(SPEAKING_MOCK_CRITERIA[exam]);

  return z.object({
    criteria: z.array(
      z.object({ bandHigh: band, bandLow: band, criterion, evidence: z.string(), tip: z.string() }),
    ),
    exam: z.literal(exam),
    focus: criterion,
    kind: z.literal("speakingMock"),
    overall: z
      .object({ bandHigh: band, bandLow: band })
      .meta({ description: "Estimated band range, never an official score" }),
  });
}

export const speakingMockFeedbackSchema = z
  .discriminatedUnion("exam", [
    speakingMockFeedbackFor("ielts").meta({
      description: "IELTS Speaking: four criteria on the 0 to 9 band scale",
      id: "LanguageIeltsSpeakingMockFeedback",
    }),
    speakingMockFeedbackFor("toefl").meta({
      description:
        "TOEFL iBT Speaking: Listen and Repeat accuracy and four interview criteria on the 1 to 6 band scale",
      id: "LanguageToeflSpeakingMockFeedback",
    }),
  ])
  .meta({ id: "LanguageSpeakingMockFeedback" });
