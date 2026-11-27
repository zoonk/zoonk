import { cn } from "@zoonk/ui/lib/utils";
import { ListGroup } from "../../_components/list-group";
import { PageSectionTitle } from "../../_components/page";

export function ResultRows({ className, ...props }: React.ComponentProps<"ul">) {
  return (
    <ListGroup
      as="ul"
      className={cn("w-full text-left", className)}

      {...props}
    />
  );
}

export function ResultRow({ className, ...props }: React.ComponentProps<"li">) {
  return (
    <li
      className={cn("flex min-h-11 items-center justify-between gap-3 py-2.5 text-sm", className)}
      data-slot="result-row"
      {...props}
    />
  );
}

export function ResultGroup({
  children,
  id,
  label,
}: {
  children: React.ReactNode;
  id: string;
  label: string;
}) {
  return (
    <section aria-labelledby={id} className="flex w-full flex-col gap-1 text-left">
      <PageSectionTitle id={id}>{label}</PageSectionTitle>
      {children}
    </section>
  );
}

export function EstimateNote({ children }: { children: React.ReactNode }) {
  return <p className="text-muted-foreground text-compact leading-snug">{children}</p>;
}
