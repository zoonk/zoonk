import { cn } from "@zoonk/ui/lib/utils";
import { type ReactNode } from "react";

/**
 * A phone outline that holds a product screen drawn in HTML and CSS. It's never shorter than a
 * phone screen and grows with its content, so a screen in a longer language is never cut.
 * `isCropped` lets the frame's bottom run past the edge of a container that clips it, so the
 * phone looks like it continues below; the screen keeps enough empty space at its end that the
 * crop never reaches the content.
 */
export function PhoneFrame({
  children,
  className,
  isCropped = false,
}: {
  children: ReactNode;
  className?: string;
  isCropped?: boolean;
}) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "relative min-h-[560px] w-[300px] flex-none overflow-hidden rounded-[46px] border-[9px] border-neutral-900 shadow-[0_30px_60px_-24px_rgb(0_0_0/0.45)] sm:min-h-[600px] sm:w-[320px] dark:border-neutral-700",
        isCropped && "-mb-24",
        className,
      )}
    >
      <div className="absolute top-2.5 left-1/2 z-10 h-6 w-24 -translate-x-1/2 rounded-full bg-neutral-900 dark:bg-neutral-700" />
      <div className={cn("pt-11", isCropped ? "pb-32" : "pb-8")}>{children}</div>
    </div>
  );
}
