import { PUBLIC_CONTAINER_CLASS } from "@/components/public/landing-styles";
import { cn } from "@zoonk/ui/lib/utils";

export function bold(chunks: React.ReactNode) {
  return <b>{chunks}</b>;
}

export function Objection({
  band = false,
  children,
  className,
  id,
  titleId,
}: {
  band?: boolean;
  children: React.ReactNode;
  className?: string;
  id?: string;
  titleId: string;
}) {
  return (
    <section aria-labelledby={titleId} className={cn(band && "bg-ground")} id={id}>
      <div className={cn(PUBLIC_CONTAINER_CLASS, "py-22 lg:py-34", className)}>{children}</div>
    </section>
  );
}

/**
 * A `<q>`, so the quote marks follow the page's language. They hang outside the text's edge where
 * the gutter has room for them.
 */
export function ObjectionQuote({ children, id }: { children: React.ReactNode; id: string }) {
  return (
    <h2
      className="text-[clamp(2.25rem,5.6vw,4.25rem)] leading-[1.02] font-[680] tracking-[-0.048em] text-balance"
      id={id}
    >
      <q className="before:text-faint after:text-faint before:font-[520] before:content-[open-quote] after:font-[520] after:content-[close-quote] sm:before:ml-[-0.4em] sm:in-data-centered:before:ml-0">
        {children}
      </q>
    </h2>
  );
}

export function ObjectionAnswer({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <p
      className={cn(
        "text-muted-foreground [&_b]:text-foreground mt-5 max-w-[33em] text-[1.0625rem] leading-[1.55] tracking-[-0.01em] text-pretty lg:text-[1.21875rem] [&_b]:font-semibold",
        className,
      )}
      {...props}
    />
  );
}
