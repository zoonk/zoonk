import { cn } from "@zoonk/ui/lib/utils";

/** `label` replaces the line's prefix from `labels`; `null` drops it. */
export type DiffLine = {
  kind: "added" | "context" | "removed";
  label?: string | null;
  lang?: string;
  text: string;
  tone?: DiffTone;
};

export type DiffTone = "bad" | "good" | "neutral";

const LINE_CLASS: Readonly<Record<DiffLine["kind"], string>> = {
  added: "bg-success/12 text-success-text",
  context: "text-muted-foreground",
  removed: "bg-destructive/12 text-destructive-text",
};

const NEUTRAL_CLASS: Readonly<Record<DiffLine["kind"], string>> = {
  added: "text-foreground",
  context: "text-muted-foreground",
  removed: "text-muted-foreground",
};

/** Bad news isn't a mistake, so it takes the warning's amber; pink means wrong. */
const TONE_CLASS: Readonly<Record<Exclude<DiffTone, "neutral">, string>> = {
  bad: "bg-warning/12 text-warning-text",
  good: "bg-success/12 text-success-text",
};

function getLineClass({ kind, tone }: DiffLine): string {
  if (kind === "context" || tone === undefined) {
    return LINE_CLASS[kind];
  }

  return tone === "neutral" ? NEUTRAL_CLASS[kind] : TONE_CLASS[tone];
}

const LINE_SIGN: Readonly<Record<DiffLine["kind"], string>> = {
  added: "+ ",
  context: "",
  removed: "− ",
};

export function DiffLines({
  className,
  labels,
  lines,
}: {
  className?: string;
  labels: { added: string; removed: string };
  lines: readonly DiffLine[];
}) {
  return (
    <ul
      className={cn(
        "ring-border overflow-hidden rounded-[0.625rem] py-1 font-mono text-[0.78125rem] leading-[1.7] tabular-nums ring-1 ring-inset",
        className,
      )}
      data-slot="diff-lines"
    >
      {lines.map((line, index) => (
        <li
          className={cn("flex px-3 py-px", getLineClass(line))}
          // oxlint-disable-next-line react/no-array-index-key -- Lines are positions in the change.
          key={index}
        >
          {line.kind !== "context" && (
            <span aria-hidden="true" className="shrink-0 whitespace-pre">
              {LINE_SIGN[line.kind]}
            </span>
          )}
          <span className="min-w-0">
            {line.kind !== "context" && line.label !== null && (
              <span className="sr-only">{`${line.label ?? labels[line.kind]}: `}</span>
            )}
            <span
              className={cn(
                line.tone === "neutral" &&
                  line.kind === "removed" &&
                  "decoration-faint line-through",
              )}
              lang={line.lang}
            >
              {line.text}
            </span>
          </span>
        </li>
      ))}
    </ul>
  );
}
