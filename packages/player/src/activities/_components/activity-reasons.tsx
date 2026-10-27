import { LessonRichText } from "../../lesson/_components/lesson-rich-text";

/** What the check found, one card each with its why (a misplaced item, a missed pair, a mistake). */
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
    <li className="bg-background rounded-xl border px-3 py-2.5 text-sm leading-snug">
      <p>{children}</p>
      {why && (
        <p className="text-muted-foreground mt-0.5">
          <LessonRichText text={why} />
        </p>
      )}
    </li>
  );
}
