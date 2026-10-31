import { cn } from "@zoonk/ui/lib/utils";
import { type ReactNode } from "react";

export function StatusMessage({
  children,
  className,
  description,
  icon,
  title,
}: {
  children: ReactNode;
  className?: string;
  description: string;
  icon: ReactNode;
  title: string;
}) {
  return (
    <div
      className={cn(
        "mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center px-5 py-16 text-center",
        className,
      )}
    >
      <span className="text-muted-foreground flex [&_svg]:size-8">{icon}</span>

      <h1 className="text-title mt-5">{title}</h1>

      <p className="text-lead mt-3">{description}</p>

      <div className="mt-8 flex flex-col items-center gap-2">{children}</div>
    </div>
  );
}
