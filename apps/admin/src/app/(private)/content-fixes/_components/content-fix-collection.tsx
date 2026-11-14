import { Badge } from "@zoonk/ui/components/badge";
import { cn } from "@zoonk/ui/lib/utils";
import { isJsonObject } from "@zoonk/utils/json";
import { diffArrays } from "diff";
import { type FieldChange, type Names, SIDES, type Side } from "./content-fix-values";

type Entry = { detail: string | null; id: string; key: string };

/** A course's chapter is placed at a level and in an area; other collections list bare ids. */
function toEntries(value: unknown): Entry[] {
  const entries = Array.isArray(value) ? value : [];

  return entries.flatMap((entry): Entry[] => {
    if (typeof entry === "string") {
      return [{ detail: null, id: entry, key: entry }];
    }

    if (isJsonObject(entry) && typeof entry.chapterId === "string") {
      const detail = [entry.level, entry.area].filter((part) => typeof part === "string");
      return [{ detail: detail.join(" · "), id: entry.chapterId, key: JSON.stringify(entry) }];
    }

    return [];
  });
}

type EntryChange = "added" | "kept" | "moved" | "removed";

const ONE_SIDE_ONLY: Record<Side, EntryChange> = { after: "added", before: "removed" };

/**
 * Which entries each side adds, removes or moves: an entry both sides have that falls outside
 * their longest common order moved.
 */
function markEntries({ after, before }: { after: Entry[]; before: Entry[] }) {
  const beforeKeys = new Set(before.map((entry) => entry.key));
  const afterKeys = new Set(after.map((entry) => entry.key));

  const parts = diffArrays(
    before.map((entry) => entry.key),
    after.map((entry) => entry.key),
  );

  const changesOf = (side: Side): EntryChange[] =>
    parts
      .filter((part) => !(side === "before" ? part.added : part.removed))
      .flatMap((part) =>
        part.value.map((key): EntryChange => {
          if (!part.added && !part.removed) {
            return "kept";
          }

          return beforeKeys.has(key) && afterKeys.has(key) ? "moved" : ONE_SIDE_ONLY[side];
        }),
      );

  return { after: changesOf("after"), before: changesOf("before") };
}

const ENTRY_MARKS: Record<EntryChange, string> = {
  added: SIDES.after.mark,
  kept: "",
  moved: "",
  removed: SIDES.before.mark,
};

function EntryList({
  changes,
  entries,
  isOrdered,
  names,
  side,
}: {
  changes: EntryChange[];
  entries: Entry[];
  isOrdered: boolean;
  names: Names;
  side: Side;
}) {
  const List = isOrdered ? "ol" : "ul";

  return (
    <div className="flex min-w-0 flex-col gap-1">
      <span className="text-muted-foreground text-xs">{SIDES[side].label}</span>
      <List
        className={cn(
          "min-h-10 rounded-lg border py-2 pr-3 text-sm leading-6 wrap-break-word",
          isOrdered ? "list-decimal pl-8" : "list-disc pl-7",
        )}
      >
        {entries.map((entry, index) => {
          const change = changes[index] ?? "kept";

          return (
            <li key={entry.key}>
              <mark className={cn("text-foreground bg-transparent", ENTRY_MARKS[change])}>
                {names.get(entry.id) ?? "Deleted or unknown"}
              </mark>
              {entry.detail && <span className="text-muted-foreground"> · {entry.detail}</span>}{" "}
              {change === "moved" && <Badge variant="outline">Moved</Badge>}{" "}
              <span className="text-muted-foreground font-mono text-xs">{entry.id}</span>
            </li>
          );
        })}
      </List>
    </div>
  );
}

/** Chapters and lessons keep their order, which a fix can change; skills are a set. */
export function CollectionChange({
  field,
  isOrdered,
  names,
}: {
  field: FieldChange;
  isOrdered: boolean;
  names: Names;
}) {
  const byName = (entries: Entry[]) =>
    isOrdered
      ? entries
      : entries.toSorted((left, right) =>
          (names.get(left.id) ?? left.id).localeCompare(names.get(right.id) ?? right.id),
        );

  const before = byName(toEntries(field.before));
  const after = byName(toEntries(field.after));
  const changes = markEntries({ after, before });

  return (
    <div className="grid gap-3 py-3 md:grid-cols-2">
      <EntryList
        changes={changes.before}
        entries={before}
        isOrdered={isOrdered}
        names={names}
        side="before"
      />
      <EntryList
        changes={changes.after}
        entries={after}
        isOrdered={isOrdered}
        names={names}
        side="after"
      />
    </div>
  );
}
