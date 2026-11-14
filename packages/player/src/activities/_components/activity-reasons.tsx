import { cn } from "@zoonk/ui/lib/utils";
import { LessonRichText } from "../../lesson/_components/lesson-rich-text";
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
