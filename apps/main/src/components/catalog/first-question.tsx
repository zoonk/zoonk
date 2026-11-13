import { NoSessionNote } from "@/components/public/no-account-note";
import { DISCLOSURE_ANSWER_CLASS } from "@/components/public/public-disclosure";
import { StartLink, getSecondaryStartControlClassName } from "@/components/public/public-start";
import { getAppLocale } from "@/i18n/locale";
import { withOrigin } from "@/lib/public/public-hrefs";
import { type PublicLibraryLesson } from "@zoonk/core/library/lessons/public";
import { Eyebrow } from "@zoonk/learn/eyebrow";
import { QuestionTitle } from "@zoonk/learn/question-title";
import { RichTextBlocks } from "@zoonk/learn/rich-text";
import { LineMarker } from "@zoonk/ui/components/line-marker";
import { cn } from "@zoonk/ui/lib/utils";
import { getSentenceSpace } from "@zoonk/utils/locale";
import { CirclePlayIcon, SparklesIcon } from "lucide-react";
import { getExtracted } from "next-intl/server";
import { type ReactNode } from "react";
import { LessonProgressSwitch } from "./course-progress";
import { FirstScreenChoices } from "./first-screen-choices";

export type FirstChoiceScreen = Extract<
  NonNullable<PublicLibraryLesson["firstScreen"]>,
  { kind: "choice" }
>;

function StartNote({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p
      className={cn(
        "text-muted-foreground text-compact mt-5 flex gap-3 leading-snug sm:text-sm",
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
  screen: FirstChoiceScreen;
};

/** Inside "Try a lesson" the card's own chip says what this is and how long the lesson takes. */
async function QuestionScreen({
  lessonId,
  minutes,
  origin,
  playerPath,
  screen,
  timed,
}: FirstQuestionProps & { timed: boolean }) {
  const t = await getExtracted();
  const space = getSentenceSpace(await getAppLocale());

  return (
    <>
      {timed && (
        <Eyebrow icon={<SparklesIcon aria-hidden="true" />}>
          {screen.guess
            ? t({
                description:
                  "Chip above the lesson's opening question, which the learner answers before being taught. Guesses are never scored.",
                message: "Just a guess, it doesn't count",
              })
            : t("Quick question")}
        </Eyebrow>
      )}

      {screen.context && (
        <RichTextBlocks
          className="text-muted-foreground text-reading mt-3 leading-relaxed sm:text-base"
          text={screen.context}
        />
      )}

      <QuestionTitle className="mt-2 mb-4" heading={false} text={screen.question} />

      <FirstScreenChoices
        action={playerPath}
        lessonId={lessonId}
        options={screen.options}
        origin={origin}
        question={screen.question}
      />

      <StartNote>
        {timed
          ? t("Your answer starts the {minutes}-minute lesson.", { minutes: String(minutes) })
          : t("Your answer starts the lesson.")}
        {space}
        <NoSessionNote>{t("No sign-up needed.")}</NoSessionNote>
      </StartNote>
    </>
  );
}

async function ContinueLesson({ href, secondary }: { href: string; secondary: boolean }) {
  const t = await getExtracted();
  const label = t("Continue the lesson");

  return (
    <>
      <p className={cn(DISCLOSURE_ANSWER_CLASS, "mb-5")}>
        {t("You've started this lesson. It picks up where you left off.")}
      </p>

      {secondary ? (
        <a
          className={cn(getSecondaryStartControlClassName(), "sm:w-auto sm:self-start")}
          href={href}
        >
          {label}
        </a>
      ) : (
        <StartLink className="w-full sm:w-auto sm:self-start" href={href}>
          {label}
        </StartLink>
      )}
    </>
  );
}

export function FirstQuestion({
  secondary = false,
  ...props
}: FirstQuestionProps & { secondary?: boolean }) {
  return (
    <LessonProgressSwitch
      continueLesson={
        <ContinueLesson href={withOrigin(props.playerPath, props.origin)} secondary={secondary} />
      }
      question={<QuestionScreen {...props} timed={!secondary} />}
    />
  );
}
