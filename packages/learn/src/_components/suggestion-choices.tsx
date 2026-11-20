import { cn } from "@zoonk/ui/lib/utils";

/** Equal picks: one under the other in their order, none drawn as the main answer. */
export function SuggestionChoices({ className, ...props }: React.ComponentProps<"form">) {
  return (
    <form
      className={cn("flex flex-col gap-2 pt-1", className)}
      data-slot="suggestion-choices"
      {...props}
    />
  );
}
