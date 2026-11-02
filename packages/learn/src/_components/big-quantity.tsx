import { cn } from "@zoonk/ui/lib/utils";
import { splitQuantity } from "../_utils/quantity-parts";

export function BigQuantity({ children, className }: { children: string; className?: string }) {
  return (
    <span className={cn("text-readout font-sans", className)} data-slot="big-quantity">
      {splitQuantity(children).map((part, index) =>
        part.numeric ? (
          part.text
        ) : (
          <span
            className="text-muted-foreground text-[max(0.45em,0.8125rem)] font-medium tracking-[-0.01em]"
            // oxlint-disable-next-line react/no-array-index-key -- the parts are fixed for this text
            key={index}
          >
            {part.text}
          </span>
        ),
      )}
    </span>
  );
}
