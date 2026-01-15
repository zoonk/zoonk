import { z } from "zod";

export const sortOrderInputSchema = z.object({
  feedback: z.string().describe("Explanation of why this sequence is correct"),
  items: z.array(z.string()).describe("Items in the CORRECT order (4-6 items)"),
  question: z.string().describe("What needs to be ordered and why it matters"),
});
