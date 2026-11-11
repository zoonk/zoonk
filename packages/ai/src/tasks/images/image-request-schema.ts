import { aimForCharacters } from "@zoonk/utils/character-target";
import { z } from "zod";

/** Mirrors the step contract's image request targets (core `stepImageRequestSchema`). */
const IMAGE_PROMPT_TARGET = 400;
const IMAGE_ALT_TARGET = 160;
const MIN_NUMBERED_PARTS = 2;
const MAX_NUMBERED_PARTS = 6;

/* oxlint-disable eslint/sort-keys -- Structured output follows schema property order: what to draw, then how to describe it. */

const pictureRequest = z.object({
  prompt: aimForCharacters(z.string(), IMAGE_PROMPT_TARGET),
  alt: aimForCharacters(z.string(), IMAGE_ALT_TARGET),
});

/** Null when nothing needs to be seen. */
export const imageRequestSchema = pictureRequest.nullable();

/**
 * `parts` names the numbered parts of one whole in English, in order, and code draws number 1 on
 * the first. Null on a picture without numbers.
 */
export const numberedImageRequestSchema = pictureRequest
  .extend({ parts: z.array(z.string()).min(MIN_NUMBERED_PARTS).max(MAX_NUMBERED_PARTS).nullable() })
  .nullable();

/* oxlint-enable eslint/sort-keys */
