import { Skeleton } from "@zoonk/ui/components/skeleton";
import { cn } from "@zoonk/ui/lib/utils";

function MediaPending({
  children,
  className,
  icon,
  scrollable = false,
  ...props
}: React.ComponentProps<"div"> & { icon: React.ReactNode; scrollable?: boolean }) {
  return (
    <div
      className={cn(
        "text-muted-foreground relative flex items-center justify-center overflow-hidden rounded-xl",
        className,
      )}
      data-slot="media-pending"
      {...props}
    >
      <Skeleton aria-hidden="true" className="bg-muted/60 absolute inset-0" />
      <div
        className={cn(
          "relative flex flex-col items-center gap-2 p-4 text-center text-sm",
          scrollable && "max-h-full overflow-y-auto",
        )}
        // oxlint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- Overflowing descriptions need a keyboard scroll target.
        tabIndex={scrollable ? 0 : undefined}
      >
        {icon}
        {children}
      </div>
    </div>
  );
}

export { MediaPending };
