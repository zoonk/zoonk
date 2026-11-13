import { TaskBody } from "@zoonk/learn/task-layout";
import { cn } from "@zoonk/ui/lib/utils";
import { PublicTopBar } from "./public-top-bar";

/** What a child set to `display: contents` puts back on the column itself. */
export const COLUMN_CONTENT_CLASS = "mx-auto w-full max-w-(--column)";

/**
 * A page with only the top bar and a task's column: a sign-in gate, the CLI's login, an email's
 * link. `width="message"` is for a page that is a title and a button: from tablet width its column
 * is as narrow as the message, so it sits on the page's center line, not at the start of a wide
 * column. A bottom bar in it spans the screen, and its buttons end on the column's edge.
 */
export function ColumnScreen({
  children,
  className,
  width = "column",
}: {
  children: React.ReactNode;
  className?: string;
  width?: "column" | "message";
}) {
  return (
    <div className="flex min-h-dvh flex-col">
      <PublicTopBar actions={null} />
      <main className="flex flex-1 flex-col">
        <TaskBody
          className={cn(
            "max-w-none py-12 [--column:var(--container-column)] [--page-bottom:--spacing(12)] [--page-gutter:--spacing(4)] sm:py-16 sm:[--page-bottom:--spacing(16)]",
            "[&>*:not([data-slot=bottom-bar],.contents)]:mx-auto [&>*:not([data-slot=bottom-bar],.contents)]:w-full [&>*:not([data-slot=bottom-bar],.contents)]:max-w-(--column)",
            "**:data-[slot=bottom-bar-row]:mx-auto **:data-[slot=bottom-bar-row]:max-w-[calc(var(--column)+2*var(--page-gutter))]",
            width === "message" && "sm:[--column:28rem]",
            className,
          )}
        >
          {children}
        </TaskBody>
      </main>
    </div>
  );
}
