import { AdminJson } from "@/components/admin-json";
import { type StoredChange } from "@zoonk/core/staff/content-fixes/contract";
import {
  type ContentValueChange,
  listContentValueChanges,
} from "@zoonk/core/staff/content-fixes/screen-content-rules";
import { Badge } from "@zoonk/ui/components/badge";
import { cn } from "@zoonk/ui/lib/utils";
import { isJsonObject } from "@zoonk/utils/json";
import { diffWordsWithSpace } from "diff";

export type Side = "after" | "before";

export const SIDES: Record<Side, { label: string; mark: string; own: "added" | "removed" }> = {
  after: { label: "After", mark: "bg-success/20 rounded-xs", own: "added" },
  before: { label: "Before", mark: "bg-destructive/20 rounded-xs line-through", own: "removed" },
};

export type Names = ReadonlyMap<string, string>;

function toText(value: unknown): string {
  return typeof value === "string" ? value : JSON.stringify(value);
}

function isTextOrMissing(value: unknown): boolean {
  return value === undefined || typeof value === "string";
}

function NamedId({ id, name }: { id: string; name: string }) {
  return (
    <>
      {name} <span className="text-muted-foreground font-mono text-xs">{id}</span>
    </>
  );
}

/** One side of a changed value, with the words only this side has marked. */
function ValueSide({
  after,
  before,
  names,
  side,
}: {
  after: unknown;
  before: unknown;
  names: Names;
  side: Side;
}) {
  const { label, mark, own } = SIDES[side];
  const other = own === "added" ? "removed" : "added";
  const value = side === "before" ? before : after;
  const name = typeof value === "string" ? names.get(value) : undefined;
  const isText = !name && isTextOrMissing(before) && isTextOrMissing(after);

  const parts = isText
    ? diffWordsWithSpace(toText(before ?? ""), toText(after ?? "")).filter((part) => !part[other])
    : [{ [own]: true, value: toText(value) }];

  return (
    <div className="flex min-w-0 flex-col gap-1">
      <span className="text-muted-foreground text-xs">{label}</span>
      <p
        className={cn(
          "min-h-10 rounded-lg border px-3 py-2 text-sm leading-6 wrap-break-word whitespace-pre-wrap",
          !isText && !name && "font-mono text-xs",
        )}
      >
        {value === undefined && <span className="text-muted-foreground">None</span>}
        {name && typeof value === "string" ? (
          <mark className={cn("text-foreground", mark)}>
            <NamedId id={value} name={name} />
          </mark>
        ) : (
          parts.map((part, index) =>
            part[own] ? (
              // oxlint-disable-next-line react/no-array-index-key -- the parts never reorder
              <mark className={cn("text-foreground", mark)} key={index}>
                {part.value}
              </mark>
            ) : (
              part.value
            ),
          )
        )}
      </p>
    </div>
  );
}

type ShownChange = ContentValueChange & { about: string | null };

function ValueChange({ change, names }: { change: ShownChange; names: Names }) {
  return (
    <li className="flex flex-col gap-2 py-3">
      <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <code className="text-xs font-medium">{change.path}</code>
        {change.about && <span className="text-muted-foreground text-xs">of “{change.about}”</span>}
        {change.isAnswerKey && <Badge variant="destructive">Changes the right answer</Badge>}
      </span>

      <div className="grid gap-3 md:grid-cols-2">
        <ValueSide after={change.after} before={change.before} names={names} side="before" />
        <ValueSide after={change.after} before={change.before} names={names} side="after" />
      </div>
    </li>
  );
}

export type FieldChange = Extract<StoredChange, { op: "set" }>["fields"][number];

function hasAnswerKey(model: StoredChange["model"]): boolean {
  return (
    model === "Step" || model === "StepVariant" || model === "Item" || model === "LanguageLevelTest"
  );
}

function nameOf(value: unknown, names: Names): string | null {
  if (!isJsonObject(value)) {
    return null;
  }

  if (typeof value.text === "string") {
    return value.text;
  }

  const named = Object.values(value).find((entry) => typeof entry === "string" && names.has(entry));

  return typeof named === "string" ? (names.get(named) ?? null) : null;
}

/**
 * A flag or a number says little alone, so a value inside an option, an item or a graph's skill
 * is shown with what that part is: its own `text`, or the title of the row its id names.
 */
function findAbout({
  content,
  names,
  path,
}: {
  content: unknown;
  names: Names;
  path: string;
}): string | null {
  const keys = path.split(".");

  if (keys.at(-1) === "text") {
    return null;
  }

  const parents = keys
    .slice(0, -1)
    .map((_, index) =>
      keys
        .slice(0, index + 1)
        .reduce<unknown>(
          (value, key) =>
            isJsonObject(value) || Array.isArray(value) ? Reflect.get(value, key) : null,
          content,
        ),
    );

  return parents.map((parent) => nameOf(parent, names)).findLast((name) => name !== null) ?? null;
}

/** A text field is one value; JSON shows each value that differs, the way approving writes it. */
function toValueChanges({
  field,
  model,
  names,
}: {
  field: FieldChange;
  model: StoredChange["model"];
  names: Names;
}): ShownChange[] {
  if (typeof field.before === "string" || typeof field.after === "string") {
    return [
      {
        about: null,
        after: field.after,
        before: field.before,
        isAnswerKey: false,
        path: field.field,
      },
    ];
  }

  return listContentValueChanges({ ...field, of: model === "Item" ? "item" : "screen" }).map(
    (value) => ({
      ...value,
      about:
        findAbout({ content: field.before, names, path: value.path }) ??
        findAbout({ content: field.after, names, path: value.path }),
      isAnswerKey: value.isAnswerKey && hasAnswerKey(model),
      path: `${field.field}.${value.path}`,
    }),
  );
}

export function FieldChanges({
  compact,
  field,
  model,
  names,
}: {
  compact: boolean;
  field: FieldChange;
  model: StoredChange["model"];
  names: Names;
}) {
  const isJson = typeof field.before !== "string" && typeof field.after !== "string";

  return (
    <>
      <ul className="divide-y">
        {toValueChanges({ field, model, names }).map((change) => (
          <ValueChange change={change} key={change.path} names={names} />
        ))}
      </ul>

      {isJson && !compact && (
        <div className="grid gap-x-3 md:grid-cols-2">
          <AdminJson label={`Whole ${field.field} before`} value={field.before} />
          <AdminJson label={`Whole ${field.field} after`} value={field.after} />
        </div>
      )}
    </>
  );
}
