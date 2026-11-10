import { profileAnswerInputSchema } from "./profile-question-contract";

export const profileOnboardingAnswerSchemas = [
  profileAnswerInputSchema.options[0].extend({
    answer: profileAnswerInputSchema.options[0].shape.answer.nullable().default(null),
  }),
  profileAnswerInputSchema.options[1].extend({
    answer: profileAnswerInputSchema.options[1].shape.answer.nullable().default(null),
  }),
  profileAnswerInputSchema.options[2].extend({
    answer: profileAnswerInputSchema.options[2].shape.answer.nullable().default(null),
  }),
  profileAnswerInputSchema.options[3].extend({
    answer: profileAnswerInputSchema.options[3].shape.answer.nullable().default(null),
  }),
  profileAnswerInputSchema.options[4].extend({
    answer: profileAnswerInputSchema.options[4].shape.answer.nullable().default(null),
  }),
  profileAnswerInputSchema.options[5].extend({
    answer: profileAnswerInputSchema.options[5].shape.answer.nullable().default(null),
  }),
  profileAnswerInputSchema.options[6].extend({
    answer: profileAnswerInputSchema.options[6].shape.answer.nullable().default(null),
  }),
  profileAnswerInputSchema.options[7].extend({
    answer: profileAnswerInputSchema.options[7].shape.answer.nullable().default(null),
  }),
  profileAnswerInputSchema.options[8].extend({
    answer: profileAnswerInputSchema.options[8].shape.answer.nullable().default(null),
  }),
  profileAnswerInputSchema.options[9].extend({
    answer: profileAnswerInputSchema.options[9].shape.answer.nullable().default(null),
  }),
] as const;
