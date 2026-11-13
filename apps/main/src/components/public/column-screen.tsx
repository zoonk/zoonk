import { TaskBody } from "@zoonk/learn/task-layout";
import { cn } from "@zoonk/ui/lib/utils";
import { PublicTopBar } from "./public-top-bar";

/** A page with only the top bar and a task's column: a sign-in gate, the CLI's login, an email's link. */
export function ColumnScreen({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className="flex min-h-dvh flex-col">
      <PublicTopBar actions={null} />
      <main className="flex flex-1 flex-col">
        <TaskBody className={cn("py-12 sm:py-16", className)}>{children}</TaskBody>
      </main>
    </div>
  );
}
