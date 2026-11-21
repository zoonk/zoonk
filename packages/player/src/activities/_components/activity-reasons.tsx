import { LessonRichText } from "@zoonk/learn/rich-text/lesson";
import { cn } from "@zoonk/ui/lib/utils";
import { ACTIVITY_CARD_CLASS } from "./activity-canvas";

export function ActivityReasons({ children }: { children: React.ReactNode }) {
  return <ul className="flex flex-col gap-2">{children}</ul>;
}

export function ActivityReason({
  children,
  why,
}: {
  children: React.ReactNode;
  why: string | null;
}) {
  return (
    <li className={cn(ACTIVITY_CARD_CLASS, "text-sm leading-snug")}>
      <p>{children}</p>
      {why && (
        <p className="text-muted-foreground mt-0.5">
          <LessonRichText text={why} />
        </p>
      )}
    </li>
  );
}
