import { cn } from "@zoonk/ui/lib/utils";
import { CheckIcon, XIcon } from "lucide-react";

/** A design system page's header: its name and what it covers. */
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

/** A part of a page, named by a title, with an optional line under it. */
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

/** Rules as a short list, each one sentence. */
export function DocRules({ rules }: { rules: readonly string[] }) {
  return (
    <ul className="max-w-column flex list-disc flex-col gap-1.5 pl-5 text-sm leading-6">
      {rules.map((rule) => (
        <li key={rule}>{renderCode(rule)}</li>
      ))}
    </ul>
  );
}

/** Live components on the page, as learners see them, in this device's mode. */
export function Specimen({ children, className }: React.PropsWithChildren<{ className?: string }>) {
  return (
    <div className={cn("ring-border rounded-xl p-5 ring-1 sm:p-6", className)} data-slot="specimen">
      {children}
    </div>
  );
}

/** What to do and what not, side by side. */
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

/** Text with `code` spans, as the design system's module writes component and token names. */
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
