import { z } from "zod";

const MAX_SOURCE_PAGE = 32_767;

export const sourcePageSchema = z.int().min(1).max(MAX_SOURCE_PAGE).nullable();
