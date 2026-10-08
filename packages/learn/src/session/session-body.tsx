import { cn } from "@zoonk/ui/lib/utils";

/**
 * A full-screen session step's content: one centered column under its header (or at the top when
 * it has none), clear of the phone's home bar. The session, its summary and mistakes practice share
 * it, so every step sits in the same place.
 */
export function SessionBody({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "mx-auto flex w-full max-w-150 flex-1 flex-col gap-5 px-4 pt-4 pb-[max(1.5rem,env(safe-area-inset-bottom))]",
        className,
      )}
      data-slot="session-body"
      {...props}
    />
  );
}
