import { cn } from "@zoonk/ui/lib/utils";

const TONES = {
  destructive: "bg-destructive/10 text-destructive-text",
  warning: "bg-warning/10 text-warning-text",
} as const;

/**
 * The one thing about a record that staff must see before anything else: it's out of play, banned,
 * or built on something that changed. One per page, under the header.
 */
export function AdminNotice({
  children,
  title,
  tone = "warning",
}: {
  children?: React.ReactNode;
  title: React.ReactNode;
  tone?: keyof typeof TONES;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-1 rounded-xl px-4 py-3 text-sm [&_a]:font-medium [&_a]:underline [&_a]:underline-offset-3",
        TONES[tone],
      )}
      role="status"
    >
      <p className="font-medium">{title}</p>
      {children ? <div className="text-foreground">{children}</div> : null}
    </div>
  );
}
