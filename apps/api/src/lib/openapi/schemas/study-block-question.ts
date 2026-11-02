import { z } from "zod";
import {
  itemCitationSchema,
  questionEntrySchema,
  questionImageSchema,
  questionSelectSchema,
  questionUnitSchema,
  questionVisualSchema,
} from "./common";
import { itemSetSchema } from "./item-set";
import { mistakeDrillSchema } from "./mistakes";

const idSchema = z.uuid();

export const studyBlockQuestionSchema = z.object({
  answered: z
    .object({
      blank: z
        .boolean()
        .meta({
          description: "Left blank where a wrong answer cancels a right one: counts as neither",
        }),
      isCorrect: z.boolean(),
    })
    .nullable(),
  capsuleKey: z.string().nullable(),
  citation: itemCitationSchema.meta({
    description: "The passage it quotes, such as an article of law, with its dated source",
  }),
  context: z.string().nullable(),
  drill: mistakeDrillSchema
    .nullable()
    .meta({ description: "A saved mistake's drill, played the way its cause calls for" }),
  entry: questionEntrySchema
    .nullable()
    .meta({ description: "A math problem's answer box; null for other questions" }),
  format: z
    .enum(["multipleChoice", "trueFalse", "matchPairs", "numeric", "order", "typed"])
    .meta({
      description:
        "numeric: a math problem, answered with a number. Its numbers are drawn for this block, so they stay the same on every visit and change in the next block that asks it. order: put `options` in order, answered with `order`. typed: a short answer (a word, a number, a term), answered with `text`",
    }),
  image: questionImageSchema,
  itemId: idSchema,
  left: z.array(z.string()).nullable().meta({ description: "Match pairs: the left column" }),
  mistakeId: idSchema.nullable(),
  options: z
    .array(z.string())
    .nullable()
    .meta({ description: "Multiple choice: the options. Order: the steps, shuffled" }),
  placement: z
    .boolean()
    .meta({
      description:
        "A placement question of the goal's first week: it fine-tunes where the plan starts, is never saved as a mistake, and welcomes `{ dontKnow: true }`",
    }),
  question: z.string(),
  quoted: z
    .boolean()
    .meta({
      description:
        "A real past exam question copied as printed, where its organizer allows it: show `citation` with it before it's answered",
    }),
  right: z.array(z.string()).nullable().meta({ description: "Match pairs: the right column" }),
  select: questionSelectSchema
    .nullable()
    .meta({ description: "Multiple choice: how many options to pick; null otherwise" }),
  set: itemSetSchema
    .nullable()
    .meta({
      description:
        "The passage, case, chart or recording the question shares with the set's other questions, which the block asks back to back; null for a question on its own",
    }),
  skillId: idSchema,
  timeMachine: z
    .object({ answer: z.string().nullable(), answeredAt: z.iso.datetime(), isCorrect: z.boolean() })
    .nullable()
    .meta({
      description:
        "The learner's last answer to this question before today: when, and whether it was right. `answer` holds its text only when it was wrong, so it never gives today's answer away; show it after the learner answers. A math answer given with other numbers has no answer text",
    }),
  unit: questionUnitSchema,
  visual: questionVisualSchema,
});
