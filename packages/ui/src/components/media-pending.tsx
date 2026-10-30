import { Skeleton } from "@zoonk/ui/components/skeleton";
import { cn } from "@zoonk/ui/lib/utils";

function MediaPending({
  children,
  className,
  icon,
  ...props
}: React.ComponentProps<"div"> & { icon: React.ReactNode }) {
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
      <div className="relative flex flex-col items-center gap-2 p-4 text-center text-sm">
        {icon}
        {children}
      </div>
    </div>
  );
}

export { MediaPending };
