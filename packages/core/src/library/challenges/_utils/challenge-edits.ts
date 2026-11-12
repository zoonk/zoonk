import { type ChallengeEdit } from "@zoonk/ai/tasks/challenge/fix";
import { type WrittenChallengeCase, challengeCaseSchema } from "@zoonk/ai/tasks/challenge/schema";
import { sumOf } from "@zoonk/utils/number";

function listTexts(value: unknown): string[] {
  if (typeof value === "string") {
    return [value];
  }

  if (Array.isArray(value)) {
    return value.flatMap((item) => listTexts(item));
  }

  if (value && typeof value === "object") {
    return Object.values(value).flatMap((item) => listTexts(item));
  }

  return [];
}

function mapTexts(value: unknown, change: (text: string) => string): unknown {
  if (typeof value === "string") {
    return change(value);
  }

  if (Array.isArray(value)) {
    return value.map((item) => mapTexts(item, change));
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, mapTexts(item, change)]),
    );
  }

  return value;
}

function countMatches({ find, written }: { find: string; written: WrittenChallengeCase }) {
  return sumOf(listTexts(written).map((text) => text.split(find).length - 1));
}

function applyEdit({
  edit,
  written,
}: {
  edit: ChallengeEdit;
  written: WrittenChallengeCase;
}): WrittenChallengeCase | null {
  if (!edit.find || countMatches({ find: edit.find, written }) !== 1) {
    return null;
  }

  return challengeCaseSchema.parse(
    mapTexts(written, (text) => text.replace(edit.find, () => edit.replace)),
  );
}

/** Null when an edit's text doesn't occur exactly once in the case, so it can't say what to change. */
export function applyChallengeEdits({
  edits,
  written,
}: {
  edits: ChallengeEdit[];
  written: WrittenChallengeCase;
}): WrittenChallengeCase | null {
  return edits.reduce<WrittenChallengeCase | null>(
    (current, edit) => current && applyEdit({ edit, written: current }),
    written,
  );
}
