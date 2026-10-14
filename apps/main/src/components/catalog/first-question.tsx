import { StartLink, getSecondaryStartControlClassName } from "@/components/public/public-start";
import { withCatalogOrigin } from "@/lib/public/public-hrefs";
import { type PublicLibraryLesson } from "@zoonk/core/library/lessons/public";
import { RichTextBlocks } from "@zoonk/learn/rich-text";
import { LineMarker } from "@zoonk/ui/components/line-marker";
import { cn } from "@zoonk/ui/lib/utils";
import { ArrowRightIcon, CirclePlayIcon, SparklesIcon } from "lucide-react";
import { getExtracted } from "next-intl/server";
import { type ReactNode } from "react";
import { LessonProgressSwitch } from "./course-progress";
import { FirstScreenChoices } from "./first-screen-choices";

/** A lesson's first screen when it's a question. */
export type FirstChoiceScreen = Extract<
  NonNullable<PublicLibraryLesson["firstScreen"]>,
  { kind: "choice" }
>;

/** The quiet line under a lesson's way in: what it takes to start. */
export function StartNote({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p
      className={cn(
        "text-muted-foreground mt-5 flex gap-2 text-[13px] leading-snug sm:text-sm",
        className,
      )}
    >
      <LineMarker>
        <CirclePlayIcon aria-hidden="true" className="size-4" />
      </LineMarker>
      <span className="text-pretty">{children}</span>
    </p>
  );
}

type FirstQuestionProps = {
  lessonId: string;
  minutes: number;
  origin: string;
  playerPath: string;
  questionId: string;
  screen: FirstChoiceScreen;
};

/**
 * A lesson's first question, answerable right where it's shown: "Guess first. It doesn't count."
 * (or "Quick question"), its context, the question and its options, any of which opens the
 * player with that answer, and what that starts. The lesson's page shows it as its first screen,
 * and the course's and the chapter's as "Try a lesson". `questionId` names the options' group, so
 * it's unique on its page; `origin` is that page, which closing the lesson returns to.
 */
async function QuestionScreen({
  lessonId,
  minutes,
  origin,
  playerPath,
  questionId,
  screen,
}: FirstQuestionProps) {
  const t = await getExtracted();

  return (
    <>
      <p className="text-muted-foreground flex items-center gap-1.5 text-[13px] font-medium">
        <SparklesIcon aria-hidden="true" className="size-3.5 flex-none" />
        {screen.guess ? t("Guess first. It doesn't count.") : t("Quick question")}
      </p>

      {screen.context && (
        <RichTextBlocks
          className="text-muted-foreground mt-3 text-[15px] leading-relaxed sm:text-base"
          text={screen.context}
        />
      )}

      <div
        className="mt-2 mb-5 text-[19px] leading-snug font-[560] tracking-[-0.015em] text-balance"
        id={questionId}
      >
        <RichTextBlocks text={screen.question} />
      </div>

      <FirstScreenChoices
        action={playerPath}
        lessonId={lessonId}
        options={screen.options}
        origin={origin}
        questionId={questionId}
      />

      <StartNote>
        {screen.guess
          ? t("Your answer starts the {minutes}-minute lesson. No sign-up needed.", {
              minutes: String(minutes),
            })
          : t(
              "Your choice opens the {minutes}-minute lesson. Check your answer there. No sign-up needed.",
              { minutes: String(minutes) },
            )}
      </StartNote>
    </>
  );
}

/**
 * A lesson the learner left partway: its way back in, where the question would be, since the
 * player picks up after the screens they answered and the question would only lead there anyway.
 * `secondary` keeps it beside the page's own main action (a course's "Build my plan").
 */
async function ContinueLesson({ href, secondary }: { href: string; secondary: boolean }) {
  const t = await getExtracted();
  const label = t("Continue the lesson");

  return (
    <>
      <p className="text-muted-foreground mb-5 text-[15px] leading-relaxed text-pretty sm:text-base">
        {t("You've started this lesson. It picks up where you left off.")}
      </p>

      {secondary ? (
        <a
          className={cn(getSecondaryStartControlClassName(), "sm:w-auto sm:self-start")}
          href={href}
        >
          {label}
          <ArrowRightIcon aria-hidden="true" data-icon="inline-end" />
        </a>
      ) : (
        <StartLink className="w-full sm:w-auto sm:self-start" href={href}>
          {label}
        </StartLink>
      )}
    </>
  );
}

/**
 * A lesson's first question, or, for a learner partway through the lesson (a guest who tried it
 * and closed it), "Continue the lesson" in its place. The page is the same for everyone, so the
 * browser asks once it shows (`CourseProgressScope` names the lesson); until then, and for everyone
 * else, the question.
 */
export function FirstQuestion({
  secondary = false,
  ...props
}: FirstQuestionProps & { secondary?: boolean }) {
  return (
    <LessonProgressSwitch
      continueLesson={
        <ContinueLesson
          href={withCatalogOrigin(props.playerPath, props.origin)}
          secondary={secondary}
        />
      }
      question={<QuestionScreen {...props} />}
    />
  );
}
