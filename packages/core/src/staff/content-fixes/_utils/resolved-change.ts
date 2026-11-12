import { isDeepStrictEqual } from "node:util";
import { type ContentFixUnit } from "@zoonk/db";
import { z } from "zod";
import { type ContentFixEffect, type StoredChange } from "../contract";

export type Json = z.core.util.JSONType;

const jsonSchema = z.json();

/** Rows' JSON columns and step content repairs come back typed loosely; this checks them. */
export function toJson(value: unknown): Json {
  return jsonSchema.parse(value);
}

export type FixUnit = { id: string; kind: ContentFixUnit };

export type Refusal = { ok: false; problem: string };

export type ResolvedChange =
  | Refusal
  | { effects: ContentFixEffect[]; ok: true; stored: StoredChange; unit: FixUnit };

export function refuse(problem: string): Refusal {
  return { ok: false, problem };
}

export function nonEmptyText(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

export function changedFields(
  current: Readonly<Record<string, Json>>,
  next: readonly (readonly [string, Json])[],
) {
  return next
    .filter(([field, after]) => !isDeepStrictEqual(after, current[field] ?? null))
    .map(([field, after]) => ({ after, before: current[field] ?? null, field }));
}

export const PRIVATE_CONTENT =
  "Private content belongs to one learner; fixes change shared content only.";

export const NOT_CURRENT_SCREEN =
  "Only a lesson's current screens can be fixed; this one isn't shown to new learners.";
