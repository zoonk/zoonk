import { cn } from "@zoonk/ui/lib/utils";

/**
 * A section of the language screens: a soft card in Focus and glass in Fun, so the same parts sit
 * on both surfaces without a second layout.
 */
export function LanguageCard({ className, ...props }: React.ComponentProps<"section">) {
  return (
    <section
      className={cn(
        "bg-card flex flex-col gap-3 rounded-3xl border p-4 shadow-sm sm:p-5",
        "in-data-[mode=fun]:fun-glass",
        className,
      )}
      data-slot="language-card"
      {...props}
    />
  );
}

/** A card's title: plain and semibold in Focus, the display face in Fun. */
export function LanguageCardTitle({ children, className, ...props }: React.ComponentProps<"h2">) {
  return (
    <h2
      className={cn(
        "font-semibold",
        "in-data-[mode=fun]:font-fun-display in-data-[mode=fun]:font-bold",
        className,
      )}
      data-slot="language-card-title"
      {...props}
    >
      {children}
    </h2>
  );
}
