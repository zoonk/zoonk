import { cn } from "@zoonk/ui/lib/utils";
import { LessonRichText, LessonRichTextBlocks } from "./lesson-rich-text";

/** The question or prompt of a screen: the one line the learner answers. */
export function LessonQuestion({ children, id }: { children: string; id?: string }) {
  return (
    <h2
      className="text-foreground text-xl leading-snug font-semibold tracking-tight text-balance sm:text-2xl"
      id={id}
    >
      <LessonRichText text={children} />
    </h2>
  );
}

/** The situation before a question, read before answering. */
export function LessonContext({ children }: { children?: string }) {
  if (!children) {
    return null;
  }

  return <LessonRichTextBlocks className="text-lg leading-relaxed sm:text-xl" text={children} />;
}

/** The main reading text of a screen, large and calm. */
export function LessonBody({ children }: { children: string }) {
  return (
    <LessonRichTextBlocks
      className="text-foreground text-lg leading-relaxed sm:text-xl sm:leading-relaxed"
      text={children}
    />
  );
}

/** A small label above a screen's content, such as "Guess first" or "Worked example". */
export function LessonEyebrow({
  children,
  className,
  icon,
}: {
  children: React.ReactNode;
  className?: string;
  icon?: React.ReactNode;
}) {
  return (
    <p
      className={cn(
        "bg-muted text-muted-foreground inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium [&_svg]:size-3.5",
        className,
      )}
    >
      {icon}
      {children}
    </p>
  );
}
