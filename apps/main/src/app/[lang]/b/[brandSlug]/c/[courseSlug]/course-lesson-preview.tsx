import { ANSWER_OPTION_CLASS, AnswerOptionContent } from "@/components/public/answer-option";
import { PhoneFrame } from "@/components/public/phone-frame";
import { type SampleLesson } from "@/lib/public/sample-lesson";
import { EllipsisIcon, SparklesIcon, XIcon } from "lucide-react";
import { getExtracted } from "next-intl/server";

/**
 * A lesson from this course as it opens in the app, drawn in HTML and CSS: its first question with
 * the answers to pick from. The phone is a picture of the product, so it's hidden from assistive
 * tech; the lesson itself is one tap away on its own page.
 */
export async function CourseLessonPreview({ lesson }: { lesson: SampleLesson }) {
  const t = await getExtracted();
  const screen = lesson.firstScreen;

  return (
    <PhoneFrame className="bg-background" isCropped>
      <div className="flex items-center justify-between gap-2 border-b px-3 pb-2">
        <span className="flex size-9 flex-none items-center justify-center">
          <XIcon className="size-5" />
        </span>
        <p className="min-w-0 text-center text-[13px] leading-tight font-medium text-balance">
          {lesson.title}
        </p>
        <span className="flex size-9 flex-none items-center justify-center">
          <EllipsisIcon className="size-5" />
        </span>
      </div>

      <div className="bg-muted h-1">
        <div className="bg-primary h-full w-[12%]" />
      </div>

      <div className="px-5 pt-6">
        <p className="bg-muted text-muted-foreground inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium">
          <SparklesIcon className="size-3.5 flex-none" />
          {screen.guess ? t("Guess first. It doesn't count.") : t("Quick question")}
        </p>

        <p className="mt-4 text-lg leading-snug font-semibold tracking-[-0.01em] text-pretty">
          {screen.question}
        </p>

        <div className="mt-5 flex flex-col gap-2">
          {screen.options.map((option, index) => (
            <div className={ANSWER_OPTION_CLASS} key={option.id}>
              <AnswerOptionContent number={index + 1} text={option.text} />
            </div>
          ))}
        </div>
      </div>
    </PhoneFrame>
  );
}
