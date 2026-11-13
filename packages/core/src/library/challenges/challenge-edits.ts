import { type ChallengeEdit } from "@zoonk/ai/tasks/challenge/fix";
import { type WrittenChallengeCase, challengeCaseSchema } from "@zoonk/ai/tasks/challenge/schema";
import { sumOf } from "@zoonk/utils/number";

/**
 * The words learners read. Ids, routes and settings such as `goodWhen` stay as the writer set them.
 */
const EDITABLE_FIELDS = new Set([
  "deadline",
  "example",
  "expertise",
  "label",
  "mission",
  "name",
  "note",
  "outcome",
  "practice",
  "prompt",
  "role",
  "setting",
  "summary",
  "text",
  "title",
  "value",
]);

function mapEditableTexts({
  change,
  editable,
  value,
}: {
  change: (text: string) => string;
  editable: boolean;
  value: unknown;
}): unknown {
  if (typeof value === "string") {
    return editable ? change(value) : value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => mapEditableTexts({ change, editable, value: item }));
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        mapEditableTexts({ change, editable: EDITABLE_FIELDS.has(key), value: item }),
      ]),
    );
  }

  return value;
}

function listEditableTexts({ editable, value }: { editable: boolean; value: unknown }): string[] {
  if (typeof value === "string") {
    return editable ? [value] : [];
  }

  if (Array.isArray(value)) {
    return value.flatMap((item) => listEditableTexts({ editable, value: item }));
  }

  if (value && typeof value === "object") {
    return Object.entries(value).flatMap(([key, item]) =>
      listEditableTexts({ editable: EDITABLE_FIELDS.has(key), value: item }),
    );
  }

  return [];
}

function countMatches({ find, written }: { find: string; written: WrittenChallengeCase }) {
  return sumOf(
    listEditableTexts({ editable: false, value: written }).map(
      (text) => text.split(find).length - 1,
    ),
  );
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

  const parsed = challengeCaseSchema.safeParse(
    mapEditableTexts({
      change: (text) => text.replace(edit.find, () => edit.replace),
      editable: false,
      value: written,
    }),
  );

  return parsed.success ? parsed.data : null;
}

/**
 * Null when an edit's text doesn't occur exactly once among the editable fields, or leaves an
 * invalid case.
 */
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
