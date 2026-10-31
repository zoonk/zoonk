import { cn } from "@zoonk/ui/lib/utils";
import * as React from "react";

function Message({
  className,
  align = "start",
  ...props
}: React.ComponentProps<"div"> & { align?: "start" | "end" }) {
  return (
    <div
      data-slot="message"
      data-align={align}
      className={cn(
        "group/message relative flex w-full min-w-0 gap-2 text-sm data-[align=end]:flex-row-reverse",
        className,
      )}
      {...props}
    />
  );
}

function MessageContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="message-content"
      className={cn(
        "flex w-full min-w-0 flex-col gap-2.5 wrap-break-word group-data-[align=end]/message:*:data-slot:self-end",
        className,
      )}
      {...props}
    />
  );
}

function MessageHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="message-header"
      className={cn(
        "text-muted-foreground flex max-w-full min-w-0 items-center px-3.5 text-xs font-medium group-has-data-[variant=ghost]/message:px-0",
        className,
      )}
      {...props}
    />
  );
}

function LearnerBubble({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="learner-bubble"
      className={cn(
        "bg-muted text-foreground w-fit max-w-[80%] min-w-0 self-end rounded-[0.75rem_0.75rem_0.25rem_0.75rem] px-3 py-2 text-[0.9375rem] leading-normal wrap-break-word whitespace-pre-wrap",
        className,
      )}
      {...props}
    />
  );
}

export { LearnerBubble, Message, MessageContent, MessageHeader };
