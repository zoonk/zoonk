import { z } from "zod";

/** Mirrors the step contract's image request limits (core `stepImageRequestSchema`). */
const MAX_IMAGE_PROMPT_LENGTH = 400;
const MAX_IMAGE_ALT_LENGTH = 160;

/* oxlint-disable eslint/sort-keys -- Structured output follows schema property order: what to draw, then how to describe it. */

/**
 * A picture a lesson screen or a question asks for: what to draw, with every label the words use,
 * and one sentence for screen readers. Code draws and checks it, then links the file; null when
 * nothing needs to be seen.
 */
export const imageRequestSchema = z
  .object({
    prompt: z.string().max(MAX_IMAGE_PROMPT_LENGTH),
    alt: z.string().max(MAX_IMAGE_ALT_LENGTH),
  })
  .nullable();

/* oxlint-enable eslint/sort-keys */
