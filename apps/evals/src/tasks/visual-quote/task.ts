import { type Task } from "@/lib/types";
import {
  type VisualQuoteParams,
  type VisualQuoteSchema,
  generateVisualQuote,
} from "@zoonk/ai/tasks/visuals/quote";
import { TEST_CASES } from "./test-cases";

export const visualQuoteTask: Task<VisualQuoteParams, VisualQuoteSchema> = {
  description:
    "Generate structured quote data (text and author attribution) from a textual description",
  generate: generateVisualQuote,
  id: "visual-quote",
  name: "Visual Quote",
  testCases: TEST_CASES,
};
