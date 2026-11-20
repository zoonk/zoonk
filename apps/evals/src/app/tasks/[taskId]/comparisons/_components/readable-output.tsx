import { cn } from "@zoonk/ui/lib/utils";
import { humanizeKey } from "../_utils/words";

export type OutputMark = { anchor: string; label: string; major: boolean; quote: string };

type Segment = { mark?: OutputMark; text: string };

const NO_MARKS: OutputMark[] = [];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const HEADER_KEYS = new Set(["kind", "template", "type"]);
const INLINE_PATTERN = /(?<inline>\*\*[^*\n]+\*\*|(?<![\w])_[^_\s][^_\n]*_(?![\w]))/u;

function parseJson(text: string): unknown {
  const trimmed = text.trim();

  if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) {
    return undefined;
  }

  try {
    return JSON.parse(trimmed);
  } catch {
    return undefined;
  }
}

function isEmpty(value: unknown): boolean {
  return (
    value === null ||
    value === undefined ||
    value === "" ||
    (Array.isArray(value) && value.length === 0)
  );
}

function isPrimitive(value: unknown): value is string | number | boolean {
  return ["string", "number", "boolean"].includes(typeof value);
}

function firstRange(text: string, mark: OutputMark) {
  const start = text.indexOf(mark.quote);
  return start === -1 ? null : { end: start + mark.quote.length, mark, start };
}

/** Splits text around the first place each quote appears, skipping a quote that overlaps an earlier one. */
function splitMarks(text: string, marks: OutputMark[]): Segment[] {
  const ranges = marks
    .flatMap((mark) => {
      const range = firstRange(text, mark);
      return range ? [range] : [];
    })
    .toSorted((left, right) => left.start - right.start)
    .filter((range, index, sorted) =>
      sorted.slice(0, index).every((prior) => prior.end <= range.start),
    );

  const ends = [0, ...ranges.map((range) => range.end)];

  return [
    ...ranges.flatMap((range, index) => [
      { text: text.slice(ends[index], range.start) },
      { mark: range.mark, text: text.slice(range.start, range.end) },
    ]),
    { text: text.slice(ends.at(-1)) },
  ].filter((segment) => segment.text.length > 0);
}

function Inline({ text }: { text: string }) {
  return text.split(INLINE_PATTERN).map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
      // oxlint-disable-next-line react/no-array-index-key -- a sentence's parts never reorder
      return <strong key={index}>{part.slice(2, -2)}</strong>;
    }

    if (part.startsWith("_") && part.endsWith("_") && part.length > 2) {
      // oxlint-disable-next-line react/no-array-index-key -- a sentence's parts never reorder
      return <em key={index}>{part.slice(1, -1)}</em>;
    }

    return part;
  });
}

function Segments({ marks, text }: { marks: OutputMark[]; text: string }) {
  return splitMarks(text, marks).map((segment) =>
    segment.mark ? (
      <a
        className={cn(
          "rounded-sm px-0.5 no-underline",
          segment.mark.major ? "bg-destructive/15" : "bg-warning/20",
        )}
        href={`#${segment.mark.anchor}`}
        key={segment.mark.anchor}
        title={segment.mark.major ? "Major problem" : "Minor problem"}
      >
        <Inline text={segment.text} />
        <sup className="text-muted-foreground ms-0.5 font-mono">{segment.mark.label}</sup>
      </a>
    ) : (
      <Inline key={segment.text} text={segment.text} />
    ),
  );
}

function Prose({ marks, text }: { marks: OutputMark[]; text: string }) {
  return (
    <div className="flex flex-col gap-2">
      {text.split(/\n{2,}/u).map((paragraph, index) => (
        // oxlint-disable-next-line react/no-array-index-key -- a text's paragraphs never reorder
        <p className="whitespace-pre-line" key={index}>
          <Segments marks={marks} text={paragraph} />
        </p>
      ))}
    </div>
  );
}

function FieldLabel({ children }: { children: string }) {
  return <p className="text-muted-foreground text-xs">{children}</p>;
}

function Fields({
  headingKey,
  marks,
  record,
}: {
  headingKey?: string;
  marks: OutputMark[];
  record: Record<string, unknown>;
}) {
  const entries = Object.entries(record).filter(
    ([key, value]) => !isEmpty(value) && key !== headingKey,
  );

  const [only] = entries;

  if (entries.length === 1 && only) {
    return <Value marks={marks} value={only[1]} />;
  }

  return (
    <div className="flex flex-col gap-3">
      {entries.map(([key, value]) => {
        if (key === "title" && typeof value === "string") {
          return (
            <p className="font-semibold" key={key}>
              <Inline text={value} />
            </p>
          );
        }

        if (key === "text") {
          return <Value key={key} marks={marks} value={value} />;
        }

        if (typeof value === "boolean" || typeof value === "number") {
          return (
            <p className="text-muted-foreground text-xs" key={key}>
              {humanizeKey(key)}: <span className="text-foreground">{formatPrimitive(value)}</span>
            </p>
          );
        }

        return (
          <div className="flex flex-col gap-1" key={key}>
            <FieldLabel>{humanizeKey(key)}</FieldLabel>
            <Value marks={marks} value={value} />
          </div>
        );
      })}
    </div>
  );
}

function formatPrimitive(value: string | number | boolean): string {
  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }

  return String(value);
}

function ListItem({ index, item, marks }: { index: number; item: unknown; marks: OutputMark[] }) {
  const heading = isRecord(item)
    ? Object.entries(item).find(
        (entry): entry is [string, string] =>
          HEADER_KEYS.has(entry[0]) && typeof entry[1] === "string" && Boolean(entry[1].trim()),
      )
    : undefined;

  const title = heading ? `${index + 1} · ${humanizeKey(heading[1])}` : `${index + 1}`;

  return (
    <li className="flex flex-col gap-2 border-t py-3 first:border-t-0 first:pt-0">
      <p className="text-muted-foreground font-mono text-xs">{title}</p>
      <Value headingKey={heading?.[0]} marks={marks} value={item} />
    </li>
  );
}

function List({ items, marks }: { items: unknown[]; marks: OutputMark[] }) {
  if (items.every((item) => isPrimitive(item))) {
    return (
      <ul className="flex list-disc flex-col gap-1 ps-5">
        {items.map((item, index) => (
          // oxlint-disable-next-line react/no-array-index-key -- an output's list never reorders
          <li key={index}>
            {typeof item === "string" ? <Prose marks={marks} text={item} /> : formatPrimitive(item)}
          </li>
        ))}
      </ul>
    );
  }

  return (
    <ol className="flex flex-col">
      {items.map((item, index) => (
        // oxlint-disable-next-line react/no-array-index-key -- an output's list never reorders
        <ListItem index={index} item={item} key={index} marks={marks} />
      ))}
    </ol>
  );
}

function Value({
  headingKey,
  marks,
  value,
}: {
  headingKey?: string;
  marks: OutputMark[];
  value: unknown;
}) {
  if (typeof value === "string") {
    const nested = parseJson(value);

    return nested === undefined ? (
      <Prose marks={marks} text={value} />
    ) : (
      <Value marks={marks} value={nested} />
    );
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return <p>{formatPrimitive(value)}</p>;
  }

  if (Array.isArray(value)) {
    return <List items={value} marks={marks} />;
  }

  if (isRecord(value)) {
    return <Fields headingKey={headingKey} marks={marks} record={value} />;
  }

  return null;
}

/**
 * An output as a person reads it: JSON fields become labeled text and lists, a lesson's screens a
 * numbered list, and quoted observations are marked where their words appear.
 */
export function ReadableOutput({ marks = NO_MARKS, text }: { marks?: OutputMark[]; text: string }) {
  return (
    <div className="text-sm leading-relaxed wrap-break-word">
      <Value marks={marks} value={text} />
    </div>
  );
}
