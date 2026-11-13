import { AdminJson } from "@/components/admin-json";
import { StateMark } from "@/components/state-mark";
import { type ContentFixDetail } from "@/data/content-fixes/get-content-fix";
import { type StoredChange } from "@zoonk/core/staff/content-fixes/contract";
import {
  type ContentValueChange,
  listContentValueChanges,
} from "@zoonk/core/staff/content-fixes/screen-content-rules";
import { cn } from "@zoonk/ui/lib/utils";
import { isJsonObject } from "@zoonk/utils/json";
import { diffWordsWithSpace } from "diff";
import Link from "next/link";
import { connection } from "next/server";

const MODEL_LABELS: Record<StoredChange["model"], string> = {
  AnswerExplanation: "Answer explanation",
  Chapter: "Chapter",
  Course: "Course",
  Item: "Practice question",
  Lesson: "Lesson",
  Step: "Screen",
  StepVariant: "Screen version",
};

type Side = "after" | "before";

const SIDES: Record<Side, { label: string; mark: string; own: "added" | "removed" }> = {
  after: { label: "After", mark: "bg-success/20 rounded-xs", own: "added" },
  before: { label: "Before", mark: "bg-destructive/20 rounded-xs line-through", own: "removed" },
};

function toText(value: unknown): string {
  return typeof value === "string" ? value : JSON.stringify(value);
}

/** One side of a changed value, with the words only this side has marked. */
function ValueSide({ after, before, side }: { after: unknown; before: unknown; side: Side }) {
  const { label, mark, own } = SIDES[side];
  const other = own === "added" ? "removed" : "added";
  const isText = typeof before === "string" && typeof after === "string";

  const parts = isText
    ? diffWordsWithSpace(before, after).filter((part) => !part[other])
    : [{ [own]: true, value: toText(side === "before" ? before : after) }];

  return (
    <div className="flex min-w-0 flex-col gap-1">
      <span className="text-muted-foreground text-xs">{label}</span>
      <p
        className={cn(
          "min-h-10 rounded-lg border px-3 py-2 text-sm leading-6 wrap-break-word whitespace-pre-wrap",
          !isText && "font-mono text-xs",
        )}
      >
        {parts.map((part, index) =>
          part[own] ? (
            // oxlint-disable-next-line react/no-array-index-key -- the parts never reorder
            <mark className={cn("text-foreground", mark)} key={index}>
              {part.value}
            </mark>
          ) : (
            part.value
          ),
        )}
      </p>
    </div>
  );
}

type ShownChange = ContentValueChange & { about: string | null };

function ValueChange({ change }: { change: ShownChange }) {
  return (
    <li className="flex flex-col gap-2 py-3">
      <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <code className="text-xs font-medium">{change.path}</code>
        {change.about && <span className="text-muted-foreground text-xs">of “{change.about}”</span>}
        {change.isAnswerKey && (
          <StateMark className="text-xs" state="answerKey" tone="attention">
            Changes the right answer
          </StateMark>
        )}
      </span>

      <div className="grid gap-3 md:grid-cols-2">
        <ValueSide after={change.after} before={change.before} side="before" />
        <ValueSide after={change.after} before={change.before} side="after" />
      </div>
    </li>
  );
}

type FieldChange = Extract<StoredChange, { op: "set" }>["fields"][number];

function isScreen(model: StoredChange["model"]): boolean {
  return model === "Step" || model === "StepVariant";
}

/**
 * A flag or a number says little alone, so a value inside an option or an item is shown with that
 * option's text: the nearest part of the screen around it that has a `text` of its own.
 */
function findAbout({ content, path }: { content: unknown; path: string }): string | null {
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

  const parent = parents.findLast((value) => isJsonObject(value) && typeof value.text === "string");
  return isJsonObject(parent) && typeof parent.text === "string" ? parent.text : null;
}

/** Text fields are one value; a screen's content and a lesson's map show each value that differs. */
function toValueChanges({
  field,
  model,
}: {
  field: FieldChange;
  model: StoredChange["model"];
}): ShownChange[] {
  const whole = {
    about: null,
    after: field.after,
    before: field.before,
    isAnswerKey: false,
    path: field.field,
  };

  if (typeof field.before === "string" || typeof field.after === "string") {
    return [whole];
  }

  const values = listContentValueChanges(field);

  return values
    ? values.map((value) => ({
        ...value,
        about: findAbout({ content: field.before, path: value.path }),
        isAnswerKey: value.isAnswerKey && isScreen(model),
        path: `${field.field}.${value.path}`,
      }))
    : [whole];
}

function FieldChanges({ field, model }: { field: FieldChange; model: StoredChange["model"] }) {
  const isJson = typeof field.before !== "string" && typeof field.after !== "string";

  return (
    <>
      <ul className="divide-y">
        {toValueChanges({ field, model }).map((change) => (
          <ValueChange change={change} key={change.path} />
        ))}
      </ul>

      {isJson && (
        <div className="grid gap-x-3 md:grid-cols-2">
          <AdminJson label={`Whole ${field.field} before`} value={field.before} />
          <AdminJson label={`Whole ${field.field} after`} value={field.after} />
        </div>
      )}
    </>
  );
}

function PictureLink({ mediaAssetId }: { mediaAssetId: string }) {
  return (
    <Link className="hit-area relative underline" href={`/media/${mediaAssetId}`}>
      See the picture
    </Link>
  );
}

function ChangeBody({ change }: { change: StoredChange }) {
  switch (change.op) {
    case "set":
      return change.fields.map((field) => (
        <FieldChanges field={field} key={field.field} model={change.model} />
      ));
    case "retire":
      return <p className="text-sm">Takes this question out of new practice.</p>;
    case "unretire":
      return <p className="text-sm">Puts this question back in new practice.</p>;
    case "detachPicture":
      return (
        <p className="text-sm">
          Takes the picture off this screen. Other screens that show it keep it.{" "}
          <PictureLink mediaAssetId={change.mediaAssetId} />
        </p>
      );
    case "attachPicture":
      return (
        <p className="text-sm">
          Puts the picture back on this screen. <PictureLink mediaAssetId={change.mediaAssetId} />
        </p>
      );
    default:
      return null;
  }
}

/** jsdiff reads the clock for its time limit, which Next.js refuses while it prerenders a prefetch. */
export async function ContentFixChanges({ fix }: { fix: ContentFixDetail }) {
  await connection();

  return (
    <ul className="flex flex-col gap-6">
      {fix.changes.map((change) => (
        <li className="flex flex-col gap-1" key={`${change.id}:${change.op}`}>
          <h3 className="flex flex-wrap items-baseline gap-x-2 text-sm font-medium">
            {fix.rowLabels.get(change.id) ?? MODEL_LABELS[change.model]}
            <span className="text-muted-foreground font-mono text-xs font-normal">{change.id}</span>
          </h3>
          <ChangeBody change={change} />
        </li>
      ))}
    </ul>
  );
}
