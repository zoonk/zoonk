import { FLOATING_CARD_CLASS } from "@/components/public/landing-styles";
import { PUBLIC_START_ID } from "@/components/public/public-ids";
import { StartBlock, StartLink } from "@/components/public/public-start";
import { StartLessonButton } from "@/components/public/start-lesson-button";
import { type PublicLibraryLesson } from "@zoonk/core/library/lessons/public";
import { LineMarker } from "@zoonk/ui/components/line-marker";
import { cn } from "@zoonk/ui/lib/utils";
import { CirclePlayIcon, SparklesIcon } from "lucide-react";
import { getExtracted } from "next-intl/server";
import { type ReactNode } from "react";
import { FirstScreenChoices } from "./first-screen-choices";

const QUESTION_ID = "lesson-first-question";

type FirstScreen = NonNullable<PublicLibraryLesson["firstScreen"]>;

function FirstScreenFrame({ children }: { children: ReactNode }) {
  return (
    <section className={cn(FLOATING_CARD_CLASS, "mt-8 sm:mt-10")} id={PUBLIC_START_ID}>
      {children}
    </section>
  );
}

function StartNote({ children }: { children: ReactNode }) {
  return (
    <p className="text-muted-foreground mt-5 flex gap-2 text-[13px] leading-snug sm:text-sm">
      <LineMarker>
        <CirclePlayIcon aria-hidden="true" className="size-4" />
      </LineMarker>
      <span className="text-pretty">{children}</span>
    </p>
  );
}

async function ChoiceScreen({
  lessonId,
  minutes,
  playerPath,
  screen,
}: {
  lessonId: string;
  minutes: number;
  playerPath: string;
  screen: Extract<FirstScreen, { kind: "choice" }>;
}) {
  const t = await getExtracted();

  return (
    <FirstScreenFrame>
      <p className="bg-muted text-muted-foreground inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium">
        <SparklesIcon aria-hidden="true" className="size-3.5 flex-none" />
        {screen.guess ? t("Guess first. It doesn't count.") : t("Quick question")}
      </p>

      {screen.context && (
        <p className="text-muted-foreground mt-4 text-[15px] leading-relaxed sm:text-base">
          {screen.context}
        </p>
      )}

      <p
        className="mt-3 mb-5 text-xl leading-snug font-semibold tracking-[-0.015em] text-balance sm:mt-4 sm:mb-6 sm:text-2xl"
        id={QUESTION_ID}
      >
        {screen.question}
      </p>

      <FirstScreenChoices
        action={playerPath}
        lessonId={lessonId}
        options={screen.options}
        questionId={QUESTION_ID}
      />

      <StartNote>
        {t("Your answer starts the {minutes}-minute lesson. No sign-up needed.", {
          minutes: String(minutes),
        })}
      </StartNote>
    </FirstScreenFrame>
  );
}

/**
 * The lesson's first screen, live on the public page as its only next step.
 * A question takes any answer to open the player and a text opener gets a
 * start button under it. Any other first screen gets the start button alone,
 * and a lesson that isn't written yet starts with one tap, which opens it
 * while it's written.
 */
export async function FirstScreenCard({
  lessonId,
  minutes,
  playerPath,
  screen,
}: {
  lessonId: string;
  minutes: number;
  playerPath: string;
  screen: PublicLibraryLesson["firstScreen"];
}) {
  const t = await getExtracted();

  if (screen?.kind === "choice") {
    return (
      <ChoiceScreen lessonId={lessonId} minutes={minutes} playerPath={playerPath} screen={screen} />
    );
  }

  if (screen?.kind === "text") {
    return (
      <FirstScreenFrame>
        <p className="mb-6 text-lg leading-relaxed text-pretty sm:text-xl">{screen.text}</p>

        <StartLink className="w-full sm:w-auto" href={playerPath}>
          {t("Start the lesson")}
        </StartLink>

        <StartNote>
          {t("{minutes, plural, one {# minute} other {# minutes}}. No sign-up needed.", {
            minutes,
          })}
        </StartNote>
      </FirstScreenFrame>
    );
  }

  const note = t("{minutes, plural, one {# minute} other {# minutes}}. No sign-up needed.", {
    minutes,
  });

  if (screen) {
    return (
      <StartBlock note={note}>
        <StartLink href={playerPath}>{t("Start the lesson")}</StartLink>
      </StartBlock>
    );
  }

  return (
    <StartBlock note={note}>
      <StartLessonButton action={playerPath} lessonId={lessonId}>
        {t("Start this lesson")}
      </StartLessonButton>
    </StartBlock>
  );
}
