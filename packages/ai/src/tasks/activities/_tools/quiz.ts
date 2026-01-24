import { tool } from "ai";
import { type z } from "zod";
import { fillBlankInputSchema } from "./fill-blank";
import fillBlankPrompt from "./fill-blank.prompt.md";
import { matchColumnsInputSchema } from "./match-columns";
import matchColumnsPrompt from "./match-columns.prompt.md";
import { multipleChoiceInputSchema } from "./multiple-choice";
import multipleChoicePrompt from "./multiple-choice.prompt.md";
import { selectImageInputSchema } from "./select-image";
import selectImagePrompt from "./select-image.prompt.md";
import { sortOrderInputSchema } from "./sort-order";
import sortOrderPrompt from "./sort-order.prompt.md";

export const quizTools = {
  fillBlank: tool({
    description: fillBlankPrompt,
    inputSchema: fillBlankInputSchema,
  }),
  matchColumns: tool({
    description: matchColumnsPrompt,
    inputSchema: matchColumnsInputSchema,
  }),
  multipleChoice: tool({
    description: multipleChoicePrompt,
    inputSchema: multipleChoiceInputSchema,
  }),
  selectImage: tool({
    description: selectImagePrompt,
    inputSchema: selectImageInputSchema,
  }),
  sortOrder: tool({
    description: sortOrderPrompt,
    inputSchema: sortOrderInputSchema,
  }),
};

export type MultipleChoiceQuestion = {
  format: "multipleChoice";
} & z.infer<typeof multipleChoiceInputSchema>;

export type MatchColumnsQuestion = {
  format: "matchColumns";
} & z.infer<typeof matchColumnsInputSchema>;

export type FillBlankQuestion = {
  format: "fillBlank";
} & z.infer<typeof fillBlankInputSchema>;

export type SortOrderQuestion = {
  format: "sortOrder";
} & z.infer<typeof sortOrderInputSchema>;

export type SelectImageQuestion = {
  format: "selectImage";
} & z.infer<typeof selectImageInputSchema>;

export type QuizQuestion =
  | MultipleChoiceQuestion
  | MatchColumnsQuestion
  | FillBlankQuestion
  | SortOrderQuestion
  | SelectImageQuestion;
