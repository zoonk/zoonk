import {
  type FirstChoiceScreen,
  FirstQuestion,
  StartNote,
} from "@/components/catalog/first-question";
import { StartBlock, StartLink } from "@/components/public/public-start";
import { StartLessonButton } from "@/components/public/start-lesson-button";
import { withCatalogOrigin } from "@/lib/public/public-hrefs";
import { type PublicLibraryLesson } from "@zoonk/core/library/lessons/public";
import { getExtracted } from "next-intl/server";
import { type ReactNode } from "react";

/** The first screen sits right on the page, as the player shows it, with no panel around it. */
function FirstScreenSection({ children }: { children: ReactNode }) {
  return <section className="mt-8 sm:mt-10">{children}</section>;
}

async function ChoiceScreen({
  lessonId,
  minutes,
  origin,
  playerPath,
  screen,
}: {
  lessonId: string;
  minutes: number;
  origin: string;
  playerPath: string;
  screen: FirstChoiceScreen;
}) {
  return (
    <FirstScreenSection>
      <FirstQuestion
        lessonId={lessonId}
        minutes={minutes}
        origin={origin}
        playerPath={playerPath}
        questionId={`lesson-first-question-${lessonId}`}
        screen={screen}
      />
    </FirstScreenSection>
  );
}

/**
 * The lesson's first screen, live on the public page as its only next step. A question takes any
 * answer to open the player and a text opener gets a start button under it. Any other first screen
 * gets the start button alone, and a lesson that isn't written yet starts with one tap, which
 * opens it while it's written. Each way in carries the lesson's page (`origin`), which closing the
 * lesson returns to.
 */
export async function LessonFirstScreen({
  lessonId,
  minutes,
  origin,
  playerPath,
  screen,
}: {
  lessonId: string;
  minutes: number;
  origin: string;
  playerPath: string;
  screen: PublicLibraryLesson["firstScreen"];
}) {
  const t = await getExtracted();
  const startHref = withCatalogOrigin(playerPath, origin);

  if (screen?.kind === "choice") {
    return (
      <ChoiceScreen
        lessonId={lessonId}
        minutes={minutes}
        origin={origin}
        playerPath={playerPath}
        screen={screen}
      />
    );
  }

  if (screen?.kind === "text") {
    return (
      <FirstScreenSection>
        <p className="mb-6 text-lg leading-relaxed text-pretty sm:text-xl">{screen.text}</p>

        <StartLink className="w-full sm:w-auto" href={startHref}>
          {t("Start the lesson")}
        </StartLink>

        <StartNote>
          {t("{minutes, plural, one {# minute} other {# minutes}}. No sign-up needed.", {
            minutes,
          })}
        </StartNote>
      </FirstScreenSection>
    );
  }

  const note = t("{minutes, plural, one {# minute} other {# minutes}}. No sign-up needed.", {
    minutes,
  });

  if (screen) {
    return (
      <StartBlock note={note}>
        <StartLink href={startHref}>{t("Start the lesson")}</StartLink>
      </StartBlock>
    );
  }

  return (
    <StartBlock note={note}>
      <StartLessonButton action={playerPath} lessonId={lessonId} origin={origin}>
        {t("Start this lesson")}
      </StartLessonButton>
    </StartBlock>
  );
}
