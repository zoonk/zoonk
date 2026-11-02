import { cn } from "@zoonk/ui/lib/utils";
import { CheckIcon, XIcon } from "lucide-react";

export function DocHeader({ children, title }: React.PropsWithChildren<{ title: string }>) {
  return (
    <header className="max-w-column flex flex-col gap-2 pb-8">
      <h1 className="text-title">{title}</h1>
      <div className="text-muted-foreground text-[0.9375rem] leading-6 text-pretty">
        {typeof children === "string" ? renderCode(children) : children}
      </div>
    </header>
  );
}

export function DocSection({
  children,
  className,
  id,
  intro,
  title,
}: React.PropsWithChildren<{ className?: string; id?: string; intro?: string; title: string }>) {
  return (
    <section className={cn("flex flex-col gap-4 pb-12", className)} id={id}>
      <div className="max-w-column flex flex-col gap-1">
        <h2 className="text-section">{title}</h2>
        {intro && (
          <p className="text-muted-foreground text-sm leading-6 text-pretty">{renderCode(intro)}</p>
        )}
      </div>
      {children}
    </section>
  );
}

export function DocRules({ rules }: { rules: readonly string[] }) {
  return (
    <ul className="max-w-column flex list-disc flex-col gap-1.5 pl-5 text-sm leading-6">
      {rules.map((rule) => (
        <li key={rule}>{renderCode(rule)}</li>
      ))}
    </ul>
  );
}

export function Specimen({ children, className }: React.PropsWithChildren<{ className?: string }>) {
  return (
    <div className={cn("ring-border rounded-xl p-5 ring-1 sm:p-6", className)} data-slot="specimen">
      {children}
    </div>
  );
}

/**
 * Only the dev server runs next-intl's `useExtracted` without its compiler, so a production build
 * shows a note here instead of failing.
 */
export function DevOnlySpecimen({ children }: React.PropsWithChildren) {
  if (process.env.NODE_ENV !== "production") {
    return children;
  }

  return (
    <p className="text-muted-foreground text-sm">
      This specimen&apos;s components speak through next-intl; run the playground with `pnpm dev` to
      see them.
    </p>
  );
}

export function DoDont({ avoid, follow }: { avoid: readonly string[]; follow: readonly string[] }) {
  return (
    <div className="grid gap-4 text-sm leading-6 sm:grid-cols-2">
      <ul className="flex flex-col gap-1.5">
        {follow.map((item) => (
          <li className="flex gap-2" key={item}>
            <CheckIcon aria-hidden="true" className="text-success mt-1 size-4 shrink-0" />
            <span>
              <span className="sr-only">Do: </span>
              {renderCode(item)}
            </span>
          </li>
        ))}
      </ul>
      <ul className="flex flex-col gap-1.5">
        {avoid.map((item) => (
          <li className="flex gap-2" key={item}>
            <XIcon aria-hidden="true" className="text-destructive mt-1 size-4 shrink-0" />
            <span>
              <span className="sr-only">Don&apos;t: </span>
              {renderCode(item)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function renderCode(text: string): React.ReactNode {
  return text.split(/(?<code>`[^`]+`)/u).map((part, index) =>
    part.startsWith("`") ? (
      // oxlint-disable-next-line react/no-array-index-key -- the parts are fixed for this text
      <code className="bg-muted rounded px-1 py-0.5 font-mono text-[0.85em]" key={index}>
        {part.slice(1, -1)}
      </code>
    ) : (
      part
    ),
  );
}
