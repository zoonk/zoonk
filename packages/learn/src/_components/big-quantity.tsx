import { cn } from "@zoonk/ui/lib/utils";
import { splitQuantity } from "../_utils/quantity-parts";

/**
 * A readout ("~2 h", "1 h 30 min", "~16"): its numbers large in the text face with tabular figures
 * (`text-readout`), its units under half their size in the muted step, close beside them, so the
 * number leads. The one way every big number with a unit is drawn. Size it with `className`.
 */
export function BigQuantity({ children, className }: { children: string; className?: string }) {
  return (
    <span className={cn("text-readout", className)} data-slot="big-quantity">
      {splitQuantity(children).map((part, index) =>
        part.numeric ? (
          part.text
        ) : (
          <span
            className="text-muted-foreground text-[0.45em] font-medium tracking-[-0.01em]"
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
