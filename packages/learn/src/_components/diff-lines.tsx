import { cn } from "@zoonk/ui/lib/utils";

/**
 * One line of a change: what goes away (`removed`), what comes in (`added`) or what stays as it
 * was (`context`). `lang` names the line's language when it isn't the page's (a sentence in the
 * language being learned), so screen readers say it right. `label` replaces what screen readers
 * hear before it (`labels`), and null says nothing first, for a line whose words say it
 * ("Leaves out 228 lessons"). `tone` colors a line by what it means for the learner rather than by
 * its sign (a plan change: good news green, bad news red, a plain move neutral); without it, an
 * added line is green and a removed one red (a worked answer: the right step and the wrong one).
 */
export type DiffLine = {
  kind: "added" | "context" | "removed";
  label?: string | null;
  lang?: string;
  text: string;
  tone?: DiffTone;
};

/** What a line means for the learner: good news, bad news, or a plain move. */
export type DiffTone = "bad" | "good" | "neutral";

const LINE_CLASS: Readonly<Record<DiffLine["kind"], string>> = {
  added: "bg-success/12 text-success-text",
  context: "text-muted-foreground",
  removed: "bg-destructive/12 text-destructive-text",
};

/** A plain move reads as a diff without color: the old value struck through, the new one plain. */
const NEUTRAL_CLASS: Readonly<Record<DiffLine["kind"], string>> = {
  added: "text-foreground",
  context: "text-muted-foreground",
  removed: "text-muted-foreground",
};

const TONE_CLASS: Readonly<Record<Exclude<DiffTone, "neutral">, string>> = {
  bad: "bg-destructive/12 text-destructive-text",
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

/**
 * A change told line by line in the mono face, the way a diff reads: a red-tinted line for what
 * goes, a green-tinted line for what comes, quiet lines for what stays; or, with a `tone`, colored
 * by what each line means for the learner. Plan changes (fewer
 * minutes, a later date) and worked answers (the step that went wrong, the right one) both use it,
 * so the learner sees exactly what moved. The signs are for sighted readers, in a column of their
 * own so a long line wraps under its words; screen readers hear each line with what it means
 * (`labels`).
 *
 * ```tsx
 * <DiffLines
 *   labels={{ added: "New", removed: "Was" }}
 *   lines={[
 *     { kind: "removed", text: "Mon to Thu 50 min a day" },
 *     { kind: "added", text: "Mon to Thu 25 min a day" },
 *     { kind: "context", text: "Preparation 70% → 66%" },
 *   ]}
 * />
 * ```
 */
export function DiffLines({
  className,
  labels,
  lines,
}: {
  className?: string;
  /** What screen readers hear before an added and a removed line ("New", "Was"). */
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
          {/* The sign keeps its own column, so a wrapped line hangs under its text. */}
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
