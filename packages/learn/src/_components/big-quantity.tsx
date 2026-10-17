import { cn } from "@zoonk/ui/lib/utils";
import { splitQuantity } from "../_utils/quantity-parts";

/**
 * A headline quantity ("~2 h", "1 h 30 min", "~16"): its numbers large in the mono face, its
 * units half their size in the text face, close beside them. The one way every big number with a
 * unit is drawn, so none shows a digit-wide gap before its unit. Size it with `className`.
 */
export function BigQuantity({ children, className }: { children: string; className?: string }) {
  return (
    <span
      className={cn(
        "font-mono leading-none font-medium tracking-[-0.04em] tabular-nums",
        className,
      )}
      data-slot="big-quantity"
    >
      {splitQuantity(children).map((part, index) =>
        part.numeric ? (
          part.text
        ) : (
          // oxlint-disable-next-line react/no-array-index-key -- the parts are fixed for this text
          <span className="font-sans text-[0.5em] font-semibold tracking-[-0.01em]" key={index}>
            {part.text}
          </span>
        ),
      )}
    </span>
  );
}
