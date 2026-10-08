import { cn } from "@zoonk/ui/lib/utils";
import { SURFACE_CLASS } from "../_components/surface";

/** A section of the language screens, as a soft card. */
export function LanguageCard({ className, ...props }: React.ComponentProps<"section">) {
  return (
    <section
      className={cn(SURFACE_CLASS, "flex flex-col gap-3 p-4 sm:p-5", className)}
      data-slot="language-card"
      {...props}
    />
  );
}

/** A card's title, plain and semibold. */
export function LanguageCardTitle({ children, className, ...props }: React.ComponentProps<"h2">) {
  return (
    <h2 className={cn("font-semibold", className)} data-slot="language-card-title" {...props}>
      {children}
    </h2>
  );
}
