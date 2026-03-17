import { cn } from "@zoonk/ui/lib/utils";

export function FeedbackScreen({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      aria-live="polite"
      className={cn(
        "animate-in fade-in slide-in-from-bottom-1 mx-auto flex w-full max-w-lg flex-col gap-6 duration-200 ease-out motion-reduce:animate-none",
        className,
      )}
      data-slot="feedback-screen"
      role="status"
      {...props}
    />
  );
}

export function FeedbackMessage({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <p
      className={cn("text-foreground max-w-md text-lg leading-relaxed", className)}
      data-slot="feedback-message"
      {...props}
    />
  );
}
