import "server-only";
import { getLessonSeoSource } from "@/data/lessons/get-lesson-seo-source";
import { getLessonPageMeta } from "@/lib/lessons";
import { type CatalogLesson } from "@zoonk/core/lessons/get-by-slug";
import { cn } from "@zoonk/ui/lib/utils";

/**
 * Groups the lesson name and description as the primary page context without
 * adding a card or decorative container around the unavailable state.
 */
function LessonSummary({ children, className, ...props }: React.ComponentProps<"header">) {
  return (
    <header
      className={cn("flex w-full max-w-sm flex-col items-start gap-2 text-left", className)}
      data-slot="lesson-summary"
      {...props}
    >
      {children}
    </header>
  );
}

/**
 * Gives unavailable lesson pages one semantic page heading so people and
 * crawlers encounter the lesson topic before the access or generation action.
 */
function LessonSummaryTitle({ children, className, ...props }: React.ComponentProps<"h1">) {
  return (
    <h1
      className={cn("text-xl leading-tight font-semibold tracking-tight text-pretty", className)}
      data-slot="lesson-summary-title"
      {...props}
    >
      {children}
    </h1>
  );
}

/**
 * Keeps authored or derived lesson details visually quieter than the title
 * while remaining readable enough to explain what the lesson will teach.
 */
function LessonSummaryDescription({ children, className, ...props }: React.ComponentProps<"p">) {
  return (
    <p
      className={cn("text-muted-foreground text-sm/relaxed text-pretty", className)}
      data-slot="lesson-summary-description"
      {...props}
    >
      {children}
    </p>
  );
}

/**
 * Separates a temporary availability message from the durable lesson
 * description, so the page explains the current action without muddying SEO
 * copy or turning the state into a second prominent heading.
 */
export function LessonSummaryStatus({ children, className, ...props }: React.ComponentProps<"p">) {
  return (
    <p
      className={cn(
        "text-muted-foreground w-full max-w-sm text-left text-sm/relaxed text-pretty",
        className,
      )}
      data-slot="lesson-summary-status"
      {...props}
    >
      {children}
    </p>
  );
}

/**
 * Loads source-aware lesson copy only for unavailable states, keeping normal
 * player routes free of the extra companion lookup while giving every blocked
 * page the same semantic summary.
 */
export async function LessonPageSummary({ lesson }: { lesson: CatalogLesson }) {
  const sourceLesson = await getLessonSeoSource(lesson);
  const sourceTitle = sourceLesson?.title?.trim() || null;
  const lessonMeta = await getLessonPageMeta({ lesson, sourceTitle });

  return (
    <LessonSummary>
      <LessonSummaryTitle>{lessonMeta.title}</LessonSummaryTitle>
      <LessonSummaryDescription>{lessonMeta.description}</LessonSummaryDescription>
    </LessonSummary>
  );
}
