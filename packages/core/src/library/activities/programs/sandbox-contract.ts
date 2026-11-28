import { uuidSchema } from "@zoonk/utils/uuid-schema";
import { z } from "zod";
import { MAX_CODE_BYTES, SANDBOX_LANGUAGE_IDS } from "./program-languages";

export const sandboxLanguageSchema = z.enum(SANDBOX_LANGUAGE_IDS);

export const codeRunInputSchema = z
  .object({
    code: z
      .string()
      .max(MAX_CODE_BYTES)
      .refine(
        (code) => new TextEncoder().encode(code).length <= MAX_CODE_BYTES,
        "Source exceeds 64 KiB in UTF-8",
      ),
    language: sandboxLanguageSchema,
    requestId: uuidSchema(),
  })
  .strict();

export type CodeRunInput = z.infer<typeof codeRunInputSchema>;

export const codeRunPhaseSchema = z.object({ phase: z.enum(["starting", "compiling", "running"]) });

export type CodeRunPhase = z.infer<typeof codeRunPhaseSchema>["phase"];

export const codeRunResultSchema = z.object({
  error: z.object({ line: z.number().int().positive().nullable(), message: z.string() }).nullable(),
  errorOutput: z.string(),
  output: z.string(),
  runId: uuidSchema(),
  stop: z.enum(["done", "error", "timeout", "tooMuchOutput", "unavailable"]),
});

export type CodeRunResult = z.infer<typeof codeRunResultSchema>;
