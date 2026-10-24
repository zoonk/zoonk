import { cn } from "@zoonk/ui/lib/utils";

/**
 * What a question is read with (the picture it asks about, its situation, chart or data table),
 * right above it in the column on every screen size: it's part of the question, read first, never
 * set apart where it could be missed. A screen without any draws nothing here.
 */
export function ScreenSupport({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn("flex flex-col gap-3 empty:hidden lg:gap-4", className)}
      data-slot="lesson-screen-support"
    >
      {children}
    </div>
  );
}
