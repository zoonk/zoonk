import { TaskBody } from "@zoonk/learn/task-layout";
import { cn } from "@zoonk/ui/lib/utils";
import { PublicTopBar } from "./public-top-bar";

/**
 * A page with only the top bar and a task's column: a sign-in gate, the CLI's login, an email's
 * link. `width="message"` is for a page that is a title and a button: from tablet width its column
 * is as narrow as the message, so it sits on the page's center line, not at the start of a wide
 * column.
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
        <TaskBody className={cn("py-12 sm:py-16", width === "message" && "sm:max-w-md", className)}>
          {children}
        </TaskBody>
      </main>
    </div>
  );
}
