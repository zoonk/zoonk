import { cn } from "@zoonk/ui/lib/utils";

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
