import { lessonVisualSchema } from "@zoonk/ai/tasks/v2/visuals/schema";
import { z } from "zod";
import { exploreActivitySchema } from "../../activities/activity-templates";
import {
  choiceOptionSchema,
  choiceOptionsSchema,
  explanationSchema,
  idSchema,
  languageCodeSchema,
  optionTextSchema,
  pictureRequestSchema,
  promptSchema,
  richTextSchema,
  stepImageRequestSchema,
} from "./content-schemas";

const MAX_WORKED_STEPS = 8;
const MAX_KEY_POINTS = 5;
const MAX_SUMMARY_IDEAS = 5;
const MAX_MATH_LENGTH = 300;

const mathSchema = z.string().min(1).max(MAX_MATH_LENGTH);

const visualSchema = lessonVisualSchema.optional();

export const hookContentSchema = z.discriminatedUnion("variant", [
  z
    .object({
      image: stepImageRequestSchema.optional(),
      options: choiceOptionsSchema(
        z.object({ id: idSchema, isCorrect: z.boolean(), text: optionTextSchema }).strict(),
      ),
      question: promptSchema,
      reveal: explanationSchema,
      variant: z.literal("guess"),
      visual: visualSchema,
    })
    .strict(),
  z
    .object({
      image: stepImageRequestSchema.optional(),
      text: richTextSchema,
      variant: z.literal("text"),
      visual: visualSchema,
    })
    .strict(),
]);

export const explanationContentSchema = z
  .object({
    exampleLineSlot: z.object({ idea: explanationSchema }).strict().optional(),
    explore: exploreActivitySchema.optional(),
    image: stepImageRequestSchema.optional(),
    text: richTextSchema,
    title: promptSchema.optional(),
    visual: visualSchema,
  })
  .strict();

export const workedExampleContentSchema = z
  .object({
    image: stepImageRequestSchema.optional(),
    problem: richTextSchema,
    result: explanationSchema,
    steps: z
      .array(z.object({ math: mathSchema.optional(), text: explanationSchema }).strict())
      .min(2)
      .max(MAX_WORKED_STEPS),
    title: promptSchema.optional(),
    visual: visualSchema,
  })
  .strict();

const questionBasisSchema = z
  .object({ position: z.number().int().min(0), quote: explanationSchema })
  .strict();

const MAX_PICTURE_OPTIONS = 4;

const checkOptionSchema = choiceOptionSchema
  .extend({ picture: pictureRequestSchema.optional() })
  .strict();

type CheckOption = z.infer<typeof checkOptionSchema>;

function pictureOptionsIssue(content: {
  image?: unknown;
  options: readonly CheckOption[];
  visual?: unknown;
}): string | null {
  const pictured = content.options.filter((option) => option.picture).length;

  if (pictured === 0) {
    return null;
  }

  if (pictured !== content.options.length) {
    return "Give every option a picture, or none";
  }

  if (pictured > MAX_PICTURE_OPTIONS) {
    return `A question shows at most ${String(MAX_PICTURE_OPTIONS)} pictures`;
  }

  if (content.options.some((option) => namesItself(option))) {
    return "A picture's description says what it looks like without naming the option";
  }

  return content.image || content.visual
    ? "A question whose options are pictures has no other picture or visual"
    : null;
}

function namesItself(option: CheckOption): boolean {
  const name = option.text.trim().toLocaleLowerCase();
  return name.length > 2 && (option.picture?.alt.toLocaleLowerCase().includes(name) ?? false);
}

function numberedOptionsIssue(content: {
  image?: { parts?: readonly string[] };
  options: readonly CheckOption[];
}): string | null {
  const count = content.image?.parts?.length;

  if (!count) {
    return null;
  }

  const marksNothing = content.options.some((option) => {
    const number = Number(option.text);
    return Number.isInteger(number) && (number < 1 || number > count);
  });

  return marksNothing
    ? `The picture numbers ${String(count)} parts, so a number option is one of 1 to ${String(count)}`
    : null;
}

export const checkContentSchema = z
  .object({
    basis: questionBasisSchema.nullable(),
    context: richTextSchema.optional(),
    image: stepImageRequestSchema.optional(),
    options: choiceOptionsSchema(checkOptionSchema),
    question: promptSchema,
    visual: visualSchema,
  })
  .strict()
  .superRefine((content, context) => {
    for (const issue of [pictureOptionsIssue(content), numberedOptionsIssue(content)]) {
      if (issue) {
        context.addIssue({ code: "custom", message: issue, path: ["options"] });
      }
    }
  });

export const typedAnswerContentSchema = z
  .object({
    acceptedAnswers: z.array(optionTextSchema).max(MAX_KEY_POINTS).optional(),
    basis: questionBasisSchema.nullable(),
    context: richTextSchema.optional(),
    keyPoints: z.array(explanationSchema).min(1).max(MAX_KEY_POINTS),
    question: promptSchema,
    sampleAnswer: richTextSchema,
    visual: visualSchema,
  })
  .strict();

export const spokenAnswerContentSchema = z
  .object({
    language: languageCodeSchema,
    prompt: promptSchema,
    romanization: optionTextSchema.optional(),
    targetText: optionTextSchema,
    translation: optionTextSchema.optional(),
  })
  .strict();

export const summaryContentSchema = z
  .object({
    ideas: z
      .array(z.object({ text: explanationSchema }).strict())
      .min(1)
      .max(MAX_SUMMARY_IDEAS),
  })
  .strict();
