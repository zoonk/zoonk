import { Skeleton } from "@zoonk/ui/components/skeleton";
import { cn } from "@zoonk/ui/lib/utils";
import { isValidElement } from "react";

const FIELD_ROW_CLASS =
  "grid grid-cols-[8rem_minmax(0,1fr)] items-baseline gap-x-4 py-3 text-sm @lg:grid-cols-[11rem_minmax(0,1fr)]";

export function DetailFields({ children }: { children: React.ReactNode }) {
  return <dl className="@container divide-y">{children}</dl>;
}

/**
 * Data, not words: a count (with its unit), an amount, a size, an id, a key, a hash or an address. A
 * model's name ("openai/gpt-6.1-sol"), an email and a handle ("@ana_enem") read as names and stay
 * in the text face, as an email does under a name in every table.
 */
const DATA_VALUE = /^(?:\$?[\d,]+(?:\.\d+)?%?(?: [a-z]+)?|\d+ × \d+|(?=\S*[\d._:/-])\S+)$/u;

const NAME_LIKE = /^(?:[a-z-]+\/[\w.-]+|[^\s@]+@[^\s@]+|@[\w.]+)$/u;

/** A field that names an identifier holds one, whatever it looks like ("enem"). */
const ID_LABEL = /\b(?:id|key|hash|slug)$/iu;

/** The words a value shows, through a link around them. */
function textOf(children: React.ReactNode): string | null {
  if (typeof children === "string" || typeof children === "number") {
    return String(children);
  }

  if (isValidElement<{ children?: React.ReactNode }>(children)) {
    return textOf(children.props.children);
  }

  return null;
}

function isData({ children, label }: { children: React.ReactNode; label: string }): boolean {
  const text = textOf(children)?.trim();

  if (!text) {
    return false;
  }

  return ID_LABEL.test(label) || (DATA_VALUE.test(text) && !NAME_LIKE.test(text));
}

/**
 * A value that is data is set in mono, digit under digit; `mono` says so where the value isn't a
 * plain string. An `icon` says what the field is before its label; give one to every field of a
 * list or to none, so the labels share an edge.
 */
export function DetailField({
  children,
  icon,
  label,
  mono,
}: {
  children: React.ReactNode;
  icon?: React.ReactNode;
  label: string;
  mono?: boolean;
}) {
  return (
    <div className={FIELD_ROW_CLASS}>
      <dt className="text-muted-foreground flex items-baseline gap-2.5 [&>svg]:size-4 [&>svg]:shrink-0 [&>svg]:self-center">
        {icon}
        {label}
      </dt>
      <dd
        className={cn(
          "[&_a]:hit-area min-w-0 wrap-anywhere [&_a]:relative",
          (mono ?? isData({ children, label })) && "text-compact font-mono tabular-nums",
        )}
      >
        {children}
      </dd>
    </div>
  );
}

export function DetailFieldsSkeleton({ rows }: { rows: number }) {
  return (
    <div className="@container divide-y">
      {Array.from({ length: rows }, (_, index) => (
        <div className={FIELD_ROW_CLASS} key={index}>
          <span className="flex h-5 items-center">
            <Skeleton className="h-3.5 w-20" />
          </span>
          <span className="flex h-5 items-center">
            <Skeleton className="h-3.5 w-40 max-w-full" />
          </span>
        </div>
      ))}
    </div>
  );
}
